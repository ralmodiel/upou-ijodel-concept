# 50 more improvement rounds (planned 2026-10-30, rounds 51-100, after plan30 finishes)

Same working rules as plan30: one small change set per round, one script or e2e check as proof, one row in docs/rounds.md, numbers from script runs, quiet output, no commits until a gate.
Agents: one phase per agent (about 5 rounds), builds run one after another, at most 3 agents at once. Model: S = Sonnet (mechanical, scripted), O = Opus (judgement, security, data), F = Fable (hard design).
Goal: a high-quality app UPOU could run. Each section ends with a gate (verify, a11y, phone, perf, e2e).

## A. Content trust and data quality (51-60)
| # | Round | Proof | Model |
|---|-------|-------|-------|
| 51 | Resolve the 27 year/issue-label mismatches and the duplicate author spellings (O'maitarya): one canonical source, alias map for authors | audit-data.mjs 0 notes | O |
| 52 | FAQ quality pass: re-check answers scoring under 0.6, drop or regenerate; LLM-judge every Q&A against its cited passage; sample 100 by hand-checkable script output | faq-audit.mjs support rate >= 95% | O |
| 53 | Summaries audit: each AI summary vs abstract (length, no invented numbers: every number in a summary appears in the source) | summary-audit.mjs 0 FAIL | S |
| 54 | Related-reading "why" notes audit: both articles share what the note claims | related-audit.mjs | S |
| 55 | Search eval v2: 100 queries incl. vector half, typos, questions in Filipino/English, "did you mean" cases (fix "chatgtp teaching") | search-eval hit@1 >= 0.93, hit@5 >= 0.98 | O |
| 56 | Query understanding: phrases in quotes, minus words, author:/year: operators, shown as chips | e2e + eval | S |
| 57 | Passage highlighting: exact in-page highlight of the best passage in the reader, jump-to-passage from results | e2e | S |
| 58 | Citation exports: BibTeX, RIS, APA/MLA/Chicago toggle (with a fixed initials/full-name rule per style), copy all for a view list | cite-check.mjs vs sample files | S |
| 59 | Accessibility of data: alt text for every cover, language attributes, reading order of reader sections, plain-language summary option | a11y both pages types | S |
| 60 | Gate A: audits and evals all green, docs/rounds.md updated | verdict lines | O |

## B. Search and Advanced intuitiveness (61-70)
| # | Round | Proof | Model |
|---|-------|-------|-------|
| 61 | Search page empty state and zero-result recovery: suggestions, spelling, widen scope in one click | e2e | S |
| 62 | Saved searches and recent searches (consent-aware), clear history | e2e | S |
| 63 | Advanced onboarding: a worked example that fills the four areas, "what does this mean" per area with a live result diff | e2e | F |
| 64 | Advanced: keyboard-only flow for every drag action (move, copy to Boost, reorder Boost, H/L), screen reader announcements | e2e keyboard script | S |
| 65 | Boost semantics explained in the UI (copy vs move, H above L), a "why this rank" popover per result | e2e | S |
| 66 | Result explanations: show which filter matched each result (chips on cards), matched-passage count | e2e | S |
| 67 | Share an Advanced search by URL (compressed state in the hash), open-from-link restores the four areas | e2e round trip | S |
| 68 | Undo/redo history list and reset-with-undo toast; guard against losing a long Advanced setup | e2e | S |
| 69 | Suggestions quality: measure suggestion usefulness on 30 seeded setups (precision of accepted suggestions proxy), tune weights, hide noise | suggest-eval.mjs | O |
| 70 | Gate B | verify + e2e + a11y | S |

## C. Maps and reader (71-80)
| # | Round | Proof | Model |
|---|-------|-------|-------|
| 71 | Circuit map polish: bend dots, trace routing without crossings where possible, seed emblem sized to the graph, labels never on traces | screenshot triage | F |
| 72 | 3D map on real GPU path: low-power mode, node cap, reduced-motion, WebGL context-loss recovery | e2e + manual note | O |
| 73 | Map keyboard and screen-reader mode: node list view as the accessible equivalent, arrow-key traversal | e2e | S |
| 74 | Map search and filter: find a node, highlight path to the seed, "why connected" text | e2e | S |
| 75 | Map to Advanced round trip: pending additions shown, undo, remember the last Expand/Additional choice (done once, regression test) | e2e | S |
| 76 | Reader: sticky section nav, progress, previous/next in issue, print stylesheet, text size control | e2e + print screenshot | S |
| 77 | Reader: footnote/reference jump, figure/table lightbox, copy section link | e2e | S |
| 78 | View lists: rename, reorder, export/import JSON, share via URL fragment | e2e | S |
| 79 | Issue and topic pages: issue contents with covers, topic hubs with related topics, breadcrumbs everywhere | e2e + terms.mjs | S |
| 80 | Gate C | verify + e2e + phone | S |

## D. Speed (81-86)
| # | Round | Proof | Model |
|---|-------|-------|-------|
| 81 | Field-like budgets: LCP < 2.5 s, INP < 200 ms, CLS < 0.02 on slow 4G and mid phone CPU throttle for 6 routes | perf.mjs table | S |
| 82 | Route-level code splitting audit (three/3d-force-graph only on map 3D), preload on intent | bundle report | S |
| 83 | Service worker: precache shell and index, offline reading of visited chapters, versioned cache with update prompt | e2e offline | O |
| 84 | Large-corpus stress: synthetic 5,000 chapters; search, Advanced and map stay within frame budgets | stress.mjs | O |
| 85 | Memory and long-session leaks (heap after 200 navigations), listener cleanup | heap script | S |
| 86 | Compression and caching headers guidance for the final host plus `_headers` file where the host allows | doc + check | S |

## E. Security, privacy, dependencies (87-93)
| # | Round | Proof | Model |
|---|-------|-------|-------|
| 87 | Dependency cleanup follow-up from plan30: zero high/critical `npm audit`, pinned exact versions, lockfile check in CI, Dependabot | deps.mjs | S |
| 88 | CSP final form: no unsafe-inline, nonces/hashes, Trusted Types where supported, report-only trial then enforce | e2e no violations | O |
| 89 | Supply chain: SBOM (CycloneDX), license allow-list, `npm ci --ignore-scripts` in CI, provenance for the Pages deploy | CI run script | O |
| 90 | Input hardening: URL hash/params fuzz (route, search, shared state), localStorage poisoning cases, huge inputs | fuzz-inputs.mjs 0 crash | O |
| 91 | Privacy end to end: no network call before consent (script that records every request per consent state), counter and model loading only after opt-in | consent-audit.mjs | O |
| 92 | Legal text review pass: RA 10173 wording, cookie/storage table generated from the code's real keys, operator placeholders list for UPOU | script diff + checklist | O |
| 93 | Security headers doc for the UPOU host (CSP, HSTS, frame-ancestors, referrer, permissions-policy) and a verify script run against the live host | doc + script | S |

## F. Aesthetics and final quality (94-100)
| # | Round | Proof | Model |
|---|-------|-------|-------|
| 94 | Design tokens: spacing/type/radius/elevation scale in CSS variables, one card anatomy, one icon sprite | screenshot triage | F |
| 95 | Dark mode with AA contrast on both themes, charts/maps themed, covers adapt | a11y both themes | S |
| 96 | Motion system: one set of durations/easings, reduced-motion verified everywhere, pulse/animation audit | e2e + screenshot | S |
| 97 | Cover and thumbnail polish, consistent aspect ratios, skeleton loading states for every list | screenshot triage + CLS | S |
| 98 | Copywriting pass: terms (book/chapter/publication), microcopy, error messages, empty states, Filipino-English tone | terms.mjs verdict | F |
| 99 | Cross-browser and device matrix: Chromium, Firefox, WebKit (Playwright), 3 phone sizes, tablet, 200% zoom, forced-colors | matrix.mjs table | S |
| 100 | Final gate 3: everything green (verify, a11y both themes, phone, perf, deps, consent-audit, search-eval, data audit, fuzz), release notes, one squashed commit, no push | all verdict lines | O |

## Notes
- Run order: A (data first) -> B -> C in sequence; D and E can run beside B/C only if they do not both rebuild, and never two agents on the same files.
- Human tasks that no round can do: UPOU/editor sign-off, the operator name and DPO contact, the final domain (SITE_URL), real-device checks (touch, real GPU), choosing which year is right for the 27 mismatches.
- Cost control: about 10 agents in total, a fresh agent per phase of 5 rounds, budgets set in the brief, scripts instead of reading.
