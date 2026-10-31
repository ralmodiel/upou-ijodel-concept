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
console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
