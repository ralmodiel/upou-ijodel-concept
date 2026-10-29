"""Download each article's PDF galley (OJS galley ids from records.jsonl) into data/pdf/<id>.pdf."""
import json, os, re, time, urllib.request
H = {"User-Agent": "ijodel-rag-poc/0.1 (research)"}
os.makedirs("data/pdf", exist_ok=True)
ok = miss = 0
for line in open("data/records.jsonl"):
    r = json.loads(line)
    aid = r["urls"][0].rstrip("/").split("/")[-1]
    out = f"data/pdf/{aid}.pdf"
    if os.path.exists(out): ok += 1; continue
    for rel in r["relation"]:
        gid = rel.rstrip("/").split("/")[-1]
        url = f"https://ijodel.upou.edu.ph/ijodel/article/download/{aid}/{gid}"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=60) as resp:
                body = resp.read()
                if body[:4] == b"%PDF": open(out, "wb").write(body); ok += 1; break
        except Exception as e:
            pass
        time.sleep(0.3)
    else:
        miss += 1; print("no pdf:", aid, r["title"][:60])
print("pdfs:", ok, "missing:", miss)
