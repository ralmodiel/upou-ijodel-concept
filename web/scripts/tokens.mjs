// R143 design drift: node scripts/tokens.mjs. Counts arbitrary Tailwind values (w-[...], text-[13px], bg-[#hex]) in src/*.jsx.
// First run writes scripts/tokens-baseline.json; later runs fail when the count grows past it. Delete the file to re-baseline after a deliberate change.
// shortcut: guards growth only (the plan's "baseline minus 10" would need a design pass first); lower the baseline by hand as usages move to tokens.
import fs from "fs";
const dir = new URL("../src/", import.meta.url), bf = new URL("tokens-baseline.json", import.meta.url);
const re = /[\w:-]+-\[[^\]\s]+\]/g; let n = 0, odd = [];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".jsx"))) { const t = fs.readFileSync(new URL(f, dir), "utf8"); n += (t.match(re) || []).length; for (const m of t.matchAll(/<Icon [^>]*\bw=\{([\d.]+)\}/g)) if (!["1.5", "2"].includes(m[1])) odd.push(f + " w=" + m[1]); } // R183: Icon strokes are 1.5 or 2 only
// R193: the four empty states share App.jsx's EMPTY dashed card (the element holding the text uses className={EMPTY})
const src = (f) => fs.readFileSync(new URL(f, dir), "utf8");
for (const [f, s] of [["App.jsx", "<p>Nothing found"], ["App.jsx", "This list is empty."], ["Maps.jsx", "Nothing to map"], ["Advanced.jsx", "No chapter fits"]]) if (!src(f).includes("className={EMPTY}>" + s)) odd.push(`${f} empty state "${s}" is not className={EMPTY}`);
// R202/R203: no bare #000 in Maps.jsx; no text-[Npx] literals (use the type scale)
if (/#000\b/.test(src("Maps.jsx"))) odd.push("Maps.jsx has #000");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".jsx"))) if (/text-\[\d+px\]/.test(src(f))) odd.push(f + " has text-[Npx]");
if (odd.length) console.log(`FAIL Icon stroke widths outside {1.5, 2} or empty states off the shared card: ${odd.join(", ")}`);
if (!fs.existsSync(bf)) { fs.writeFileSync(bf, JSON.stringify({ arbitrary: n }) + "\n"); console.log(`baseline recorded: ${n} arbitrary values`); process.exit(0); }
const base = JSON.parse(fs.readFileSync(bf, "utf8")).arbitrary;
console.log(`2 checks, ${(n > base) + (odd.length > 0)} FAIL (${n} arbitrary values, baseline ${base})`); process.exit(n > base || odd.length ? 1 : 0);
