# 30 more improvement rounds (planned 2026-10-29, after the first 20)

Each round: one small change set, one script or e2e check as proof, one row in docs/rounds.md.
Scripts first (web/scripts/*.mjs), numbers from runs, quiet output, no commits until the gate.
Agents: one phase per agent, at most 3 at once, phases that touch the build run one after another.
Model hint: S = Sonnet (mechanical, scripted), O = Opus (judgement, security, data quality), F = Fable (hard cross-cutting design).

## A. Correctness and data (rounds 21-26)

| # | Round | Proof | Model |
|---|-------|-------|-------|
| 21 | Finish the FAQ regeneration (faq2.py to 116/116, then qa.py r1/r2): at least 14 sourced Q&As per chapter, each with PDF page and paragraph | script: per-article counts, 0 below 14 | O |
| 22 | assemble.py builds faqs.json from data/faqs3.jsonl; UI shows the Source line and groups key vs topic questions; remove the old 865-FAQ set | e2e + counts script | S |
| 23 | Data audit script: every article has abstract, authors, year, issue, categories, covers, passages, vectors; ids unique; related ids resolve; no empty tags | `audit-data.mjs` N checks, 0 FAIL | S |
| 24 | Search quality set: 40 query/expected-article pairs (titles, authors, topics, typos, questions); report hit@1, hit@5 with and without the model; fix scoring regressions | `search-eval.mjs` prints hit@k | O |
| 25 | Advanced search correctness: property-style script over random chip combos (Required/Boost/Expand/Exclude, any/one) vs a brute-force reference | `adv-fuzz.mjs` 0 mismatch | O |
| 26 | Verify the Details "Drag to a filter" chips for issue/year match (they were written blind), citation formatting vs the MDC repo samples, Map links/seed ids for every article | e2e + script | S |

## B. Speed (rounds 27-31)

| # | Round | Proof | Model |
|---|-------|-------|-------|
| 27 | Real-network profile: throttled 4G Lighthouse-style run of home, search, reader, maps (script with playwright CDP); set LCP/TBT budgets | `perf.mjs` table | S |
| 28 | Startup data diet: split articles.json (list fields vs abstracts/summaries), brotli-friendly layout, preload hints for the first screen | budgets before/after | S |
| 29 | Vectors and model: lazy start on first search focus, cache in IndexedDB (consent-aware), progress indicator, fallback to BM25 only | e2e + timing | O |
| 30 | Search worker: move BM25 + fusion off the main thread; typing never drops frames with 116 records and with 1000 (synthetic) | frame-time script | O |
| 31 | Images and fonts: covers as responsive WebP/AVIF with width/height, font subsetting and `font-display`, no layout shift (CLS < 0.02) | `perf.mjs` CLS | S |

## C. Security and dependencies (rounds 32-37)

| # | Round | Proof | Model |
|---|-------|-------|-------|
| 32 | Replace `@xenova/transformers` with `@huggingface/transformers` (current, maintained) to clear the protobufjs/sharp advisories; re-verify the CSP hosts and model loading | `npm audit` before/after, e2e | O |
| 33 | Vite/esbuild upgrade (dev-server advisory), TypeScript-free but lint-clean; pin exact versions | `npm audit` 0 high/critical | S |
| 34 | Dependency policy: `npm ls`, license allow-list script, unused-dependency check, lockfile integrity in CI, Dependabot config | `deps.mjs` verdict | S |
| 35 | Tighten CSP: remove `unsafe-inline` where possible (hashes for the few inline scripts/styles), `form-action`, `base-uri`, `object-src none`; a meta CSP cannot set frame-ancestors, so document the host-level headers for the final UPOU host | e2e no violations | O |
| 36 | Subresource integrity and third parties: Flag Counter behaviour under the referrer policy, jsDelivr wasm pinned/self-hosted option, Hugging Face fallback when blocked | network script | O |
| 37 | Privacy review pass: cookie/consent text vs actual storage keys (script diff of keys set per consent state), retention, DPA RA 10173 wording, operator placeholder list for UPOU | `consent-audit.mjs` | O |

## D. UI/UX intuitiveness (rounds 38-46)

| # | Round | Proof | Model |
|---|-------|-------|-------|
| 38 | First-visit guidance: a 3-step dismissible tour (search, Advanced, Maps, lists) that respects reduced motion and consent for storing its dismissal | e2e | F |
| 39 | Home information scent: clearer section names (books/chapters wording everywhere), consistent "chapter" vs "publication" terminology audit | `terms.mjs` grep verdict | S |
| 40 | Search page: filters as removable chips, sort control (relevance, newest, A-Z), result count announcements for screen readers | e2e + axe | S |
| 41 | Advanced: undo/redo discoverability, keyboard drag alternative (every drag action reachable by keyboard/menu), clearer empty states and the suggestions legend | e2e keyboard flow | S |
| 42 | Reader: sticky section nav, reading progress, previous/next in issue, copy-link and share, print stylesheet | e2e | S |
| 43 | View lists: rename/reorder/export (JSON, BibTeX/RIS of the citations), import, share via URL fragment | e2e | S |
| 44 | Maps: legend, node search, keyboard navigation of nodes, clearer "why connected" tooltips, 3D performance guard (node cap, low-power mode) | e2e + phone | O |
| 45 | Phone-first pass: bottom sheet filters on small screens, thumb-reachable actions, floating elements never overlap (ScrollHint, cookie banner, Advanced button) | `phone.mjs` + overlap probe | S |
| 46 | Error resilience: error boundaries per route, offline message, retry, 404 route with search suggestions | e2e | S |

## E. Aesthetics (rounds 47-50)

| # | Round | Proof | Model |
|---|-------|-------|-------|
| 47 | Visual system audit: spacing/type scale tokens, one card anatomy, consistent icon set (replace ad-hoc inline SVGs with one sprite) | screenshots via local_vision text triage | F |
| 48 | Dark mode (tokens only) with AA contrast verified by axe | `a11y.mjs` both themes | S |
| 49 | Cover generation polish: legibility of titles on covers, motif variety, no repeated look in one row | screenshot triage | O |
| 50 | Final gate 2: verify.mjs, a11y (both themes), phone, perf, deps, consent-audit, search-eval, data audit; one squashed commit, no push | all verdict lines | O |

## Notes
- Rounds 21-22 are the biggest correctness gap: the shipped FAQs are the old set and carry no page references.
- Round 32 is the biggest dependency risk: the 7 remaining `npm audit` findings (esbuild via Vite 6 for the dev server only; protobufjs and sharp via @xenova/transformers).
- Things only a human can sign off: UPOU/journal editors' approval, the operator name and DPO contact in the privacy notice, the final domain (SITE_URL), real-device checks (touch, real GPU for 3D).
- Order: A before B (data first), C can run in parallel with D only when they do not both rebuild; E last.
