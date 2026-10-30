"""3-paragraph "what makes this chapter different" per article, written by the local LLM with a 2048-token thinking budget
(the "max" effort in LEARNINGS.md) against its 8 nearest chapters. Resumable: appends to data/differentiators.jsonl.
Run after assemble.py (needs the neighbours), then assemble.py again to merge. Usage: python differentiate.py [workers] [ids...]"""
import json, os, sys, httpx
from concurrent.futures import ThreadPoolExecutor
LLM, OUT = "http://127.0.0.1:8093/v1/chat/completions", "data/differentiators.jsonl"
arts = {a["id"]: a for a in json.load(open("web/public/index/articles.json"))}
done = {json.loads(l)["article"] for l in open(OUT)} if os.path.exists(OUT) else set()
SYS = ("You write for a journal's reader. Use only the supplied summaries; never invent facts, numbers, names or citations. "
       "Call each article a 'chapter' and each journal number an 'issue'; never write 'publication'. Plain prose, no markdown, no preamble.")

def work(a):
    A = arts[a]
    peers = "\n\n".join(f"- {arts[r['id']]['title']}: {arts[r['id']]['half']}" for r in A["related"][:8] if r["id"] in arts)
    p = (f"CHAPTER: {A['title']}\nAuthors: {'; '.join(A['authors'])}\n\n{A.get('one') or A['half']}\n\n"
         f"THE EIGHT MOST SIMILAR CHAPTERS IN THE SAME JOURNAL:\n{peers}\n\n"
         "Write exactly three paragraphs (about 80-110 words each, separated by one blank line) on what makes this chapter highly "
         "different from those similar chapters and from the rest of the journal. Paragraph 1: its distinctive question or angle. "
         "Paragraph 2: its distinctive method, context or evidence. Paragraph 3: what a reader gets from it that they cannot get from "
         "the others. Name a concrete contrast with at least one similar chapter. Do not repeat the summary; do not praise.")
    try:
        m = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.3, "max_tokens": 4500, "thinking_budget_tokens": 2048,
            "chat_template_kwargs": {"enable_thinking": True},
            "messages": [{"role": "system", "content": SYS}, {"role": "user", "content": p}]}, timeout=1200).json()["choices"][0]
        t = m["message"]["content"].strip()
        ps = [x.strip() for x in t.split("\n\n") if x.strip()]
        if m["finish_reason"] != "stop" or len(ps) != 3: raise ValueError(f"{len(ps)} paragraphs, finish={m['finish_reason']}")
    except Exception as e:
        print(a, "FAILED", repr(e)[:80], flush=True); return
    open(OUT, "a").write(json.dumps({"article": a, "paras": ps}) + "\n"); print(a, [len(x.split()) for x in ps], flush=True)

if __name__ == "__main__":
    only = set(sys.argv[2:])
    todo = [a for a in arts if a not in done and (not only or a in only)]
    with ThreadPoolExecutor(int(sys.argv[1]) if len(sys.argv) > 1 else 2) as ex: list(ex.map(work, todo))
