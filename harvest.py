"""Harvest IJODeL metadata via OAI-PMH into data/records.jsonl (title, authors, year, abstract, urls)."""
import json, re, sys, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
BASE = "https://ijodel.upou.edu.ph/ijodel/oai"
NS = {"o": "http://www.openarchives.org/OAI/2.0/", "dc": "http://purl.org/dc/elements/1.1/"}
H = {"User-Agent": "ijodel-rag-poc/0.1 (research)"}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=H), timeout=60) as r:
        return ET.fromstring(r.read())

url = f"{BASE}?verb=ListRecords&metadataPrefix=oai_dc"
rows = []
while url:
    root = get(url)
    for rec in root.iterfind(".//o:record", NS):
        if rec.find("o:header", NS).get("status") == "deleted":
            continue
        m = rec.find(".//{*}dc", NS) if False else rec.find(".//{http://www.openarchives.org/OAI/2.0/oai_dc/}dc")
        g = lambda t: [e.text.strip() for e in m.iterfind(f"dc:{t}", NS) if e.text]
        ids = g("identifier")
        rows.append({
            "oai": rec.find("o:header/o:identifier", NS).text,
            "title": (g("title") or [""])[0],
            "authors": g("creator"),
            "date": (g("date") or [""])[0],
            "abstract": (g("description") or [""])[0],
            "subjects": g("subject"),
            "urls": [i for i in ids if i.startswith("http")],
            "relation": g("relation"),
            "source": g("source"),
        })
    tok = root.find(".//o:resumptionToken", NS)
    url = f"{BASE}?verb=ListRecords&resumptionToken={urllib.parse.quote(tok.text)}" if tok is not None and tok.text else None
with open("data/records.jsonl", "w") as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(len(rows), "records;", sum(1 for r in rows if r["abstract"]), "with abstract")
