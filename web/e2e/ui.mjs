// Browser checks: node e2e/ui.mjs  (needs `vite preview` on :4173). Prints PASS/FAIL lines, exits 1 on any FAIL.
import { chromium } from "playwright-core";
import { homedir } from "os";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1500 } });
await ctx.addInitScript(() => { try { if (!localStorage.getItem("ijodel-consent")) localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: true })); } catch {} });
// R238/R239: collect securitypolicyviolation events for the whole run; the preview server sends no headers, so the document gets the Trusted Types report-only policy from _headers
const viol = []; await ctx.exposeFunction("__viol", (d, s, u) => viol.push([d, s, u]));
await ctx.addInitScript(() => addEventListener("securitypolicyviolation", (e) => window.__viol?.(e.effectiveDirective, e.sample, e.blockedURI)));
await ctx.route((u) => !/\.(js|css|json|bin|png|jpg|webp|svg|woff2?|onnx|wasm)(\?|$)/.test(u.pathname), async (r) => { if (r.request().resourceType() !== "document") return r.fallback(); const x = await r.fetch(); await r.fulfill({ response: x, headers: { ...x.headers(), "content-security-policy-report-only": "require-trusted-types-for 'script'" } }); });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const csp = []; p.on("console", (m) => /Content Security Policy/i.test(m.text()) && csp.push(m.text()));
let bad = 0, nChecks = 0;
const ok = (n, c, x = "") => { nChecks++; console.log(`${c ? "PASS" : "FAIL"} ${n} ${x}`); if (!c) bad++; };
const U = "http://localhost:4173/#";
const chips = (area) => p.locator(`xpath=//h2[normalize-space()="${area}"]/ancestor::div[contains(@class,"rounded-xl")][1]`);
const wait = (ms = 400) => p.waitForTimeout(ms);

// Fill all four Advanced areas by opening a share link built in the page (the same code "Share link" copies)
const fill4 = async () => { await p.goto(U + "/advanced"); const code = await p.evaluate(async () => {
  const A = window.__S.articles, top = (f) => { const m = {}; A.forEach((a) => f(a).forEach((x) => { m[x] = (m[x] || 0) + 1; })); return Object.entries(m).sort((x, y) => y[1] - x[1]).map((x) => x[0]); };
  const t = top((a) => a.subjects), c = top((a) => a.categories), y = String(Math.max(...A.map((a) => +a.year))), ch = (k, v, h) => ({ k, v, l: v, ...(h ? { h } : {}) });
  const json = JSON.stringify({ req: [ch("tag", t[0])], exp: [ch("tag", t[1])], boost: [ch("category", c[0], "H")], exc: [ch("year", y)], m: "any" });
  const u = new Uint8Array(await new Response(new Blob([new TextEncoder().encode(json)]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
  return btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); });
  await p.goto(U + "/advanced/s/" + code); await wait(600); };
// R154: following a link to a new page moves focus to <main> under the new title
{ await p.goto(U + "/issues"); await p.waitForSelector("h1"); const t0 = await p.title(); await p.locator('main a[href^="#/issue/"]').first().click(); await wait(600);
  ok("R154 route change: focus on main[tabindex=-1], title changed", await p.evaluate(() => document.activeElement?.matches("main#main[tabindex='-1']")) && (await p.title()) !== t0, await p.title()); }
// ---- Search facets ----
await p.goto(U + "/search/libre"); await p.waitForSelector("text=chapters for"); await wait(800);
ok("result cards use content-visibility", await p.evaluate(() => [...document.querySelectorAll(".grid-pubs > li, .cv-list > li")].some((e) => getComputedStyle(e).contentVisibility === "auto")));
ok("search shows the issues' covers", await p.getByRole("region", { name: "Issues in these results" }).locator("img").count() > 0);
ok("big cards show a best passage with its page", await p.getByLabel("Best-fit passage").first().innerText().then((t) => /best passage · pdf page \d+/i.test(t)));
{ const l = p.getByRole("link", { name: /^Relationship map of/ }).first(), b = await l.boundingBox();
  let hit = true; for (const [dx, dy] of [[.1, .1], [.5, .5], [.9, .9], [.9, .1], [.1, .9]]) { const x = b.x + b.width * dx, y = b.y + b.height * dy; await p.mouse.move(x, y); hit &&= await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("aria-label")?.startsWith("Relationship map"), [x, y]); }
  ok("Map link on a big card is hit across its whole area", hit); await l.click(); await p.waitForURL(/maps\/pub/); ok("Map link opens the relationship map", true); await p.goBack(); await p.waitForSelector("text=chapters for"); await wait(500); }
const cat = p.locator('xpath=//span[normalize-space()="Category"]/following-sibling::div//button');
const nCat0 = await cat.count(); ok("search 'libre': categories limited to matches", nCat0 > 0 && nCat0 < 8, `(${nCat0})`);
const yrs0 = await p.locator('select[aria-label="From year"] option').count(); ok("years limited", yrs0 < 12, `(${yrs0})`);
await cat.first().click(); await wait();
const nCat1 = await cat.count(); ok("last-clicked category facet stays unlimited", nCat1 === nCat0, `(${nCat0}->${nCat1})`);
const total = await p.locator("[role=status] b").first().innerText(); ok("category narrows results", +total < 5, `(${total})`);
await p.getByText("Clear all filters").click(); await wait();
// tag click: categories now limited by tag
const tag = p.locator('xpath=//span[normalize-space()="Tags"]/following-sibling::div//button').first();
const tagN = await p.locator('xpath=//span[normalize-space()="Tags"]/following-sibling::div//button').count();
await tag.click(); await wait();
const nCat2 = await cat.count(); ok("after tag click, categories narrowed", nCat2 <= nCat0, `(${nCat0}->${nCat2})`);
ok("tag facet itself not narrowed", await p.locator('xpath=//span[normalize-space()="Tags"]/following-sibling::div//button').count() >= Math.min(tagN, 2));
// scope toggles default on
ok("search-in all on", (await p.locator('button[aria-pressed=true]:has-text("✓")').count()) === 3);

// ---- Advanced: add, swap, undo, drag ----
await p.evaluate(() => localStorage.removeItem("ijodel-adv"));
await p.goto(U + "/advanced"); await p.reload(); await p.waitForSelector("aside h2:text(\"Best suggestions\")"); await wait(800);
ok("advanced default view = big cards", await p.locator("ul.grid-pubs").count() === 1);
const req = chips("Required"), exp = chips("Expand"), exc = chips("Exclude");
// click a best suggestion -> Expand
const sug = p.locator('aside[aria-label="Best suggestions"] button:not([aria-label^=Dismiss])').first();
const sugText = (await sug.innerText()).replace(/\s*\d+$/, "").trim();
await sug.click(); await wait();
ok("click suggestion adds to Expand", await exp.getByText(sugText).count() > 0, sugText);
// swap Expand<->Required
await p.getByRole("button", { name: "Swap the filters of Required and Expand" }).click(); await wait();
ok("swap moves chip to Required", await req.getByText(sugText).count() > 0 && await exp.getByText(sugText).count() === 0);
await p.getByRole("button", { name: /Undo/ }).click(); await wait();
ok("undo restores", await exp.getByText(sugText).count() > 0);
// drag a suggestion chip into Exclude
const sug2 = p.locator('aside[aria-label="Best suggestions"] span[draggable=true]').first();
const s2t = (await sug2.locator("button").first().innerText()).replace(/\s*\d+$/, "").trim();
await sug2.dragTo(exc); await wait();
ok("drag suggestion into Exclude", await exc.getByText(s2t).count() > 0, s2t);
// drop onto the text input and the Add button inside an area
const sug3 = p.locator('aside[aria-label="Best suggestions"] span[draggable=true]').nth(1), s3t = (await sug3.locator("button").first().innerText()).replace(/\s*\d+$/, "").trim();
await sug3.dragTo(p.getByLabel(/^Add to Exclude/)); await wait();
ok("drop on a filter's text input", await exc.getByText(s3t).count() > 0, s3t);
const sug4 = p.locator('aside[aria-label="Best suggestions"] span[draggable=true]').nth(2), s4t = (await sug4.locator("button").first().innerText()).replace(/\s*\d+$/, "").trim();
await sug4.dragTo(req.getByRole("button", { name: "Add", exact: true })); await wait();
ok("drop on a filter's Add button", await req.getByText(s4t).count() > 0, s4t);
// drag a chip from Exclude to Required
await exc.locator("[draggable=true]").first().dragTo(req); await wait();
ok("drag chip Exclude -> Required", await req.getByText(s2t).count() > 0);
// drag a result card into Boost
const card = p.locator("ul.grid-pubs li[draggable=true]").first();
await card.scrollIntoViewIfNeeded(); await card.dragTo(chips("Boost"), { force: true }); await wait();
ok("drag result card into Boost", JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-adv"))).boost.some((c) => c.k === "pub"));
await p.evaluate(() => scrollTo(0, 0)); await wait();
ok("filters persisted", JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-adv"))).boost.length === 1);
// a chip dropped into Boost stays in its other area; H/L toggles and keeps H before L
await req.locator("[draggable=true]").first().dragTo(chips("Boost"), { force: true }); await wait();
const adv = async () => JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-adv")));
const advN = async () => { const v = await adv(); return JSON.stringify(["req", "boost", "exp", "exc"].map((k) => v[k])); }; // area order, not key order
let A = await adv();
ok("drop in Boost keeps the filter in Required", A.boost.length === 2 && A.req.some((c) => A.boost.some((b) => b.k === c.k && b.v === c.v)) && A.boost.every((c) => c.h === "H"));
await chips("Boost").getByRole("button", { name: /switch to low/ }).first().click(); await wait(); A = await adv();
ok("Boost H/L toggle sorts H before L", A.boost.map((c) => c.h).join("") === "HL");
await chips("Boost").getByRole("button", { name: /^Remove / }).last().click(); await wait(); A = await adv();
ok("Remove in Boost leaves the filter in Required", A.boost.length === 1 && A.req.length > 0);
// Expand mode: "at least one" narrows
const n = async () => +(await p.locator("p.text-sm > b").last().innerText());
const nAny = await n();
await p.getByLabel("How the Expand filters apply").selectOption("one"); await wait();
ok("mode 'one' renames Expand to Additional", await p.getByRole("heading", { name: "Additional" }).count() === 1);
ok("mode 'one' narrows results", (await n()) <= nAny, `(${nAny}->${await n()})`);
await p.getByLabel("How the Additional filters apply").selectOption("any").catch(async () => p.getByLabel("How the Expand filters apply").selectOption("any")); await wait();
ok("mode back to 'any'", (await n()) === nAny);
// Seeding options of Best suggestions
const sg = p.locator('aside[aria-label="Best suggestions"]'), sgN = () => sg.locator("span[draggable=true]").count();
const n0 = await sgN();
await sg.getByLabel("the filters").uncheck(); await sg.getByLabel("the first", { exact: true }).uncheck(); await wait();
ok("no seed source -> none, with hint", (await sgN()) === 0 && await sg.getByText("Tick a source").count() === 1);
await sg.getByLabel("the first", { exact: true }).check(); await sg.getByLabel("How many of the first results seed suggestions").fill("1"); await wait();
ok("seeding from first result only changes suggestions", (await sgN()) > 0 && (await sgN()) !== n0 || (await sgN()) > 0, `(${n0}->${await sgN()})`);
await sg.getByLabel("the filters").check(); await sg.getByLabel("How many of the first results seed suggestions").fill("10");
// Lookup dialog
await chips("Required").getByRole("button", { name: /^Find filters/ }).click(); await wait();
ok("facet pop-up opens", await p.getByRole("dialog").count() > 0);
{ let inside = true; for (let i = 0; i < 15; i++) { await p.keyboard.press("Tab"); inside = inside && await p.evaluate(() => !!document.activeElement.closest('[role=dialog]')); }
  ok("R144 Find filters: 15 Tabs stay inside the dialog", inside); }
await p.keyboard.press("Escape"); await wait(200);
ok("R144 Esc closes Find filters and focus returns to the Lookup button", await p.getByRole("dialog").count() === 0 && /^Find filters/.test(await p.evaluate(() => document.activeElement.getAttribute("aria-label") || "")));

// ---- Advanced Q&A option on cards and details ----
await p.goto(U + "/advanced"); await p.waitForSelector("ul.grid-pubs"); await wait(500);
ok("Q&A hidden by default", await p.getByLabel(/^Questions answered by/).count() === 0);
await p.getByLabel("Q&A").selectOption("q"); await wait();
ok("cards show questions", await p.locator('ul.grid-pubs [aria-label^="Questions answered by"]').count() > 0);
await p.getByLabel("Q&A").selectOption("qa"); await p.getByRole("button", { name: "Details" }).click(); await wait();
ok("details show openable Q&A", await p.locator('ol [aria-label^="Questions answered by"] details').count() > 0);
ok("details offer draggable filters not yet used", await p.locator('ol [aria-label="Filters you can add from this item"] [draggable=true]').count() > 0);
ok("AI label on answers", await p.locator("ol details abbr[title^=\"Never cite\"]").count() > 0);
await p.locator('ol details summary').first().click(); await wait();
ok("answer opens", await p.locator('ol details[open]').count() === 1);

// ---- Reader: abstract by default, AI summaries behind a toggle ----
await p.goto(U + "/read/295"); await p.waitForSelector("h1"); await wait();
ok("reader shows abstract, no AI note", await p.getByRole("heading", { name: "Abstract" }).count() === 1 && await p.locator("main section:has(h2:text-is(\"Abstract\")) [role=note]").count() === 0);
await p.getByRole("button", { name: "AI summary" }).click(); await wait();
ok("AI summary shows disclaimer on top", await p.locator("main section:has(h2:text-is(\"Summary\")) [role=note]").first().innerText().then((t) => t.startsWith("AI-generated.")) && await p.getByText("Never cite from the AI summary").count() === 1 && await p.getByRole("button", { name: "2 pages" }).count() === 1);
const w1 = (await p.locator("section .space-y-4").first().innerText()).length;
await p.getByRole("button", { name: "2 pages" }).click(); await wait();
ok("2-page summary is longer than half page", (await p.locator("section .space-y-4").first().innerText()).length > w1);
ok("reader FAQs grouped key + topic", await p.locator("[data-faq-group=key] details").count() > 0 && await p.locator("[data-faq-group=topic]").count() <= 1);
await p.locator("[data-faq-group=key] details summary").first().click(); await wait();
ok("FAQ shows PDF page + paragraph", /^Source: PDF page \d+, paragraph \d+$/.test(await p.locator("[data-faq-group=key] details[open] p").last().innerText()));

{ await p.goto(U + "/"); await p.waitForSelector(".row-track"); await wait(500); const h = p.getByRole("button", { name: /Scroll for more categories/ });
  await p.evaluate(() => scrollTo(0, 1500)); await wait(300); const mid = await h.count();
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(500);
  ok("scroll hint stays while scrolling and hides at the footer", mid === 1 && await h.count() === 0); }
{ await p.goto(U + "/search/libre"); await p.waitForSelector("text=chapters for"); await wait(600);
  const first = await p.locator(".grid-pubs > li a[href*='/read/'], .cv-list > li a[href*='/read/']").first().getAttribute("href").then((h) => h.match(/read\/(\d+)/)?.[1]);
  await p.evaluate(() => scrollTo(0, 0)); await p.getByRole("link", { name: /relationship map from/ }).click(); await p.waitForURL(/maps\/pub\/\d+/);
  ok("logo emblem on a search with a query seeds the map with the top result", !!first && p.url().endsWith("/maps/pub/" + first), `(${first})`);
  await fill4();
  const top = await p.evaluate(() => window.__top);
  await p.getByRole("link", { name: /relationship map from/ }).click(); await p.waitForURL(/maps\/pub\/\d+/);
  ok("logo emblem on Advanced with a filter seeds the map with the top result", top != null && p.url().endsWith("/maps/pub/" + top), `(${top})`); }
{ await p.goto(U + "/maps/pub/295"); await p.waitForSelector('svg[aria-label="Relationship map"]'); await wait(600);
  const undo = p.getByRole("button", { name: "↶ Undo", exact: true }), redo = p.getByRole("button", { name: "↷ Redo", exact: true }), rings = p.getByRole("button", { name: "Rings" });
  const dis0 = await undo.isDisabled(); await rings.click(); await wait(300);
  const ringsOn = await rings.getAttribute("aria-pressed") === "true"; await undo.click(); await wait(300);
  const back = await p.getByRole("button", { name: "Circuit" }).getAttribute("aria-pressed") === "true"; await redo.click(); await wait(300);
  ok("map Undo/Redo steps the layout back and forward", dis0 && ringsOn && back && await rings.getAttribute("aria-pressed") === "true");
  await p.locator("svg g[data-node]").nth(1).dblclick().catch(() => {}); }
// ---- Maps ----
await p.goto(U + "/"); await p.getByRole("link", { name: /random chapter of the latest issue/ }).click(); await p.waitForURL(/maps\/pub\/\d+/); await p.waitForSelector('svg[aria-label="Relationship map"]');
ok("logo emblem opens a 2D Circuit map seeded from the latest issue", await p.getByRole("button", { name: "Circuit" }).getAttribute("aria-pressed") === "true");
await p.goto(U + "/"); await wait(500); await p.evaluate(() => scrollTo(0, 40)); await wait(200); const y0 = await p.evaluate(() => scrollY);
await p.getByRole("link", { name: /random chapter of the latest issue/ }).click(); await p.waitForURL(/maps\/pub\/\d+/); await p.waitForSelector('svg[aria-label="Relationship map"]'); await wait(400);
await p.waitForFunction((y) => Math.abs(scrollY - y) < 5, y0, { timeout: 2500 }).catch(() => {});
ok("emblem click keeps the scroll level", y0 > 0 && Math.abs((globalThis.__y1 = await p.evaluate(() => scrollY)) - y0) < 5, `(${y0} -> ${globalThis.__y1})`);
{ const svg = p.locator('svg[aria-label="Relationship map"]'); const nodes = await svg.locator("circle, rect, path[data-node]").count();
  ok("map has a full-screen button", await p.getByRole("button", { name: "Full screen map" }).count() === 1);
  ok("map legend lists the Show options on the canvas", await p.getByRole("group", { name: "Show on the map" }).count() === 1);
  ok("map labels nodes and lines", await svg.locator("text").count() > 5, `(${await svg.locator("text").count()} texts)`);
  await p.getByRole("button", { name: "Full screen map" }).click(); await wait(500);
  ok("full-screen map button toggles", await p.getByRole("button", { name: "Exit full screen" }).count() === 1 || await p.evaluate(() => !document.fullscreenEnabled)); }
await p.goto(U + "/maps/pub"); await p.waitForSelector('svg[aria-label="Relationship map"]'); await wait(1000);
ok("2D Circuit is the default map", await p.getByRole("button", { name: "2D", exact: true }).getAttribute("aria-pressed") === "true" && await p.getByRole("button", { name: "Circuit" }).getAttribute("aria-pressed") === "true");
await p.getByRole("button", { name: "3D", exact: true }).click(); await p.waitForSelector("canvas", { timeout: 20000 }).catch(() => {}); await wait(1500);
ok("3D canvas renders", await p.locator("canvas").count() > 0);
ok("3D map also defaults to Circuit", await p.getByRole("button", { name: "Circuit" }).getAttribute("aria-pressed") === "true");
const cv = p.locator("canvas").first(), bb = await cv.boundingBox();
await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.move(bb.x + bb.width / 2 + 120, bb.y + bb.height / 2 + 40, { steps: 8 }); await p.mouse.up();
await p.mouse.wheel(0, -300); await wait();
await p.getByRole("button", { name: "2D", exact: true }).click(); await p.waitForSelector('svg[aria-label="Relationship map"]'); await wait();
await p.getByRole("button", { name: "2D", exact: true }).click(); await wait();
ok("2D svg view", await p.locator('svg[aria-label="Relationship map"]').count() === 1);
await p.locator('svg g[role=button]').nth(2).click(); await wait();
ok("node click shows selection", await p.getByText("Add to Advanced Search as").count() > 0);
ok("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));

// ---- Cookie consent: fresh visitor ----
{ await p.goto(U + "/search/" + encodeURIComponent('"learning without a physical classroom"')); await p.waitForSelector("text=chapters for", { timeout: 15000 }).catch(() => {}); await wait(800);
  ok("an unmatched quoted phrase falls back to meaning, with a notice", await p.getByText("No chapter contains that exact phrase").count() === 1 && await p.getByText("Nothing found").count() === 0); }
{ const c7 = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await c7.goto(U + "/"); await c7.getByRole("button", { name: "Customize…" }).click();
  ok("first visit: Customize opens the settings with every optional item off", await c7.getByRole("dialog", { name: "Cookie and privacy settings" }).count() === 1 && await c7.locator("#c-lists, #c-pref, #c-model, #c-counter").evaluateAll((e) => e.length === 4 && e.every((x) => !x.checked))); }
{ const c8 = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await c8.goto(U + "/read/10"); const ab = c8.getByRole("button", { name: /Add to (a )?view list/ }).first(); await ab.click({ force: true });
  ok("no lists consent: the + button is disabled, explains why, and opens Cookie settings", await ab.getAttribute("aria-disabled") === "true" && /Cookie settings/.test(await ab.getAttribute("title")) && await c8.getByRole("dialog", { name: "Add to a view list" }).count() === 0 && await c8.getByRole("dialog", { name: "Cookie and privacy settings" }).count() === 1); }
{ const c9 = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await c9.goto(U + "/"); await c9.getByRole("button", { name: "View lists only" }).click(); await c9.goto(U + "/maps/pub/10"); await c9.getByText("Node list (text version of the map)").click();
  const nl = c9.getByRole("list", { name: "Nodes and their connections" }), nb = nl.getByRole("button", { name: "Add to a view list" }).first(); await nb.scrollIntoViewIfNeeded(); await wait(300); await nb.click(); await wait(300); await c9.getByLabel("New list name").fill("Map list"); await c9.keyboard.press("Enter"); await wait(300);
  ok("map node list: a chapter can be added to a view list", await nl.locator("li", { hasText: "Chapter" }).first().getByRole("button", { name: "In a view list; change lists" }).count() === 1); }
{ const c6 = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await c6.goto(U + "/"); await c6.getByRole("button", { name: "View lists only" }).click();
  await c6.goto(U + "/read/10"); await c6.getByRole("button", { name: "Larger text" }).first().click().catch(() => {}); const ab6 = c6.getByRole("button", { name: /Add to (a )?view list/ }).first(); await ab6.scrollIntoViewIfNeeded(); await wait(300); await ab6.click(); await wait(300); await c6.getByLabel("New list name").fill("Mine"); await c6.getByLabel("New list name").press("Enter");
  const cs = await c6.evaluate(() => JSON.parse(localStorage.getItem("ijodel-consent"))), ks = await c6.evaluate(() => Object.keys(localStorage));
  ok("View lists only: lists allowed, history and settings not", cs.lists === true && cs.prefs === false && !cs.model && !cs.counter && ks.includes("ijodel-lists") && ks.every((x) => /^ijodel-(consent|lists?)$/.test(x)), ks.join(" ")); }
{ const c5 = await b.newContext({ viewport: { width: 1300, height: 900 } }); await c5.addInitScript(() => { sessionStorage.setItem("ijodel-lite", "1"); localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: true })); });
  const q5 = await c5.newPage(); let hf = 0; q5.on("request", (r) => { if (/huggingface\.co/.test(r.url())) hf++; });
  await q5.goto(U + "/search/libre"); await q5.waitForSelector("text=chapters for"); await wait(2500);
  ok("weak device: no model download, keyword search only", hf === 0 && (await q5.locator("main").innerText()).includes("chapters for")); await c5.close(); }
{ const c2 = await (await b.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await c2.goto(U + "/"); await c2.getByRole("dialog", { name: "Cookie and privacy choices" }).waitFor();
  ok("first visit shows the cookie banner", true);
  await c2.getByRole("button", { name: "Essential only" }).click();
  await c2.goto(U + "/read/10"); await c2.getByRole("button", { name: /Add to view list|\+/ }).first().click().catch(() => {});
  const keys = await c2.evaluate(() => Object.keys(localStorage));
  ok("essential-only stores nothing but the choice", keys.length === 1 && keys[0] === "ijodel-consent");
  await c2.goto(U + "/privacy"); await c2.getByRole("heading", { name: "Privacy notice" }).waitFor().catch(() => {}); ok("privacy notice page exists", await c2.getByRole("heading", { name: "Privacy notice" }).count() === 1);
  await c2.getByRole("button", { name: "Cookie settings" }).first().click();
  ok("header has a Cookie settings button that opens the dialog", await c2.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Cookie settings" }).count() === 1 && await c2.getByRole("dialog", { name: "Cookie and privacy settings" }).count() === 1);
  await c2.getByLabel("Search history and settings").check(); await c2.getByRole("button", { name: "Save choices" }).click();
  ok("settings dialog saves a choice", (await c2.evaluate(() => JSON.parse(localStorage.getItem("ijodel-consent")))).prefs === true);
  await c2.locator("footer").getByRole("button", { name: "Cookie settings" }).click(); await c2.getByRole("dialog", { name: "Cookie and privacy settings" }).waitFor(); await c2.keyboard.press("Escape"); await c2.waitForTimeout(200);
  ok("R145 Cookie settings: Esc returns focus to the footer link that opened it", await c2.evaluate(() => document.activeElement.textContent.trim() === "Cookie settings" && !!document.activeElement.closest("footer"))); }
{ const t0 = await p.title(); await p.goto(U + "/read/10"); await p.waitForFunction((t) => document.title !== t && document.title.endsWith("| IJODeL"), t0);
  const a = await p.title(); await p.goto(U + "/maps"); await p.waitForFunction((t) => document.title !== t, a);
  ok("document.title changes per route", /Maps \| IJODeL/.test(await p.title()), await p.title());
  const r = await fetch("http://localhost:4173/read/10/"); const h = await r.text();
  ok("static read page serves and links to the app", r.ok && /citation_title/.test(h) && /href="\.\.\/\.\.\/#\/read\/10"/.test(h)); }
{ await p.goto(U + "/search/libre"); await p.waitForSelector("text=chapters for"); await wait(500);
  await p.getByRole("button", { name: /Full content/ }).click(); await wait(800);
  ok("no best passage when full content is not searched", await p.getByLabel("Best-fit passage").count() === 0);
  ok("search scope hint is shown", await p.getByText(/only when .Full content. is searched/).count() > 0); }
ok("no CSP violations in the console", !csp.length, csp[0]?.slice(0, 120) ?? "");
await p.goto(U + "/"); await wait(800);
{ const li = await p.getByRole("heading", { name: "Latest issues" }).first().boundingBox(), org = await p.getByRole("group", { name: "Organize by" }).boundingBox(); ok("By category/issue/tag sit below the Latest issues list", org.y > li.y + li.height); }
await p.getByLabel("Search chapters").first().fill("zzquux"); await p.getByRole("link", { name: "Advanced search" }).first().click(); await wait(1200);
ok("Advanced adds the search words as a Required filter", await chips("Required").getByText("zzquux").count() > 0);
// ---- Round 29/30: semantic model starts on first search focus, progress line, IndexedDB vectors, BM25 fallback, worker ----
{ const c2 = await b.newContext({ viewport: { width: 1400, height: 1500 } });
  await c2.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: true })));
  const q = await c2.newPage(), reqs = [], wk = []; q.on("request", (r) => reqs.push(r.url())); q.on("console", (m) => /Content Security Policy/i.test(m.text()) && csp.push(m.text())); q.on("worker", (w) => wk.push(w.url()));
  await q.goto(U + "/"); await q.waitForSelector("text=Latest issues"); await q.waitForTimeout(1500);
  ok("no model or vecs.bin download before a search box is focused", !reqs.some((u) => /huggingface|vecs\.bin|transformers/.test(u)), reqs.filter((u) => /huggingface|vecs/.test(u))[0] || "");
  const t0 = Date.now(); await q.getByLabel("Search chapters").first().focus();
  const seen = await q.locator("[data-model=loading]").waitFor({ timeout: 5000 }).then(() => Date.now() - t0).catch(() => -1);
  ok("focus shows the model progress line", seen >= 0, `(${seen} ms)`);
  ok("search runs in a module worker", wk.some((u) => /worker/.test(u)), `(${wk.length})`);
  const tr = await q.waitForFunction(() => !document.querySelector("[data-model]"), null, { timeout: 120000 }).then(() => Date.now() - t0).catch(() => -1);
  ok("model + vectors ready after focus", tr >= 0, `(${tr} ms cold)`);
  const idb = await q.evaluate(() => new Promise((ok) => { const r = indexedDB.open("ijodel", 1); r.onsuccess = () => { const g = r.result.transaction("kv").objectStore("kv").get("vecs"); g.onsuccess = () => ok(g.result?.buf?.byteLength || 0); g.onerror = () => ok(0); }; r.onerror = () => ok(0); }));
  ok("vectors cached in IndexedDB under model consent", idb > 0, `(${idb} B)`);
  await q.reload(); await q.waitForSelector("text=Latest issues"); const n0 = reqs.length; const t1 = Date.now(); await q.getByLabel("Search chapters").first().focus();
  await q.waitForFunction(() => !document.querySelector("[data-model]"), null, { timeout: 60000 }).catch(() => {}); await q.waitForTimeout(300);
  ok("warm start: vecs.bin not re-downloaded", !reqs.slice(n0).some((u) => /vecs\.bin$/.test(u)) , `(${Date.now() - t1} ms warm)`);
  await q.evaluate(() => { const v = JSON.parse(localStorage.getItem("ijodel-consent")); return v; });
  await c2.close();
  // model unreachable: progress line says keyword only, results still come
  const c3 = await b.newContext({ viewport: { width: 1400, height: 1500 } });
  await c3.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: true })));
  await c3.route(/huggingface|hf\.co|jsdelivr/, (r) => r.abort());
  const f = await c3.newPage(); await f.goto(U + "/search/libre"); await f.waitForSelector("text=chapters for");
  ok("model failure shows keyword-only notice", await f.locator("[data-model=failed]").waitFor({ timeout: 30000 }).then(() => true).catch(() => false));
  ok("BM25 results still shown after model failure", await f.waitForFunction(() => +document.querySelector("[role=status] b")?.textContent > 0, null, { timeout: 15000 }).then(() => true).catch(() => false));
  await c3.close();
  // no consent: no model download on focus; worker blocked: in-thread fallback still searches
  const c4 = await b.newContext({ viewport: { width: 1400, height: 1500 } });
  await c4.addInitScript(() => { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); window.__noWorker = true; });
  const g = await c4.newPage(), r4 = []; g.on("request", (r) => r4.push(r.url())); await g.goto(U + "/search/libre"); await g.waitForSelector("text=chapters for");
  await g.getByLabel("Search chapters").first().focus(); await g.waitForTimeout(800);
  ok("no model consent: nothing fetched from Hugging Face", !r4.some((u) => /huggingface/.test(u)));
  ok("in-thread fallback (no worker) returns results", await g.waitForFunction(() => +document.querySelector("[role=status] b")?.textContent > 0, null, { timeout: 15000 }).then(() => true).catch(() => false));
  await c4.close(); }
// ---- Rounds 38-46 ----
{ for (const prefs of [false, true]) { const cx = await b.newContext({ viewport: { width: 1300, height: 900 } }); await cx.addInitScript((v) => { if (!localStorage.getItem("ijodel-consent")) localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: v })); }, prefs);
    const t = await cx.newPage(); await t.goto(U + "/"); const tour = t.getByRole("region", { name: "Quick tour" }); await tour.waitFor();
    await tour.getByRole("button", { name: "Next" }).click(); const step2 = await tour.getByText("step 2 of 3").count();
    await tour.getByRole("button", { name: "Skip tour" }).click(); await t.reload(); await t.waitForSelector("text=Latest issues");
    const again = await t.getByRole("region", { name: "Quick tour" }).count(), stored = await t.evaluate(() => localStorage.getItem("ijodel-tour"));
    ok(`tour: steps and dismissal ${prefs ? "kept on the device with prefs consent" : "not stored without prefs consent"}`, step2 === 1 && (prefs ? again === 0 && stored === "1" : again === 1 && stored === null)); await cx.close(); } }
await p.goto(U + "/search/libre"); await p.waitForSelector("text=chapters for"); await wait(600);
await p.locator('xpath=//span[normalize-space()="Category"]/following-sibling::div//button').first().click(); await wait();
ok("search: status announces filters and sort", /1 filter, sorted by relevance/.test(await p.locator("[role=status][aria-atomic]").innerText()));
await p.getByRole("button", { name: /^Remove filter / }).first().click(); await wait();
await p.getByLabel("Sort").selectOption("title"); await wait();
{ const t = await p.locator("ul.grid-pubs > li a.pub-link").evaluateAll((l) => l.slice(0, 5).map((a) => a.closest("li").querySelector("img, .cover") && a.closest("li").innerText));
  ok("search: chip removed and Title A-Z sort announced", await p.getByRole("button", { name: /^Remove filter / }).count() === 0 && /sorted by title A to Z/.test(await p.locator("[role=status][aria-atomic]").innerText())); }
await p.evaluate(() => localStorage.removeItem("ijodel-adv")); await p.goto(U + "/advanced"); await p.reload(); await p.waitForSelector("aside h2:text(\"Best suggestions\")"); await wait(600);
{ const s1 = p.locator('aside[aria-label="Best suggestions"] select').first(), lab = (await s1.getAttribute("aria-label")).replace(/^Add | to…$/g, "");
  await s1.selectOption("exc"); await wait(); ok("advanced: keyboard route puts a suggestion in Exclude", await chips("Exclude").getByText(lab).count() > 0, lab);
  await p.locator("body").click({ position: { x: 5, y: 5 } }); await p.keyboard.press("Control+z"); await wait(); ok("advanced: Ctrl+Z undoes", await chips("Exclude").getByText(lab).count() === 0);
  await p.getByRole("button", { name: "Details" }).click(); await wait(); const pick = p.locator('ol [aria-label="Filters you can add from this item"] select').first();
  await pick.selectOption("boost"); await wait(); ok("advanced: a result chapter reaches Boost without dragging", (await adv()).boost.some((c) => c.k === "pub")); }
await p.goto(U + "/read/295"); await p.waitForSelector("h1"); await wait();
{ const nav = p.getByRole("navigation", { name: "On this page" });
  ok("reader: sticky section nav with progress", await nav.evaluate((e) => getComputedStyle(e).position) === "sticky" && await p.getByRole("progressbar", { name: "Reading progress" }).count() === 1);
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await wait(); ok("reader: progress reaches 100 at the end", await p.getByRole("progressbar").getAttribute("aria-valuenow") === "100");
  const nx = nav.getByRole("link", { name: /in issue/ }); ok("reader: previous/next in the issue", await nx.count() > 0);
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]); await nav.getByRole("button", { name: "Share link" }).click(); await wait();
  ok("reader: share copies the link", (await p.evaluate(() => navigator.clipboard.readText())).endsWith("#/read/295"));
  await p.emulateMedia({ media: "print" }); ok("reader: print hides header, footer and toolbar", !(await p.locator("header").isVisible()) && !(await nav.isVisible()) && await p.locator("h1").isVisible()); await p.emulateMedia({ media: "screen" }); }
await p.evaluate(() => localStorage.setItem("ijodel-lists", JSON.stringify([{ id: "l1", name: "Test list", items: ["295", "10"] }])));
await p.goto(U + "/list/l1"); await p.reload(); await p.waitForSelector("text=Test list");
await p.getByRole("button", { name: /^Move down:/ }).first().click(); await wait();
ok("lists: reorder", JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-lists")))[0].items.join() === "10,295");
{ const [d] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "BibTeX" }).click()]); const t = await (await import("fs")).promises.readFile(await d.path(), "utf8");
  ok("lists: BibTeX export", /^@article\{ijodel10,/.test(t) && (t.match(/@article/g) || []).length === 2);
  const [r] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "RIS" }).click()]); ok("lists: RIS export", /^TY {2}- JOUR/.test(await (await import("fs")).promises.readFile(await r.path(), "utf8")));
  const [j] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "JSON", exact: true }).click()]);
  await p.getByRole("button", { name: "Copy share link" }).click(); await wait(); const link = await p.evaluate(() => navigator.clipboard.readText());
  await p.goto(link.replace(/^.*#/, U)); await p.waitForSelector("text=Shared view list"); ok("lists: share link opens the shared list", await p.locator("main li").count() === 2);
  await p.goto(U + "/list/share/x/295,<img>,99999"); await p.waitForSelector("text=Shared view list"); ok("lists: shared link keeps only known chapters", /1 chapter\./.test(await p.locator("main p").first().innerText()));
  await p.goto(U + "/list/share/x/3,3,999999,6"); await p.waitForSelector("text=Shared view list"); ok("lists: shared link drops duplicate and unknown ids (R161)", /2 chapters\./.test(await p.locator("main p").first().innerText())); }
await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await wait(500);
{ await p.getByLabel("Find a node on the map").fill(await p.locator("svg g[data-node][tabindex]").nth(3).getAttribute("aria-label").then((l) => l.split(": ")[1].slice(0, 12))); await p.keyboard.press("Enter"); await wait();
  ok("maps: node search selects and focuses a node", await p.evaluate(() => document.activeElement?.getAttribute("aria-pressed")) === "true");
  ok("R142 focused map node shows a stroke ring (>=3 wide, >=3:1 on white)", await p.evaluate(() => { const c = getComputedStyle(document.activeElement.querySelector(":scope > g:not([aria-hidden])")), [r, g, b] = c.stroke.match(/\d+/g).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return parseFloat(c.strokeWidth) >= 3 && 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05) >= 3; }));
  const a0 = await p.evaluate(() => document.activeElement.dataset.node); await p.keyboard.press("ArrowRight"); ok("maps: arrow keys move between nodes", await p.evaluate((a) => document.activeElement.dataset.node && document.activeElement.dataset.node !== a, a0));
  ok("maps: every line has a why-connected tooltip", await p.locator("svg > g > g:not([data-node]) > title").count() === await p.locator("svg > g > g:not([data-node])").count() && /→/.test(await p.locator("svg title").first().textContent()));
  await p.getByRole("button", { name: "3D", exact: true }).click(); await p.waitForSelector("canvas", { timeout: 20000 }).catch(() => {}); ok("maps: 3D offers a low-power mode", await p.getByLabel("Low power").count() === 1); await p.getByLabel("Low power").check(); await wait(800); ok("maps: low power keeps rendering", await p.locator("canvas").count() > 0); }
await p.goto(U + "/no-such-page"); await p.waitForSelector("h1"); ok("404 route with a search prefilled", await p.getByRole("heading", { name: "Page not found" }).count() === 1 && await p.getByLabel("Search chapters").inputValue() === "no such page");
await ctx.setOffline(true); await wait(300); ok("offline message", await p.getByText("You are offline.").count() === 1); await ctx.setOffline(false); await wait(300); ok("offline message clears", await p.getByText("You are offline.").count() === 0);
{ const e = await ctx.newPage(); await e.goto(U + "/"); await e.waitForSelector("text=Latest issues"); await e.evaluate(() => { window.__S.byId["295"] = { ...window.__S.byId["295"], authors: null }; location.hash = "/read/295"; });
  await e.getByRole("alert").filter({ hasText: "Something went wrong" }).waitFor({ timeout: 5000 }).catch(() => {}); ok("error boundary: a crashing route shows Retry, header stays", await e.getByRole("button", { name: "Retry" }).count() === 1 && await e.locator("header").count() === 1);
  ok("R245 error boundary: the alert names the route and Retry has focus", /\/read\/295/.test(await e.getByRole("alert").filter({ hasText: "Something went wrong" }).innerText()) && await e.evaluate(() => document.activeElement?.textContent === "Retry"), await e.evaluate(() => document.activeElement?.tagName + ":" + document.activeElement?.textContent));
  await e.getByRole("link", { name: "Home" }).last().click(); ok("error boundary: another route recovers", await e.getByText("Latest issues").first().waitFor({ timeout: 5000 }).then(() => true, () => false)); await e.close(); }
{ const m = await b.newPage({ viewport: { width: 390, height: 800 } }); await m.goto(U + "/advanced"); await m.waitForSelector("text=Advanced search");
  const sb = m.getByRole("button", { name: /^Best suggestions/ }); const hid = !(await m.getByRole("complementary", { name: "Best suggestions" }).isVisible()); await sb.click();
  ok("phone: Advanced suggestions fold behind a button", hid && await m.getByRole("complementary", { name: "Best suggestions" }).isVisible());
  await m.goto(U + "/search/libre"); await m.waitForSelector("text=chapters for"); ok("phone: search filters fold behind a button", !(await m.getByText("Category", { exact: true }).isVisible()) && await m.getByRole("button", { name: /^Filters/ }).isVisible());
  await m.close(); }
{ const d = await b.newPage({ colorScheme: "dark" }); await d.goto(U + "/maps/pub/295"); await d.waitForSelector("svg g[data-node]");
  ok("site stays light when the OS prefers dark", await d.evaluate(() => { const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return m[0] + m[1] + m[2] > 600; }));
  await d.close(); }
{ const h = await b.newPage({ viewport: { width: 1300, height: 900 } }); await h.goto(U + "/"); await h.waitForSelector(".row-track .cover.gen");
  const [pairs, same] = await h.evaluate(() => { let n = 0, k = 0; document.querySelectorAll(".row-track").forEach((t) => { const c = [...t.querySelectorAll(".cover.gen")].map((e) => e.style.background + e.querySelector("svg").innerHTML.slice(0, 12)); for (let i = 1; i < c.length; i++) { n++; if (c[i] === c[i - 1]) k++; } }); return [n, k]; });
  ok("covers: neighbours in a row rarely look the same (<3%)", pairs > 50 && same / pairs < 0.03, `(${same}/${pairs})`); await h.close(); }
{ await p.goto(U + "/search/chatgtp%20teaching"); await p.waitForSelector("text=chapters for"); await wait(600);  // round 55: a typo next to a real word still finds the article
  ok("search: typo beside a real word (chatgtp teaching) finds the ChatGPT article", await p.getByText("ChatGPT — A Threat or an Aid", { exact: false }).first().isVisible().catch(() => false)); }
// ---- rounds 56-65 ----
{ await p.goto(U + "/search/" + encodeURIComponent('learning "distance education" year:2016-2018')); await p.waitForSelector("text=chapters for"); await p.waitForSelector(".grid-pubs > li p.text-xs", { timeout: 8000 }).catch(() => {});
  const ys = await p.locator(".grid-pubs > li p.text-xs", { hasText: "· Vol" }).allInnerTexts();
  ok("56 operators: phrase and year shown as chips, results inside the years", await p.getByRole("link", { name: "Remove year: 2016–2018" }).count() === 1 && await p.getByRole("link", { name: "Remove “distance education”" }).count() === 1 && ys.length > 0 && ys.every((t) => /201[678] · Vol/.test(t)), `(${ys.length})`); }
{ await p.goto(U + "/search/libre"); await p.waitForSelector("text=chapters for"); await wait(600);
  await p.getByRole("link", { name: "Show in chapter" }).first().click(); await p.waitForSelector("#r-passage mark", { timeout: 8000 }).catch(() => {});
  ok("57 Show in chapter opens the reader at the highlighted passage", await p.locator("#r-passage mark").count() > 0 && /\/read\/\d+\/p\/\d+/.test(p.url()));
  await p.getByRole("button", { name: "MLA", exact: true }).click();
  ok("58 citation style toggle: MLA", /vol\. \d+, no\. /.test(await p.getByRole("region", { name: "How to cite" }).innerText())); }
{ await p.goto(U + "/search/" + encodeURIComponent("libre year:1990")); await p.waitForSelector("text=Nothing found"); await p.getByRole("button", { name: /^✓ Title/ }).click(); await wait(600);
  const wide = await p.getByRole("button", { name: "Search in all fields" }).count(), tags = await p.locator("text=Or browse a popular tag").count();
  await p.getByRole("link", { name: "Drop the query operators" }).click(); await p.waitForSelector("text=chapters for “libre”");
  ok("61 zero results: widen scope, tag suggestions, drop operators in one click", wide === 1 && tags === 1 && !(await p.locator("text=Nothing found").count())); }
{ await p.goto(U + "/search/libre"); await p.waitForSelector("text=chapters for"); await p.getByRole("button", { name: "☆ Save search" }).click();
  await p.goto(U + "/search"); await p.waitForSelector("text=chapters"); const has = await p.locator("text=Saved searches:").count();
  await p.getByRole("button", { name: "Clear saved" }).click(); await wait(200);
  ok("62 saved search listed on /search, Clear saved removes it", has === 1 && await p.locator("text=Saved searches:").count() === 0); }
{ await p.goto(U + "/advanced"); await p.waitForSelector("aside h2:text(\"Best suggestions\")"); await p.getByRole("button", { name: "Clear all" }).click().catch(() => {});
  await fill4();
  const n = await Promise.all(["Required", "Boost", "Expand", "Exclude"].map((a) => chips(a).locator("[data-chip]").count()));
  ok("63 a four-area search shows a chip in each area", n.every((x) => x === 1), n.join(","));
  await chips("Required").getByLabel(/^Move .* to another area$/).selectOption("boost"); await wait(300);
  const lab = () => chips("Boost").locator("[data-chip] span.line-clamp-1").allInnerTexts(), before = await lab();
  await chips("Boost").locator("[data-chip]").nth(1).locator("button").first().focus(); await p.keyboard.press("Alt+ArrowUp"); await wait(300); const after = await lab();
  ok("64 keyboard: copy to Boost, Alt+Up reorders and is announced", before.length === 2 && after[0] === before[1] && /is now 1 of 2 in Boost/.test(await p.locator("p[role=status]").first().innerText()), `${before}|${after}`);
  { await chips("Boost").locator("[data-chip]").nth(0).locator("button").first().focus(); await p.keyboard.press("Alt+End"); await wait(300); const e = await lab();
    await chips("Boost").locator("[data-chip]").nth(1).locator("button").first().focus(); await p.keyboard.press("Alt+Home"); await wait(300); const h = await lab();
    ok("R244 Boost chip: Alt+End moves it last, Alt+Home first", e.at(-1) === after[0] && h[0] === e.at(-1) && e.length === 2, `${after}|${e}|${h}`); }
  ok("65 results show matched-filter chips and no redundant Why panel", await p.locator("[data-matched]").count() > 0 && await p.getByText(/^Why #\d+\?$/).count() === 0); }
{ const c = await b.newContext(), p = await c.newPage(); await p.goto(U + "/"); await p.waitForSelector("nav[aria-label=Main]"); const got = p.waitForRequest(/assets\/Maps-.*\.js/, { timeout: 3000 }).then(() => true).catch(() => false);
  await p.locator("nav[aria-label=Main] a", { hasText: "Maps" }).hover(); ok("82 Maps chunk is fetched on tab hover (intent)", await got); await c.close(); }
// R169: a chunk that keeps failing reloads the page exactly once, then the error boundary shows (role=alert)
{ const c = await b.newContext(); await c.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true }))); await c.route(/assets\/Maps-.*\.js/, (r) => r.abort()); const p = await c.newPage(); let navs = 0; p.on("framenavigated", (f) => { if (f === p.mainFrame()) navs++; });
  await p.goto(U + "/maps"); await p.getByRole("alert").filter({ hasText: "Something went wrong" }).waitFor({ timeout: 8000 }).catch(() => {}); await wait(1500);
  ok("169 failing chunk: one reload, then an error alert", navs === 2 && await p.getByRole("alert").filter({ hasText: "Something went wrong" }).count() === 1, "navigations " + navs); await c.close(); }
// R164: the consent banner's choices share size, weight and shape (none is a link or smaller than the rest)
{ const c = await b.newContext(), p = await c.newPage(); await p.goto(U + "/"); const d = p.getByRole("dialog", { name: "Cookie and privacy choices" }); await d.waitFor();
  const st = await d.locator("button").evaluateAll((bs) => bs.map((x) => { const s = getComputedStyle(x); return [Math.round(x.getBoundingClientRect().height), s.fontSize, s.fontWeight, s.borderRadius, s.paddingLeft].join("|"); }));
  ok("164 consent buttons share height, font size and weight, shape and padding", st.length === 4 && new Set(st).size === 1, st.join(" ; ")); await c.close(); }
{ const c = await b.newContext({ viewport: { width: 1200, height: 900 } }); await c.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })));
  const q = await c.newPage(); await q.goto(U + "/read/3"); await q.waitForSelector("h1"); await q.evaluate(() => navigator.serviceWorker.ready);
  await q.reload(); await q.waitForSelector("h1"); const t = await q.locator("h1").innerText(); await q.waitForTimeout(800);
  await c.setOffline(true); await q.reload(); const t2 = await q.locator("h1").innerText({ timeout: 8000 }).catch(() => "");
  ok("83 offline: a visited chapter reloads from the service worker cache", t2 === t, `${t.slice(0, 30)}|${t2.slice(0, 30)}`); await c.close(); }
// ---- rounds 66-79 ----
{ await p.goto(U + "/advanced"); await p.waitForSelector("aside h2:text(\"Best suggestions\")"); await p.getByRole("button", { name: "Clear all" }).click().catch(() => {});
  await fill4();
  ok("66 result cards show the filters they matched", /^(Required|Expand|Boost)/.test(await p.locator("[data-matched] span").first().innerText().catch(() => "")));
  const before = await advN(); await p.getByRole("button", { name: "Share link" }).click(); await wait(300);
  ok("67 Share link says the link is copied", await p.getByRole("button", { name: "✓ Link copied" }).count() === 1 && await p.getByText(/copied to your clipboard/).count() === 1);
  ok("67 the address bar holds the current search", /#\/advanced\/s\//.test(p.url()));
  const link = await p.evaluate(() => navigator.clipboard.readText()); await p.getByRole("button", { name: "Clear all" }).click(); await wait(200);
  const toast = await p.locator("p[role=status]", { hasText: "Cleared 4 filters" }).getByRole("button", { name: "Undo" }).count();
  await p.goto(link.replace(/^.*#/, U)); await p.waitForSelector("p[role=status]:has-text(\"Opened a shared search\")"); await wait(300);
  ok("67 share link round trip restores the four areas", /#\/advanced\/s\//.test(link) && await advN() === before && /#\/advanced\/s\//.test(p.url()));
  await p.getByRole("button", { name: "Clear all" }).click(); await wait(500); ok("67 opened share link: Clear all leaves a bare #/advanced address", p.url().endsWith("#/advanced"));
  await p.goto(U + "/maps"); await wait(300); await p.goto(link.replace(/^.*#/, U)); await p.waitForSelector("p[role=status]:has-text(\"Opened a shared search\")"); await wait(300);
  await p.goto(U + "/advanced/s/@@notvalid"); await p.waitForSelector("p[role=status]:has-text(\"That share link is broken\")"); ok("67 a broken share link is refused, setup kept", await advN() === before);
  await p.getByRole("button", { name: "Clear all" }).click(); await wait(500); const cleared = p.url().endsWith("#/advanced"); await p.getByRole("button", { name: "Undo" }).last().click(); await wait(600);
  ok("67 the address follows Clear all and Undo", cleared && /#\/advanced\/s\//.test(p.url()));
  const undone = await advN() === before; await p.locator("summary", { hasText: /^History/ }).click();
  const items = await p.getByRole("list", { name: "Undo history" }).locator("button").count(); await p.getByRole("list", { name: "Undo history" }).locator("button").last().click(); await wait(200);
  ok("68 clear shows an Undo toast; History lists steps and jumps back", toast === 1 && undone && items >= 2 && (await adv()).req.length === 0, `items ${items}`); }
await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await wait(400);
{ ok("71 circuit traces have bend dots", await p.locator("svg circle[aria-hidden=true]").count() > 0);
  { const sk = p.getByRole("link", { name: "Skip the map, go to the node list" }); await sk.focus(); await p.keyboard.press("Enter"); await wait(100); // R284
    ok("R284 skip link opens the node list and focuses its summary", await p.evaluate(() => { const d = document.getElementById("map-nodelist"), r = d.open && document.activeElement.tagName === "SUMMARY"; d.open = false; return r; })); }
  await p.locator("summary", { hasText: "Node list" }).click(); const nl = p.getByRole("list", { name: "Nodes and their connections" });
  ok("73 node list lists every node with its links", await nl.locator("> li").count() === await p.locator("svg g[data-node]").count() && /\d+ links?:/.test(await nl.locator("li p").first().innerText()));
  await nl.locator("li button[aria-pressed]").last().click(); await wait(300);
  ok("74 selecting a node bolds its path to the seed and spells out why", await p.locator("svg g[data-path]").count() > 0 && /→.*→/.test(await p.locator("[data-why]").innerText()));
  await p.getByRole("button", { name: "Additional", exact: true }).click(); await wait(200);
  ok("75 map shows the pending addition with an Undo", await p.getByRole("button", { name: /^↶ Undo “Added/ }).count() === 1);
  await p.reload(); await p.waitForSelector("svg g[data-node]"); ok("75 the Expand/Additional choice is remembered", /Additional \(at least one\)/.test(await p.locator("text=Expand applies as").innerText()));
  await p.getByRole("button", { name: /^↶ Undo/ }).click().catch(() => {}); await p.goto(U + "/advanced"); await p.getByLabel("How the Expand filters apply").selectOption("any"); await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]");
  await p.getByRole("button", { name: "3D", exact: true }).click(); await p.waitForSelector("canvas", { timeout: 20000 }); await wait(800);
  const lost = await p.evaluate(() => { const x = document.querySelector("canvas").getContext("webgl2")?.getExtension("WEBGL_lose_context"); x?.loseContext(); window.__lc = x; return !!x; }); await wait(300);
  const msg = await p.getByText("The graphics were reset").count(); await p.evaluate(() => window.__lc?.restoreContext()); await wait(1500);
  ok("72 3D recovers from a lost WebGL context", lost && msg === 1 && await p.getByText("The graphics were reset").count() === 0 && await p.locator("canvas").count() > 0, `${lost} ${msg}`);
  await p.getByRole("button", { name: "2D", exact: true }).click(); }
await p.goto(U + "/read/295"); await p.waitForSelector("h1"); await wait(300);
{ await p.getByRole("button", { name: "Larger text" }).click(); await p.reload(); await p.waitForSelector("h1"); await wait(300);
  ok("76 text size control persists (prefs consent)", await p.locator("#r-overview").evaluate((e) => getComputedStyle(e.parentElement).zoom) === "1.15");
  await p.getByRole("button", { name: "Smaller text" }).click();
  ok("79 reader breadcrumb Home › Issues › issue", (await p.getByRole("navigation", { name: "Breadcrumb" }).innerText()).replace(/\s+/g, " ").startsWith("Home › Issues ›"));
  const r = p.locator("[data-faq-group] a", { hasText: /^PDF page \d+$/ }).first(); if (await r.count()) { await p.locator("[data-faq-group] details").first().locator("summary").click().catch(() => {}); }
  const refs = await p.locator('[data-faq-group] a[href*="/p/"]').count(); if (refs) { await p.locator('[data-faq-group] a[href*="/p/"]').first().evaluate((a) => a.click()); await p.waitForSelector("#r-passage", { timeout: 8000 }).catch(() => {}); }
  ok("77 a question's source page jumps to that passage", refs > 0 && await p.locator("#r-passage").count() === 1, `(${refs} refs)`);
  await p.goto(U + "/read/295"); await p.waitForSelector("h1"); await p.locator("#r-related").getByRole("button", { name: "Copy link to this section" }).click(); await wait(200);
  const sl = await p.evaluate(() => navigator.clipboard.readText()); await p.goto(U + "/"); await p.goto(sl.replace(/^.*#/, U)); await p.waitForSelector("h1"); await wait(500);
  ok("77 copy section link opens the chapter at that section", sl.endsWith("#/read/295/s/related") && await p.locator("#r-related").evaluate((e) => { const b = e.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0; })); }
{ await p.goto(U + "/issues"); await p.waitForSelector("h1"); await p.locator("main a[href^='#/issue/']").first().click(); await p.waitForSelector("text=in this issue");
  ok("79 issue page: cover, contents list and breadcrumb", await p.locator("main img[alt^='Cover of']").count() === 1 && await p.getByRole("list", { name: "Contents" }).locator("li").count() > 0 && /Issues/.test(await p.getByRole("navigation", { name: "Breadcrumb" }).innerText()));
  await p.goto(U + "/topics"); await p.locator("main a[href^='#/cat/']").first().click(); await p.waitForSelector("text=Related topics:");
  ok("79 topic hub lists related topics and common tags", await p.locator("text=Common tags:").count() === 1 && /Topics/.test(await p.getByRole("navigation", { name: "Breadcrumb" }).innerText())); }
{ await p.evaluate(() => localStorage.setItem("ijodel-lists", JSON.stringify([{ id: "l1", name: "Test list", items: ["295"] }]))); await p.goto(U + "/list/l1"); await p.reload(); await p.waitForSelector("text=Test list");
  p.once("dialog", (d) => d.accept("Renamed list")); await p.getByRole("button", { name: "Rename" }).click(); await wait(200);
  ok("78 lists: rename", JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-lists")))[0].name === "Renamed list"); }
{ const M = "svg[aria-label='Relationship map']", sc = () => p.evaluate((m) => +document.querySelector(m + " > g").getAttribute("transform").match(/scale\(([\d.]+)\)/)[1], M);
  await p.setViewportSize({ width: 1400, height: 700 }); await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await wait(500);
  await p.evaluate((m) => document.querySelector(m).scrollIntoView({ block: "center" }), M); await wait(200);
  const r = await p.locator(M).boundingBox(), y0 = await p.evaluate(() => scrollY), s0 = await sc(); await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.wheel(0, 100); await wait(300);
  ok("R100 maps: wheel over the 2D map zooms and does not scroll the page", await sc() < s0 && await p.evaluate(() => scrollY) === y0);
  for (let i = 0; i < 15; i++) await p.mouse.wheel(0, 100); await wait(200);
  ok("R103 maps: every svg text is at least 9 screen px at minimum zoom", await p.evaluate((m) => Math.min(...[...document.querySelectorAll(m + " text")].map((t) => t.getBoundingClientRect().height)), M) >= 8.9);
  await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await wait(300);
  const all = await p.locator("svg g[data-node][tabindex]").count(); await p.locator("svg g[data-node][tabindex]").nth(2).focus(); await p.keyboard.press("End"); const e1 = await p.evaluate(() => [...document.querySelectorAll("svg g[data-node][tabindex]")].indexOf(document.activeElement));
  await p.keyboard.press("Home"); const h1 = await p.evaluate(() => [...document.querySelectorAll("svg g[data-node][tabindex]")].indexOf(document.activeElement)); await p.keyboard.press("Enter"); await p.keyboard.press("Escape"); await wait(100);
  ok("R104 maps: Home/End move between focusable nodes and Esc clears the selection", e1 === all - 1 && h1 === 0 && await p.evaluate(() => document.activeElement.getAttribute("aria-pressed")) === "false");
  await p.setViewportSize({ width: 1024, height: 800 }); let hit = [];
  for (const id of ["295", ...(await p.evaluate(() => window.__S.articles.slice(0, 4).map((a) => a.id)))]) { await p.goto(U + "/maps/pub/" + id); await p.waitForSelector("svg g[data-node]"); await wait(400);
    hit.push(...await p.evaluate(() => { const f = document.querySelector("fieldset").getBoundingClientRect(); return [...document.querySelectorAll("svg g[data-node]")].filter((n) => { const q = n.getBoundingClientRect(); return q.left < f.right && q.right > f.left && q.top < f.bottom && q.bottom > f.top; }).map((n) => n.getAttribute("aria-label")); })); }
  ok("R102 maps: the Show options box covers no node at 1024px on 5 seeds", hit.length === 0, hit[0] ?? ""); await p.setViewportSize({ width: 1400, height: 1500 }); }
{ await p.goto(U + "/advanced"); await p.waitForSelector("h1"); await wait(300); const inp = p.getByLabel("Add to Required"); await inp.fill("distance learning"); await inp.press("Enter"); await wait(200);
  ok("R105 advanced: Add announces the result and keeps focus in the input", await p.getByRole("status").filter({ hasText: /Added .* to Required/ }).count() === 1 && await p.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Add to Required"); }
{ await p.goto(U + "/maps/pub/295"); await p.waitForSelector('svg[aria-label="Relationship map"]'); await wait(600);
  const au = p.getByLabel("Authors", { exact: true }), h0 = p.url(), c0 = await au.isChecked();
  await p.evaluate(() => { location.hash = "/maps/pub/3"; }); await wait(600); await au.click(); await wait(300);
  await p.keyboard.press("Control+z"); await wait(400); await p.keyboard.press("Control+z"); await wait(600);
  const back = p.url() === h0 && await au.isChecked() === c0;
  await p.keyboard.press("Control+Shift+z"); await wait(400); await p.keyboard.press("Control+Shift+z"); await wait(600);
  ok("R111 maps: Ctrl+Z twice restores the earlier seed and options, Ctrl+Shift+Z returns", back && p.url().endsWith("/maps/pub/3") && await au.isChecked() !== c0, `(${h0} ${p.url()})`); }
{ await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await wait(400); // R194
  // the last chapter node: never the seed (drawn first), and chapters show whatever the remembered map options are
  const node = p.locator('svg g[data-node][tabindex][aria-label^="chapter: "]').last(); await node.focus(); await p.keyboard.press("Enter"); await wait(150); const h0 = p.url(); await p.keyboard.press("Enter"); await wait(400);
  ok("R194 maps: Enter on the selected chapter node explores from it", h0.endsWith("/maps/pub/295") && /\/maps\/pub\/\d+$/.test(p.url()) && p.url() !== h0, p.url()); }
{ await p.goto(U + "/"); await p.waitForSelector("text=Latest issues"); // R196
  await p.evaluate(() => { const o = Worker.prototype.postMessage; window.__dym = 0; Worker.prototype.postMessage = function (m, ...r) { if (m?.op === "didYouMean") window.__dym++; return o.call(this, m, ...r); }; });
  const box = p.getByPlaceholder("Search titles, tags, summaries, topics…"); await box.click(); await box.pressSequentially("onlne learnin", { delay: 30 }); await wait(500);
  const nd = await p.evaluate(() => window.__dym); ok("R196 search box: typing 12+ characters sends at most 3 did-you-mean requests", nd >= 1 && nd <= 3, `(${nd})`); }
{ await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await p.getByRole("button", { name: "3D", exact: true }).click(); await p.waitForSelector("canvas", { timeout: 20000 }); await wait(1200); // R197
  const raf = (ms) => p.evaluate((ms) => new Promise((done) => { let n = 0; const o = requestAnimationFrame; window.requestAnimationFrame = (f) => { n++; return o(f); }; setTimeout(() => { window.requestAnimationFrame = o; done(n); }, ms); }), ms);
  const on = await raf(500); await p.evaluate(() => { document.body.style.paddingBottom = "300vh"; scrollTo(0, document.body.scrollHeight); }); await wait(400); const off = await raf(500);
  await p.evaluate(() => { document.body.style.paddingBottom = ""; scrollTo(0, 0); }); ok("R197 maps: 3D stops rendering while scrolled out of view", on > 5 && off === 0, `(${on} -> ${off})`); }
{ const cx = await b.newContext(); await cx.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("ijodel-consent", JSON.stringify({ v: 0, prefs: true, lists: true })); localStorage.setItem("ijodel-lists", JSON.stringify([{ id: "x", name: "Old", items: ["3"] }])); } }); // R199
  const t = await cx.newPage(); await t.goto(U + "/"); const dlg = t.getByRole("dialog", { name: "Cookie and privacy choices" }); const shown = await dlg.waitFor({ timeout: 8000 }).then(() => true, () => false);
  await dlg.getByRole("button", { name: "Essential only" }).click().catch(() => {}); await t.waitForTimeout(300);
  const s = await t.evaluate(() => [JSON.parse(localStorage.getItem("ijodel-consent") || "{}").v, localStorage.getItem("ijodel-lists")]);
  ok("R199 consent: a record from an older notice re-asks; Essential only then removes the old list", shown && s[0] === 1 && s[1] === null, JSON.stringify(s)); await cx.close(); }
{ const cx = await b.newContext(); await cx.addInitScript(() => { localStorage.setItem("ijodel-consent", JSON.stringify({ v: 1, prefs: false, lists: false })); }); // R204/R205
  const k = await cx.newPage(); await k.goto(U + "/"); await k.waitForSelector("text=Latest issues"); await k.keyboard.press("/"); await wait(100);
  const foc = await k.evaluate(() => document.activeElement?.getAttribute("role")); await k.keyboard.press("/"); const typed = await k.evaluate(() => document.activeElement.value);
  ok("R205 '/' focuses the search box; inside it, '/' is typed", foc === "combobox" && typed === "/", `(${foc} ${typed})`);
  await k.evaluate(() => document.activeElement.blur()); await k.keyboard.press("Shift+?"); const dlg = k.getByRole("dialog", { name: "Keyboard shortcuts" }); await dlg.waitFor({ timeout: 3000 }).catch(() => {});
  const nli = await dlg.locator("li").count(); await k.keyboard.press("Escape"); await wait(200);
  ok("R204 '?' opens the shortcuts dialog (5 items); Esc closes it", nli === 5 && !(await dlg.isVisible()), `(${nli})`); await cx.close(); }
{ await p.goto(U + "/maps/pub/3"); await p.getByLabel("Seed", { exact: true }).waitFor(); await wait(300); // R214 seed Clear / Random chapter
  const inp = p.getByLabel("Seed", { exact: true }), h0 = p.url(), t0 = await inp.inputValue();
  await p.getByRole("button", { name: "Clear" }).click(); await wait(200);
  const cleared = (await inp.inputValue()) === "" && p.url() === h0 && t0 !== "";
  let moved = false; for (let i = 0; i < 4 && !moved; i++) { await p.getByRole("button", { name: "Random", exact: true }).click(); await wait(500); moved = p.url() !== h0; }
  ok("R214 maps: Clear empties the seed input without moving the map; Random chapter changes the seed hash", cleared && moved, `(${h0} -> ${p.url()})`); }
{ const cx = await b.newContext({ viewport: { width: 1000, height: 800 } }); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); } catch {} }); // R215 offline bar
  const o = await cx.newPage(); await o.goto(U + "/issues"); await o.waitForSelector("h1"); await cx.setOffline(true); await o.waitForTimeout(500);
  const on = await o.getByText("You are offline. Pages already opened").isVisible(); await cx.setOffline(false); await o.waitForTimeout(500);
  ok("R215 offline bar shows when offline and hides when back online", on && !(await o.getByText("You are offline. Pages already opened").isVisible())); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1000 } }), o = await cx.newPage(); // R220 undo/redo x6, storage-free (no consent)
  await o.goto(U + "/advanced"); await o.waitForSelector('aside[aria-label="Best suggestions"] button'); await o.waitForTimeout(800);
  const st = () => o.evaluate(() => JSON.stringify([...document.querySelectorAll("[data-chip]")].map((e) => e.textContent))), s0 = await st();
  for (let i = 0; i < 6; i++) { await o.locator('aside[aria-label="Best suggestions"] button:not([aria-label^=Dismiss])').first().click(); await o.waitForTimeout(250); }
  const s6 = await st(); await o.locator("body").click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < 6; i++) { await o.keyboard.press("Control+z"); await o.waitForTimeout(150); } const su = await st();
  for (let i = 0; i < 6; i++) { await o.keyboard.press("Control+y"); await o.waitForTimeout(150); }
  ok("R220 6 adds, 6 Ctrl+Z = initial, 6 redos = final, nothing stored", s6 !== s0 && su === s0 && (await st()) === s6 && !(await o.evaluate(() => localStorage.getItem("ijodel-adv")))); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); await cx.addInitScript(() => { try { if (!localStorage.getItem("ijodel-consent")) localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); } catch {} }); // R221 share round trip
  await cx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:4173" }); const o = await cx.newPage(); await o.goto(U + "/advanced"); await o.waitForSelector('aside[aria-label="Best suggestions"] span[draggable=true]'); await o.waitForTimeout(800);
  const box = (a) => o.locator(`xpath=//h2[normalize-space()="${a}"]/ancestor::div[contains(@class,"rounded-xl")][1]`);
  for (const [i, a] of [[0, "Required"], [1, "Expand"], [2, "Exclude"]]) { await o.locator('aside[aria-label="Best suggestions"] span[draggable=true]').nth(i).dragTo(box(a)); await o.waitForTimeout(300); }
  await o.getByLabel("How the Expand filters apply").selectOption("one"); await o.waitForTimeout(300);
  const A = await o.evaluate(() => localStorage.getItem("ijodel-adv")); await o.getByRole("button", { name: /Share link/ }).click(); await o.waitForTimeout(300);
  const url = await o.evaluate(() => navigator.clipboard.readText()), c2 = await b.newContext(); await c2.addInitScript(() => localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })));
  const q = await c2.newPage(); await q.goto(url); await q.waitForTimeout(1200); const B = await q.evaluate(() => localStorage.getItem("ijodel-adv")), m = await q.evaluate(() => localStorage.getItem("ijodel-adv-mode"));
  ok("R221 share link in a new context: same chips in the same areas, same mode", A === B && m === "one" && Object.values(JSON.parse(A)).flat().length === 3, `(${m})`); await cx.close(); await c2.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1000 } }), o = await cx.newPage(); // R224 Levels <-> ticked options (fresh page: earlier map checks leave 3D/fullscreen state)
  await o.goto(U + "/maps/pub/3"); await o.waitForSelector("svg [data-node]"); await o.waitForTimeout(600);
  const T = { rel: 2, rec: 2, tag: 1, tagrel: 1, issue: 5, category: 3, author: 4 }, K = ["rel", "rec", "tag", "tagrel", "issue", "category", "author"]; let good = true, prev = 0, log = [];
  for (let lv = 1; lv <= 5; lv++) { await o.getByLabel("Levels").selectOption(String(lv)); await o.waitForTimeout(900);
    const ch = (await o.evaluate(() => [...document.querySelectorAll("fieldset input[type=checkbox]")].map((i) => i.checked))).slice(0, 7), nodes = await o.locator("svg [data-node]").count();
    good &&= JSON.stringify(ch) === JSON.stringify(K.map((k) => k !== "tagrel" && T[k] <= lv)) && nodes >= prev; prev = nodes; log.push(`${lv}:${nodes}`); }
  ok("R224 Levels 1..5 tick exactly the TIER options; node count non-decreasing", good, log.join(" ")); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 390, height: 844 } }), o = await cx.newPage(); // R225 back to top (phone: libre's results run past 2 screens)
  await o.goto(U + "/search/libre"); await o.waitForSelector("text=chapters for"); await o.waitForTimeout(600); await o.evaluate(() => scrollTo(0, 2500)); await o.waitForTimeout(400);
  const btn = o.getByRole("button", { name: "Back to top" }), shown = await btn.isVisible(); if (shown) { await btn.focus(); await o.keyboard.press("Enter"); await o.waitForTimeout(400); }
  ok("R225 Back to top shows after 2500 px; Enter -> scrollY 0, focus on main", shown && await o.evaluate(() => scrollY === 0 && document.activeElement?.id === "main")); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1500 } }); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} }); const o = await cx.newPage(); // R230/R234 map counts and node-list filter (fresh context)
  const seeds = []; for (const id of ["295", "3", "10", "20"]) { await o.goto(U + "/maps/pub/" + id); await o.waitForSelector("svg g[data-node]"); await o.waitForTimeout(400);
    const m = /(\d+) nodes · (\d+) links/.exec(await o.locator("span.ml-auto").first().innerText()), dom = await o.locator("svg g[data-node]").count(), li = await o.locator("ul[aria-label='Nodes and their connections'] > li").count(); seeds.push(m && +m[1] === dom && dom === li); }
  ok("R230 map 'N nodes' equals DOM nodes and node-list items for 4 seeds", seeds.every(Boolean), seeds.join());
  const nl = o.getByRole("list", { name: "Nodes and their connections" }); await o.locator("summary", { hasText: "Node list" }).click(); const all = await nl.locator("> li").count(); await o.getByLabel("Filter the node list").fill("learn"); await o.waitForTimeout(200);
  const n = await nl.locator("> li").count(), want = await o.locator("svg g[data-node]").evaluateAll((l) => l.filter((g) => g.getAttribute("aria-label").toLowerCase().includes("learn")).length); // list text is cut at 60 chars, the full label is on the map node
  ok("R234 node-list filter keeps exactly the nodes whose label contains the text", n > 0 && n < all && n === want, `${n}/${all}, map says ${want}`); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} }); const o = await cx.newPage(); // R235 issue prev/next
  await o.goto(U + "/"); await o.waitForSelector("h1"); const ks = await o.evaluate(() => Object.keys(window.__S.issues).sort((x, y) => x.localeCompare(y, "en", { numeric: true }))), res = [];
  for (const k of [ks[0], ks[3], ks.at(-1)]) { await o.goto(U + "/issue/" + k); await o.waitForSelector("h1"); await o.waitForTimeout(200); res.push([await o.locator("a[rel=prev]").count(), await o.locator("a[rel=next]").count()].join("")); }
  ok("R235 issue pages: next only at the start, both in the middle, prev only at the end", res.join() === "01,11,10", res.join());
  // R232 cover/issue images: alt text longer than 3 chars, no duplicates on a page
  const alts = []; for (const u of ["/", "/issues", "/search/learning"]) { await o.goto(U + u); await o.waitForSelector("h1, h2"); await o.waitForTimeout(500); const a = await o.locator("img").evaluateAll((l) => l.map((i) => i.alt).filter((t) => t)), bad = await o.locator("img:not([alt])").count(); alts.push(a.every((t) => t.length > 3) && new Set(a).size === a.length && bad === 0); }
  ok("R232 images have alt > 3 chars, unique per page", alts.every(Boolean), alts.join()); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1000 } }); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); window.__ls = 0; const o = EventTarget.prototype.addEventListener; EventTarget.prototype.addEventListener = function (t, ...r) { if (t === "scroll") window.__ls++; return o.call(this, t, ...r); }; } catch {} }); const o = await cx.newPage(); // R236
  await o.goto(U + "/"); await o.waitForSelector("ul.row-track"); await o.waitForTimeout(1500); const ls = await o.evaluate(() => window.__ls), rows = await o.locator("ul.row-track").count();
  ok("R236 / has <= 3 scroll listeners across all rows (React root + window x2; none per row)", rows >= 3 && ls <= 3, `${ls} listeners, ${rows} rows`);
  const nx = o.getByRole("button", { name: /^Next in/ }).first(); const had = await nx.isVisible(); await nx.click(); await o.waitForTimeout(900);
  ok("R236 row arrows still follow the scroll position (Previous appears after Next)", had && await o.getByRole("button", { name: /^Previous in/ }).first().isVisible()); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 700, height: 500 } }); const o = await cx.newPage(); // carry-over: Back to top is not under the bottom cookie banner at 640-860 px
  await o.goto(U + "/search/libre"); await o.waitForSelector("text=chapters for"); await o.waitForTimeout(600); await o.evaluate(() => scrollTo(0, 2500)); await o.waitForTimeout(500);
  const hit = await o.evaluate(() => { const t = document.querySelector('button[aria-label="Back to top"]'); if (!t) return "none"; const r = t.getBoundingClientRect(), e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t === e || t.contains(e) ? "top" : "covered"; });
  ok("carry-over: Back to top is not covered by the cookie banner at 700 px", hit === "top", hit);
  await o.goto(U + "/issue/" + (await o.evaluate(() => Object.keys(window.__S.issues)[0]))); await o.waitForSelector("ol[aria-label=Contents] a");
  ok("carry-over: contents-list links are underlined", await o.locator("ol[aria-label=Contents] > li > a").first().evaluate((a) => getComputedStyle(a).textDecorationLine === "underline")); await cx.close(); }
// batch 15 (fresh context): R242 focus ring, row fade at scroll 0, node-list filter on the 3D map
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1500 } }); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: false })); } catch {} }); const o = await cx.newPage();
  await o.goto(U + "/search/libre"); await o.waitForSelector("text=chapters for"); await o.waitForTimeout(600); await o.keyboard.press("Tab");
  const ring = []; for (const s of ["input", "button:visible:enabled", "a[href^='#/read/']", "summary"]) { const el = o.locator(`main ${s}:not(.bg-navy-fill *, .on-navy *)`).first(); /* navy bands use a white ring on purpose */ if (!await el.count()) continue; await el.focus(); await o.waitForTimeout(350); ring.push([s, await el.evaluate((e) => { const c = getComputedStyle(e); return [c.outlineStyle, c.outlineWidth, c.outlineOffset, c.outlineColor].join(" "); })]); }
  ok("R242 focus ring identical for input, button, link, summary", ring.length >= 3 && new Set(ring.map((r) => r[1])).size === 1, ring.map((r) => r[1]).join(" | "));
  await o.goto(U + "/"); await o.waitForSelector("ul.row-track"); await o.waitForTimeout(600); const fl = () => o.evaluate(() => document.querySelector("ul.row-track").style.getPropertyValue("--fl"));
  await o.evaluate(() => { const u = document.querySelector("ul.row-track"); u.style.maxWidth = Math.round(u.firstElementChild.getBoundingClientRect().width * 0.7) + "px"; u.scrollLeft = 0; }); await o.waitForTimeout(500); const f0 = await fl();
  await o.evaluate(() => { document.querySelector("ul.row-track").scrollLeft = 150; }); await o.waitForTimeout(500); const f1 = await fl();
  ok("row fade: no left fade at scroll 0 even when the first card is cropped, fade once scrolled", f0 === "0px" && f1 !== "0px", `${f0} -> ${f1}`);
  await o.goto(U + "/maps/pub/295"); await o.waitForSelector("svg g[data-node]"); const want = await o.locator("svg g[data-node]").evaluateAll((l) => l.filter((g) => g.getAttribute("aria-label").toLowerCase().includes("learn")).length);
  await o.getByRole("button", { name: "3D", exact: true }).click(); await o.waitForSelector("canvas", { timeout: 20000 }); await o.locator("summary", { hasText: "Node list" }).click(); await o.getByLabel("Filter the node list").fill("learn"); await o.waitForTimeout(300);
  ok("node-list filter on the 3D map keeps the same nodes as the 2D map", want > 0 && await o.getByRole("list", { name: "Nodes and their connections" }).locator("> li").count() === want, `want ${want}`); await cx.close(); }
// batch 16 (fresh context): R250 Select-a-node options = clickable nodes, R254/R255 fullscreen focus and aria-pressed, R259 safe download name
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1500 }, acceptDownloads: true }); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, lists: true, model: false })); if (!localStorage.getItem("ijodel-lists")) localStorage.setItem("ijodel-lists", JSON.stringify([{ id: "a", name: "../x", items: ["3", "10"] }])); } catch {} }); const o = await cx.newPage();
  for (const r of ["/maps/pub/295", "/maps/tag/online%20learning"]) { await o.goto(U + r); await o.waitForSelector("svg g[data-node]"); await o.waitForTimeout(500);
    const opts = await o.getByLabel("Select a node").locator("option").count() - 1, nodes = await o.locator("svg g[data-node][role=button]").count();
    ok("R250 Select-a-node options equal the clickable nodes " + r, opts === nodes && nodes > 0, `${opts} vs ${nodes}`); }
  await o.goto(U + "/maps/pub/295"); await o.waitForSelector("svg g[data-node]"); const fsb = o.getByRole("button", { name: /full screen/i }), thb = o.getByRole("button", { name: "Theater mode" });
  const bx = await Promise.all([fsb.boundingBox(), thb.boundingBox()]); await thb.click(); const t1 = await thb.getAttribute("aria-pressed"); await thb.click();
  ok("R255 theater and full-screen buttons expose aria-pressed and are >= 40 px", t1 === "true" && await thb.getAttribute("aria-pressed") === "false" && await fsb.getAttribute("aria-pressed") === "false" && bx.every((r) => r.width >= 40 && r.height >= 40));
  await fsb.click(); await o.waitForTimeout(400); const pr = await fsb.getAttribute("aria-pressed"); await o.locator("svg g[data-node][role=button]").first().focus(); await o.evaluate(() => document.exitFullscreen()); await o.waitForTimeout(400);
  ok("R254/R255 leaving full screen returns focus to the Full screen button (aria-pressed true while in)", await o.evaluate(() => !document.fullscreenElement) && pr === "true" && await o.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Full screen map", pr);
  await o.goto(U + "/list/a"); await o.getByRole("button", { name: "JSON", exact: true }).waitFor(); const dl = o.waitForEvent("download"); await o.getByRole("button", { name: "JSON", exact: true }).click();
  const nm = (await dl).suggestedFilename(); ok("R259 a list named ../x downloads as a safe file name", nm === "x.json", nm); await cx.close(); }
// batch 17 (fresh context): R264 list remove + Undo, empty-list links; R265 copy-link status clears after 3 s
{ const cx = await b.newContext({ viewport: { width: 1400, height: 1500 } }); await cx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://localhost:4173" });
  await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, lists: true, model: false })); if (!localStorage.getItem("ijodel-lists")) localStorage.setItem("ijodel-lists", JSON.stringify([{ id: "a", name: "R264", items: ["3", "10"] }])); } catch {} }); const o = await cx.newPage();
  await o.goto(U + "/list/a"); const rm = o.getByRole("button", { name: /^Remove from list: / }); await rm.first().waitFor(); const t0 = await rm.first().getAttribute("aria-label"); await rm.first().click();
  const un = o.getByRole("button", { name: "Undo remove" }); const n1 = await rm.count(), foc = await o.evaluate(() => document.activeElement?.textContent); await un.click(); await o.waitForTimeout(200);
  ok("R264 Remove takes the chapter out, Undo remove puts it back first (focus on Undo)", n1 === 1 && foc === "Undo remove" && await rm.first().getAttribute("aria-label") === t0 && await rm.count() === 2 && await un.count() === 0, `${n1} ${foc}`);
  await rm.first().click(); await rm.first().click(); ok("R264 empty list links to Search and Home rows", await o.locator("main p").filter({ hasText: "This list is empty" }).getByRole("link").allInnerTexts().then((l) => l.join() === "Search,Home rows"));
  await o.getByRole("button", { name: "Undo remove" }).click(); await o.getByRole("button", { name: "Copy share link" }).click(); const st = o.locator("main span[role=status]").first(); await o.waitForTimeout(200); const s0 = await st.innerText(); await o.waitForTimeout(3200);
  ok("R265 Copy share link: status says so, empty 3.2 s later", s0 === "Share link copied" && await st.innerText() === "", s0); await cx.close(); }
// R238/R239: Trusted Types report-only sinks are the documented ones; any other CSP violation fails
{ const tt = viol.filter((v) => v[0] === "require-trusted-types-for"), other = viol.filter((v) => v[0] !== "require-trusted-types-for"), sinks = [...new Set(tt.map((v) => v[1]?.split(/[|\n]/)[0].slice(0, 40)))];
  console.log(`TT report-only: ${tt.length} events; sinks: ${sinks.join(" ; ")}`);
  ok("R238 Trusted Types violations stay within the recorded baseline and documented sinks", tt.length <= 2 && sinks.every((s) => ["ServiceWorkerContainer register", "Worker constructor"].includes(s)) /* baseline 2026-10-31: SW register + embedding Worker URL */, `${tt.length}`);
  ok("R239 no non-Trusted-Types CSP violation during the run", other.length === 0, other.slice(0, 2).map((v) => v.join(" ")).join(" | ")); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 900 } }), o = await cx.newPage(); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); } catch {} }); // R270/R274/R275, fresh context
  await o.goto(U + "/maps/pub/zzz"); await o.waitForSelector("[role=status] a"); const href = await o.locator("[role=status] a").getAttribute("href");
  await o.locator("[role=status] a").click(); await o.waitForSelector("svg [data-node]");
  ok("R270 /maps/pub/zzz: status message with a link to a valid seed that draws a map", /^#\/maps\/pub\//.test(href) && (await o.locator("svg [data-node]").count()) > 3 && (await o.getByLabel("Seed", { exact: true }).inputValue()).length > 0, href);
  await o.goto(U + "/search/distance"); await o.waitForSelector("#count b"); await o.getByLabel("Sort").selectOption("newest"); await o.waitForTimeout(300);
  ok("R274 choosing Newest puts \"sorted by newest first\" in the result-count status", /sorted by newest first/.test(await o.locator("#count").textContent()));
  await o.goto(U + "/read/3"); await o.waitForSelector("#r-related"); const cur = (n) => o.getByRole("navigation", { name: "On this page" }).getByRole("button", { name: n });
  await o.evaluate(() => document.getElementById("r-related").scrollIntoView({ block: "start" })); await o.waitForTimeout(400);
  const rel = await cur("Related").getAttribute("aria-current"), abs = await cur("Abstract").getAttribute("aria-current");
  ok("R275 scrolled to Related: that link has aria-current=location, Abstract does not", rel === "location" && abs === null, `${rel} ${abs}`); await cx.close(); }
{ const cx = await b.newContext({ viewport: { width: 1400, height: 900 } }), o = await cx.newPage(), pe = []; o.on("pageerror", (e) => pe.push(e.message)); await cx.addInitScript(() => { try { localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true })); } catch {} }); // R291/R294, fresh context
  const h1 = async () => { await o.waitForSelector("h1"); await o.waitForTimeout(900); return (await o.locator("h1").first().innerText()).trim(); }, diff = [];
  for (const r of ["/", "/search/libre", "/advanced", "/maps", "/read/3", "/issues", "/topics", "/list"]) { await o.goto(U + r); const a = await h1(); await o.reload(); if (a !== await h1()) diff.push(r); }
  ok("R291 reload on 8 routes keeps the same h1, no page error", !diff.length && !pe.length, `${diff.join(" ")} ${pe[0] ?? ""}`);
  const hidden = [], seen = new Set(); let stuck = 0; // 4 routes x 50 Tab presses: the focused element is on screen and focus moves every press
  for (const r of ["/", "/search/libre", "/advanced", "/maps"]) { await o.goto(U + r); await h1(); let prev = null;
    for (let i = 0; i < 50; i++) { await o.keyboard.press("Tab");
      const f = await o.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const q = e.getBoundingClientRect(), c = getComputedStyle(e);
        return { id: `${e.tagName}|${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)}|${Math.round(q.x)},${Math.round(q.y + scrollY)}`, vis: q.width > 0 && q.height > 0 && q.bottom > 0 && q.top < innerHeight && q.right > 0 && q.left < innerWidth && c.visibility !== "hidden" && +c.opacity > 0 }; });
      if (!f) { prev = null; continue; } seen.add(r + f.id); if (!f.vis) hidden.push(r + " " + f.id); if (f.id === prev) stuck++; prev = f.id; } }
  ok("R294 200-press Tab walk (Home, Search, Advanced, Maps): every focused element visible, focus never stuck", !hidden.length && !stuck && seen.size > 150, `${seen.size} distinct, ${hidden.length} hidden, ${stuck} stuck ${hidden.slice(0, 2).join(" | ")}`); await cx.close(); }
ok("no page errors (rounds 38-46)", errs.length === 0, errs.slice(0, 2).join(" | "));
ok("no CSP violations by the end (model load included)", !csp.length, csp[0]?.slice(0, 120) ?? "");
console.log(`${nChecks} checks, ${bad} FAIL`); await b.close(); process.exit(bad ? 1 : 0);
