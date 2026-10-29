"""Assign each article 1-2 categories from a fixed list (local LLM). Resumable -> data/categories.jsonl."""
import json, os, httpx
from concurrent.futures import ThreadPoolExecutor
CATS = ["Learner Engagement & Experience", "Teaching & Teacher Readiness", "Learning Technologies & Platforms",
        "AI, Analytics & Emerging Tech", "Quality, Policy & Institutions", "Student Support & Access",
        "Course Design & Assessment", "Open Education & ODeL Foundations"]
OUT = "data/categories.jsonl"
arts = json.load(open("web/public/index/articles.json"))
done = {json.loads(l)["id"] for l in open(OUT)} if os.path.exists(OUT) else set()

def work(a):
    p = (f"Categories:\n" + "\n".join(f"- {c}" for c in CATS) + f"\n\nTitle: {a['title']}\nSummary: {a['half']}\n\n"
         'Pick the 1 or 2 best categories (exact names from the list, best first). Reply JSON: {"categories":["..."]}')
    try:
        r = httpx.post("http://127.0.0.1:8093/v1/chat/completions", json={"model": "local-fast", "temperature": 0, "max_tokens": 120,
            "chat_template_kwargs": {"enable_thinking": False}, "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": p}]}, timeout=300).json()["choices"][0]["message"]["content"]
        cats = [c for c in json.loads(r)["categories"] if c in CATS][:2]
    except Exception as e:
        print(a["id"], "FAILED", repr(e)[:60], flush=True); return
    if cats: open(OUT, "a").write(json.dumps({"id": a["id"], "categories": cats}) + "\n")

with ThreadPoolExecutor(2) as ex: list(ex.map(work, [a for a in arts if a["id"] not in done]))
import collections
rows = [json.loads(l) for l in open(OUT)]
print(len(rows), "classified;", collections.Counter(c for r in rows for c in r["categories"]).most_common())
