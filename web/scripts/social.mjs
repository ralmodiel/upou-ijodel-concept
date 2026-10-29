// Regenerates public/img/social.png (1200x630 share thumbnail, a collage): node scripts/social.mjs (needs `vite preview` on :4173). After it runs, shrink the PNG (Pillow: Image.convert("RGB").quantize(256).save(f, optimize=True)) to stay under ~300 KB.
// Four quadrants: the home page, the latest-issues section, the Advanced search with its Preview of suggestions highlighted, and scripts/social-map.png (a relationship map).
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { homedir } from "os";
const here = (f) => new URL(f, import.meta.url).pathname;
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const c = await b.newContext({ viewport: { width: 1200, height: 630 } });
await c.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: false, lists: false, model: false, counter: false })));
const p = await c.newPage(); await p.goto("http://localhost:4173/#/"); await p.waitForSelector("h1"); await p.waitForTimeout(1500);
// the hint pill and cookie button are noise in a thumbnail
const clean = (pg = p) => pg.evaluate(() => { document.querySelectorAll('[aria-label="Cookie settings"]').forEach((e) => e.remove()); [...document.querySelectorAll("button,a")].filter((e) => /^Scroll for more/.test(e.textContent)).forEach((e) => e.remove()); });
await clean(); const home = await p.screenshot();
await p.evaluate(() => { const h = [...document.querySelectorAll("h2")].find((e) => e.textContent.trim() === "Latest issues"); scrollTo(0, h.getBoundingClientRect().top + scrollY - 24); }); await p.waitForTimeout(800); await clean(); const issues = await p.screenshot();
const ap = await c.newPage(); await ap.goto("http://localhost:4173/#/advanced"); await ap.waitForSelector('aside h2:text("Best suggestions")'); await ap.waitForTimeout(800);
const sug = ap.locator('aside:has(h2:text("Best suggestions")) button'); for (let i = 0; i < 2; i++) { await sug.first().click(); await ap.waitForTimeout(400); } // two Expand chips so the preview fills
await ap.evaluate(() => { const a = document.querySelector('aside[aria-label="Preview of suggestions"]'); a.style.outline = "4px solid #f5b301"; a.style.boxShadow = "0 0 0 8px rgba(245,179,1,.3)"; scrollTo(0, a.getBoundingClientRect().top + scrollY - 40); }); await ap.waitForTimeout(800); await clean(ap); const adv = await ap.screenshot();
const u = (buf) => "data:image/png;base64," + buf.toString("base64");
const q = await (await b.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await q.setContent(`<body style="margin:0;width:1200px;height:630px;background:#28345A;display:grid;grid-template:312px 312px/597px 597px;gap:6px;overflow:hidden">
<img src="${u(home)}" style="width:100%;height:100%;object-fit:cover;object-position:top"><img src="${u(issues)}" style="width:100%;height:100%;object-fit:cover;object-position:top">
<img src="${u(adv)}" style="width:100%;height:100%;object-fit:cover;object-position:top"><div style="overflow:hidden;background:#f7f9fd"><img src="${u(readFileSync(here("social-map.png")))}" style="width:100%;height:100%;object-fit:contain"></div></body>`);
await q.waitForTimeout(500); await q.screenshot({ path: here("../public/img/social.png") }); await b.close();
