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
// non-colour cue: the in-search stroke is dashed, so it reads apart from every fill without relying on hue
const dash = /strokeDasharray=\{inSearch\(n\)/.test(src);
console.log(`2 checks, ${(w >= 3 ? 0 : 1) + (dash ? 0 : 1)} FAIL${dash ? "" : " (no dash cue)"}`); process.exitCode = w >= 3 && dash ? 0 : 1;
// R162: the generated cover's "IJODeL · Vol. N" line (~10% down, white text) sits under the top scrim; every PAL stop, darkened by the
// scrim alpha there, must reach 4.5:1 against white (WCAG 1.4.3). Reads PAL and coverBg from App.jsx.
{
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const stops = [...app.match(/const PAL = \{[^\n]*\}/)[0].matchAll(/#[0-9a-f]{6}/g)].map((m) => m[0]);
  const m = app.match(/to bottom, rgb\(0 0 0 \/ (\.\d+)\)(?: (\d+)%)?, transparent (\d+)%/);
  const [A, P, E] = [+m[1], +(m[2] || 0), +m[3]], at = 10, a = at <= P ? A : A * Math.max(0, 1 - (at - P) / (E - P));
  const dark = (h) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");
  const low = stops.map((h) => [h, cr("#ffffff", dark(h))]).filter(([, r]) => r < 4.5);
  console.log(`cover top scrim alpha ${a.toFixed(2)} at ${at}%: ${stops.length} PAL stops, ${low.length} below 4.5` + (low.length ? " (" + low.map(([h, r]) => h + " " + r.toFixed(1)).join(", ") + ")" : ""));
  if (low.length) process.exitCode = 1;
}
