# RAG project plan: IJODeL research assistant (2026-10-29)

Purpose: a deployable product for UP Open University (the user's wife's university), and the public RAG portfolio piece the AI-engineer plan calls for. Plan only; nothing built yet.

## What the corpus is (checked)
- IJODeL: bi-annual, open-access, refereed journal on open and distance e-learning. Runs on OJS (PKP). CC BY 4.0.
- **OAI-PMH works:** `https://ijodel.upou.edu.ph/ijodel/oai` returns 116 records (Dublin Core), all English, each with PDF, HTML and EPUB. No scraping needed, and metadata comes clean.
- Latest issue: Vol. 11 No. 2 (Dec 2025). Archive has about 22 issue pages.
- Small corpus (~116 articles, maybe 1–2K pages). Good for a fast, cheap MVP; the same pipeline can later cover other UPOU journals and OJS sites (any OJS exposes OAI-PMH).
- Check before building: the journal's full-text license terms and that PDFs download without login; get the editors' sign-off before deploying under UPOU's name.

## Product (what users get)
"Ask IJODeL": a search and Q&A assistant over the journal.
1. Ask a question in plain English; get an answer with **cited passages** (article, page, link to the PDF/HTML).
2. Filters by year, issue and author; "similar articles".
3. Literature-review helper: summarize what IJODeL says about a topic (e.g., assessment, gamification, teacher education) with citations.
4. Audience: UPOU students, faculty, TAs/RAs, and the journal's editors (find related work, spot duplicates).
Answers must only use retrieved text and say "not found" otherwise. No invented citations.

## Architecture (keep it small)
1. **Ingest:** OAI-PMH harvest → download PDF/HTML → parse text with section/page tracking → chunk (about 300–500 tokens, keep headings) → store with metadata (title, authors, year, DOI/URL, page).
2. **Index:** hybrid retrieval, keyword (BM25) + vector embeddings, then rerank. This uses the user's search background and is the portfolio differentiator. SQLite/Postgres + pgvector, or one embedded vector store; no heavy infrastructure.
3. **Generate:** LLM answers from the top passages, with citation IDs mapped back to links. Start with a hosted API for quality; try a local model via the user's existing benchmarks to cut cost.
4. **App:** small web UI (chat + sources panel), mobile-friendly. Deploy on a cheap VPS or UPOU's server.
5. **Refresh:** nightly OAI-PMH harvest for new issues.

## Evaluation (the part recruiters care about)
- Build a test set of ~40–60 questions with known answers from the articles (ask the wife and colleagues for real questions).
- Measure retrieval hit rate (is the right passage in the top 5?), answer correctness, citation accuracy, hallucination rate, latency and cost per question.
- Compare keyword-only vs vector-only vs hybrid vs hybrid+rerank. Publish the table.
- A short write-up plus a public GitHub repo is the portfolio deliverable.

## Phases
- **Phase 1 (week 1):** harvest + parse + chunk; keyword search working; 20-question test set.
- **Phase 2 (week 2):** embeddings + hybrid retrieval + rerank; run the eval; pick the best config.
- **Phase 3 (week 3):** answer generation with citations; guardrails ("not found"); simple web UI.
- **Phase 4 (week 4):** deploy for a pilot with the wife's department; collect feedback and real questions; publish write-up and repo; post on LinkedIn.

## Risks and things to settle first
- Permission and ownership: get written OK from IJODeL's editors/UPOU; decide who hosts and pays for the API.
- PDF parsing quality (tables, two-column layouts). Check 5 sample PDFs early.
- Privacy: log queries minimally; no student data.
- Cost: with ~116 articles, embedding is a one-off of cents; answering costs depend on traffic; set a monthly cap.
- Scope creep: do not add other journals or multilingual until the eval is solid.

## Decisions for the user
1. Who is the sponsor at UPOU (wife's department or the IJODeL editors)? Needed before deploying under the university's name.
2. Hosting: UPOU server vs your own VPS.
3. Hosted LLM API vs local model for answers (quality vs cost and data control).
