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
  await p.getByRole("button", { name: /Add to view list|\+/ }).first().click().catch(() => {}); await p.waitForTimeout(300);
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
const ph = [...text.matchAll(/\[[^\]]*to be completed[^\]]*\]/g)].map((m) => m[0]);
console.log(`UPOU placeholders (${ph.length}):`); ph.forEach((x) => console.log("  - " + x));
await b.close(); console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
