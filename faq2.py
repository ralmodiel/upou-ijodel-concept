"""Second FAQ pass from abstract + 3 summaries: 10 ranked key questions + two Q&As per category/tag.
Resumable (data/faqs2.jsonl). Usage: python faq2.py [workers] [article ids...]"""
import json, os, re, sys, httpx
from concurrent.futures import ThreadPoolExecutor
LLM, OUT = "http://127.0.0.1:8093/v1/chat/completions", "data/faqs2.jsonl"
STOP = set("the a an of to in and or is are was were be for on with that this it as by from at which their its they have has not".split())
recs = {json.loads(l)["urls"][0].rstrip("/").split("/")[-1]: json.loads(l) for l in open("data/records.jsonl")}
sums = {j["article"]: j for j in map(json.loads, open("data/summaries.jsonl"))}
cats = {j["id"]: j["categories"] for j in map(json.loads, open("data/categories.jsonl"))}

def grounded(a, text):
    ws = [w for w in re.findall(r"[a-z0-9]{4,}", a.lower()) if w not in STOP]
    return bool(ws) and sum(w in text for w in ws) / len(ws) >= 0.6

def work(aid):
    r, s = recs[aid], sums[aid]
    topics = cats.get(aid, []) + [t for t in (r.get("subjects") or []) if len(t) <= 40][:3]
    src = f"Abstract: {r.get('abstract') or ''}\n\nHalf-page summary: {s['half']}\n\nOne-page summary: {s['one']}\n\nTwo-page summary: {s['two']}"
    p = ("You write the FAQ for one journal article, from its abstract and summaries below.\n"
         "1. \"key\": the 10 MOST IMPORTANT, distinct questions a reader needs answered to understand this article, most important first "
         "(its central problem or purpose, main findings or argument, method or approach, key conclusions or recommendations, who it matters to, limits, implications, definitions). "
         f"2. \"topics\": for EACH of these topics write TWO different questions and answers on how this article relates to it: {json.dumps(topics)}; "
         "set \"about\" to the topic exactly as given.\n"
         "Rules: every question must make sense on its own (name the subject; never say 'the article', 'the study' or 'this paper'). "
         "Each answer is 2-3 sentences, each question different from the others using ONLY facts in the text below; if the text says nothing about a topic, skip that topic.\n"
         'Reply as JSON: {"key":[{"q":"","a":""}],"topics":[{"about":"","q":"","a":""}]}\n\n'
         f"Title: {r['title']}\nAuthors: {'; '.join(r['authors'])}\n\n{src}")
    try:
        c = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.2, "max_tokens": 8000,
            "chat_template_kwargs": {"enable_thinking": False}, "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": p}]}, timeout=900).json()["choices"][0]["message"]["content"]
        j = json.loads(c)
    except Exception as e:
        print(aid, "FAILED", repr(e)[:80], flush=True); return
    low = src.lower()
    ok = lambda x: isinstance(x, dict) and x.get("q") and x.get("a") and grounded(x["a"], low)
    key = [x for x in j.get("key", []) if ok(x)][:10]
    tp = [x for x in j.get("topics", []) if ok(x) and x.get("about") in topics][:2 * len(topics)]
    open(OUT, "a").write(json.dumps({"article": aid, "key": key, "topics": tp}) + "\n")
    print(aid, len(key), "key", len(tp), "topic", flush=True)

if __name__ == "__main__":
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    only = set(sys.argv[2:])
    done = {json.loads(l)["article"] for l in open(OUT)} if os.path.exists(OUT) else set()
    with ThreadPoolExecutor(workers) as ex: list(ex.map(work, [a for a in recs if a in sums and a not in done and (not only or a in only)]))
