// Release check (run in web/): node scripts/verify.mjs [--all]
// Builds, then checks budgets (gzip KB), sitemap vs read pages, JSON-LD, no ojs_brand / dead asset refs in dist.
// --all also runs every gate script (list at the end), phone.mjs at W=390/768/1300 and e2e/ui.mjs (browser ones need `npx vite preview` on :4173).
// Prints "N checks, M FAIL" and exits 1 on any failure.
import fs from "node:fs"; import path from "node:path"; import zlib from "node:zlib"; import { execSync } from "node:child_process";
const web = path.resolve(import.meta.dirname, ".."), dist = path.join(web, "dist");
let n = 0, bad = 0;
const check = (ok, msg) => { n++; if (!ok) bad++; fs.writeSync(1, `${ok ? "ok  " : "FAIL"} ${msg}\n`); };
const run = (cmd) => { try { return [true, execSync(cmd, { cwd: web, stdio: "pipe", encoding: "utf8" })]; } catch (e) { return [false, `${e.stdout ?? ""}`]; } };
check(run("npx vite build")[0], "vite build");
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length / 1024;
const assets = fs.readdirSync(path.join(dist, "assets")).map((f) => path.join(dist, "assets", f));
// R246: the h1 font (Merriweather 400 latin) is preloaded with crossorigin, same-origin, and the file exists
{ const h = fs.readFileSync(path.join(dist, "index.html"), "utf8"), m = h.match(/<link rel="preload" as="font" type="font\/woff2" href="\.\/(assets\/merriweather-latin-400-normal-[^"]+\.woff2)" crossorigin>/);
  check(!!m && fs.existsSync(path.join(dist, m[1])) && !/rel="preload"[^>]*href="https?:/.test(h), "index.html preloads the Merriweather 400 woff2 (crossorigin, local file)"); }
// R283: the og:image file exists in dist and is a 1200x630 PNG (IHDR width/height at bytes 16-23)
{ const f = path.join(dist, "img/social.png"), b = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(24); check(b.readUInt32BE(16) === 1200 && b.readUInt32BE(20) === 630 && fs.readFileSync(path.join(dist, "index.html"), "utf8").includes('og:image'), "R283 og:image img/social.png is 1200x630 and index.html has og:image"); }
const sum = (fs_) => Math.round(fs_.reduce((s, f) => s + gz(f), 0));
for (const [name, files, max] of [
  ["entry JS", assets.filter((f) => /index-.*\.js$/.test(f)), 82],
  ["CSS", assets.filter((f) => f.endsWith(".css")), 11], // R147: budgets = measured (CSS 10, data 206 KB gz, 2026-10-31) + 5%
  ["startup data", ["articles.json", "issues.json", "chunks.json"].map((f) => path.join(dist, "index", f)), 217],
]) { const kb = sum(files); check(kb <= max, `${name} ${kb} KB gz (budget ${max})`); }
// R216: the service worker installs everything in PRE (texts.json included): its gzip total stays within the measured 724 KB (2026-10-31) + 5%
{ const pre = JSON.parse(fs.readFileSync(path.join(dist, "sw.js"), "utf8").match(/PRE = (\[.*?\])[,;]/)[1]), kb = Math.round(pre.filter((f) => f !== "./").reduce((s, f) => s + gz(path.join(dist, f)), 0)); check(kb <= 760, `service worker precache ${kb} KB gz over ${pre.length} files (budget 760)`);
  check(!pre.some((f) => /Graph3D|three|force-graph/i.test(f)), "R227 sw.js PRE has no 3D chunk (loaded on demand)"); }
const reads = fs.readdirSync(path.join(dist, "read")).filter((d) => fs.existsSync(path.join(dist, "read", d, "index.html")));
const locs = (fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8").match(/<loc>[^<]*\/read\/[^<]+<\/loc>/g) || []).length;
check(reads.length > 0 && locs === reads.length, `sitemap read urls ${locs} = read pages ${reads.length}`);
// R280/R281: every read page's title, authors, year, issue label equal articles.json; canonical equals its sitemap <loc>; sitemap = home + read pages only
{ const arts = JSON.parse(fs.readFileSync(path.join(dist, "index/articles.json"), "utf8")), sm = fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8"), locs2 = new Set([...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1])), unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&"), badP = [];
  for (const a of arts) { const s = fs.readFileSync(path.join(dist, "read", String(a.id), "index.html"), "utf8"), can = s.match(/<link rel="canonical" href="([^"]+)"/)?.[1], ok = unesc(s.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "") === a.title && unesc(s.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "") === a.title + " | IJODeL" && unesc(s.match(/<\/h1>\s*<p>([\s\S]*?)<\/p>/)?.[1] ?? "") === (a.authors || []).join("; ") && s.includes(`name="citation_publication_date" content="${a.year}"`) && unesc(s.match(/<\/h1>\s*<p>[\s\S]*?<\/p>\s*<p>([\s\S]*?) · International Journal/)?.[1] ?? "") === String(a.issue?.label || a.year);
    if (!ok || !locs2.has(can)) badP.push(a.id); }
  check(!badP.length && locs2.size === arts.length + 1, `R280/R281 read-page meta equals articles.json and canonical is in the sitemap (${arts.length} pages, ${badP.length} bad, ${locs2.size} sitemap urls)`); }
const htmls = [path.join(dist, "index.html"), ...reads.map((d) => path.join(dist, "read", d, "index.html"))];
let ld = 0, ldBad = 0, brand = 0, dead = [];
for (const f of htmls) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { ld++; try { JSON.parse(m[1]); if (m[1].includes("<")) ldBad++; /* R179: a raw "<" could close the script tag */ } catch { ldBad++; } }
  if (s.includes("ojs_brand")) brand++;
  for (const [, u] of s.matchAll(/(?:src|href)="([^"#?]+)"/g)) if (!/^[a-z]+:/.test(u) && !u.endsWith("/") && !fs.existsSync(path.resolve(path.dirname(f), u))) dead.push(path.relative(dist, f) + " -> " + u);
}
{ const { esc } = await import(path.join(web, "scripts/seo.mjs")), h = esc('"><script>x'); check(!/["<>]/.test(h), `R218 esc() leaves no raw quote or angle bracket in a hostile title (${h})`); }
const ids = reads.filter((d) => !/^\d+$/.test(d)), rj = fs.readFileSync(path.join(dist, "r.js"), "utf8"), badId = htmls.slice(1).filter((f) => !/<script src="\.\.\/\.\.\/r\.js" data-id="\d+"><\/script>/.test(fs.readFileSync(f, "utf8")));
check(!ids.length && !badId.length && rj.includes("/^\\d+$/.test"), `R219 r.js tests for digits; every read page data-id is digits (${badId.length} bad pages, ${ids.length} bad dirs)`);
check(ld > 0 && !ldBad, `JSON-LD blocks parse (${ld} found, ${ldBad} bad)`);
check(!brand && !assets.some((f) => fs.readFileSync(f, "latin1").includes("ojs_brand")), "no ojs_brand references in dist");
for (const src of fs.readdirSync(path.join(web, "src"))) for (const [, u] of fs.readFileSync(path.join(web, "src", src), "utf8").matchAll(/asset\("([^"]+)"\)/g)) if (!fs.existsSync(path.join(dist, u))) dead.push(`src/${src} -> ${u}`);
check(!dead.length, `asset references resolve (${dead.length} dead${dead.length ? ": " + dead.slice(0, 5).join(", ") : ""})`);
const leak = fs.readdirSync(dist, { recursive: true }).filter((f) => /\.(map|pdf)$|(^|\/)\.env|^data\//.test(f)); // R198: no source maps, PDFs, .env or data/ in dist
check(!leak.length, `no source maps, .pdf, .env or data/ in dist (${leak.length}${leak.length ? ": " + leak.slice(0, 5).join(", ") : ""})`);
// R290: --all runs every gate script one after another (browser ones need :4173; never two browser gates at once) and shows each one's verdict line
const node = "audit-data boolq-check bundle cite-check emph-check planner-queries consent-unit deps dym-unit engine-unit graph-unit headers key-audit links-check lru-unit map-contrast parse-query recommend-unit related-audit sw-unit terms tokens suggest-eval summary-audit adv-fuzz search-eval stress perf";
const browser = "a11y consent-audit fuzz-inputs href-allow third-party map-reader-probe nav-save prefetch-check search-ui matrix frame-time heap";
if (process.argv.includes("--all")) for (const c of [...`${node} ${browser}`.split(" ").map((s) => `node scripts/${s}.mjs`), ...[390, 768, 1300].map((w) => `W=${w} node scripts/phone.mjs`), "timeout 900 node e2e/ui.mjs"]) {
  const [ok, out] = run(c); check(ok, `${c} -> ${out.trim().split("\n").at(-1)}`); }
fs.writeSync(1, `${n} checks, ${bad} FAIL\n`); process.exit(bad ? 1 : 0);
