// R157 guard: the idle Maps/Advanced chunk prefetch is same-origin, skipped under ijodel-lite=1 and on save-data / 2g, and starts only after
// the first search results are on screen: node scripts/prefetch-check.mjs (needs `vite preview` on :4173) -> "N checks, M FAIL".
import { chromium } from "playwright-core"; import { homedir } from "os";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const run = async (init) => {
  const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true }))); if (init) await c.addInitScript(init);
  const p = await c.newPage(), asked = []; let first = 0; const t0 = Date.now();
  p.on("request", (r) => { if (/assets\/(Maps|Advanced)-.*\.js/.test(r.url())) asked.push({ t: Date.now() - t0, u: r.url() }); });
  await p.goto("http://localhost:4173/#/search/libre"); const sel = p.locator('main a[href^="#/read/"]').first(); await sel.waitFor({ timeout: 20000 }); first = Date.now() - t0;
  await p.waitForTimeout(3500); await c.close(); return { asked, first };
};
const base = await run(), lite = await run(() => sessionStorage.setItem("ijodel-lite", "1")),
  save = await run(() => Object.defineProperty(navigator, "connection", { value: { saveData: true } })), g2 = await run(() => Object.defineProperty(navigator, "connection", { value: { effectiveType: "2g" } }));
const rows = [
  ["capable device prefetches Maps and Advanced", base.asked.length >= 2],
  ["same origin only", base.asked.every((a) => a.u.startsWith("http://localhost:4173/"))],
  ["not before first results render", base.asked.every((a) => a.t >= base.first)],
  ["skipped under ijodel-lite=1", lite.asked.length === 0],
  ["skipped on save-data", save.asked.length === 0],
  ["skipped on 2g", g2.asked.length === 0],
];
let bad = 0; for (const [n, ok] of rows) if (!ok) { bad++; console.log("FAIL " + n, JSON.stringify({ first: base.first, asked: base.asked.map((a) => a.t) })); }
console.log(`${rows.length} checks, ${bad} FAIL`); await b.close(); process.exit(bad ? 1 : 0);
