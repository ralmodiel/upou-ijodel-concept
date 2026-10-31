// Round 108 href allowlist crawl (needs `vite preview` on :4173): node scripts/href-allow.mjs
// Every rendered <a href> on 8 routes is #route, mailto:, or https: on a host from articles.json url fields plus creativecommons.org,
// scholar.google.com, www.flagcounter.me. No javascript:, data:, http: or off-list host. Exits 1 on any violation.
import { chromium } from "playwright-core";
import { homedir } from "os";
import fs from "fs";
const A = JSON.parse(fs.readFileSync(new URL("../dist/index/articles.json", import.meta.url)));
const hosts = new Set([...A.map((a) => { try { return new URL(a.url).host; } catch { return ""; } }).filter(Boolean), "creativecommons.org", "scholar.google.com", "www.flagcounter.me"]);
const routes = ["/", "/search/libre", "/advanced", "/maps", "/read/295", "/issues", "/topics", "/about"];
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })));
const p = await ctx.newPage(); let n = 0, links = 0, bad = 0;
for (const r of routes) {
  await p.goto("http://localhost:4173/#" + r); await p.waitForSelector("h1"); await p.waitForTimeout(600);
  for (const h of await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))) {
    n++; links++; let ok = h.startsWith("#") || h.startsWith("mailto:");
    if (!ok && /^https:\/\//i.test(h)) try { ok = hosts.has(new URL(h).host); } catch { /* bad URL */ }
    if (!ok) { bad++; console.log(`FAIL ${r} ${h.slice(0, 100)}`); }
  }
}
await b.close(); console.log(`${n} checks, ${bad} FAIL (${routes.length} routes, ${links} anchors, ${hosts.size} hosts)`); process.exit(bad ? 1 : 0);
