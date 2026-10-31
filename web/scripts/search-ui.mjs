// Search page UI checks (rounds 122-125, 128-129; needs `vite preview` on :4173): node scripts/search-ui.mjs
import { chromium } from "playwright-core"; import { homedir } from "os";
const U = "http://localhost:4173/";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
let n = 0, bad = 0; const ok = (m, c, x = "") => { n++; if (!c) { bad++; console.log(`FAIL ${m} ${x}`); } };
for (const w of [390, 1300]) {
  const p = await (await b.newContext({ viewport: { width: w, height: 900 } })).newPage();
  await p.goto(U + "#/search/libre"); await p.waitForSelector(".cover");
  const hs = await p.$$eval(".cover", (e) => [...new Set(e.map((x) => Math.round(x.getBoundingClientRect().height)))]);
  ok(`R122 ${w}px grid covers share one height`, hs.length === 1, hs);
  await p.getByRole("button", { name: /list/i }).first().click().catch(() => {});
  const lines = await p.$$eval("ol.cv-list li a.font-serif", (e) => e.map((x) => Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight))));
  ok(`R122 ${w}px list titles <= 2 lines`, lines.every((l) => l <= 2), lines.join());
  if (w === 1300) {
    await p.goto(U + "#/search/libre"); await p.waitForSelector("[role=status] b");
    await p.focus("input[role=combobox]");
    let hit = false; for (let k = 0; k < 6 && !hit; k++) { await p.keyboard.press("Tab"); hit = await p.evaluate(() => /Skip to results/.test(document.activeElement.textContent)); }
    ok("R125 Tab from the search box reaches Skip to results", hit);
    await p.getByText("Skip to results").focus(); await p.keyboard.press("Enter");
    ok("R125 Enter focuses the result count", await p.evaluate(() => document.activeElement.id === "count" && document.activeElement.getAttribute("role") === "status"));
    // R124: two searches back to back; the last one wins
    await p.evaluate(() => { location.hash = "#/search/libre"; setTimeout(() => { location.hash = "#/search/moodle"; }, 0); });
    await p.waitForTimeout(1500);
    ok("R124 list is for the last query", /moodle/.test(await p.textContent("[role=status]")) && !(await p.textContent("[role=status]")).includes("libre"));
  }
}
console.log(`${n} checks, ${bad} FAIL`); await b.close(); process.exit(bad ? 1 : 0);
