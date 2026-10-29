"""Local-LLM summaries per article: ~2-page (from full text), ~1-page (from 2-page), ~half-page (from 1-page).
Resumable: appends to data/summaries.jsonl. Usage: python summarize.py [workers] [limit_ids...]"""
import json, os, sys, re, time, httpx, pymupdf
from concurrent.futures import ThreadPoolExecutor
LLM = "http://127.0.0.1:8093/v1/chat/completions"
OUT = "data/summaries.jsonl"
SPEC = {"two": 900, "one": 450, "half": 225}
SYS = ("You summarize academic journal articles faithfully. Use only the provided text; never invent facts, numbers, "
       "names or citations. Plain prose in short paragraphs, no markdown headings, no preamble.")

def call(prompt, words):
    r = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.2, "chat_template_kwargs": {"enable_thinking": False}, "max_tokens": int(words * 2),
        "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": prompt}]}, timeout=900)
    return r.json()["choices"][0]["message"]["content"].strip()

def fulltext(aid):
    w = " ".join(p.get_text() for p in pymupdf.open(f"data/pdf/{aid}.pdf")).split()
    return " ".join(w if len(w) <= 14000 else w[:10000] + w[-3000:])  # shortcut: long papers lose the middle, map-reduce if it shows

def work(r):
    aid = r["urls"][0].rstrip("/").split("/")[-1]
    t = time.time()
    two = call(f"Write a detailed summary of about 900 words (about two pages) of this article: problem, context, method, findings, "
               f"conclusions and implications.\n\nTitle: {r['title']}\nAuthors: {'; '.join(r['authors'])}\n\nText:\n{fulltext(aid)}", 900)
    one = call(f"Condense this summary to about 450 words (one page), keeping the key findings.\n\n{two}", 450)
    half = call(f"Condense this summary to about 225 words (half a page), keeping the key findings.\n\n{one}", 225)
    row = {"article": aid, "two": two, "one": one, "half": half, "secs": round(time.time() - t)}
    open(OUT, "a").write(json.dumps(row) + "\n")
    print(aid, row["secs"], "s", [len(row[k].split()) for k in SPEC], flush=True)

if __name__ == "__main__":
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    only = set(sys.argv[2:])
    done = {json.loads(l)["article"] for l in open(OUT)} if os.path.exists(OUT) else set()
    recs = [json.loads(l) for l in open("data/records.jsonl")]
    recs = [r for r in recs if (a := r["urls"][0].rstrip("/").split("/")[-1]) not in done and (not only or a in only)]
    with ThreadPoolExecutor(workers) as ex: list(ex.map(work, recs))
