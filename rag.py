"""Hybrid retrieval (BM25 + local embeddings, RRF) and cited answers. `python rag.py build` embeds chunks; `python rag.py "question"` asks."""
import json, re, sys, os, numpy as np, httpx
from rank_bm25 import BM25Okapi
EMB = "http://127.0.0.1:8092/v1/embeddings"
LLM = os.environ.get("LLM_URL", "http://127.0.0.1:8093/v1/chat/completions")
tok = lambda s: re.findall(r"\w+", s.lower())
chunks = [json.loads(l) for l in open("data/chunks.jsonl")]

def embed(texts):
    r = httpx.post(EMB, json={"model": "local-embed", "input": texts}, timeout=300)
    r.raise_for_status()
    return np.array([d["embedding"] for d in r.json()["data"]], dtype="float32")

def build():
    vs = [embed([c["text"][:3000] for c in chunks[i:i+16]]) for i in range(0, len(chunks), 16)]
    v = np.vstack(vs); v /= np.linalg.norm(v, axis=1, keepdims=True)
    np.save("data/vecs.npy", v); print("embedded", v.shape)

bm = BM25Okapi([tok(c["title"] + " " + c["text"]) for c in chunks])
vecs = np.load("data/vecs.npy") if os.path.exists("data/vecs.npy") else None

def search(q, k=5, mode="hybrid"):
    ranks = []
    if mode in ("hybrid", "bm25"): ranks.append(np.argsort(-bm.get_scores(tok(q)))[:50])
    if mode in ("hybrid", "vec"):
        qv = embed([q])[0]; qv /= np.linalg.norm(qv); ranks.append(np.argsort(-(vecs @ qv))[:50])
    s = {}
    for r in ranks:
        for pos, i in enumerate(r): s[i] = s.get(i, 0) + 1 / (60 + pos)
    return [chunks[i] for i in sorted(s, key=s.get, reverse=True)[:k]]

PROMPT = ("Answer ONLY from the numbered sources. Cite as [1], [2]. If the sources do not contain the answer, "
          "reply exactly: Not found in IJODeL.\n\nSources:\n{src}\n\nQuestion: {q}")

def ask(q, k=5):
    hits = search(q, k)
    src = "\n\n".join(f"[{i+1}] {h['title']} ({h['year']}, p.{h['page']}): {h['text'][:1800]}" for i, h in enumerate(hits))
    r = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.1, "max_tokens": 500,
        "messages": [{"role": "user", "content": PROMPT.format(src=src, q=q)}]}, timeout=120)
    ans = r.json()["choices"][0]["message"]["content"]
    return {"answer": ans, "sources": [{"n": i+1, "title": h["title"], "year": h["year"], "page": h["page"], "url": h["url"]} for i, h in enumerate(hits)]}

if __name__ == "__main__":
    if sys.argv[1] == "build": build()
    else: print(json.dumps(ask(" ".join(sys.argv[1:])), indent=1))
