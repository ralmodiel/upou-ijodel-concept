// Round 107 unit check: node scripts/graph-unit.mjs. src/graph.js shortestPath equals the old per-node link rescan BFS
// on every article seed's real graph shape, and a 2000-link graph runs under 10 ms. Exits 1 on any mismatch.
import { adjacency, shortestPath } from "../src/graph.js";
import fs from "fs";
const old = (links, sel, seed) => { const prev = new Map([[sel, null]]), q = [sel];
  while (q.length && !prev.has(seed)) { const c = q.shift(); for (const l of links) for (const [x, y] of [[l.source.id, l.target.id], [l.target.id, l.source.id]]) if (x === c && !prev.has(y)) { prev.set(y, l); q.push(y); } }
  const out = []; for (let c = seed, l; (l = prev.get(c)); c = l.source.id === c ? l.target.id : l.source.id) out.push(l); return out; };
const A = JSON.parse(fs.readFileSync(new URL("../dist/index/articles.json", import.meta.url)));
const N = (id) => ({ id }), by = new Map(), node = (id) => by.get(id) || (by.set(id, N(id)), by.get(id));
const links = []; A.forEach((a) => (a.related || []).forEach((r) => links.push({ source: node("p" + a.id), target: node("p" + (r.id ?? r)) })));
let n = 0, bad = 0; const chk = (ok, m) => { n++; if (!ok) { bad++; console.log("FAIL " + m); } };
const adj = adjacency(links), ids = [...by.keys()];
for (const seed of ids.slice(0, 120)) for (const sel of ids.slice(0, 30)) chk(shortestPath(adj, seed, sel).length === old(links, sel, seed).length && shortestPath(adj, sel, seed).every((l, i) => l === old(links, sel, seed)[i]) , `path ${sel}->${seed}`);
const big = Array.from({ length: 2000 }, (_, i) => ({ source: N("n" + (i % 700)), target: N("n" + ((i * 7 + 1) % 700)) }));
const bn = new Map(); big.forEach((l) => { for (const k of ["source", "target"]) l[k] = bn.get(l[k].id) || (bn.set(l[k].id, l[k]), l[k]); });
const t = performance.now(), ba = adjacency(big); shortestPath(ba, "n0", "n699"); const ms = performance.now() - t; chk(ms < 10, `2000 links ${ms.toFixed(1)}ms`);
console.log(`${n} checks, ${bad} FAIL (${links.length} real links, ${ms.toFixed(1)} ms for 2000)`); process.exit(bad ? 1 : 0);
