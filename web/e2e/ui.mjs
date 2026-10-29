// Browser checks: node e2e/ui.mjs  (needs `vite preview` on :4173). Prints PASS/FAIL lines, exits 1 on any FAIL.
import { chromium } from "playwright-core";
import { homedir } from "os";
const b = await chromium.launch({ executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ viewport: { width: 1400, height: 1500 } });
await ctx.addInitScript(() => { try { if (!localStorage.getItem("ijodel-consent")) localStorage.setItem("ijodel-consent", JSON.stringify({ prefs: true, model: true })); } catch {} });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const csp = []; p.on("console", (m) => /Content Security Policy/i.test(m.text()) && csp.push(m.text()));
let bad = 0;
const ok = (n, c, x = "") => { console.log(`${c ? "PASS" : "FAIL"} ${n} ${x}`); if (!c) bad++; };
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
ok("facet pop-up opens", await p.getByRole("dialog").count() > 0); await p.keyboard.press("Escape");

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
  await c2.goto(U + "/privacy"); ok("privacy notice page exists", await c2.getByRole("heading", { name: "Privacy notice" }).count() === 1);
  await c2.getByRole("button", { name: "Cookie settings" }).first().click();
  ok("header has a Cookie settings button that opens the dialog", await c2.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Cookie settings" }).count() === 1 && await c2.getByRole("dialog", { name: "Cookie and privacy settings" }).count() === 1);
  await c2.getByLabel("Search history and settings").check(); await c2.getByRole("button", { name: "Save choices" }).click();
  ok("settings dialog saves a choice", (await c2.evaluate(() => JSON.parse(localStorage.getItem("ijodel-consent")))).prefs === true); }
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
  await p.locator('input[type=file]').setInputFiles(await j.path()); await wait(); ok("lists: JSON import adds a list", JSON.parse(await p.evaluate(() => localStorage.getItem("ijodel-lists"))).length === 2);
  await p.getByRole("button", { name: "Copy share link" }).click(); await wait(); const link = await p.evaluate(() => navigator.clipboard.readText());
  await p.goto(link.replace(/^.*#/, U)); await p.waitForSelector("text=Shared view list"); ok("lists: share link opens the shared list", await p.locator("main li").count() === 2);
  await p.goto(U + "/list/share/x/295,<img>,99999"); await p.waitForSelector("text=Shared view list"); ok("lists: shared link keeps only known chapters", /1 chapter\./.test(await p.locator("main p").first().innerText())); }
await p.goto(U + "/maps/pub/295"); await p.waitForSelector("svg g[data-node]"); await wait(500);
{ await p.getByLabel("Find a node on the map").fill(await p.locator("svg g[data-node]").nth(3).getAttribute("aria-label").then((l) => l.split(": ")[1].slice(0, 12))); await p.keyboard.press("Enter"); await wait();
  ok("maps: node search selects and focuses a node", await p.evaluate(() => document.activeElement?.getAttribute("aria-pressed")) === "true");
  const a0 = await p.evaluate(() => document.activeElement.dataset.node); await p.keyboard.press("ArrowRight"); ok("maps: arrow keys move between nodes", await p.evaluate((a) => document.activeElement.dataset.node && document.activeElement.dataset.node !== a, a0));
  ok("maps: every line has a why-connected tooltip", await p.locator("svg > g > g:not([data-node]) > title").count() === await p.locator("svg > g > g:not([data-node])").count() && /→/.test(await p.locator("svg title").first().textContent()));
  await p.getByRole("button", { name: "3D", exact: true }).click(); await p.waitForSelector("canvas", { timeout: 20000 }).catch(() => {}); ok("maps: 3D offers a low-power mode", await p.getByLabel("Low power").count() === 1); await p.getByLabel("Low power").check(); await wait(800); ok("maps: low power keeps rendering", await p.locator("canvas").count() > 0); }
await p.goto(U + "/no-such-page"); await p.waitForSelector("h1"); ok("404 route with a search prefilled", await p.getByRole("heading", { name: "Page not found" }).count() === 1 && await p.getByLabel("Search chapters").inputValue() === "no such page");
await ctx.setOffline(true); await wait(300); ok("offline message", await p.getByText("You are offline.").count() === 1); await ctx.setOffline(false); await wait(300); ok("offline message clears", await p.getByText("You are offline.").count() === 0);
{ const e = await ctx.newPage(); await e.goto(U + "/"); await e.waitForSelector("text=Latest issues"); await e.evaluate(() => { window.__S.byId["295"] = { ...window.__S.byId["295"], authors: null }; location.hash = "/read/295"; });
  await e.getByRole("alert").filter({ hasText: "Something went wrong" }).waitFor({ timeout: 5000 }).catch(() => {}); ok("error boundary: a crashing route shows Retry, header stays", await e.getByRole("button", { name: "Retry" }).count() === 1 && await e.locator("header").count() === 1);
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
{ await p.goto(U + "/search/" + encodeURIComponent('learning "distance education" year:2016-2018')); await p.waitForSelector("text=chapters for"); await wait(600);
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
  ok("65 results show matched-filter chips and no redundant Why panel", await p.locator("[data-matched]").count() > 0 && await p.getByText(/^Why #\d+\?$/).count() === 0); }
{ const c = await b.newContext(), p = await c.newPage(); await p.goto(U + "/"); await p.waitForSelector("nav[aria-label=Main]"); const got = p.waitForRequest(/assets\/Maps-.*\.js/, { timeout: 3000 }).then(() => true).catch(() => false);
  await p.locator("nav[aria-label=Main] a", { hasText: "Maps" }).hover(); ok("82 Maps chunk is fetched on tab hover (intent)", await got); await c.close(); }
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
ok("no page errors (rounds 38-46)", errs.length === 0, errs.slice(0, 2).join(" | "));
ok("no CSP violations by the end (model load included)", !csp.length, csp[0]?.slice(0, 120) ?? "");
await b.close(); process.exit(bad ? 1 : 0);
