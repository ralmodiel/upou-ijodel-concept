# IJODeL reader (proof of concept)

A static, all-in-browser reader and search for the open-access *International Journal on Open and Distance e-Learning* (IJODeL, ISSN 2467-7469, CC BY 4.0). Browse issues and topics, keyword + semantic search, maps of related articles, reading lists. Summaries, Q&As, tags and related-reading notes are AI-generated and must not be cited. Pending sign-off by the journal editors.

## Run, build, test (in `web/`)

```sh
npm ci
npm run dev                        # dev server
npm run build                      # -> web/dist (also writes read/<id>/ pages, sitemap.xml, robots.txt, 404.html)
npx vite preview --port 4173       # serve dist for the browser tests
node scripts/verify.mjs [--all]    # build + budgets + sitemap/JSON-LD/asset checks; --all adds the three below
node scripts/a11y.mjs              # axe on key pages
node scripts/phone.mjs             # phone-width layout audit
node e2e/ui.mjs                    # end-to-end UI tests (needs preview on :4173)
node eval.mjs                      # offline search-quality eval
node scripts/deps.mjs              # dependency policy: exact pins, lockfile, licences, unused deps, audit (also in CI)
node scripts/consent-audit.mjs     # storage keys per consent state vs the privacy notice (needs preview)
```

## Data pipeline (repo root, Python; intermediate files in `data/`, not committed)

`harvest.py` (OAI-PMH metadata) -> `fetch_pdfs.py` -> `chunk.py` -> `web/build-index.mjs` (embeddings) and `passages.py`
-> `summarize.py`, `faq.py`/`faq2.py`, `categorize.py` (local LLM) -> `assemble.py` -> `related.py` -> `assemble.py` again; `covers.py` renders issue/article covers.
Outputs land in `web/public/index/`, which is committed so the site builds without the pipeline.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` builds `web/` on push to `main` and publishes `web/dist`. In the repo settings set Pages source to "GitHub Actions" and add a repository variable `SITE_URL` (e.g. `https://<user>.github.io/<repo>`). Without it, canonical/sitemap URLs use the placeholder `https://example.github.io/ijodel-rag`.

### Security headers for the final (UPOU) host

The page sets its CSP in a `<meta>` tag (`default-src 'self'`, no `unsafe-inline`; three `sha256-` hashes cover the fixed `<style>` blocks the 3D-map libraries inject — an upgrade of `3d-force-graph` can change them, and `e2e/ui.mjs` then fails "no CSP violations"). A meta CSP cannot set `frame-ancestors`, reporting or other headers, so the host should send:

```
Content-Security-Policy: frame-ancestors 'none'   (plus the same policy as the meta tag, if the host can)
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

GitHub Pages cannot send custom headers. `vecs.bin` and `.wasm` should be served with `Content-Type: application/octet-stream` / `application/wasm`.

Third parties: the semantic-search model comes from `huggingface.co` (and its `*.hf.co` CDN), the ONNX runtime wasm from `cdn.jsdelivr.net` pinned to the exact `onnxruntime-web` version. `ORT_SELF=1 npm run build` copies the runtime into `dist/ort/` (~41 MB) instead, and jsDelivr can then be dropped from `connect-src`. If either host is blocked, search falls back to keyword (BM25) only and says so.

## Privacy

No analytics or advertising of its own. Opt-in consent covers storing lists/filters on the device, downloading the search model from Hugging Face, and the journal's visit counter (Flag Counter, a third-party tracker that counts visits by country and may set its own cookie). See `#/privacy` (draft pending the university's data protection review).

## Limits

- FAQs are the older set; regeneration (`faq2.py`) is unfinished.
- Hash routing: only the static `read/<id>/` pages are crawlable.
