// node scripts/title-unit.mjs: titledAuthor adds the official title to the display label only (fictitious names).
import { titledAuthor } from "../src/graph.js";
const S = { articles: [{ authors: ["Reyes, Ana"], at: { "Reyes, Ana": "Dr." } }, { authors: ["Lim, Bo"] }] };
const got = [titledAuthor(S, "Reyes, Ana"), titledAuthor(S, "Lim, Bo"), titledAuthor(S, "Nobody, Zed")], want = ["Dr. Ana Reyes", "Lim, Bo", "Nobody, Zed"];
const bad = got.filter((g, i) => g !== want[i]);
console.log(`${got.length} checks, ${bad.length} FAIL`); process.exit(bad.length ? 1 : 0);
