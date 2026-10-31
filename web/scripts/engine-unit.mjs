// engine.js pagePassage: 30 (id,page) pairs return a chunk on that page or null. node scripts/engine-unit.mjs
import fs from "node:fs"; import path from "node:path"; import assert from "node:assert/strict";
const dir = path.resolve(import.meta.dirname, "../public/index");
globalThis.fetch = async (u) => { const b = fs.readFileSync(path.join(dir, u.split("/index/")[1])); return { json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const E = await import("../src/engine.js"), S = await E.load(); let n = 0, hit = 0;
for (const a of S.articles.slice(0, 30)) { for (const pg of [1, 2, 3, 9999]) { const r = await E.pagePassage(a.id, pg, "learning online"); n++; if (r) { hit++; assert.equal(String(r.page), String(pg), `${a.id} p${pg}`); } } }
assert.equal(await E.pagePassage("nope", 1, ""), null); assert.equal(await E.pagePassage(S.articles[0].id, 9999, ""), null);
assert(hit > 0, "no page matched at all"); console.log(`engine-unit: ${n} (id,page) pairs, ${hit} hit, 0 FAIL`);
