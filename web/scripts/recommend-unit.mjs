// recommend() unit check (R151, run in web/): node scripts/recommend-unit.mjs. Each chapter as the only seed, then each
// with its next chapter as a second seed: no seed, no duplicate id, scores non-increasing, at most max. "N checks, M FAIL".
import fs from "node:fs"; import path from "node:path"; import { recommend } from "../src/recommend.js";
const arts = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../public/index/articles.json"), "utf8"));
let n = 0, bad = 0;
const check = (seeds) => { n++; const r = recommend(seeds, arts), ids = r.map((x) => x.a.id), seed = new Set(seeds.map((s) => s.id));
  const why = ids.some((id) => seed.has(id)) ? "returns a seed" : new Set(ids).size !== ids.length ? "duplicate" : r.some((x, i) => i && x.sc > r[i - 1].sc) ? "score rises" : r.length > 12 ? "over max" : "";
  if (why) { bad++; if (bad <= 5) console.log(`FAIL seeds ${[...seed]}: ${why}`); } };
arts.forEach((a, i) => { check([a]); check([a, arts[(i + 1) % arts.length]]); });
console.log(`${n} checks, ${bad} FAIL (${arts.length} chapters)`); process.exit(bad ? 1 : 0);
