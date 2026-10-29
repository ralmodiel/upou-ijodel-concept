// Round 82 bundle report: node scripts/bundle.mjs (after vite build). Entry chunk must not hold three/3d-force-graph/transformers/Maps/Advanced; prints gzip KB per chunk, exits 1 on a leak.
import fs from "fs"; import path from "path"; import zlib from "zlib";
const d = path.join(import.meta.dirname, "..", "dist"), html = fs.readFileSync(d + "/index.html", "utf8");
const entry = html.match(/src="\.\/assets\/(index-[^"]+\.js)"/)[1], js = fs.readdirSync(d + "/assets").filter((f) => f.endsWith(".js"));
let bad = 0; const src = fs.readFileSync(d + "/assets/" + entry, "utf8");
// markers of each heavy lib; static `import ... from "./X.js"` in the entry would pull a chunk in eagerly
const heavy = { three: /WebGLRenderer/, "3d-force-graph": /forceGraph|ForceGraph3D/, transformers: /AutoTokenizer|pipeline\(/ };
for (const [k, re] of Object.entries(heavy)) { const hit = re.test(src); if (hit) bad++; console.log(`${hit ? "FAIL" : "PASS"} entry has no ${k}`); }
const stat = [...src.matchAll(/^import[^;]*?from"\.\/([^"]+)"/gm)].map((m) => m[1]).filter((f) => /Graph3D|Maps|Advanced|transformers/.test(f));
if (stat.length) bad++; console.log(`${stat.length ? "FAIL" : "PASS"} no static import of lazy chunks ${stat.join(",")}`);
for (const f of js) console.log(`  ${f.padEnd(34)} ${(zlib.gzipSync(fs.readFileSync(d + "/assets/" + f)).length / 1024).toFixed(0).padStart(5)} KB gz${f === entry ? "  (entry)" : ""}`);
console.log(`${Object.keys(heavy).length + 1} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
