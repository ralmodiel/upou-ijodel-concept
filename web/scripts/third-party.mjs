// Third-party network check (needs `vite preview` on :4173): node scripts/third-party.mjs
// 1) all consents on: only allow-listed hosts are contacted, the model gets ready, ORT wasm comes from the pinned
//    jsDelivr URL (or dist/ort/ in an ORT_SELF=1 build), Flag Counter is requested with no Referer and renders;
// 2) jsDelivr blocked and 3) Hugging Face blocked: keyword-only notice, results still shown.
// Prints PASS/FAIL lines and "N checks, M FAIL"; exits 1 on any FAIL.
import { chromium } from "playwright-core"; import { homedir } from "os"; import { readFileSync, existsSync } from "fs";
const U = "http://localhost:4173", self = existsSync(new URL("../dist/ort", import.meta.url));
const ver = JSON.parse(readFileSync(new URL("../node_modules/onnxruntime-web/package.json", import.meta.url))).version;
const HOSTS = /^(localhost|huggingface\.co|([\w-]+\.)+huggingface\.co|([\w-]+\.)+hf\.co|cdn\.jsdelivr\.net|www\.flagcounter\.me)$/;
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
let n = 0, bad = 0; const ok = (m, c, x = "") => { n++; console.log(`${c ? "PASS" : "FAIL"} ${m} ${x}`); if (!c) bad++; };
async function run(block) {
  const c = await b.newContext(); const reqs = [];
  await c.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: true, counter: true })));
  if (block) await c.route(block, (r) => r.abort());
  c.on("request", (r) => reqs.push(r));
  const p = await c.newPage(); await p.goto(U + "/"); await p.waitForSelector("text=Latest issues");
  await p.getByLabel("Search chapters").first().focus();
  await p.locator("[data-model=loading]").waitFor({ timeout: 5000 }).catch(() => {}); // appears after focus, then goes
  await p.waitForFunction(() => !document.querySelector("[data-model=loading]"), null, { timeout: 120000 }).catch(() => {});
  return { c, p, reqs, state: await p.evaluate(() => document.querySelector("[data-model]")?.dataset.model || "ready") };
}
{ const { c, p, reqs, state } = await run(null);
  const hosts = [...new Set(reqs.map((r) => new URL(r.url()).hostname).filter(Boolean))]; // data:/blob: have none
  ok("only allow-listed hosts contacted", hosts.every((h) => HOSTS.test(h)), hosts.join(" "));
  ok("model ready with all consents", state === "ready", state);
  const w = reqs.filter((r) => /ort-wasm.*\.wasm$/.test(r.url())).map((r) => r.url());
  ok(self ? "ORT wasm self-hosted (dist/ort)" : `ORT wasm from jsDelivr pinned to onnxruntime-web@${ver}`, w.length > 0 && w.every((u) => self ? u.startsWith(U + "/ort/") : u.includes(`onnxruntime-web@${ver}/`)), w[0] || "none");
  const fc = reqs.find((r) => /flagcounter\.me\/c0i/.test(r.url()));
  ok("Flag Counter requested without a Referer", !!fc && !(await fc.allHeaders()).referer, fc ? "" : "no request");
  const img = await p.locator('img[src*="flagcounter"]').evaluate((i) => i.complete && i.naturalWidth).catch(() => 0);
  ok("Flag Counter image renders under no-referrer", img > 0, `(${img}px)`);
  // R229: withdrawing the counter in Cookie settings removes the image at once (no reload) and nothing asks flagcounter again
  await p.getByRole("button", { name: "Cookie settings" }).first().click(); await p.locator("#c-counter").click(); await p.getByRole("button", { name: "Save choices" }).click();
  const t = reqs.length; await p.waitForTimeout(300); const left = await p.locator('img[src*="flagcounter"]').count();
  for (const h of ["#/issues", "#/"]) { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(700); } // in-page: the init script would re-grant on a reload
  const late = reqs.slice(t).filter((r) => /flagcounter/.test(r.url())).length;
  ok("R229 counter withdrawn: img removed without reload, no later flagcounter request", left === 0 && late === 0 && !JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-consent"))).counter, `(img ${left}, requests ${late})`);
  await c.close(); }
for (const [name, pat] of [["jsDelivr", /cdn\.jsdelivr\.net/], ["Hugging Face", /huggingface\.co|hf\.co/]]) {
  const { c, p, state } = await run(pat);
  if (name === "jsDelivr" && self) ok("jsDelivr blocked: self-hosted model still ready", state === "ready", state);
  else ok(`${name} blocked: keyword-only notice`, state === "failed", state);
  await p.getByLabel("Search chapters").first().fill("libre"); await p.keyboard.press("Enter");
  ok(`${name} blocked: keyword results still shown`, await p.waitForSelector("text=chapters for", { timeout: 15000 }).then(() => true).catch(() => false));
  await c.close();
}
// R189: a fresh visitor (no consent stored) loads 8 routes; every request goes to the page origin
{ const c = await b.newContext(), reqs = []; c.on("request", (r) => reqs.push(r.url())); const p = await c.newPage();
  for (const r of ["/search/libre", "/", "/search/libre", "/read/3", "/maps", "/advanced", "/issues", "/topics", "/privacy"]) { await p.goto(U + "/#" + r); await p.waitForSelector("main h1"); await p.waitForTimeout(800); }
  const off = [...new Set(reqs.filter((u) => /^https?:/.test(u) && new URL(u).origin !== U))];
  ok("R217 fresh visitor on /search/libre: no transformers chunk requested", !reqs.some((u) => /assets\/transformers/.test(u)), reqs.filter((u) => /transformers/.test(u))[0] || "");
  ok("fresh visitor, 8 routes: only same-origin requests", off.length === 0, off.slice(0, 3).join(" ")); await c.close(); }
await b.close(); console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
