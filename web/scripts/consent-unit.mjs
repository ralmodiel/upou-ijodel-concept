// consent.js read() unit check: node scripts/consent-unit.mjs. Stub localStorage, import fresh copies. "N checks, M FAIL".
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
console.log(`${n} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
