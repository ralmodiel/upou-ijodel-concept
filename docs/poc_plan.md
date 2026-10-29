# IJODeL RAG proof of concept: Thu 2026-10-29 to Mon 2026-11-02

Goal: a public demo URL where anyone asks a question about IJODeL and gets a cited answer from a small language model, using the 116 harvested articles as context. Details of the full product are in rag_project_plan.md.

## Key decision: RAG, not fine-tuning
"Add context from the 116 publications" = retrieval-augmented generation. Fine-tuning a small model on 116 articles will not make it reliably recall facts, can't cite sources, and needs GPU time. RAG gives cited answers, updates by re-harvesting, and runs on a CPU. Fine-tuning is a later option for tone or format only.

## Stack (cheapest that works)
| Piece | Choice | Cost |
|---|---|---|
| Harvest | OAI-PMH (`https://ijodel.upou.edu.ph/ijodel/oai`, 116 records, PDF/HTML) | free |
| Parse + chunk | PyMuPDF or the HTML galleys; about 400-token chunks, keep title/author/year/URL/page | free |
| Retrieval | BM25 + small local embedding model (e.g. bge-small / MiniLM class, CPU), stored in SQLite or a numpy file, merged by reciprocal rank | free |
| Generator | small instruct model, 1.5B–3B parameters (Qwen / Llama / Phi class; confirm the current best small instruct model), 4-bit GGUF via llama.cpp | free to run |
| UI | Gradio or a one-page FastAPI app: question box, answer, sources panel | free |
| Host | see below | $0–6/mo |

## Hosting options (verify pricing and limits on each provider's page; search did not confirm them)
1. **Hugging Face Space, free CPU tier + Gradio**: simplest; a tutorial runs a small model this way. Free CPU is slow (expect a few tokens/sec for a 3B 4-bit model) and the Space sleeps when idle. Fine for a PoC.
2. **Small VPS, about €4–6/month (e.g. Hetzner)**: always on, llama.cpp server, your own domain. Unverified price.
3. **Oracle Cloud Always Free ARM VM** (if you can get capacity): more RAM for a 3B model, $0. Unverified; capacity can be unavailable.
4. **Fallback for answer quality:** keep the retriever local but call a free-tier hosted LLM API for generation. Better answers than a 1.5B model; sends only the retrieved snippets out. Check the free-tier limits.
Recommendation: build and demo on a Hugging Face Space (zero cost), keep the VPS as plan B if CPU speed is too poor.

## Schedule
- **Thu eve (today):** harvest all 116 records; download PDFs/HTML; parse; spot-check 5 PDFs for tables and columns. Output: `chunks.jsonl`.
- **Fri:** embeddings + BM25 + hybrid retrieval; command-line question tool; write 20 test questions with expected articles; measure hit-rate@5 (target at least 80%).
- **Sat:** plug in the small model with a strict prompt: answer only from sources, cite [n], say "not found in IJODeL" otherwise. Add the UI. Compare 2 candidate models on the 20 questions.
- **Sun:** deploy to the host; test from a phone; add a "how it works" blurb and a disclaimer ("AI-generated; check the cited article"); measure latency.
- **Mon:** demo to the university; collect feedback and real questions; screenshot results for the portfolio and LinkedIn.

## Success criteria for Monday
- Public URL works; answers cite the right article for at least 16 of 20 test questions; "not found" for off-topic questions; response under about 30 seconds on free CPU.

## Risks
- Free-CPU latency with a 3B model, so offer a smaller model option or the hosted-API fallback.
- PDF parsing problems; use the HTML galleys when the PDF is messy.
- Permission: CC BY 4.0 allows reuse with attribution; show the attribution, and tell the IJODeL editors before the demo uses UPOU's name.
- Time: skip filters, author pages and other journals until after Monday.
