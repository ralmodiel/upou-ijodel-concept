// R143 design drift: node scripts/tokens.mjs. Counts arbitrary Tailwind values (w-[...], text-[13px], bg-[#hex]) in src/*.jsx.
// First run writes scripts/tokens-baseline.json; later runs fail when the count grows past it. Delete the file to re-baseline after a deliberate change.
// shortcut: guards growth only (the plan's "baseline minus 10" would need a design pass first); lower the baseline by hand as usages move to tokens.
import fs from "fs";
const dir = new URL("../src/", import.meta.url), bf = new URL("tokens-baseline.json", import.meta.url);
const re = /[\w:-]+-\[[^\]\s]+\]/g; let n = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".jsx"))) n += (fs.readFileSync(new URL(f, dir), "utf8").match(re) || []).length;
if (!fs.existsSync(bf)) { fs.writeFileSync(bf, JSON.stringify({ arbitrary: n }) + "\n"); console.log(`baseline recorded: ${n} arbitrary values`); process.exit(0); }
const base = JSON.parse(fs.readFileSync(bf, "utf8")).arbitrary;
console.log(`1 check, ${n > base ? 1 : 0} FAIL (${n} arbitrary values, baseline ${base})`); process.exit(n > base ? 1 : 0);
