// did-you-mean unit check (round 190, run in web/): node scripts/dym-unit.mjs. "N checks, M FAIL".
// For the 100+25 search-eval queries and 200 corpus words: didYouMean(didYouMean(q)) is null (a hint never needs a second hint),
// and a query made only of corpus words (title, subjects, abstract, authors) gets no hint.
import fs from "node:fs"; import path from "node:path";
const dir = path.resolve(import.meta.dirname, "../public/index");
globalThis.fetch = async (u) => { const b = fs.readFileSync(path.join(dir, u.split("/index/")[1])); return { json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const E = await import("../src/engine.js"); await E.load();
const src = fs.readFileSync(path.resolve(import.meta.dirname, "search-eval.mjs"), "utf8");
const Q = [...src.matchAll(/\["([^"]+)", ?"\d+"\]/g)].map((m) => m[1]);
const arts = JSON.parse(fs.readFileSync(path.join(dir, "articles.json")));
const words = [...new Set(arts.flatMap((a) => (a.title + " " + a.subjects.join(" ") + " " + a.abstract + " " + a.authors.join(" ")).toLowerCase().match(/[a-z0-9]{2,}/g) || []))];
let seed = 190; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const W = Array.from({ length: 200 }, () => words[Math.floor(rnd() * words.length)]);
let n = 0; const bad = [];
for (const q of Q) { n++; const h = E.didYouMean(q); if (h && E.didYouMean(h)) bad.push(`not idempotent: ${q} -> ${h} -> ${E.didYouMean(h)}`); }
for (const w of W) { n++; const h = E.didYouMean(w); if (h) bad.push(`hint for corpus word: ${w} -> ${h}`); }
// R240/R241/R249: repeat queries give identical lists; a year filter still returns min(k, articles of that year); a 20,000-word query is fast
await E.ready(false);
const yrs = {}; arts.forEach((a) => yrs[a.year] = (yrs[a.year] || 0) + 1);
for (const q of Q.slice(0, 20)) { n++; const ids = async () => (await E.searchArticles(q, { k: 20 })).map((a) => a.id).join(); if (await ids() !== await ids()) bad.push("unstable list: " + q); }
for (const q of ["learning", "teaching"]) for (const y of Object.keys(yrs)) { n++; const r = (await E.searchArticles(q, { k: 20, year: y })).length; if (r < Math.min(20, yrs[y])) bad.push(`year ${y} "${q}": ${r} < ${Math.min(20, yrs[y])}`); }
{ n++; const t = performance.now(); await E.searchArticles(Array.from({ length: 20000 }, (_, i) => "wrd" + (i % 977) + "x").join(" "), { k: 20 }); const ms = performance.now() - t; if (ms > 200) bad.push(`20,000-word query took ${Math.round(ms)} ms`); }
bad.slice(0, 10).forEach((b) => console.log("FAIL", b));
console.log(`${Q.length} queries + ${W.length} words: ${n} checks, ${bad.length} FAIL`); process.exit(bad.length ? 1 : 0);
