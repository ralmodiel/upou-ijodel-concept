# Round queue (one agent per phase, run in this order; each phase fixes bugs and gaps it finds)

Done: 1-31 (plan20 + plan30 A; 27-31 speed).
Next, plan30: 32-37 security/deps (O) -> 38-42 UX (S/F) -> 43-46 UX (S/O) -> 47-50 aesthetics + gate 2 (F/O).
Then plan50 (docs/plan50.md): 51-55, 56-60 | 61-65, 66-70 | 71-75, 76-80 | 81-86 | 87-93 | 94-100.
Each phase ends with: vite build, e2e 0 FAIL, verify.mjs 0 FAIL; a line in docs/rounds.md; no commit, no push.
Open data decisions for the human: the 27 year/issue-label mismatches, the duplicate author spelling.

## Added 2026-10-30 (user request)
- Chunk data and static pages for faster loads and low browser memory: split passages.json (5.6 MB) per issue/article and fetch on demand, cache with a size cap, route-level code splitting (Maps/Graph3D/three already lazy? verify), per-route static HTML shells, drop unused fields; proof: perf.mjs transfer KB + JS heap (CDP) before/after. Runs after rounds 29-30 report (same files: engine.js, seo.mjs).
