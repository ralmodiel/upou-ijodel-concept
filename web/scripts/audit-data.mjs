// Data audit (run in web/): node scripts/audit-data.mjs
// Checks public/index: every article has abstract, authors, year, issue, categories, a cover (issue in issues.json),
// passages and vectors; ids unique; related ids resolve; no empty tags. Prints "N checks, M FAIL", exits 1 on failure.
import fs from "node:fs"; import path from "node:path";
const dir = path.resolve(import.meta.dirname, "../public/index"), J = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
const arts = J("articles.json"), issues = J("issues.json"), chunks = J("chunks.json"), pass = J("passages.json");
const vecs = fs.statSync(path.join(dir, "vecs.bin")).size / 4 / 384;
let n = 0, bad = 0;
const check = (fails, msg) => { n++; if (fails.length) bad++; console.log(`${fails.length ? "FAIL" : "ok  "} ${msg}${fails.length ? ` (${fails.length}: ${fails.slice(0, 5).join(", ")})` : ""}`); };
const ids = new Set(arts.map((a) => a.id)), key = (a) => a.issue.vol + "." + String(a.issue.no).replace("&", "-");
const each = (msg, bad) => check(arts.filter(bad).map((a) => a.id), msg);
check(ids.size === arts.length ? [] : ["dup"], `${arts.length} article ids unique`);
each("abstract, or a summary for editorials without one", (a) => !a.abstract?.trim() && !a.half?.trim());
console.log(`note ${arts.filter((a) => !a.abstract?.trim()).length} articles have no source abstract (editorials, reviews); UI falls back to the half-page summary`);
each("authors", (a) => !a.authors?.length || a.authors.some((x) => !x.trim()));
each("year 4 digits", (a) => !/^(19|20)\d\d$/.test(a.year));
each("issue vol/no/label", (a) => !a.issue?.vol || !a.issue.no || !a.issue.label);
// OJS publication year can differ from the issue date (back issues uploaded later): reported, not failed.
const dec = JSON.parse(fs.readFileSync(path.resolve(dir, "../../../data/year-decisions.json"), "utf8"));
const pendY = arts.filter((a) => !a.issue?.label?.includes(a.year) && !dec[a.id]).length;
if (pendY) console.log(`note ${pendY} articles whose year differs from their issue label, awaiting an editor (scripts/year-review.mjs -> data/year-review.tsv)`);
// same person spelled two ways (case, punctuation, swapped name order): fix in data/author-aliases.json
const akey = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");
const spell = new Map(); arts.flatMap((a) => a.authors || []).forEach((s) => spell.set(akey(s), new Set([...(spell.get(akey(s)) || []), s])));
check([...spell.values()].filter((v) => v.size > 1).map((v) => [...v].join(" / ")), "one spelling per author");
each("categories", (a) => !a.categories?.length || a.categories.some((c) => !c.trim()));
each("cover (issue in issues.json)", (a) => !issues[key(a)]?.cover || !fs.existsSync(path.join(dir, "..", issues[key(a)].cover)));
each("no empty tags", (a) => !Array.isArray(a.subjects) || a.subjects.some((t) => !t.trim()));
each("summaries half/one/two", (a) => !a.half?.trim() || !a.one?.trim() || !a.two?.trim());
const per = new Map(); chunks.forEach((id, c) => pass[c]?.[1]?.trim() && per.set(id, (per.get(id) || 0) + 1));
each("passages with text", (a) => !per.get(a.id));
check(chunks.filter((id) => !ids.has(id)), "chunk ids resolve");
check(chunks.length === pass.length && chunks.length === vecs ? [] : [`chunks ${chunks.length} passages ${pass.length} vecs ${vecs}`], "chunks = passages = vectors");
check(arts.flatMap((a) => (a.related || []).filter((r) => !ids.has(r.id) || r.id === a.id).map((r) => a.id + "->" + r.id)), "related ids resolve (not self)");
check(Object.keys(issues).filter((k) => !arts.some((a) => key(a) === k)), "every issue has articles");
console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
