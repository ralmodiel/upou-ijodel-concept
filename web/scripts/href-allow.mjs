// Round 108 href allowlist crawl (needs `vite preview` on :4173): node scripts/href-allow.mjs
// Every rendered <a href> on 8 routes is #route, mailto:, or https: on a host from articles.json url fields plus creativecommons.org,
// scholar.google.com, www.flagcounter.me. No javascript:, data:, http: or off-list host. Exits 1 on any violation.
import { chromium } from "playwright-core";
import { homedir } from "os";
import fs from "fs";
// R268: a fixed allowlist (the journal host), not hosts read from the data it is meant to check
const hosts = new Set(["ijodel.upou.edu.ph", "creativecommons.org", "scholar.google.com", "www.flagcounter.me"]);
const offList = (u) => { try { const x = new URL(u); return x.protocol !== "https:" || !hosts.has(x.host); } catch { return true; } };
const A = JSON.parse(fs.readFileSync(new URL("../dist/index/articles.json", import.meta.url)));
let n0 = 0, bad0 = 0;
for (const a of A) { n0++; if (a.url && offList(a.url)) { bad0++; console.log(`FAIL data url of ${a.id} off the allowlist: ${String(a.url).slice(0, 80)}`); } }
// R268: prerendered /read/<id>/ pages: JSON-LD sameAs and every https link stay on the allowlist
for (const id of fs.readdirSync(new URL("../dist/read/", import.meta.url))) { const h = fs.readFileSync(new URL(`../dist/read/${id}/index.html`, import.meta.url), "utf8"), ld = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || "{}");
  n0++; const off = [ld.sameAs, ...[...h.matchAll(/<a href="(https?:[^"]*)"/g)].map((m) => m[1])].filter((u) => u && offList(u.replace(/&amp;/g, "&"))); if (off.length || !ld.sameAs) { bad0++; console.log(`FAIL dist/read/${id} sameAs/link ${off[0] || "missing sameAs"}`); } }
const routes = ["/", "/search/libre", "/advanced", "/maps", "/read/295", "/issues", "/topics", "/about"];
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false, counter: true })));
const p = await ctx.newPage(); let n = 0, links = 0, bad = 0;
for (const r of routes) {
  await p.goto("http://localhost:4173/#" + r); await p.waitForSelector("h1"); await p.waitForTimeout(600);
  for (const h of await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))) {
    n++; links++; let ok = h.startsWith("#") || h.startsWith("mailto:");
    if (!ok && /^https:\/\//i.test(h)) try { ok = hosts.has(new URL(h).host); } catch { /* bad URL */ }
    if (!ok) { bad++; console.log(`FAIL ${r} ${h.slice(0, 100)}`); }
  }
  // R178: target=_blank anchors need noopener noreferrer; images from another origin need referrerpolicy
  for (const x of await p.evaluate(() => [...document.querySelectorAll("a[target=_blank]")].filter((a) => !/\bnoopener\b/.test(a.rel) || !/\bnoreferrer\b/.test(a.rel)).map((a) => a.href).concat([...document.querySelectorAll("img[src^='http']")].filter((i) => new URL(i.src).origin !== location.origin && !i.referrerPolicy).map((i) => "img " + i.src)))) { n++; bad++; console.log(`FAIL ${r} rel/referrerpolicy ${x.slice(0, 100)}`); }
}
n += n0; bad += bad0; await b.close(); console.log(`${n} checks, ${bad} FAIL (${routes.length} routes, ${links} anchors, ${A.length} data urls + prerendered pages, ${hosts.size} hosts)`); process.exit(bad ? 1 : 0);
