// Input hardening (round 90; needs `vite preview` on :4173): node scripts/fuzz-inputs.mjs
// Hostile URL hashes (routes, search, shared lists/state, reader page links) and poisoned localStorage for every key the app
// reads. A case passes when the page throws no uncaught error, shows no error boundary and still renders a heading.
import { chromium } from "playwright-core"; import { homedir } from "os";
const U = "http://localhost:4173/";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
let n = 0, bad = 0; const ok = (m, c, x = "") => { n++; if (!c) { bad++; console.log(`FAIL ${m} ${x}`); } };
const big = "a".repeat(200000), ids = Array.from({ length: 5000 }, (_, i) => i).join(",");
const HASH = ["/%", "/%E0%A4%A", "/search/%ZZ%", "/search/" + big, "/search/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E", "/search/author:%22", "/search/year:9999-1", "/search/-", "/search/\"\"\"",
  "/read/__proto__", "/read/constructor", "/read/3/p/999999/%ZZ", "/read/3/p/-1/x", "/read/../../etc/passwd", "/maps/pub/__proto__", "/maps/tag/%", "/maps/x/y/z", "/maps/pub/" + big.slice(0, 5000),
  "/list/share/x/" + ids, "/list/share/%/%", "/list/share/" + big.slice(0, 3000) + "/3", "/list/__proto__", "/advanced/" + big.slice(0, 2000), "/advanced?s=%7B%22req%22%3A1%7D", "/cat/%", "/tag/__proto__", "/year/-1e309", "/issue/0.0", "/" + "/".repeat(500), "/ /\u0000/\uD800"];
const BAD = ['{"__proto__":{"x":1}}', "null", "1", '"str"', "[[[[]]]]", "{", big, '{"req":[{"k":"tag","v":{"a":1}}],"boost":5}', '[{"name":1,"ids":"x"}]', '[null,{"name":"' + big.slice(0, 1000) + '"}]'];
const KEYS = ["ijodel-lists", "ijodel-list", "ijodel-adv", "ijodel-adv-mode", "ijodel-recent", "ijodel-saved", "ijodel-cite", "ijodel-tour", "ijodel-map-seed", "ijodel-text", "ijodel-consent"];
async function check(name, hash, seed) {
  const c = await b.newContext(); await c.addInitScript(([seed]) => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); for (const [k, v] of seed) localStorage.setItem(k, v); } catch {} }, [seed]);
  const p = await c.newPage(), errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("crash", () => errs.push("crash"));
  await p.goto(U + "#" + hash, { timeout: 30000 }).catch((e) => errs.push("goto " + e.message.slice(0, 60)));
  await p.waitForSelector("h1, h2", { timeout: 10000 }).catch(() => errs.push("no heading"));
  await p.waitForTimeout(400); const boundary = await p.locator("text=Something went wrong on this page").count();
  ok(name, !errs.length && !boundary, (errs[0] || (boundary ? "error boundary" : "")).slice(0, 140)); await c.close();
}
for (const h of HASH) await check("hash " + h.slice(0, 60), h, []);
for (const k of KEYS) for (const [i, v] of BAD.entries()) await check(`localStorage ${k} #${i}`, k === "ijodel-adv" || k === "ijodel-adv-mode" ? "/advanced" : k.includes("list") ? "/list" : k === "ijodel-cite" || k === "ijodel-text" ? "/read/3" : "/search", [[k, v]]);
// R141: a poisoned map seed falls back to the default seed (an svg with nodes), not "Nothing to map"
for (const seed of ['{"kind":"tag","id":"zzz"}', '{"kind":"author","id":"x"}', '{"kind":"pub","id":"zzz"}']) {
  const c = await b.newContext(); await c.addInitScript(([s]) => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); localStorage.setItem("ijodel-map-seed", s); } catch {} }, [seed]);
  const p = await c.newPage(); await p.goto(U + "#/maps"); await p.waitForSelector("h1, h2");
  const nodes = await p.waitForSelector("svg [data-node]", { timeout: 8000 }).then(() => 1, () => 0); ok("R141 seed " + seed + " shows nodes", nodes === 1); await c.close();
}
// R140: unknown text sizes keep the reader at the default zoom (same as no key)
{ const zoom = async (v) => { const c = await b.newContext(); await c.addInitScript(([v]) => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); if (v != null) localStorage.setItem("ijodel-text", v); } catch {} }, [v]); const p = await c.newPage(); await p.goto(U + "#/read/3"); await p.waitForSelector("article h1"); const z = await p.evaluate(() => document.querySelector("article div[style*=zoom]")?.style.zoom); await c.close(); return z; };
  const d = await zoom(null); for (const v of BAD.slice(0, 9)) { const z = await zoom(v); ok("R140 ijodel-text " + v.slice(0, 20) + " -> default zoom", z === d || v === "1", z + " vs " + d); } }
// rounds 128-129: a 200k-char query is capped before the engine, and the title stays short and control-free
{ const p = await (await b.newContext()).newPage(); await p.addInitScript(() => { window.__posted = 0; const o = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m) { window.__posted = Math.max(window.__posted, String(m?.a?.[0] ?? "").length); return o.apply(this, arguments); }; });
  const t0 = Date.now(); await p.goto(U + "#/search/" + big + "%00%1f"); await p.waitForSelector("[role=status] b", { timeout: 10000 }); const ms = Date.now() - t0;
  const [len, ctl, posted] = await p.evaluate(() => [document.title.length, /[\u0000-\u001f]/.test(document.title), window.__posted]);
  ok("R128 /search/<200k> renders under 300 ms after load", ms < 300, ms + " ms"); ok("R128 query sent to the worker <= 300 chars", posted > 0 && posted <= 300, posted); ok("R129 title <= 120 chars, no control chars", len <= 120 && !ctl, len); }
await b.close(); console.log(`${n} cases, ${bad} FAIL`); process.exit(bad ? 1 : 0);
