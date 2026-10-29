"""Combine records + summaries + FAQs + related lists -> web/public/index/{articles,faqs}.json. Run after summarize/faq/related."""
import json, os, re, numpy as np
BAD = re.compile(r"\b(the|this) (text|article|study|paper|authors?|passage|document)\b", re.I)  # question must stand alone
recs = {}
for l in open("data/records.jsonl"):
    r = json.loads(l); recs[r["urls"][0].rstrip("/").split("/")[-1]] = r
sums = {j["article"]: j for j in map(json.loads, open("data/summaries.jsonl"))}
chunks = [json.loads(l) for l in open("data/chunks.jsonl")]
v = np.fromfile("web/public/index/vecs.bin", dtype="float32").reshape(len(chunks), -1)
ids = [a for a in recs if a in sums]
mean = np.stack([v[[i for i, c in enumerate(chunks) if c["article"] == a]].mean(0) for a in ids])
mean /= np.linalg.norm(mean, axis=1, keepdims=True)
sim = mean @ mean.T
cats = {j["id"]: j["categories"] for j in map(json.loads, open("data/categories.jsonl"))} if os.path.exists("data/categories.jsonl") else {}
why = {}
if os.path.exists("data/related_why.jsonl"):
    for l in open("data/related_why.jsonl"):
        j = json.loads(l); why[(j["a"], j["b"])] = j["why"]
import collections, re
def issue_of(r):
    m = re.search(r"Vol\. (\d+) No\. ([\d&]+) \((\d{4})\): (\w+ \d{4})", (r.get("source") or [""])[0])
    return {"vol": int(m[1]), "no": m[2], "label": f"Vol. {m[1]} No. {m[2].replace('&', '&')} · {m[4]}"} if m else None
# one label per tag key (case/punctuation-insensitive): the commonest spelling wins; sentence-long tags are dropped
tk = lambda t: re.sub(r"[^a-z0-9]+", "", t.lower())
spell = collections.defaultdict(collections.Counter)
for r in recs.values():
    for t in r.get("subjects") or []: spell[tk(t)][t.strip()] += 1
tag_label = {k: c.most_common(1)[0][0] for k, c in spell.items()}
motif = {json.loads(l)['id']: json.loads(l)['motif'] for l in open('data/motifs.jsonl')} if os.path.exists('data/motifs.jsonl') else {}
alias = {k: v for k, v in json.load(open("data/author-aliases.json")).items() if not k.startswith("_")} if os.path.exists("data/author-aliases.json") else {}
years = {k: v for k, v in json.load(open("data/year-decisions.json")).items() if not k.startswith("_")} if os.path.exists("data/year-decisions.json") else {}
arts = []
for n, a in enumerate(ids):
    r, s = recs[a], sums[a]
    near = [ids[m] for m in np.argsort(-sim[n]) if m != n][:6]
    arts.append({"id": a, "title": r["title"], "authors": [alias.get(x, x) for x in r["authors"]], "year": years.get(a) or (r["date"] or "")[:4], "url": r["urls"][0],
        "abstract": r.get("abstract") or "", "subjects": sorted({tag_label[tk(t)] for t in r.get("subjects") or [] if tk(t) and len(t) <= 40}), "issue": issue_of(r), "motif": motif.get(a, "book"), "half": s["half"], "one": s["one"], "two": s["two"],
        "categories": cats.get(a, []), "related": [{"id": b, "why": why.get((a, b), "")} for b in near]})
# faq_judge.py verdicts: an answer its cited passage does not support ("no") is dropped
judged = {(j["article"], j["q"]): j["verdict"] for j in map(json.loads, open("data/faq-judge.jsonl"))} if os.path.exists("data/faq-judge.jsonl") else {}
faqs = []
for l in open("data/faqs3.jsonl"):  # qa.py output: every item carries its PDF page + paragraph
    j = json.loads(l)
    if j["article"] in sums:
        ok = [f for f in j["items"] if f.get("ref") and not BAD.search(f["q"]) and judged.get((j["article"], f["q"])) != "no"]
        strong = [f for f in ok if f["ref"].get("score", 1) >= 0.6]  # 2 of 10 sampled answers scoring 0.56 were unsupported
        j["items"] = strong if len(strong) >= 14 else ok
        faqs += [{"id": f"{j['article']}-{i}", "article": j["article"], "kind": f["kind"], **({"about": f["about"]} if f.get("about") else {}),
                  "q": f["q"], "a": f["a"], "page": f["ref"]["page"], "para": f["ref"]["para"]} for i, f in enumerate(j["items"])]
json.dump(arts, open("web/public/index/articles.json", "w"), ensure_ascii=False)
json.dump(faqs, open("web/public/index/faqs.json", "w"), ensure_ascii=False)
print(len(arts), "articles,", len(faqs), "faqs")
