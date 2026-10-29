"""Parse data/pdf/*.pdf into ~350-word overlapping chunks with page + metadata -> data/chunks.jsonl."""
import json, fitz
N, OV = 350, 60
recs = {}
for l in open("data/records.jsonl"):
    r = json.loads(l); recs[r["urls"][0].rstrip("/").split("/")[-1]] = r
out = open("data/chunks.jsonl", "w"); n = 0; empty = []
for aid, r in recs.items():
    ab = " ".join(filter(None, [r["title"], r.get("abstract") or "", ", ".join(r.get("subjects") or [])]))
    out.write(json.dumps({"id": f"{aid}-abs", "article": aid, "title": r["title"], "authors": r["authors"],
        "year": (r["date"] or "")[:4], "url": r["urls"][0], "page": 0, "kind": "abstract", "text": ab}) + "\n"); n += 1
    words = []
    for pno, page in enumerate(fitz.open(f"data/pdf/{aid}.pdf"), 1):
        words += [(w, pno) for w in page.get_text().split()]
    if len(words) < 200: empty.append(aid); continue
    i = 0
    while i < len(words):
        seg = words[i:i+N]
        out.write(json.dumps({"id": f"{aid}-{i}", "article": aid, "title": r["title"], "authors": r["authors"],
            "year": (r["date"] or "")[:4], "url": r["urls"][0], "page": seg[0][1],
            "text": " ".join(w for w, _ in seg)}) + "\n"); n += 1
        i += N - OV
print("chunks:", n, "articles with little/no text:", empty)
