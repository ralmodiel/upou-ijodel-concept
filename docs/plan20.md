# 20 improvement rounds (updated 2026-10-29)

Rule for every round: aix first (`brief`/`impact`/`outline`), change, run the one script that proves it, log the verdict in docs/rounds.md.
Gate scripts: `scripts/budget.mjs` (size budget), `web/e2e/ui.mjs` (browser behaviour), `scripts/a11y.mjs` (axe + tap targets + overflow), `npm audit`.

| # | Area | Round | Proof |
|---|------|-------|-------|
| 1 | Perf | Baseline: per-asset raw/gzip sizes and a load-time probe; set budgets | budget.mjs |
| 2 | Perf | Route-level code splitting (Advanced, Maps, Reader) | budget.mjs |
| 3 | Perf | Lazy data: FAQs and passages fetched on first use, vectors/model only for search | budget.mjs + e2e |
| 4 | Perf | Search path: precomputed lowercase passages, cached best-passage | timing in e2e |
| 5 | Perf | Rendering: content-visibility on grids, memoised cards | e2e |
| 6 | Security | CSP + referrer policy via meta | e2e (no console errors) |
| 7 | Security | Validate and cap everything read from localStorage (advanced search, view lists) | e2e |
| 8 | Security | Link hygiene: https-only URLs, rel on external links, no raw HTML sinks | aix grep |
| 9 | Security | Supply chain: npm audit, license check, pinned lockfile, least-privilege Pages workflow | audit |
| 10 | UX | Touch alternative to the hover peek; tap targets >= 44px | a11y.mjs |
| 11 | UX | Keyboard and focus: focus-ring clipping, skip link, axe violations = 0 | a11y.mjs |
| 12 | UX | Empty, loading and error states (no results, data fail, passages loading) | e2e |
| 13 | UX | Phone layouts of Search, Advanced, Maps, Reader (no horizontal overflow) | a11y.mjs |
| 14 | UX | Reader: Q&A shows its PDF page and paragraph; passages explained | e2e |
| 15 | UX | Search clarity: passage only when full content is searched; scope hints | e2e |
| 16 | Look | Home rhythm: band alternation, spacing scale | screenshot |
| 17 | Look | Contrast and type audit (WCAG AA) | a11y.mjs |
| 18 | Look | Card polish: consistent chips, hover, loading skeletons | screenshot |
| 19 | Look | Motion: prefers-reduced-motion everywhere; map polish | e2e |
| 20 | Gate | Release: verify script, About page with disclaimers, Pages workflow dry-check, cleanup | all gates |
