// R170/R172/R173/R174 browser guard (needs `vite preview` on :4173): node scripts/map-reader-probe.mjs -> "N checks, M FAIL".
// Map: no NaN transform on any article seed (incl. seeds with 0 links), legend names weak lines and the search ring, + - 0 and arrows work on the focused svg.
// Reader: paragraph measure at 1300px stays 45-80 characters for every text size (font-size * 0.5 = average glyph width).
import { chromium } from "playwright-core"; import { homedir } from "os"; import fs from "fs";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const c = await b.newContext({ viewport: { width: 1300, height: 900 } }); await c.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })));
const p = await c.newPage(); let n = 0, bad = 0; const ok = (m, v) => { n++; if (!v) { bad++; console.log("FAIL " + m); } };
const A = JSON.parse(fs.readFileSync(new URL("../dist/index/articles.json", import.meta.url)));
const tf = () => p.locator("svg[aria-label='Relationship map'] g[transform]").first().getAttribute("transform");
const seeds = A.filter((a) => !(a.related || []).length && !(a.subjects || []).length).slice(0, 3).map((a) => a.id); // 0-link seeds, if any
const some = [...seeds, ...A.filter((a) => (a.related || []).length < 2).slice(0, 5).map((a) => a.id), A[0].id];
for (const id of new Set(some)) for (const m of ["Circuit", "Rings"]) {
  await p.goto(`http://localhost:4173/#/maps/pub/${id}`); await p.waitForSelector("svg[aria-label='Relationship map']"); await p.getByRole("button", { name: m, exact: true }).click(); await p.waitForTimeout(150);
  ok(`finite transform seed ${id} ${m}`, !/NaN|Infinity/.test(await tf()));
}
await p.goto(`http://localhost:4173/#/maps/pub/${A[0].id}`); const svg = p.locator("svg[aria-label='Relationship map']"); await svg.waitFor();
const legend = await p.locator("main").innerText(); ok("legend: weak line", /weak line/.test(legend)); ok("legend: in your advanced search", /in your advanced search/.test(legend));
const k = async () => +/scale\(([\d.]+)/.exec(await tf())[1], pos = async () => /translate\(([-\d.]+) ([-\d.]+)\) scale/.exec(await tf()).slice(1).map(Number);
await svg.focus(); const k0 = await k(), p0 = await pos();
for (let i = 0; i < 3; i++) await p.keyboard.press("+"); const k1 = await k(); ok("+ zooms in", k1 > k0 * 1.3);
await p.keyboard.press("-"); ok("- zooms out", (await k()) < k1);
await p.keyboard.press("ArrowLeft"); const p1 = await pos(); ok("ArrowLeft pans", p1[0] < (await pos())[0] + 1 && p1[0] !== p0[0]);
await p.keyboard.press("0"); ok("0 resets", Math.abs((await k()) - k0) < 1e-6 && (await pos()).every((v, i) => Math.abs(v - p0[i]) < 1e-6));
for (const z of [0, 1, 2]) {
  await c.addInitScript((z) => localStorage.setItem("ijodel-text", String(z)), z); await p.goto("http://localhost:4173/#/read/3"); await p.reload(); await p.waitForSelector("article p");
  const r = await p.evaluate(() => { const e = [...document.querySelectorAll("article p")].filter((x) => x.innerText.length > 200)[0]; const cs = getComputedStyle(e), zm = +(getComputedStyle(e.closest("[style*=zoom]") || document.body).zoom || 1); return { w: e.getBoundingClientRect().width, fs: parseFloat(cs.fontSize), zm }; });
  const chars = r.w / (r.fs * 0.5 * r.zm) ; ok(`reader measure text size ${z}: ${chars.toFixed(0)} chars`, chars >= 45 && chars <= 80);
}
console.log(`${n} checks, ${bad} FAIL`); await b.close(); process.exit(bad ? 1 : 0);
