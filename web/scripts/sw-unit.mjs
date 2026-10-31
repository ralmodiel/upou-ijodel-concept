// R168: runs scripts/sw.tpl.js in a node vm with stubbed caches/fetch: node scripts/sw-unit.mjs -> "N checks, M FAIL".
// It must ignore non-GET, cross-origin and model files, and cache only ok, basic, non-redirected responses.
import fs from "node:fs"; import vm from "node:vm";
const src = fs.readFileSync(new URL("./sw.tpl.js", import.meta.url), "utf8").replace("__VER__", "t").replace("/*PRE*/", "");
const run = async (req, res) => {
  const puts = [], L = {}, store = { put: async (q) => puts.push(q.url), addAll: async () => {} };
  const ctx = { self: { addEventListener: (t, f) => (L[t] = f), clients: { claim() {} }, skipWaiting() {} }, location: { origin: "https://x.test" }, URL, Response,
    caches: { open: async () => store, keys: async () => [], delete: async () => true, match: async () => undefined }, fetch: async () => res };
  vm.runInNewContext(src, ctx);
  let handled = false; await new Promise((ok) => { L.fetch({ request: req, respondWith: (p) => { handled = true; Promise.resolve(p).then(ok, ok); } }); setTimeout(ok, 20); });
  await new Promise((r) => setTimeout(r, 5)); return { handled, puts };
};
const rq = (url, method = "GET", mode = "cors") => ({ url, method, mode });
const rs = (o = {}) => ({ ok: true, type: "basic", redirected: false, clone() { return this; }, ...o });
const O = "https://x.test/";
const cases = [
  ["POST ignored", await run(rq(O + "a", "POST"), rs()), false, 0],
  ["cross-origin ignored", await run(rq("https://evil.test/a"), rs()), false, 0],
  ["vectors ignored", await run(rq(O + "index/vecs.bin"), rs()), false, 0],
  ["sw.js ignored", await run(rq(O + "sw.js"), rs()), false, 0],
  ["basic ok cached", await run(rq(O + "a.json"), rs()), true, 1],
  ["redirected not cached", await run(rq(O + "a.json"), rs({ redirected: true })), true, 0],
  ["opaque not cached", await run(rq(O + "a.json"), rs({ type: "opaque", ok: false })), true, 0],
  ["error status not cached", await run(rq(O + "a.json"), rs({ ok: false })), true, 0],
];
let bad = 0; for (const [n, r, h, p] of cases) if (r.handled !== h || r.puts.length !== p) { bad++; console.log(`FAIL ${n}: handled ${r.handled} puts ${r.puts.length}, want ${h} ${p}`); }
console.log(`${cases.length} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
