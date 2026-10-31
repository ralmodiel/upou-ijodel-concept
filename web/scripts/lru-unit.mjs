// engine.js lru: max 3, access a b c a d evicts b and a refetch loads b again. node scripts/lru-unit.mjs
import assert from "node:assert/strict"; import { lru } from "../src/engine.js";
const c = lru(3), calls = []; const get = (k) => c(k, async () => { calls.push(k); return k; });
for (const k of "abcad") await get(k);
assert.deepEqual(calls, ["a", "b", "c", "d"]); // second a was a hit
for (const k of "cad") await get(k); assert.deepEqual(calls, ["a", "b", "c", "d"]); // c a d still cached
await get("b"); assert.equal(calls.at(-1), "b"); // b was evicted, refetched
console.log("lru-unit: 3 checks, 0 FAIL");
