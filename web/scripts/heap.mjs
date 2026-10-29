// Long-session leak check (round 85; needs `vite preview` on :4173): node scripts/heap.mjs [navs=200]
// Cycles hash routes (home, search, reader, Advanced, Maps 2D, issues, topics, lists) N times in one tab. After forced GC compares
// JS heap, DOM nodes and event listeners at nav 20 vs nav N. FAIL if heap grows > 8 MB or listeners/nodes grow > 25%.
import { chromium } from "playwright-core"; import { homedir } from "os";
const N = +(process.argv[2] || 200), U = "http://localhost:4173/#";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })));
const p = await ctx.newPage(), c = await ctx.newCDPSession(p); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
await c.send("Performance.enable");
const R = ["/", "/search/online learning", "/read/3", "/advanced", "/maps", "/issues", "/topics", "/list", "/read/10", "/search/mooc"];
const snap = async () => { await p.waitForTimeout(500); await c.send("HeapProfiler.collectGarbage"); const m = Object.fromEntries((await c.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  return { heap: m.JSHeapUsedSize / 2 ** 20, nodes: m.Nodes, ls: m.JSEventListeners }; };
await p.goto(U + "/"); await p.waitForSelector("h1, h2");
let a; for (let i = 1; i <= N; i++) { await p.evaluate((r) => { location.hash = r; }, R[i % R.length]); await p.waitForTimeout(120); if (i === 20) a = await snap(); }
await p.evaluate(() => { location.hash = "/"; }); await p.waitForTimeout(800); const z = await snap();
const rows = [["heap MB", a.heap, z.heap, z.heap - a.heap > 8], ["DOM nodes", a.nodes, z.nodes, z.nodes > a.nodes * 1.25 + 200], ["listeners", a.ls, z.ls, z.ls > a.ls * 1.25 + 50]];
let bad = 0; for (const [n, x, y, f] of rows) { bad += f; console.log(`${f ? "FAIL" : "PASS"} ${n} at 20: ${x.toFixed(1)} at ${N}: ${y.toFixed(1)}`); }
if (errs.length) { bad++; console.log("FAIL page errors: " + errs.slice(0, 2).join(" | ")); }
console.log(`${N} navigations, ${rows.length + 1} checks, ${bad} FAIL`); await b.close(); process.exit(bad ? 1 : 0);
