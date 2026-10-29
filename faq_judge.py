"""LLM judge: is each shipped FAQ answer supported by its cited PDF passage? Needs data/faqs3.jsonl, data/pdf, local LLM :8093.
  .venv/bin/python faq_judge.py [workers]   -> data/faq-judge.jsonl (cache: re-runs judge only new pairs) + data/faq-sample.tsv (100 for a human)
Prints "N judged, support X%". Verdict per pair: yes | partial | no."""
import json, sys, random, os, httpx
from concurrent.futures import ThreadPoolExecutor
from qa import paras, LLM, BAD
OUT = "data/faq-judge.jsonl"
done = {}
if os.path.exists(OUT):
    for l in open(OUT): j = json.loads(l); done[(j["article"], j["q"])] = j
def passage(aid, r):
    lo, hi = (r["page"], r["para"]), (r.get("to_page", r["page"]), r.get("to_para", r["para"]))
    return "\n".join(p[2] for p in paras(aid) if lo <= (p[0], p[1]) <= hi)
PROMPT = """Passage from a journal article:
<<<
{p}
>>>
Question: {q}
Answer: {a}
Does the passage support every factual claim in the answer? Reply with one word: YES (all claims supported), PARTIAL (main claim supported, a detail is not), or NO (main claim missing or contradicted)."""
def judge(t):
    aid, x = t; p = passage(aid, x["ref"])
    for _ in range(3):
        try:
            r = httpx.post(LLM, json={"model": "local-fast", "temperature": 0, "max_tokens": 400, "chat_template_kwargs": {"enable_thinking": False},
                "messages": [{"role": "user", "content": PROMPT.format(p=p[:6000], q=x["q"], a=x["a"])}]}, timeout=180).json()
            w = r["choices"][0]["message"]["content"].strip().upper()
            v = "yes" if w.startswith("YES") else "partial" if w.startswith("PARTIAL") else "no" if w.startswith("NO") else None
            if v: return {"article": aid, "q": x["q"], "a": x["a"], "verdict": v, "passage": p}
        except Exception: pass
    return None
todo = []
for l in open("data/faqs3.jsonl"):
    j = json.loads(l)
    todo += [(j["article"], x) for x in j["items"] if x.get("ref") and not BAD.search(x["q"]) and (j["article"], x["q"]) not in done]
with ThreadPoolExecutor(int(sys.argv[1]) if len(sys.argv) > 1 else 2) as ex, open(OUT, "a") as f:
    for r in ex.map(judge, todo):
        if r: f.write(json.dumps(r, ensure_ascii=False) + "\n"); f.flush(); done[(r["article"], r["q"])] = r
rows = list(done.values()); ok = sum(r["verdict"] != "no" for r in rows)
random.seed(52); s = random.sample(rows, min(100, len(rows)))
with open("data/faq-sample.tsv", "w") as f:
    f.write("article\tverdict\tquestion\tanswer\tpassage\thuman_ok(y/n)\n")
    for r in s: f.write("\t".join(" ".join(x.split()) for x in [r["article"], r["verdict"], r["q"], r["a"], r["passage"][:1500]]) + "\t\n")
print(f"{len(rows)} judged, support {100 * ok / max(1, len(rows)):.1f}% (yes {sum(r['verdict'] == 'yes' for r in rows)}, partial {sum(r['verdict'] == 'partial' for r in rows)}, no {len(rows) - ok})")
