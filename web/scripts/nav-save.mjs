// R181/R184 browser probe: node scripts/nav-save.mjs  (needs `vite preview` on :4173 with a fresh build). Prints "N checks, M FAIL".
// 1) exactly one main-nav link has aria-current=page on 6 routes (nested /maps/pub/3 marks Maps); 2) a failing SVG-to-PNG conversion shows a status message.
import { chromium } from "playwright-core";
import { homedir } from "os";
import fs from "fs";
const U = "http://localhost:4173/#";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); });
const p = await ctx.newPage(); let n = 0, bad = 0; const ck = (ok, m) => { n++; if (!ok) bad++; console.log((ok ? "ok   " : "FAIL ") + m); };
const want = { "/": "Home", "/issues": "Issues", "/topics": "Topics", "/search/libre": "Search", "/advanced": "Advanced", "/maps/pub/3": "Maps" };
for (const [r, label] of Object.entries(want)) {
  await p.goto(U + r); await p.waitForSelector("main h1");
  const cur = await p.$$eval('nav[aria-label="Main"] a[aria-current="page"]', (a) => a.map((x) => x.textContent.trim()));
  ck(cur.length === 1 && cur[0] === label, `${r}: aria-current on ${JSON.stringify(cur)} want ${label}`);
}
await p.goto(U + "/maps/pub/3"); await p.waitForSelector("main h1");
await p.evaluate(() => { Object.defineProperty(Image.prototype, "src", { set() { setTimeout(() => this.onerror?.(new Event("error")), 0); } }); });
await p.getByText("Save image").click();
ck(await p.getByText("Could not save the image").first().waitFor({ timeout: 2000 }).then(() => true, () => false), "failed image conversion shows a status message");
ck(fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8").includes('<meta name="theme-color" content="#28345a">'), "R182: dist/index.html theme-color is the header navy");
console.log(`${n} checks, ${bad} FAIL`); await b.close(); process.exit(bad ? 1 : 0);
