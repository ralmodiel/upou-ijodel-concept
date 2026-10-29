"""Local-LLM FAQs per article (~9 each) + grounding check. Resumable: appends to data/faqs.jsonl.
Usage: python faq.py [workers] [article ids...]"""
import json, os, re, sys, httpx, pymupdf
from concurrent.futures import ThreadPoolExecutor
LLM = "http://127.0.0.1:8093/v1/chat/completions"
OUT, N = "data/faqs.jsonl", 9
STOP = set("the a an of to in and or is are was were be for on with that this it as by from at which their its they have has not".split())

def fulltext(aid):
    w = " ".join(p.get_text() for p in pymupdf.open(f"data/pdf/{aid}.pdf")).split()
    return " ".join(w if len(w) <= 14000 else w[:10000] + w[-3000:])

def grounded(a, text):
    ws = [w for w in re.findall(r"[a-z0-9]{4,}", a.lower()) if w not in STOP]
    return bool(ws) and sum(w in text for w in ws) / len(ws) >= 0.7

def work(r):
    aid = r["urls"][0].rstrip("/").split("/")[-1]
    text = fulltext(aid)
    p = (f"From the article below write exactly {N} FAQs a student or researcher might ask about its content. "
         "Each question must make sense on its own (name the topic, never say 'the article' or 'the study'). "
         "Each answer is 2-4 sentences using ONLY facts stated in the text. Cover varied aspects: purpose, context, method, "
         'findings, definitions, recommendations, limitations. Reply as JSON: {"faqs":[{"q":"...","a":"..."}]}\n\n'
         f"Title: {r['title']}\nAuthors: {'; '.join(r['authors'])}\n\nText:\n{text}")
    try:
        c = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.3, "max_tokens": 2500,
            "chat_template_kwargs": {"enable_thinking": False}, "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": p}]}, timeout=900).json()["choices"][0]["message"]["content"]
        items = json.loads(c)["faqs"]
    except Exception as e:
        print(aid, "FAILED", repr(e)[:80], flush=True); return
    low = text.lower()
    good = [x for x in items if isinstance(x, dict) and x.get("q") and x.get("a") and grounded(x["a"], low)]
    open(OUT, "a").write(json.dumps({"article": aid, "faqs": good, "dropped": len(items) - len(good)}) + "\n")
    print(aid, len(good), "kept,", len(items) - len(good), "dropped", flush=True)

if __name__ == "__main__":
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    only = set(sys.argv[2:])
    done = {json.loads(l)["article"] for l in open(OUT)} if os.path.exists(OUT) else set()
    recs = [json.loads(l) for l in open("data/records.jsonl")]
    recs = [r for r in recs if (a := r["urls"][0].rstrip("/").split("/")[-1]) not in done and (not only or a in only)]
    with ThreadPoolExecutor(workers) as ex: list(ex.map(work, recs))
