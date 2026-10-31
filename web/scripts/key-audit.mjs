// Round 109 static key audit: node scripts/key-audit.mjs. Every literal ijodel-* key handed to pref/localStorage/sessionStorage/store() in src
// must be in consent-audit.mjs (LISTS/PREF/NEC/SESSION) and be named in the Privacy text of Consent.jsx (by its key or its description); and the
// audit lists nothing the code never uses. Exits 1 on any difference.
import fs from "fs";
const R = (f) => fs.readFileSync(new URL(f, import.meta.url), "utf8");
const src = fs.readdirSync(new URL("../src/", import.meta.url)).filter((f) => /\.jsx?$/.test(f)).map((f) => R("../src/" + f)).join("\n");
const code = new Set([...src.matchAll(/(?:pref\.(?:get|set|remove)|(?:local|session)Storage\.(?:get|set|remove)Item|\bstore)\(\s*["'`](ijodel-[\w-]+)["'`]/g)].map((m) => m[1]));
const ca = R("./consent-audit.mjs"), line = ca.split("\n").find((l) => l.startsWith("const LISTS"));
const alt = (re) => line.match(new RegExp(re + "\\s*=\\s*/\\^ijodel-\\(([^)]*)\\)"))[1].split("|").map((k) => "ijodel-" + k);
const NEC = [...line.match(/NEC = new Set\(\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]), SES = [...line.match(/SESSION = new Set\(\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const audit = new Set([...alt("LISTS"), ...alt("PREF"), ...NEC, ...SES]);
const priv = R("../src/Consent.jsx"), words = { "ijodel-adv": "advanced-search filters", "ijodel-adv-mode": "their mode", "ijodel-recent": "recent searches", "ijodel-saved": "saved", "ijodel-cite": "citation style", "ijodel-tour": "quick tour", "ijodel-text": "reader text size", "ijodel-list": "ijodel-lists", "ijodel-lite": "this tab only" };
const named = (k) => priv.includes(k) || (words[k] && priv.includes(words[k].replace("reader text size", "reader text size")));
let n = 0, bad = 0; const f = (m) => { bad++; console.log("FAIL " + m); };
for (const k of code) { n++; if (!audit.has(k)) f(`${k} used in src, missing from consent-audit`); n++; if (!named(k) && !NEC.includes(k)) f(`${k} not named in the Privacy text`); }
for (const k of audit) { n++; if (!code.has(k) && !NEC.includes(k) && !SES.includes(k)) f(`${k} in consent-audit but never used in src`); n++; if (!named(k)) f(`${k} (audit) not named in the Privacy text`); }
console.log(`${n} checks, ${bad} FAIL (${code.size} keys in src, ${audit.size} in audit)`); process.exit(bad ? 1 : 0);
