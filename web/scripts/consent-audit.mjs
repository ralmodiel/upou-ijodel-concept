// Consent audit (needs `vite preview` on :4173): node scripts/consent-audit.mjs
// For each consent state it searches, adds a chapter to a view list and focuses search (model start), then lists what the
// browser holds: localStorage/sessionStorage keys, IndexedDB databases, Cache Storage names, cookies and third-party hosts.
// Checks each against what that state allows and against the privacy notice (every stored name must be named there),
// the RA 10173 wording, and prints the operator placeholders UPOU still has to fill. "N checks, M FAIL"; exit 1 on FAIL.
import { chromium } from "playwright-core"; import { homedir } from "os";
const U = "http://localhost:4173";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox"] });
let n = 0, bad = 0; const ok = (m, c, x = "") => { n++; console.log(`${c ? "PASS" : "FAIL"} ${m} ${x}`); if (!c) bad++; };
const LISTS = /^ijodel-(lists|list)$/, PREF = /^ijodel-(adv|adv-mode|recent|saved|cite|tour|text|map-seed)$/, NEC = new Set(["ijodel-consent"]), SESSION = new Set(["ijodel-chunk-retry", "ijodel-lite"]);
const MODEL_STORES = new Set(["ijodel", "transformers-cache", "experimental_transformers-hash-cache"]);
const dump = (p) => p.evaluate(async () => ({ ls: Object.keys(localStorage), ss: Object.keys(sessionStorage),
  idb: (await indexedDB.databases()).map((d) => d.name), cache: await caches.keys() }));

async function visit(c, withdraw, undecided) {
  const p = await c.newPage(), hosts = new Set(); c.on("request", (r) => { const h = new URL(r.url()).hostname; if (h && h !== "localhost") hosts.add(h); });
  if (undecided) { // the choice dialog is modal: only load pages
    await p.goto(U + "/#/read/10"); await p.goto(U + "/"); await p.getByRole("dialog", { name: "Cookie and privacy choices" }).waitFor(); await p.waitForTimeout(1500);
    return { p, hosts, s: await dump(p), cookies: await c.cookies() };
  }
  await p.goto(U + "/#/read/10"); await p.waitForSelector("h1");
  const add = p.getByRole("button", { name: /Add to (a )?view list|\+/ }).first(); await add.scrollIntoViewIfNeeded(); await p.waitForTimeout(2500); await add.click().catch(() => {}); /* the popover closes on scroll: scroll first */ await p.waitForTimeout(300);
  await p.getByLabel("New list name").fill("Mine", { timeout: 3000 }).then(() => p.getByLabel("New list name").press("Enter")).catch(() => {});
  await p.goto(U + "/"); const box = p.getByLabel("Search chapters").first(); await box.focus(); await box.fill("libre"); await p.keyboard.press("Enter");
  await p.waitForSelector("text=chapters for").catch(() => {});
  await p.waitForFunction(() => !document.querySelector("[data-model=loading]"), null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(1500);
  if (withdraw) { // withdraw everything through the real settings dialog
    await p.goto(U + "/#/privacy"); await p.getByRole("button", { name: "Open cookie settings" }).click();
    for (const id of ["c-lists", "c-pref", "c-model", "c-counter"]) { await p.locator("#" + id).setChecked(false); }
    await p.getByRole("button", { name: "Save choices" }).click(); await p.waitForTimeout(1000);
  }
  return { p, hosts, s: await dump(p), cookies: await c.cookies() };
}
const states = { undecided: null, none: {}, prefs: { prefs: true, lists: false }, lists: { lists: true }, model: { model: true }, counter: { counter: true },
  all: { prefs: true, lists: true, model: true, counter: true }, withdrawn: { prefs: true, lists: true, model: true, counter: true } };
const found = new Set();
for (const [name, v] of Object.entries(states)) {
  const c = await b.newContext({ viewport: { width: 1400, height: 1200 } });
  if (v) await c.addInitScript((v) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", 1); localStorage.setItem("ijodel-consent", JSON.stringify(v)); } }, v);
  const { p, hosts, s, cookies } = await visit(c, name === "withdrawn", !v);
  const a = name === "withdrawn" ? {} : v || {};
  s.ss = s.ss.filter((k) => k !== "seeded"); [...s.ls, ...s.ss, ...s.idb, ...s.cache].forEach((k) => found.add(k));
  const lsBad = s.ls.filter((k) => !(NEC.has(k) && v) && !(PREF.test(k) && a.prefs) && !(LISTS.test(k) && a.lists));
  ok(`${name}: localStorage only as allowed`, !lsBad.length, `[${s.ls.join(" ")}]` + (lsBad.length ? " unexpected: " + lsBad.join(" ") : ""));
  ok(`${name}: sessionStorage only necessary flags`, s.ss.every((k) => SESSION.has(k)), `[${s.ss.join(" ")}]`);
  const st = [...s.idb, ...s.cache], stBad = st.filter((k) => !(MODEL_STORES.has(k) && a.model) && !(/^ijodel-offline-/.test(k) && a.prefs));
  ok(`${name}: IndexedDB/Cache only under model (offline cache: prefs) consent`, !stBad.length, `[${st.join(" ")}]`);
  if (a.model) ok(`${name}: model stores present (caching works)`, s.idb.includes("ijodel") && s.cache.includes("transformers-cache"), `[${st.join(" ")}]`);
  if (a.prefs) ok(`${name}: preferences persisted`, s.ls.some((k) => PREF.test(k)));
  if (a.lists) ok(`${name}: view lists persisted`, s.ls.some((k) => LISTS.test(k)));
  if (!a.lists) ok(`${name}: no view list stored without the lists consent`, !s.ls.some((k) => LISTS.test(k)));
  ok(`${name}: offline cache only under prefs consent`, s.cache.some((k) => /^ijodel-offline-/.test(k)) === !!a.prefs, `[${s.cache.join(" ")}]`);
  const hostBad = [...hosts].filter((h) => !(a.model && /huggingface\.co$|hf\.co$|jsdelivr\.net$/.test(h)) && !(a.counter && /flagcounter\.me$/.test(h)));
  ok(`${name}: third parties only as allowed`, name === "withdrawn" || !hostBad.length, `[${[...hosts].join(" ")}]`);
  ok(`${name}: no cookies outside Flag Counter consent`, cookies.every((k) => a.counter && /flagcounter/.test(k.domain)), `[${cookies.map((k) => k.domain + ":" + k.name).join(" ")}]`);
  if (name === "undecided") ok("undecided: consent banner shown", await p.getByRole("dialog", { name: "Cookie and privacy choices" }).count() > 0);
  await c.close();
}
// R119: SW cache hygiene: after search, read and maps, the offline cache holds same-origin GET URLs only, none with a query string, none .bin/.wasm
{ const cs = await b.newContext({ viewport: { width: 1400, height: 1200 } }); await cs.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, lists: true, model: false })); } catch {} }); const q = await cs.newPage();
  await q.goto(U + "/"); await q.evaluate(() => navigator.serviceWorker?.ready); await q.reload(); await q.waitForTimeout(1500);
  for (const r of ["/search/libre", "/read/10", "/maps/pub/3", "/"]) { await q.goto(U + "/#" + r); await q.waitForTimeout(1800); }
  const urls = await q.evaluate(async () => { const o = []; for (const k of await caches.keys()) if (k.startsWith("ijodel-offline-")) for (const r of await (await caches.open(k)).keys()) o.push(r.method + " " + r.url); return o; });
  const bad2 = urls.filter((x) => { const [m, u] = x.split(" "), l = new URL(u); return m !== "GET" || l.origin !== U || l.search || /\.(bin|wasm)$/.test(l.pathname); });
  ok("offline cache holds only same-origin GET URLs without query strings or .bin/.wasm", urls.length > 0 && !bad2.length, `(${urls.length} entries${bad2.length ? "; bad " + bad2.slice(0, 3).join(" ") : ""})`); await cs.close(); }
// The privacy notice must name every store a visitor can end up with, and carry the RA 10173 wording.
const c = await b.newContext(), p = await c.newPage(); await p.goto(U + "/#/privacy"); await p.waitForSelector("h1");
const text = await p.locator("article").innerText();
for (const k of found) if (!PREF.test(k)) ok(`privacy notice names "${k}"`, text.includes(k.replace(/^ijodel-offline-.*/, "ijodel-offline-")));
// round 92: the storage table comes from the code: every "ijodel-*" key literal in src must be a known store, and each preference key's purpose is named
const fs = await import("fs"), src = fs.readdirSync(new URL("../src", import.meta.url)).map((f) => fs.readFileSync(new URL("../src/" + f, import.meta.url), "utf8")).join("\n");
const EVENTS = new Set(["ijodel-open-cookies", "ijodel-update"]), keys = [...new Set([...src.matchAll(/"(ijodel-[a-z-]+[a-z])"/g)].map((m) => m[1]))].filter((k) => !EVENTS.has(k));
const PURPOSE = { "ijodel-lists": /view lists/, "ijodel-list": /view lists/, "ijodel-adv": /advanced-search filters/, "ijodel-adv-mode": /their mode/, "ijodel-recent": /recent searches/, "ijodel-saved": /saved (and recent )?searches/, "ijodel-cite": /citation style/, "ijodel-tour": /quick tour/i, "ijodel-text": /reader text size/, "ijodel-map-seed": /last map seed/ };
const unknown = keys.filter((k) => !PREF.test(k) && !LISTS.test(k) && !NEC.has(k) && !SESSION.has(k) && k !== "ijodel-offline");
ok("every storage key in the code is a known store", !unknown.length, `(${keys.length} keys${unknown.length ? "; unknown " + unknown.join(" ") : ""})`);
for (const k of keys.filter((k) => PREF.test(k))) ok(`privacy notice explains preference "${k}"`, PURPOSE[k]?.test(text), PURPOSE[k] ? "" : "(no purpose mapped)");
for (const w of ["Republic Act No. 10173", "National Privacy Commission", "right to be informed", "erasure", "data portability", "Data Protection Officer", "jsDelivr", "Hugging Face", "Flag Counter"])
  ok(`privacy notice: "${w}"`, text.includes(w));
// R188: every host in the built CSP's connect-src and img-src (scheme and "*." dropped) appears in the privacy text
const csp = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8").match(/Content-Security-Policy" content="([^"]*)"/)[1];
for (const h of new Set([...csp.matchAll(/(?:connect|img)-src ([^;]*)/g)].flatMap((m) => m[1].split(" ")).filter((t) => t.startsWith("https://")).map((t) => t.replace(/^https:\/\/(\*\.)?/, ""))))
  ok(`privacy notice names CSP host "${h}"`, text.toLowerCase().includes(h.toLowerCase()) || (h === "www.flagcounter.me" && text.includes("Flag Counter")), "");
const ph = [...text.matchAll(/\[[^\]]*to be completed[^\]]*\]/g)].map((m) => m[0]);
console.log(`UPOU placeholders (${ph.length}):`); ph.forEach((x) => console.log("  - " + x));
await b.close(); console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
