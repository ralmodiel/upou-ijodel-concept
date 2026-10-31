// Round 101: node scripts/parse-query.mjs. parseQuery operators: phrase, -term, author, year (incl. reversed), unmatched quote, empty. Exits 1 on any mismatch.
import { parseQuery } from "../src/query.js";
const C = [
  ['open "distance learning" quality', (r) => r.phrases[0] === "distance learning" && r.text === "open distance learning quality"],
  ["open learning -mooc", (r) => r.neg[0] === "mooc" && r.text === "open learning"],
  ['author:"Maria Santos" learning', (r) => r.author === "maria santos" && r.text === "learning"],
  ["author:santos", (r) => r.author === "santos" && r.text === ""],
  ["learning year:2018-2020", (r) => r.y[0] === 2018 && r.y[1] === 2020],
  ["learning year:2020-2018", (r) => r.y[0] === 2018 && r.y[1] === 2020],
  ["year:2019", (r) => r.y[0] === 2019 && r.y[1] === 2019],
  ['"unmatched quote here', (r) => r.phrases.length === 0 && r.text === '"unmatched quote here'],
  ["", (r) => r.text === "" && r.ops.length === 0 && r.y === null],
  [null, (r) => r.text === ""],
  ["well-known e-learning", (r) => r.neg.length === 0 && r.text === "well-known e-learning"],
  ['"a b" -c author:d year:2001 e', (r) => r.phrases.length === 1 && r.neg[0] === "c" && r.author === "d" && r.y[0] === 2001 && r.ops.length === 4 && r.text === "a b e"],
];
let bad = 0; for (const [q, f] of C) { const r = parseQuery(q); if (!f(r)) { bad++; console.log("FAIL", JSON.stringify(q), JSON.stringify(r)); } }
import { pushUniq } from "../src/query.js";
let l = []; for (let i = 0; i < 40; i++) l = pushUniq(l, "Q" + (i % 35), 10); l = pushUniq(l, "q5", 10); // R201
if (l.length > 10 || l[0] !== "q5" || l.filter((x) => x.toLowerCase() === "q5").length !== 1) { bad++; console.log("FAIL pushUniq"); }
console.log(`${C.length + 1} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
