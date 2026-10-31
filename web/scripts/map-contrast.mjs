// Round 133: node scripts/map-contrast.mjs. The "in search" node stroke (Maps.jsx) must reach 3:1 (WCAG 1.4.11) against the white
// panel; pairs with each node fill are listed. shortcut: one stroke cannot hit 3:1 against white AND every fill (teal/orange sit mid-range), so only white is gated; upgrade to a double ring.
import fs from "fs";
const src = fs.readFileSync(new URL("../src/Maps.jsx", import.meta.url), "utf8");
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const stroke = src.match(/inSearch\(n\) \? "(#[0-9a-f]{6})"/)?.[1], fills = { ...src.match(/const COLOR = \{([^}]*)\}/)[1].split(",").reduce((o, p) => { const m = p.match(/(\w+): "(#[0-9a-f]{6})"/); if (m) o[m[1]] = m[2]; return o; }, {}), pub: "#50e0f8" };
if (!stroke) { console.log("FAIL stroke colour not found"); process.exit(1); }
const w = cr(stroke, "#ffffff");
console.log(`stroke ${stroke} vs white ${w.toFixed(2)}; ` + Object.entries(fills).map(([k, v]) => `${k} ${cr(stroke, v).toFixed(1)}`).join(", "));
console.log(`1 check, ${w >= 3 ? 0 : 1} FAIL`); process.exit(w >= 3 ? 0 : 1);
