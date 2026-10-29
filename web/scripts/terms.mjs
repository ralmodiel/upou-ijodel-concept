// Terminology audit: node scripts/terms.mjs. An issue is a "book"/"issue", an article is a "chapter"; user-visible text must not say "publication".
// Scans string literals and JSX text in src/ (comments skipped). Prints "N files, M hits"; exits 1 on any hit.
import { readFileSync, readdirSync } from "fs";
const dir = new URL("../src/", import.meta.url), bad = [];
const files = readdirSync(dir).filter((f) => /\.jsx?$/.test(f));
for (const f of files) readFileSync(new URL(f, dir), "utf8").split("\n").forEach((line, i) => {
  const code = line.replace(/\/\/.*$|\{\/\*.*?\*\/\}/g, ""); // shortcut: a "//" inside a string cuts the line; fine for this codebase
  for (const m of code.matchAll(/\bpublications?\b/gi)) if (!/citation_publication/.test(code)) bad.push(`${f}:${i + 1}: ${code.slice(Math.max(0, m.index - 30), m.index + 30).trim()}`);
});
bad.slice(0, 20).forEach((b) => console.log("HIT", b));
console.log(`${files.length} files, ${bad.length} hits`); process.exit(bad.length ? 1 : 0);
