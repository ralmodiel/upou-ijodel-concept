// Hosting headers check (rounds 86/93): node scripts/headers.mjs [https://live.host/path/]
// No URL: checks dist/_headers (CSP equals the index.html meta CSP plus frame-ancestors, the security headers, cache rules).
// With a URL: fetches the page, an asset, sw.js and an index file from the live host and checks the same headers plus
// compression and caching. GitHub Pages cannot set headers: expect FAIL there for CSP/HSTS-preload/frame-ancestors (see docs/hosting.md).
import fs from "fs"; import path from "path"; import { createHash } from "crypto";
const web = path.join(import.meta.dirname, ".."), url = process.argv[2];
let n = 0, bad = 0; const ok = (m, c, x = "") => { n++; console.log(`${c ? "PASS" : "FAIL"} ${m} ${x}`); if (!c) bad++; };
const meta = fs.readFileSync(path.join(web, "index.html"), "utf8").match(/Content-Security-Policy" content="([^"]*)"/)[1];
const SEC = { "content-security-policy": (v) => v.includes(meta) && /frame-ancestors 'none'/.test(v), "strict-transport-security": (v) => /max-age=(\d+)/.exec(v)?.[1] >= 15552000,
  "x-content-type-options": (v) => v === "nosniff", "referrer-policy": (v) => /strict-origin/.test(v), "permissions-policy": (v) => /camera=\(\)/.test(v) };
// R148: meta CSP has no 'unsafe-inline' / 'unsafe-eval' token and exactly the two documented wildcard hosts
{ const toks = meta.split(/[\s;]+/), wild = toks.filter((t) => /\*/.test(t)).map((t) => t.replace(/^https?:\/\//, "")).sort();
  ok("meta CSP: no unsafe-inline / unsafe-eval", !toks.some((t) => /^'unsafe-(inline|eval)'$/.test(t)));
  ok("meta CSP: wildcard hosts are only *.huggingface.co and *.hf.co", JSON.stringify(wild) === JSON.stringify(["*.hf.co", "*.huggingface.co"]), wild.join(",")); }
if (!url) {
  const h = fs.readFileSync(path.join(web, "dist/_headers"), "utf8"), block = (p) => Object.fromEntries((h.split(/^(?=\S)/m).find((b) => b.startsWith(p + "\n")) || "").split("\n").slice(1).filter(Boolean).map((l) => { const i = l.indexOf(":"); return [l.slice(0, i).trim().toLowerCase(), l.slice(i + 1).trim()]; }));
  const all = block("/*"); // R149
  for (const f of ["camera", "microphone", "geolocation", "payment", "usb", "interest-cohort"]) ok(`_headers Permissions-Policy denies ${f}`, new RegExp(`\\b${f}=\\(\\)`).test(all["permissions-policy"] || ""));
  ok("_headers Cross-Origin-Opener-Policy same-origin", all["cross-origin-opener-policy"] === "same-origin"); for (const [k, f] of Object.entries(SEC)) ok(`_headers /* ${k}`, all[k] && f(all[k]));
  ok("_headers Trusted Types trial (report-only)", /require-trusted-types-for/.test(all["content-security-policy-report-only"] || ""));
  ok("_headers assets immutable", /immutable/.test(block("/assets/*")["cache-control"] || ""));
  ok("_headers sw.js not cached", /no-cache/.test(block("/sw.js")["cache-control"] || ""));
  if (process.env.CI) console.log("SKIP R118 style-hash probe in CI (needs a local browser and vite preview on :4173)"); else {
  // R118: style-src sha256 hashes in the meta CSP must equal the sha256 of every <style> the pages hold (inline in dist html, or injected by the 3D map library). Needs `vite preview` on :4173.
  const sha = (s) => "sha256-" + createHash("sha256").update(s).digest("base64"), have = new Set([...(meta.match(/style-src([^;]*)/)?.[1] || "").matchAll(/'(sha256-[^']+)'/g)].map((m) => m[1]));
  const { chromium } = await import("playwright-core"), { homedir } = await import("os"), br = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const cx = await br.newContext(); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} }); const pg = await cx.newPage(), want = new Set();
  for (const r of ["/", "/maps/pub/3", "/advanced", "/read/3", "/privacy"]) { await pg.goto("http://localhost:4173/#" + r); await pg.waitForTimeout(1000); if (r.startsWith("/maps")) { await pg.getByRole("button", { name: "3D", exact: true }).click(); await pg.waitForTimeout(2500); await pg.mouse.move(700, 600); await pg.waitForTimeout(500); await pg.getByRole("button", { name: "Theater mode" }).click().catch(() => {}); await pg.waitForTimeout(800); }
    for (const t of await pg.evaluate(() => [...document.querySelectorAll("style")].map((e) => e.textContent))) want.add(sha(t)); }
  await br.close(); const miss = [...want].filter((x) => !have.has(x)), stale = [...have].filter((x) => !want.has(x));
  // shortcut: a hash whose <style> only appears in states this probe does not reach shows as "unseen", not a failure; add the state when found
  ok("every <style> the pages hold has its hash in the CSP", !miss.length, `(held ${want.size}, in CSP ${have.size}, missing ${miss.length}, unseen ${stale.length})`);
  }
} else {
  const get = async (p) => { const r = await fetch(new URL(p, url), { headers: { "accept-encoding": "gzip, br" } }); return { s: r.status, h: r.headers }; };
  const page = await get("./"), html = await (await fetch(url)).text(), js = html.match(/assets\/index-[^"]+\.js/)?.[0];
  for (const [k, f] of Object.entries(SEC)) ok(`live ${k}`, page.h.get(k) && f(page.h.get(k)), page.h.get(k) ? "" : "(missing; meta CSP still applies)");
  ok("live page compressed", /gzip|br/.test(page.h.get("content-encoding") || ""));
  if (js) { const a = await get(js); ok("live asset cached >= 1 day", +(/max-age=(\d+)/.exec(a.h.get("cache-control") || "")?.[1] || 0) >= 86400, a.h.get("cache-control") || ""); }
  const sw = await get("sw.js"); ok("live sw.js served", sw.s === 200);
  const ix = await get("index/articles.json"); ok("live index compressed", /gzip|br/.test(ix.h.get("content-encoding") || ""));
}
console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
