"""Issue covers (the journal's own, resized), thematic issue titles and per-article cover motifs, via the local LLM.
Writes web/public/issues/<key>.jpg and web/public/index/issues.json; motifs go to data/motifs.jsonl (read by assemble.py)."""
import json, os, re, subprocess, io, httpx
from PIL import Image
LLM = "http://127.0.0.1:8093/v1/chat/completions"
MOTIFS = ["book", "network", "globe", "brain", "chat", "laptop", "graduation", "bulb", "chart", "people", "shield", "phone", "gear", "magnifier", "teacher", "puzzle"]
def call(prompt, n=60):
    r = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.4, "max_tokens": n, "chat_template_kwargs": {"enable_thinking": False},
        "messages": [{"role": "user", "content": prompt}]}, timeout=120)
    return r.json()["choices"][0]["message"]["content"].strip()
arts = json.load(open("web/public/index/articles.json"))
site = json.load(open("data/issues_site.json"))
by_month = {v["month"]: (i, v) for i, v in site.items()}
os.makedirs("web/public/issues", exist_ok=True)
issues = {}; used = []
for k in sorted({f"{a['issue']['vol']}.{a['issue']['no'].replace('&','-')}" for a in arts}):
    items = [a for a in arts if f"{a['issue']['vol']}.{a['issue']['no'].replace('&','-')}" == k]
    month = items[0]["issue"]["label"].split("· ")[1]
    sid, v = by_month[month]
    out = f"web/public/issues/{k}.jpg"
    if not os.path.exists(out):
        raw = subprocess.run(["curl", "-sL", v["cover"].strip()], capture_output=True).stdout
        im = Image.open(io.BytesIO(raw)).convert("RGB"); im.thumbnail((420, 600)); im.save(out, quality=82)
    titles = "\n".join("- " + a["title"] for a in items)
    t = call(f"These chapters make up one issue of a journal on open and distance e-learning:\n{titles}\n\nWrite a short, inviting, SPECIFIC issue title (3 to 6 words, title case, no quotes, no colon) that names the two or three most distinctive subjects in this list (for example a country, a technology, a method). Do NOT use the generic words Innovations, Digital, Distance, Learning, Open, ODeL or Trends. Already used, so be different from: {'; '.join(used)}. Reply with the title only.", 30)
    issues[k] = {"theme": re.sub(r'["“”.]', "", t.splitlines()[0]).strip(), "cover": f"issues/{k}.jpg", "site": sid}
    used.append(issues[k]["theme"]); print(k, issues[k]["theme"])
json.dump(issues, open("web/public/index/issues.json", "w"), ensure_ascii=False)
done = {json.loads(l)["id"] for l in open("data/motifs.jsonl")} if os.path.exists("data/motifs.jsonl") else set()
with open("data/motifs.jsonl", "a") as f:
    for a in arts:
        if a["id"] in done: continue
        m = call(f"Pick the single best cover icon for this article from this list: {', '.join(MOTIFS)}.\nTitle: {a['title']}\nAbstract: {a['abstract'][:400]}\nReply with one word from the list only.", 8).lower()
        m = next((x for x in MOTIFS if x in m), "book")
        f.write(json.dumps({"id": a["id"], "motif": m}) + "\n")
print("motifs", sum(1 for _ in open("data/motifs.jsonl")))
