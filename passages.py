"""Passage text per embedding row -> web/public/index/passages.json: [[pdf page, text], ...] aligned with
chunks.json / vecs.bin (row i = chunks.jsonl line i). Abstract rows are empty. Loaded lazily by the search."""
import json
rows = [json.loads(l) for l in open("data/chunks.jsonl")]
out = [[0, ""] if c.get("kind") == "abstract" else [c["page"], c["text"]] for c in rows]
json.dump(out, open("web/public/index/passages.json", "w"), ensure_ascii=False, separators=(",", ":"))
art = json.load(open("web/public/index/chunks.json"))
assert len(art) == len(out) and all(a == c["article"] for a, c in zip(art, rows)), "misaligned with chunks.json"
print(len(out), "passages,", sum(len(t) for _, t in out) // 1000, "KB text")
