// consent.js read() + withdrawal unit check: node scripts/consent-unit.mjs. Stub localStorage, import fresh copies. "N checks, M FAIL".
import assert from "node:assert/strict"; import { pathToFileURL } from "node:url"; import path from "node:path";
const f = pathToFileURL(path.resolve(import.meta.dirname, "../src/consent.js")).href; let i = 0, bad = 0, n = 0;
const load = async (raw) => { globalThis.localStorage = { getItem: () => raw, setItem() {}, removeItem() {} }; return import(`${f}?${i++}`); };
const t = async (name, raw, want) => { n++; try { const m = await load(raw); assert.deepEqual(want === null ? m.allow("lists") || m.allow("prefs") : ["lists", "prefs", "model", "counter"].map(m.allow), want === null ? false : want); console.log("ok  ", name); } catch (e) { bad++; console.log("FAIL", name, e.message.split("\n")[0]); } };
await t("legacy {prefs:true}", '{"prefs":true}', [true, true, false, false]);
await t("legacy {prefs:false}", '{"prefs":false}', [false, false, false, false]);
await t("explicit lists false", '{"prefs":true,"lists":false}', [false, true, false, false]);
await t("malformed JSON", "{oops", null);
await t("null storage", null, null);
await t("non-object", "5", null);
// R199: notice version (NOTICE = 1): an older record is undecided again (banner shows), current and pre-versioning ones still count
await t("outdated {v:0} -> undecided", '{"v":0,"prefs":true,"lists":true}', null);
await t("current {v:1}", '{"v":1,"prefs":true,"model":true}', [true, true, true, false]);
// Withdrawal (round 159): every audited key (consent-audit.mjs LISTS/PREF/NEC/SESSION) plus an unknown ijodel-* key is stored; saving
// "all off" keeps only the choice, forgetConsent() leaves no ijodel-* key in either storage and nothing in memory, foreign keys stay.
const box = () => Object.defineProperties({}, { getItem: { value(k) { return Object.hasOwn(this, k) ? this[k] : null; } }, setItem: { value(k, v) { this[k] = String(v); } }, removeItem: { value(k) { delete this[k]; } } });
const ca = (await import("node:fs")).readFileSync(path.resolve(import.meta.dirname, "consent-audit.mjs"), "utf8").split("\n").find((l) => l.startsWith("const LISTS"));
const keys = [...[...ca.matchAll(/\/\^ijodel-\(([^)]*)\)/g)].flatMap((m) => m[1].split("|").map((k) => "ijodel-" + k)), ...[...ca.matchAll(/"(ijodel-[\w-]+)"/g)].map((m) => m[1]), "ijodel-future"];
const w = async (name, fn) => { n++; try { await fn(); console.log("ok  ", name); } catch (e) { bad++; console.log("FAIL", name, e.message.split("\n")[0]); } };
{
  globalThis.localStorage = box(); globalThis.sessionStorage = box(); const m = await import(`${f}?${i++}`), all = { prefs: true, lists: true, model: true, counter: true };
  const fill = () => { m.setConsent(all); keys.forEach((k) => { localStorage.setItem(k, "x"); sessionStorage.setItem(k, "x"); m.pref.set(k, "x"); }); localStorage.setItem("other-site", "x"); };
  const left = (s) => Object.keys(s).filter((k) => k.startsWith("ijodel-"));
  await w(`${keys.length} keys parsed from consent-audit`, () => assert.ok(keys.length >= 13 && keys.includes("ijodel-lists") && keys.includes("ijodel-lite")));
  fill(); m.setConsent({});
  await w("save all off: only ijodel-consent stays in localStorage", () => assert.deepEqual(left(localStorage), ["ijodel-consent"]));
  fill(); m.forgetConsent();
  await w("forgetConsent: no ijodel-* key in localStorage", () => assert.deepEqual(left(localStorage), []));
  await w("forgetConsent: no ijodel-* key in sessionStorage", () => assert.deepEqual(left(sessionStorage), []));
  await w("forgetConsent: undecided, allow() false, memory empty", () => { assert.deepEqual(["lists", "prefs", "model", "counter"].map(m.allow), [false, false, false, false]); assert.deepEqual(keys.map((k) => m.pref.get(k)).filter(Boolean), []); });
  await w("forgetConsent: other sites' keys untouched", () => assert.equal(localStorage.getItem("other-site"), "x"));
}
// R199 re-ask: an outdated record's stored data is not used while undecided, kept when the visitor allows it again, removed when not
for (const [name, choice, want] of [["re-ask, allow lists again: old list kept", { lists: true }, "L"], ["re-ask, essential only: old list removed", {}, null]]) {
  globalThis.localStorage = box(); localStorage.setItem("ijodel-consent", '{"v":0,"prefs":true,"lists":true}'); localStorage.setItem("ijodel-lists", "L");
  const m = await import(`${f}?${i++}`);
  await w(name, () => { assert.equal(m.pref.get("ijodel-lists"), null); m.setConsent(choice); assert.equal(localStorage.getItem("ijodel-lists"), want); assert.equal(JSON.parse(localStorage.getItem("ijodel-consent")).v, m.NOTICE); });
}
// R210: stored lists are capped at 20, names at 60, repeated names numbered
{
  const { normLists } = await import(pathToFileURL(path.resolve(import.meta.dirname, "../src/lists.js")).href), mk = (name, k = 0) => ({ id: "l" + k, name, items: [] });
  await w("30 lists -> 20", () => assert.equal(normLists(Array.from({ length: 30 }, (_, k) => mk("L" + k, k))).length, 20));
  await w("200-char name -> 60", () => assert.equal(normLists([mk("x".repeat(200))])[0].name.length, 60));
  await w("two Mine -> Mine, Mine (2)", () => assert.deepEqual(normLists([mk("Mine"), mk("Mine", 1)]).map((l) => l.name), ["Mine", "Mine (2)"]));
  await w("two 60-char names stay unique and <= 60", () => { const r = normLists([mk("y".repeat(60)), mk("y".repeat(60), 1)]).map((l) => l.name); assert.ok(r[0] !== r[1] && r[1].length <= 60); });
}
console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
