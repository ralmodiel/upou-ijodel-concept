"""One-sentence relationship context per (article, related article) pair using half-page summaries.
Run after `assemble.py` once (it picks neighbours by vector similarity), then run assemble.py again to merge. Resumable."""
import json, os, sys, httpx
from concurrent.futures import ThreadPoolExecutor
LLM, OUT = "http://127.0.0.1:8093/v1/chat/completions", "data/related_why.jsonl"
arts = {a["id"]: a for a in json.load(open("web/public/index/articles.json"))}
done = {(j["a"], j["b"]) for j in map(json.loads, open(OUT))} if os.path.exists(OUT) else set()

def work(a):
    A = arts[a]; todo = [r["id"] for r in A["related"] if (a, r["id"]) not in done]
    if not todo: return
    others = "\n\n".join(f"[{b}] {arts[b]['title']}: {arts[b]['half']}" for b in todo)
    p = (f"This publication: {A['title']}: {A['half']}\n\nFor each related article below write ONE sentence (max 30 words) saying how it relates to this publication (never write the letter A or the word Article) "
         "(shared topic, contrasting context, method, or follow-up question). Use only the summaries. "
         f'Reply JSON: {{"why":{{"<id>":"sentence"}}}}\n\n{others}')
    try:
        c = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.2, "max_tokens": 900, "chat_template_kwargs": {"enable_thinking": False},
            "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": p}]}, timeout=600).json()["choices"][0]["message"]["content"]
        why = {"".join(ch for ch in k if ch.isdigit()): v for k, v in json.loads(c)["why"].items()}
    except Exception as e:
        print(a, "FAILED", repr(e)[:60], flush=True); return
    with open(OUT, "a") as f:
        for b in todo:
            if why.get(b): f.write(json.dumps({"a": a, "b": b, "why": why[b]}) + "\n")
    print(a, len(why), flush=True)

with ThreadPoolExecutor(int(sys.argv[1]) if len(sys.argv) > 1 else 1) as ex: list(ex.map(work, arts))
