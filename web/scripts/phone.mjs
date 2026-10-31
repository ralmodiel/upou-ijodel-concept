// Phone-width overflow check: node scripts/phone.mjs  (needs `vite preview` on :4173). Prints "N routes, M overflow"; exits 1 on overflow. Screenshots: SHOTS=dir.
import { chromium } from "playwright-core";
import { homedir } from "os";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: +(process.env.W || 390), height: 844 }, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} });
const p = await ctx.newPage();
const routes = ["/", "/search/libre", "/advanced", "/maps", "/read/3"]; let bad = 0;
for (const r of routes) {
  await p.goto("http://localhost:4173/#" + r); await p.waitForTimeout(1500);
  const o = await p.evaluate(() => { const w = document.documentElement.clientWidth; const off = [...document.body.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > w + 1 && !e.closest(".row-track, [class*=overflow-x], [class*=overflow-hidden], svg, canvas") && getComputedStyle(e).position !== "fixed"; }).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 40)); return { over: document.documentElement.scrollWidth > w, off }; });
  if (o.over) { bad++; console.log("OVERFLOW", r, o.off.join(" | ")); }
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/p${r.replace(/\W+/g, "_")}.png` });
}
// Overlap probe: floating controls (fixed elements, plus absolutely placed buttons over the map) must not cover each other.
// Fresh visitor (cookie banner up) on home, the map at rest and in full screen.
const float = () => { const vis = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== "hidden" && r.bottom > 0 && r.top < innerHeight; };
  const els = [...document.querySelectorAll("body *")].filter((e) => { const c = getComputedStyle(e); return (c.position === "fixed" && !/inset-0/.test(e.className)) || (c.position === "absolute" && e.tagName === "BUTTON"); }).filter(vis).filter((e, _, a) => !a.some((o) => o !== e && o.contains(e)));
  const hits = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect(); if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) hits.push([els[i], els[j]].map((e) => e.tagName + ":" + (e.getAttribute("aria-label") || e.textContent).slice(0, 30)).join(" x ")); }
  return { n: els.length, hits }; };
let overlap = 0;
for (const [label, r, fresh, fs] of [["home, fresh visitor", "/", true], ["home, decided", "/", false], ["maps", "/maps", false], ["maps full screen", "/maps", false, true], ["reader", "/read/3", false]]) {
  const c2 = await b.newContext({ viewport: { width: +(process.env.W || 390), height: 844 }, hasTouch: true, isMobile: true });
  if (!fresh) await c2.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} });
  const q = await c2.newPage(); await q.goto("http://localhost:4173/#" + r); await q.waitForTimeout(1500);
  if (fs) { await q.getByRole("button", { name: "Full screen map" }).click().catch(() => {}); await q.waitForTimeout(600); await q.locator("svg g[data-node]").first().click().catch(() => {}); await q.waitForTimeout(300); }
  const o = await q.evaluate(float); if (o.hits.length) { overlap++; console.log("OVERLAP", label, o.hits.slice(0, 3).join(" | ")); }
  await c2.close();
}
// R112: the cookie banner must stay under 40% of the viewport and leave the home search box uncovered.
{ const c3 = await b.newContext({ viewport: { width: +(process.env.W || 390), height: 844 }, hasTouch: true, isMobile: true }); const q = await c3.newPage(); await q.goto("http://localhost:4173/#/"); await q.waitForTimeout(1500);
  const o = await q.evaluate(() => { const d = document.querySelector('[role=dialog][aria-label="Cookie and privacy choices"]'), s = document.querySelector('input[role=combobox]'); if (!d || !s) return { miss: true }; const a = d.getBoundingClientRect(), r = s.getBoundingClientRect(); return { h: a.height / innerHeight, cover: r.bottom > 0 && r.top < innerHeight && a.left < r.right && r.left < a.right && a.top < r.bottom && r.top < a.bottom }; });
  if (o.miss || o.h > 0.4 || o.cover) { overlap++; console.log("BANNER", JSON.stringify(o)); } else console.log("banner height", o.h.toFixed(2), "of viewport, search box clear"); await c3.close(); }
// R114/R115: the map starts above the fold; touch targets on /maps and /advanced are >= 40px high.
{ const c4 = await b.newContext({ viewport: { width: +(process.env.W || 390), height: 844 }, hasTouch: true, isMobile: true }); await c4.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} }); const q = await c4.newPage();
  await q.goto("http://localhost:4173/#/maps/pub/3"); await q.waitForSelector('svg[aria-label="Relationship map"]'); await q.waitForTimeout(800);
  const top = await q.evaluate(() => Math.round(document.querySelector('svg[aria-label="Relationship map"]').getBoundingClientRect().top)); if (top >= 560) { overlap++; console.log("MAP TOP", top, "px (limit 560)"); } else console.log("map top", top, "px");
  for (const r of ["/maps/pub/3", "/advanced"]) { await q.goto("http://localhost:4173/#" + r); await q.waitForTimeout(1200);
    const small = await q.evaluate(() => [...document.querySelectorAll("button, input, select, label, summary, [role=button]")].filter((e) => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && c.visibility !== "hidden" && !e.disabled && r.height < 39.5 && !(e.tagName === "INPUT" && e.closest("label")) && !e.closest("svg") && !(e.closest("details:not([open])") && e.tagName !== "SUMMARY") && !(e.tagName === "LABEL" && e.querySelector("input:not([type=checkbox]):not([type=radio]), select, textarea")); }).map((e) => `${e.tagName.toLowerCase()}:${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24)}:${Math.round(e.getBoundingClientRect().height)}`));
    if (small.length) { overlap += small.length; console.log("SMALL", r, small.slice(0, 12).join(" | ")); } }
  // R155: on /advanced a "Show N results" button sits within the viewport and takes focus to the results
  const sb = q.getByRole("button", { name: /^Show \d+ results?$/ }), box = await sb.boundingBox().catch(() => null);
  const inView = !!box && box.y >= 0 && box.y + box.height <= 844; if (inView) await sb.click(); const jumped = inView && await q.evaluate(() => document.activeElement?.id === "adv-results" && document.activeElement.getBoundingClientRect().top < innerHeight);
  if (!jumped) { overlap++; console.log("SHOW RESULTS", JSON.stringify(box)); } else console.log("show-results button at", Math.round(box.y), "px, jumps to results");
  await c4.close(); }
// R163: the quick tour card stays inside the viewport on every step. R165: on /maps the "Maps" tab is inside the nav's visible box.
{ const c5 = await b.newContext({ viewport: { width: +(process.env.W || 390), height: 844 }, hasTouch: true, isMobile: true }); await c5.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} }); const q = await c5.newPage();
  await q.goto("http://localhost:4173/#/"); await q.waitForSelector('section[aria-label="Quick tour"]'); const out = [];
  for (let i = 0; i < 5; i++) { const r = await q.evaluate(() => { const e = document.querySelector('section[aria-label="Quick tour"]').getBoundingClientRect(); return [e.left, e.right]; }); if (r[0] < 0 || r[1] > 390.5) out.push(`step ${i + 1} ${r.map(Math.round)}`); const nx = q.getByRole("button", { name: "Next" }); if (!(await nx.count())) break; await nx.click(); }
  await q.goto("http://localhost:4173/#/maps"); await q.waitForTimeout(1200);
  const t = await q.evaluate(() => { const n = document.querySelector('nav[aria-label="Main"]'), a = [...n.querySelectorAll("a")].find((x) => x.textContent.trim() === "Maps"), A = a.getBoundingClientRect(), N = n.getBoundingClientRect(); return A.left >= N.left - 0.5 && A.right <= N.right + 0.5; });
  if (out.length || !t) { overlap++; console.log("TOUR/NAV", out.join("; "), "mapsTabVisible", t); } else console.log("tour inside viewport on every step; Maps tab visible in nav"); await c5.close(); }
console.log(`${routes.length} routes, ${bad} overflow; 6 overlap probes, ${overlap} overlap`); bad += overlap; await b.close(); process.exit(bad ? 1 : 0);
