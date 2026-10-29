"""QA rounds for the generated FAQs. Needs data/faqs2.jsonl (faq2.py) and data/pdf/*.pdf.
  python qa.py r1            script round: locate each answer's PDF page + paragraph, drop duplicates / ungrounded -> data/faqs3.jsonl
  python qa.py r2 [workers]  LLM round: rewrite answers that found no source and add PDF-grounded Q&As for short articles, then re-check
Prints a verdict line; exit 1 if an article is still below MIN."""
import json, re, sys, collections, httpx, pymupdf
from concurrent.futures import ThreadPoolExecutor
LLM, MIN, FOUND = "http://127.0.0.1:8093/v1/chat/completions", 14, 0.55
STOP = set("the a an of to in and or is are was were be for on with that this it as by from at which their its they have has not can also such more than into these those been being".split())
toks = lambda s: {w for w in re.findall(r"[a-z0-9]{4,}", s.lower()) if w not in STOP}
_paras = {}
def paras(aid):
    if aid not in _paras:
        out = []
        for pno, pg in enumerate(pymupdf.open(f"data/pdf/{aid}.pdf"), 1):
            n = 0
            for b in pg.get_text("blocks"):
                t = " ".join(b[4].split())
                if len(t.split()) >= 20: n += 1; out.append((pno, n, t, toks(t)))
        _paras[aid] = out
    return _paras[aid]
def locate(aid, a):
    """Smallest run of up to 3 consecutive paragraphs holding most of the answer's words."""
    ws = toks(a); P = paras(aid); best = (0, None, 0)
    for i in range(len(P)):
        for w in (1, 2, 3):
            win = P[i:i + w]
            if len(win) < w: break
            raw = len(ws & set().union(*[p[3] for p in win])) / len(ws) if ws else 0
            if raw - 0.03 * (w - 1) > best[0] - 0.03 * (best[2] - 1 if best[1] else 0): best = (raw, win, w)
    if best[1] and best[0] >= FOUND:
        f, l = best[1][0], best[1][-1]
        return {"page": f[0], "para": f[1], "to_page": l[0], "to_para": l[1], "quote": f[2][:200] + ("…" if len(f[2]) > 200 else ""), "score": round(best[0], 2)}
def dedupe(items):
    kept = []
    for x in items:
        q = toks(x["q"])
        if not any(len(q & toks(k["q"])) / max(1, len(q | toks(k["q"]))) > 0.6 for k in kept): kept.append(x)
    return kept
BAD = re.compile(r"\b(the|this) (text|article|study|paper|authors?|passage|document)\b", re.I)
def flat(j):
    return [{"kind": "key", "rank": i + 1, "q": x["q"], "a": x["a"]} for i, x in enumerate(j["key"])] + \
           [{"kind": "topic", "about": x["about"], "q": x["q"], "a": x["a"]} for x in j["topics"]]
def round1():
    seen, out, drop = set(), [], collections.Counter()
    for l in open("data/faqs2.jsonl"):
        j = json.loads(l)
        if j["article"] in seen: continue
        seen.add(j["article"]); items = dedupe([x for x in flat(j) if not BAD.search(x["q"])])
        for x in items:
            x["ref"] = locate(j["article"], x["a"]); drop["no source" if not x["ref"] else "ok"] += 1
        out.append({"article": j["article"], "items": items})
    with open("data/faqs3.jsonl", "w") as f:
        for o in out: f.write(json.dumps(o, ensure_ascii=False) + "\n")
    return out, drop
def good(o): return [x for x in o["items"] if x["ref"]]
def verdict(out, tag):
    short = [o["article"] for o in out if len(good(o)) < MIN]; n = sum(len(good(o)) for o in out)
    print(f"{tag}: {len(out)} articles, {n} sourced Q&As (avg {n / max(1, len(out)):.1f}), {len(short)} below {MIN}: {short[:12]}")
    return short
def ask(p):
    c = httpx.post(LLM, json={"model": "local-fast", "temperature": 0.2, "max_tokens": 6000, "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": p}]}, timeout=900).json()["choices"][0]["message"]["content"]
    return json.loads(c)
def repair(aid, x):
    """Re-answer from the 3 paragraphs closest to the question and old answer; None answer = not answerable."""
    ws = toks(x["q"] + " " + x["a"]); ps = sorted(paras(aid), key=lambda p: -len(ws & p[3]))[:3]
    if not ps: return x
    try:
        r = ask("Answer the question in 2-3 sentences using ONLY facts stated in these paragraphs. If they do not answer it, use null. "
                'Reply as JSON {"a": "..." or null}.\n\nQuestion: ' + x["q"] + "\n\n" + "\n\n".join(p[2] for p in ps)).get("a")
    except Exception: return x
    if r and not BAD.search(r): x["a"] = r; x["ref"] = locate(aid, r)
    return x
def fill(o):
    aid, have = o["article"], good(o); need = max(0, 18 - len(have)); ps = paras(aid)
    used = {(x["ref"]["page"], x["ref"]["para"]) for x in have}
    spare = [p for p in ps if (p[0], p[1]) not in used and len(p[2].split()) >= 40]
    spare = spare[:: max(1, len(spare) // 14)][:14]
    if not need or not spare: return o
    src = "\n\n".join(f"[p{p}.{n}] {t}" for p, n, t, _ in spare)
    try:
        j = ask(f"From these numbered paragraphs of one journal article write {need + 4} NEW FAQs (important questions a reader needs answered), different from: "
                f"{json.dumps([x['q'] for x in o['items']])}. Each question must stand alone (name the subject; never say 'the article', 'the text' or 'the study'); "
                'each answer is 2-3 sentences using ONLY facts in the paragraphs. Reply as JSON {"faqs":[{"q":"","a":""}]}.\n\n' + src)["faqs"]
    except Exception as e:
        print(aid, "FAILED", repr(e)[:60], flush=True); return o
    new = [{"kind": "key", "rank": 99, "q": x["q"], "a": x["a"]} for x in j if isinstance(x, dict) and x.get("q") and x.get("a") and not BAD.search(x["q"])]
    new = dedupe(o["items"] + new)[len(o["items"]):]
    for x in new: x["ref"] = locate(aid, x["a"])
    o["items"] += [x for x in new if x["ref"]][:need]; return o
def round2(workers):
    out, _ = round1_load()
    todo = [(o["article"], x) for o in out for x in o["items"] if not x["ref"]]
    with ThreadPoolExecutor(workers) as ex: list(ex.map(lambda t: repair(*t), todo))
    print("repaired:", sum(1 for _, x in todo if x["ref"]), "of", len(todo), flush=True)
    with ThreadPoolExecutor(workers) as ex: out = list(ex.map(fill, out))
    for o in out: o["items"] = [x for x in o["items"] if x["ref"]]
    with open("data/faqs3.jsonl", "w") as f:
        for o in out: f.write(json.dumps(o, ensure_ascii=False) + "\n")
    return out
def round1_load(): return [json.loads(l) for l in open("data/faqs3.jsonl")], None
if __name__ == "__main__":
    if sys.argv[1] == "r1": out, d = round1(); print(dict(d)); sys.exit(1 if verdict(out, "round 1") else 0)
    out = round2(int(sys.argv[2]) if len(sys.argv) > 2 else 3); sys.exit(1 if verdict(out, "round 2") else 0)
