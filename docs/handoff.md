# Handoff (2026-10-30)

## What ships
A static Vite + React reader for the IJODeL journal (web/), with no backend. It has:
- search with filters and operators, Advanced search, relationship maps (2D/3D), and the reader with an abstract, a summary, Q&A, related chapters and citations;
- view lists and saved searches;
- consent-gated preferences and a service worker that runs only under consent.

The data and the per-chapter static pages are built in `web/dist`. Verdicts for every check are in docs/rounds.md (gate 3).

## Build
```
cd web && npm ci --ignore-scripts && SITE_URL=https://<user>.github.io/<repo> npx vite build   # output in web/dist
npx vite preview          # http://localhost:4173, needed by the browser checks (e2e/ui.mjs, scripts/*.mjs)
```
If SITE_URL is unset, the sitemap, canonical and JSON-LD URLs are placeholders.

## Deploy to GitHub Pages
1. Push the repo to GitHub, with `main` as the default branch.
2. Under Settings -> Pages -> Source, choose **GitHub Actions**.
3. Under Settings -> Secrets and variables -> Actions -> **Variables**, add the repository variable `SITE_URL`, for example `https://<user>.github.io/<repo>` (no trailing slash).
4. Push to main or run "Deploy to GitHub Pages" (.github/workflows/pages.yml). The workflow:
   - runs `npm ci` and the deps, headers and bundle checks;
   - builds the site;
   - writes the SBOM;
   - attests provenance and deploys.

Pages ignores `dist/_headers`, so it cannot send the CSP, HSTS or cache headers. For a real host, use docs/hosting.md, then run `node scripts/headers.mjs https://<host>/`.

## Needs a human
- **Data**: choose the right year for the 27 year/issue-label mismatches (`scripts/year-review.mjs`) and the author spellings (the duplicate author).
- **Content review**: check the 100 FAQ question/answer pairs and the 12 related-reading notes that the audits flag for a person to read.
- **Citations**: confirm the house style for MLA 9 and Chicago author-date (cite.js follows the rules in rounds.md, row 58).
- **Privacy**: fill in the UPOU operator name and the DPO contact (placeholders in Consent.jsx), and have the privacy wording (RA 10173) reviewed by UPOU.
- **Real devices**: touch gestures on maps and lists, 3D on a real GPU, and WebGL context loss and driver reset. These are tested only in headless Chromium with SwiftShader.
- **WebKit/Safari**: matrix.mjs skips WebKit here because the host is missing libraries. Run it on a Mac or in CI with `npx playwright install --with-deps webkit`.
- **Hosting**: the final domain (SITE_URL) and a host that sends the headers in docs/hosting.md (CSP, HSTS, compression, caching), and the sign-off from UPOU and the editor.
