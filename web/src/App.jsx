import { parseQuery, pushUniq } from "./query.js";
import { weakDevice } from "./device.js";
import { recommend } from "./recommend.js";
import { normLists, NAME_MAX } from "./lists.js";
import { bibtex, citeStyle, styleText, STYLES, ris } from "./cite.js";
import { CookieConsent, openCookieSettings } from "./Consent.jsx";
import { useSeo } from "./useSeo.js";
import { pref, useConsent, allow } from "./consent.js";
import { syncSW, applyUpdate } from "./sw-reg.js";
// This article's generated FAQs, fetched on first use (engine faqsFor); [] until they arrive or when there are none.
const useFaqs = (id) => { const [f, set] = useState({ id, l: [] }); useEffect(() => { let on = true; if (id) faqsFor(id).then((l) => on && set({ id, l })).catch(() => {}); return () => { on = false; }; }, [id]); return f.id === id ? [...f.l] : []; };
// Semantic-model state for the progress line: {s: off|loading|ready|failed, pct}.
const useModel = () => { const [, t] = useState(0); useEffect(() => onModel(() => t((n) => n + 1)), []); return modelState(); };
import { Component, lazy, memo, Suspense, useMemo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { load, startModel, modelState, onModel, searchArticles, didYouMean, didYouMeanAsync, warmSearch, faqsFor, pagePassage, FIELD_LABEL } from "./engine.js";

// Hash routing with scroll memory: going back to the previous route restores its scroll position; anything else starts at the top.
const trail = [{ route: location.hash.slice(1) || "/", y: 0 }];
let keep = false; // the next navigation stays at the current scroll level (the logo emblem)
const useHash = () => {
  const [h, setH] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const onHash = () => setH(location.hash.slice(1) || "/");
    const onScroll = () => { trail.at(-1).y = scrollY; };
    addEventListener("hashchange", onHash); addEventListener("scroll", onScroll, { passive: true });
    return () => { removeEventListener("hashchange", onHash); removeEventListener("scroll", onScroll); };
  }, []);
  useLayoutEffect(() => {
    if (trail.at(-1).route === h) return;
    // R154: a new page takes focus to <main> (screen readers then read it under the new title); in-page updates of the map or a
    // search (same first segment) keep focus where it is, on the map node or the search box
    const seg = (r) => r.split("/")[1], prev = trail.at(-1).route;
    if (!(seg(prev) === seg(h) && ["maps", "search"].includes(seg(h)))) document.getElementById("main")?.focus({ preventScroll: true });
    const back = !keep && trail.at(-2)?.route === h; // an emblem click is forward even when it lands on the page two steps back
    const stay = keep && !back; keep = false;
    if (back) trail.pop(); else trail.push({ route: h, y: stay ? scrollY : 0 });
    if (trail.length > 50) trail.shift(); // shortcut: back restores scroll for the last 49 routes only; fine for a session
    if (!stay) scrollTo(0, back ? trail.at(-1).y : 0);
  }, [h]);
  return h;
};
export const qcap = (s) => dec(s.slice(0, 1200)).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 300); // hostile hashes: <=300 chars, no control characters before the engine or document.title see them
export const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } }; // hostile hashes (%E0%A4%A) must not throw
export const Link = ({ to, className = "", children, ...rest }) => <a href={"#" + to} className={className} {...rest}>{children}</a>;
export const by = (a) => a.authors.join("; ");
const asset = (p) => import.meta.env.BASE_URL + p;
export const slug = (c) => c.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
export const issueKey = (a) => a.issue.vol + "." + a.issue.no.replace("&", "-");
const tagTo = (t) => "/tag/" + encodeURIComponent(t);
// a tag held by one chapter only has nothing to browse, so it is shown as plain text, not a link
const tagN = (t) => { const S = window.__S; S.tagN ||= S.articles.reduce((m, x) => { x.subjects.forEach((s) => { m[s] = (m[s] || 0) + 1; }); return m; }, {}); return S.tagN[t] || 0; };
// Cards can be dragged into the Advanced Search areas as a chapter filter.
const dragChip = (a) => (e) => { e.dataTransfer.setData("text/chip", JSON.stringify({ k: "pub", v: a.id, l: a.title })); e.dataTransfer.effectAllowed = "copyMove"; };
const store = (k, v) => { try { if (v === undefined) { const a = pref.json(k) ?? []; return Array.isArray(a) ? a.slice(0, 200) : []; } pref.set(k, JSON.stringify(v)); } catch { return []; } };
// R228: a poisoned store renders no more rows than a write keeps (10 recent, 30 saved)
const recents = () => store("ijodel-recent").filter((x) => typeof x === "string" && x.length < 200).slice(0, 10);
const remember = (q) => store("ijodel-recent", pushUniq(recents(), q, 10));
const saved = () => store("ijodel-saved").filter((x) => typeof x === "string" && x.length < 200).slice(0, 30);
// R193: one dashed card for every empty state (no results, empty list, nothing to map, no chapter fits); tokens.mjs checks the four use it
export const BADGE_C = "rounded-full bg-crimson-soft px-2 py-0.5 text-xs text-link", BADGE_N = "rounded-full bg-navy-soft px-2 py-0.5 text-xs text-navy"; // R233: the only two badge styles
export const EMPTY ="rounded-xl border border-dashed border-line p-8 text-center text-ink-2";
export const clip = (t, n) => (t.length > n ? t.slice(0, n).replace(/\s\S*$/, "") + "…" : t);

// View lists (playlists): named collections of chapters, kept in localStorage, shared across components.
const listeners = new Set();
const getLists = () => {
  const l = store("ijodel-lists").filter((x) => x && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.items));
  if (l.length) return l;
  return [{ id: "l1", name: "My list", items: store("ijodel-list").filter((x) => typeof x === "string" || typeof x === "number") }];
};
const saveLists = (l) => { store("ijodel-lists", normLists(l)); listeners.forEach((f) => f()); };
const toggleIn = (lid, id) => saveLists(getLists().map((l) => l.id === lid ? { ...l, items: l.items.includes(id) ? l.items.filter((x) => x !== id) : [...l.items, id] } : l));
const newList = (name, id) => { const l = getLists(), lid = "l" + Date.now().toString(36); saveLists([...l, { id: lid, name: name.trim().slice(0, NAME_MAX) || "Untitled list", items: id ? [id] : [] }]); return lid; };
function useLists() {
  const [l, set] = useState(getLists);
  useEffect(() => { const f = () => set(getLists()); listeners.add(f); return () => listeners.delete(f); }, []);
  return l;
}
// The + button opens a small menu: tick the lists a chapter belongs to, or start a new list with it.
export function AddBtn({ id, className = "", label }) {
  const lists = useLists(), off = !useConsent()?.lists, on = lists.some((l) => l.items.includes(id)), [pos, setPos] = useState(null), [name, setName] = useState(""), btn = useRef(null);
  const close = () => setPos(null);
  useEffect(() => {
    if (!pos) return;
    const esc = (e) => { if (e.key === "Escape") { close(); btn.current?.focus(); } };
    addEventListener("keydown", esc); addEventListener("scroll", close, true); addEventListener("resize", close);
    return () => { removeEventListener("keydown", esc); removeEventListener("scroll", close, true); removeEventListener("resize", close); };
  }, [pos]);
  const open = () => { const r = btn.current.getBoundingClientRect(), up = r.bottom + 260 > innerHeight; setPos({ left: Math.max(8, Math.min(r.left, innerWidth - 248)), [up ? "bottom" : "top"]: up ? innerHeight - r.top + 4 : r.bottom + 4 }); };
  return (
    <>
      <button ref={btn} type="button" onClick={() => (off ? openCookieSettings() : pos ? close() : open())} aria-haspopup="dialog" aria-expanded={!!pos} aria-disabled={off || undefined} aria-label={label ? undefined : on ? "In a view list; change lists" : "Add to a view list"} title={off ? "View lists are off. Change Cookie settings (allow View lists) to use this feature." : "Add to a view list"}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full text-sm font-bold transition ${on ? "bg-link-fill text-white" : "bg-navy-soft text-navy hover:bg-sky"} ${label ? "px-4 py-2" : "h-10 w-10 text-xl"} ${off ? "opacity-50" : ""} ${className}`}>{on ? "✓" : "+"}{label && <span>{on ? "In a view list" : "Add to view list"}</span>}</button>
      {pos && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div role="dialog" aria-label="Add to a view list" style={pos} className="fixed z-50 w-60 rounded-xl border border-line bg-surface p-3 text-ink shadow-2xl">
            <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-ink-3">Add to view list</p><button type="button" onClick={() => { close(); btn.current?.focus(); }} aria-label="Close" title="Close" className="-mr-1 grid h-8 w-8 place-items-center rounded-full text-lg leading-none text-ink-3 hover:bg-navy-soft hover:text-ink">×</button></div>
            <ul className="max-h-40 overflow-y-auto">{lists.map((l) => <li key={l.id}><label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={l.items.includes(id)} onChange={() => toggleIn(l.id, id)} /><span className="line-clamp-1">{l.name}</span><span className="ml-auto text-xs text-ink-3">{l.items.length}</span></label></li>)}</ul>
            <form className="mt-2 flex gap-1.5 border-t border-line pt-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { newList(name, id); setName(""); } }}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="New list name" aria-label="New list name" className="min-w-0 flex-1 rounded-md border border-line px-2 py-1.5 text-base" />
              <button aria-label="Create list" title="Create list" className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-action-fill text-lg font-bold leading-none text-white hover:bg-action-2-fill"><span aria-hidden="true">+</span></button>
            </form>
            <Link to="/list" onClick={close} className="mt-2 block text-sm text-link hover:underline">Open my lists →</Link>
          </div>
        </>, document.body)}
    </>
  );
}
// Shared/imported lists are untrusted: keep only ids of known chapters, at most 200, and a 40-character name.
const cleanList = (name, ids) => ({ name: String(name || "").trim().slice(0, NAME_MAX) || "Shared list", items: [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((i) => window.__S.byId[i]).slice(0, 200) });
const addLists = (ls) => { const l = getLists(), t = Date.now().toString(36); saveLists([...l, ...ls.map((x, i) => ({ id: "l" + t + i, ...x }))]); return "l" + t + "0"; };
const download = (name, text, type) => { const u = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a"); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
// A shared list arrives as #/list/share/<name>/<id,id,...>; nothing is saved until the visitor asks.
function SharedList({ name, ids }) {
  const l = cleanList(dec(name || ""), dec(ids || "").split(",")), items = l.items.map((i) => window.__S.byId[i]);
  return (
    <section>
      <h1 className="font-serif text-3xl">Shared view list: {l.name}</h1>
      <p className="mt-1 text-ink-3">{items.length} chapter{items.length === 1 ? "" : "s"}. Someone shared this list with you; save it to keep it with your own lists.</p>
      <button type="button" disabled={!items.length} onClick={() => { location.hash = "/list/" + addLists([l]); }} className="mt-4 min-h-11 rounded-full bg-action-fill px-5 text-sm font-bold text-white hover:bg-action-2-fill disabled:opacity-40">Save as my list</button>
      {items.length > 0 ? <ul className="mt-5 space-y-4">{items.map((a) => <Card key={a.id} a={a} />)}</ul> : <p className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-ink-3">This link has no chapters we know. <Link to="/list" className="text-link underline">Open my lists</Link></p>}
    </section>
  );
}
// Most relevant first; the list's items are the seeds, so it updates as items are added or removed.
function Recommended({ items }) {
  const recs = useMemo(() => recommend(items, window.__S.articles), [items]);
  return (
    <aside aria-labelledby="rec-h" className="lg:sticky lg:top-4 lg:self-start">
      <h2 id="rec-h" className="font-serif text-2xl">Recommended</h2>
      <p className="mt-1 text-xs text-ink-3">Chapters, papers and theses like the ones in this list, most relevant first. Worked out in your browser.</p>
      {recs.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-line p-4 text-sm text-ink-3">Add items to this list to get recommendations.</p> :
        <ol className="mt-3 space-y-3">{recs.map(({ a, why, cov, n }) => <li key={a.id} className="rounded-xl border border-line bg-surface p-3"><Link to={"/read/" + a.id} className="font-medium text-link hover:underline">{a.title}</Link>
          <div className="mt-1 flex items-center gap-2"><div className="min-w-0 flex-1 text-xs text-ink-3">{a.type} · {a.year} · {by(a)}</div><AddBtn id={a.id} label /></div>
          {n > 0 && <p className="mt-1 text-xs text-ink-2">{n} shared topic{n === 1 ? "" : "s"} with {cov} of {items.length} listed: {why.join(", ")}</p>}</li>)}</ol>}
    </aside>
  );
}
function MyList({ lid }) {
  const lists = useLists(), cur = lists.find((l) => l.id === lid) || lists[0], items = cur.items.map((i) => window.__S.byId[i]).filter(Boolean);
  const edit = (f) => saveLists(lists.map((l) => l.id === cur.id ? f(l) : l)), [msg, setMsg] = useState("");
  const say = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const move = (id, d) => edit((l) => { const it = [...l.items], i = it.indexOf(id), j = i + d; if (i < 0 || j < 0 || j >= it.length) return l; [it[i], it[j]] = [it[j], it[i]]; return { ...l, items: it }; });
  const file = (cur.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "list").toLowerCase();
  const shareUrl = () => location.href.split("#")[0] + "#/list/share/" + encodeURIComponent(cur.name) + "/" + items.map((a) => a.id).join(",");
  const share = async () => { try { await navigator.clipboard.writeText(shareUrl()); say("Share link copied"); } catch { prompt("Copy this link", shareUrl()); } };
  const act = "min-h-10 text-sm text-link hover:underline";
  return (
    <section>
      <h1 className="font-serif text-3xl">My view lists</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2" role="tablist" aria-label="View lists">
        {lists.map((l) => <Link key={l.id} to={"/list/" + l.id} role="tab" aria-selected={l.id === cur.id} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm ${l.id === cur.id ? "border-action bg-action-fill text-white" : "border-line bg-surface text-ink-2 hover:border-action-2"}`}>{l.name}<span className="opacity-70">{l.items.length}</span></Link>)}
        <button type="button" onClick={() => { const n = prompt("Name for the new view list"); if (n && n.trim()) location.hash = "/list/" + newList(n); }} className="min-h-10 rounded-full border border-dashed border-action px-4 text-sm font-medium text-action hover:bg-navy-soft">+ New list</button>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3"><h2 className="font-serif text-2xl">{cur.name}</h2><span className="text-ink-3">{items.length} chapter{items.length === 1 ? "" : "s"}</span>
        <span className="ml-auto flex flex-wrap items-center gap-3">
          {items.length > 0 && <Link to={"/read/" + items[0].id} className="rounded-full bg-action-fill px-5 py-2 text-sm font-medium text-white hover:bg-action-2-fill">Start reading</Link>}
          <button type="button" onClick={() => { const n = prompt("Rename list", cur.name); if (n && n.trim()) edit((l) => ({ ...l, name: n.trim().slice(0, NAME_MAX) })); }} className="min-h-10 text-sm text-link hover:underline">Rename</button>
          {lists.length > 1 && <button type="button" onClick={() => { if (confirm(`Delete “${cur.name}”?`)) { saveLists(lists.filter((l) => l.id !== cur.id)); location.hash = "/list"; } }} className="min-h-10 text-sm text-link hover:underline">Delete</button>}
          {items.length > 0 && <button type="button" onClick={() => confirm("Remove every chapter from this list?") && edit((l) => ({ ...l, items: [] }))} className="min-h-10 text-sm text-link hover:underline">Empty</button>}</span></div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 text-sm"><span className="text-ink-3">Export or share:</span>
        <button type="button" disabled={!items.length} className={act + " disabled:opacity-40"} onClick={share}>Copy share link</button>
        <button type="button" disabled={!items.length} className={act + " disabled:opacity-40"} onClick={() => download(file + ".json", JSON.stringify({ name: cur.name, items: cur.items }, null, 1), "application/json")}>JSON</button>
        <button type="button" disabled={!items.length} className={act + " disabled:opacity-40"} onClick={async () => { try { await navigator.clipboard.writeText(items.map((a) => styleText(a, "apa")).join("\n\n")); say(`${items.length} APA citations copied`); } catch { say("Copy failed: use BibTeX or RIS"); } }}>Copy all citations (APA)</button>
        <button type="button" disabled={!items.length} className={act + " disabled:opacity-40"} onClick={() => download(file + ".bib", bibtex(items), "application/x-bibtex")}>BibTeX</button>
        <button type="button" disabled={!items.length} className={act + " disabled:opacity-40"} onClick={() => download(file + ".ris", ris(items), "application/x-research-info-systems")}>RIS</button>
        <span role="status" className="text-xs text-ink-2">{msg}</span></div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
      {items.length === 0 ? <p className={EMPTY}>This list is empty. Press <b>+</b> on any chapter to add it, then read them one by one.</p> :
        <ul className="space-y-4">{items.map((a, i) => <Card key={a.id} a={a} extra={<div className="mt-2 flex gap-2 text-sm"><button type="button" disabled={!i} onClick={() => move(a.id, -1)} aria-label={`Move up: ${a.title}`} className="min-h-10 rounded-full border border-line px-3 disabled:opacity-40">↑ Up</button><button type="button" disabled={i === items.length - 1} onClick={() => move(a.id, 1)} aria-label={`Move down: ${a.title}`} className="min-h-10 rounded-full border border-line px-3 disabled:opacity-40">↓ Down</button></div>} />)}</ul>}</div>
        <Recommended items={items} />
      </div>
    </section>
  );
}
function Header({ route }) {
  const n = new Set(useLists().flatMap((l) => l.items)).size;
  // the nav scrolls sideways on a phone: bring the active tab (the only a.bg-surface in it) into view
  useEffect(() => { document.querySelector('nav[aria-label="Main"] a.bg-surface')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [route]);
  const tab = (to, label, on) => <Link to={to} aria-current={on ? "page" : undefined} onMouseEnter={LOAD[to]} onFocus={LOAD[to]} onTouchStart={LOAD[to]} className={`inline-flex min-h-11 items-center rounded-full px-2.5 text-sm font-medium sm:px-4 ${on ? "bg-surface text-navy" : "text-white/90 hover:bg-white/10"}`}>{label}</Link>;
  return (
    <header className="text-white print:hidden">
      <div className="bg-surface"><div className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 sm:px-8">
        <div className="group relative">
          <Link to="/" aria-label="IJODeL, International Journal on Open and Distance e-Learning: home" aria-describedby="logo-note" className="block"><img src={asset("img/logo.webp")} width="1200" height="300" decoding="async" alt="" fetchpriority="high" className="h-auto w-full" /></Link>
          <span id="logo-note" role="tooltip" className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-md bg-ink-fill p-3 text-xs font-normal leading-snug text-white shadow-lg group-hover:block group-focus-within:block">Disclaimer: this is a proof of concept, not the official IJODeL site. The IJODeL name and logo belong to the journal and UP Open University and are shown only to identify the source of the content.</span>
          {/* the logo's centre emblem: a relationship map seeded with a random chapter of the latest issue */}
          <a href="#/maps/pub" aria-label="Explore the relationship map from a random chapter of the latest issue" title="Explore the map from the top search result, or a random chapter of the latest issue" className="absolute left-[44.5%] top-[64%] block h-[36%] w-[11%] rounded-full outline-offset-2 hover:bg-sky/20"
            onClick={(e) => { e.preventDefault(); keep = true; const top = window.__top, it = issueList()[0]?.items; if (top != null) location.hash = "/maps/pub/" + encodeURIComponent(top); else if (it?.length) location.hash = "/maps/pub/" + encodeURIComponent(it[Math.floor(Math.random() * it.length)].id); else location.hash = "/maps/pub"; }} />
        </div>
      </div></div>
      <div className="bg-navy-fill"><div className="mx-auto flex max-w-6xl min-[1536px]:max-w-[88rem] flex-wrap items-center gap-3 px-4 py-1 sm:px-8 sm:py-2">
        <nav className="-mx-1 flex w-full gap-0.5 overflow-x-auto sm:mx-0 sm:ml-auto sm:w-auto sm:gap-1" aria-label="Main">{tab("/", "Home", route === "/" || /^\/(cat|year|tag)/.test(route))}{tab("/issues", "Issues", route.startsWith("/issues") || route.startsWith("/issue/"))}{tab("/topics", "Topics", route.startsWith("/topics"))}{tab("/search", "Search", route.startsWith("/search"))}{tab("/advanced", "Advanced", route.startsWith("/advanced"))}{tab("/maps", "Maps", route.startsWith("/maps"))}{tab("/list", "View lists" + (n ? ` (${n})` : ""), route.startsWith("/list"))}<button type="button" onClick={openCookieSettings} title="Cookie settings" aria-label="Cookie settings" className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-lg text-white/90 hover:bg-white/10"><span aria-hidden="true">🍪</span></button></nav>
      </div></div>
      <div className="h-1 bg-link-fill" />
    </header>
  );
}


const PAL = { "Learner Engagement & Experience": ["#ff7a59", "#c2185b"], "Learning Technologies & Platforms": ["#14b8a6", "#2563eb"], "Course Design & Assessment": ["#fbbf24", "#e4572e"], "Teaching & Teacher Readiness": ["#84cc16", "#047857"], "Open Education & ODeL Foundations": ["#8b5cf6", "#3730a3"], "Student Support & Access": ["#f472b6", "#be123c"], "AI, Analytics & Emerging Tech": ["#22d3ee", "#7c3aed"], "Quality, Policy & Institutions": ["#60a5fa", "#1e3a8a"] };
const pal = (a) => PAL[a.categories?.[0]] || ["#6b7fd7", "#28345a"];
const grad = (a, d = 150) => `linear-gradient(${d}deg, ${pal(a)[0]}, ${pal(a)[1]})`;
// Cover background: scrims under the title (bottom) and the volume line (top) keep white text >= 4.5:1 on the lightest palette colour;
// odd seeds flip the palette so neighbours from one category don't look alike.
const coverBg = (a, s) => { const [c0, c1] = pal(a), [x, y] = s % 2 ? [c1, c0] : [c0, c1];
  return `linear-gradient(to top, rgb(0 0 0 / .55), rgb(0 0 0 / .45) 38%, transparent 72%), linear-gradient(to bottom, rgb(0 0 0 / .5) 14%, transparent 30%), linear-gradient(${130 + ((s >> 3) % 7) * 12}deg, ${x}, ${y})`; };
const ICON = {
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /></>,
  network: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M6 8l5 8M18 8l-5 8" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  brain: <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V4a3 3 0 0 0-3 0zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1" />,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  laptop: <><rect x="4" y="5" width="16" height="11" rx="1" /><path d="M2 20h20" /></>,
  graduation: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5" /></>,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-9" />,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-4 3-6 6-6s6 2 6 6M15 14c3 0 6 1.5 6 5" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" /></>,
  magnifier: <><circle cx="10" cy="10" r="6" /><path d="M15 15l6 6" /></>,
  teacher: <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20l4-4 4 4" /></>,
  puzzle: <path d="M5 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 0 0 4v4H5z" />,
  // UI icons (round 47: one set, one stroke style; draw with <Icon m=".." w={2} />)
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.9-4.9" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /><path className="spark" d="M19 11v3M17.5 12.5h3" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  filter: <><path d="M3 5h14l-5.5 6.5V17l-3 2v-7.5z" /><circle cx="17.5" cy="17.5" r="3" /><path d="m20 20 2 2" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  shrink: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  swapV: <path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4" />,
  swapH: <path d="M4 8h14M15 4l4 4-4 4M20 16H6M9 12l-4 4 4 4" />,
};
export const Icon = ({ m, className = "", w = 1.5 }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{ICON[m] || ICON.book}</svg>;
const seed = (id) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 997; return h; };
// A generated cover: category colours, a seeded pattern, an LLM-chosen icon, the title.
function Cover({ a, className = "", small }) {
  const s = seed(a.id);
  return (
    <div className={`cover gen ${className}`} style={{ background: coverBg(a, s) }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 133" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {[ // three motif families picked by the seed: soft circles, diagonal bands, concentric rings
          <><circle cx={20 + (s % 60)} cy={20 + (s % 30)} r={38 + (s % 20)} fill="#fff" opacity=".09" /><circle cx={90 - (s % 40)} cy={115 - (s % 25)} r={30 + (s % 14)} fill="#fff" opacity=".12" /></>,
          <g stroke="#fff" opacity=".1">{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${-40 + i * 28 + (s % 20)} 133 L${40 + i * 28 + (s % 20)} 0`} strokeWidth={6 + (i * s) % 9} />)}</g>,
          <g fill="none" stroke="#fff" opacity=".13">{[14, 26, 38, 50].map((r) => <circle key={r} cx={78 - (s % 30)} cy={30 + (s % 25)} r={r} strokeWidth="1.2" />)}</g>,
        ][(s >> 1) % 3]}
        <path d={`M0 ${95 + (s % 20)} Q 50 ${70 + (s % 30)} 100 ${100 + (s % 18)} V133 H0z`} fill="#000" opacity=".12" />
      </svg>
      <Icon m={a.motif} className="absolute -bottom-[6%] -right-[6%] h-[62%] w-[62%] text-white/30" w={1.5} />
      <div aria-hidden="true" className="face relative z-[1] flex h-full flex-col p-[8%] text-white">
        <span className="text-[4.4cqw] font-bold uppercase tracking-[0.14em] text-white">IJODeL · Vol. {a.issue.vol}</span>
        <div className="mt-auto" />
        <div className="font-serif font-normal leading-[1.12]" style={{ fontSize: small ? "9cqw" : "8.6cqw", WebkitLineClamp: small ? 4 : 5, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden", textShadow: "0 1px 3px rgb(0 0 0 / .45)" }}>{a.title}</div>
        <span className="mt-[5%] line-clamp-1 text-[4.6cqw] text-white/85">{a.authors[0]?.split(",")[0]}{a.authors.length > 1 ? " et al." : ""} · {a.year}</span>
      </div>
      <div className="peek">{clip(a.abstract || a.title, 140)}</div>
    </div>
  );
}
// Where in the PDF an answer came from (qa.py locates page + paragraph for every FAQ).
const Ref = ({ f }) => (f.page || f.para) ? <p className="mt-1 text-xs text-ink-3">Source: {f.page ? <Link to={`/read/${f.article}/p/${f.page}/`} title="Show this page's passage" className="text-link underline">PDF page {f.page}</Link> : ""}{f.page && f.para ? ", " : ""}{f.para ? `paragraph ${f.para}` : ""}</p> : null;
// Q&A under a result: this chapter's generated FAQs, best match to the query words first; mode "q" lists the questions, "qa" lets each open to its answer.
export function QA({ a, mode, terms = [] }) {
  const faqs = useFaqs(mode && mode !== "off" ? a.id : null); // hook before the early return; no fetch while Q&A is off
  if (!mode || mode === "off") return null;
  const score = (f) => terms.reduce((n, t) => n + ((f.q + " " + f.a).toLowerCase().includes(t) ? 1 : 0), 0) + (f.kind === "key" ? 0.5 : 0); // key questions win ties
  const list = faqs.sort((x, y) => score(y) - score(x)).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="border-t border-line bg-navy-soft/40 p-2.5 pl-3 text-left" aria-label={`Questions answered by ${a.title}`}>
            <p className="mb-1.5 rounded bg-amber-100 px-1.5 py-1 text-2xs font-semibold leading-snug text-amber-950">Never cite from AI answers; check the chapter itself.</p>
      <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-ink-3">Q&amp;A <span className={BADGE_C} title="Generated by a language model; check the original article">AI</span></p>
      {mode === "q" ? <ul className="mt-1 space-y-1">{list.map((f) => <li key={f.id} className="line-clamp-2 text-xs leading-snug text-ink-2">{f.q}</li>)}</ul>
        : <div className="mt-1 divide-y divide-line">{list.map((f) => <details key={f.id} className="py-1"><summary className="cursor-pointer text-xs font-medium leading-snug text-ink">{f.q}</summary><p className="mt-1 text-xs leading-snug text-ink-2">{f.a} <AiLabel /></p><Ref f={f} /></details>)}</div>}
    </div>
  );
}
export const Pub = memo(function Pub({ a, qa, terms, extra }) {
  const [tip, setTip] = useState(false); // touch screens have no hover: a button shows the .peek text
  return (
    <li className="pub" draggable onDragStart={dragChip(a)}>
      <div className="h-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:shadow-lg">
        <div className="relative">
          <Link to={"/read/" + a.id} className="pub-link block"><Cover a={a} className="!rounded-none" /></Link>
          <AddBtn id={a.id} className="absolute right-2 top-2 z-10 !h-8 !w-8 pointer-coarse:!h-11 pointer-coarse:!w-11 !bg-surface shadow-md ring-1 ring-black/5" /><Link to={"/maps/pub/" + a.id} aria-label={`Relationship map of ${a.title}`} title="Relationship map" className="absolute bottom-1.5 right-1.5 z-10 rounded-full before:absolute before:-inset-3 before:content-['']  bg-surface px-2 py-0.5 text-2xs font-medium text-link shadow hover:underline">Map</Link>
        </div>
        <div className="p-2.5 pl-3"><p className="min-w-0 flex-1 text-xs leading-snug text-ink-3" title={a.authors.join("; ")}><span className="line-clamp-3 text-ink-2">{a.authors.join("; ")}</span>{a.year} · Vol. {a.issue.vol}</p>
          <button type="button" aria-expanded={tip} onClick={() => setTip(!tip)} className="mt-1 hidden min-h-11 text-xs font-medium text-link pointer-coarse:block">{tip ? "Hide summary" : "Show summary"}</button>{tip && <p className="text-xs leading-snug text-ink-2">{clip(a.abstract || a.title, 140)}</p>}</div>
        <Passage p={a.passage} id={a.id} small />
        <QA a={a} mode={qa} terms={terms} />
        {extra}
      </div>
    </li>
  );
});
function Row({ title, items, to, sub, render = (a) => <Pub key={a.id} a={a} /> }) {
  const ref = useRef(null), [edge, setEdge] = useState({ start: true, end: false });
  // R236: first/last card visibility replaces a scroll listener per row and a resize listener per row
  useEffect(() => { const t = ref.current, f = t?.firstElementChild, l = t?.lastElementChild; if (!f) return;
    const io = new IntersectionObserver((es) => setEdge((e) => { const n = { ...e }; for (const x of es) n[x.target === f ? "start" : "end"] = x.intersectionRatio >= 0.9; return { ...n, ...(f === l ? { end: n.start } : {}) }; }), { root: t, threshold: [0, 0.9, 1] });
    io.observe(f); if (l !== f) io.observe(l); return () => io.disconnect(); }, [items]);
  const step = (d) => ref.current.scrollBy({ left: d * ref.current.clientWidth * 0.9, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const btn = (d, label, hide, cls, glyph) => !hide && <button type="button" aria-label={`${label} in ${title}`} onClick={() => step(d)} className={`row-btn ${cls}`}>{glyph}</button>;
  return (
    <div className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 py-7 sm:px-8">
      <div className="flex items-baseline gap-3">
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
        <span className="min-w-0 text-sm text-ink-3">{sub ?? `${items.length} chapters`}</span>
        {to && <Link to={to} className="ml-auto inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm font-medium text-link hover:underline">See all →</Link>}
      </div>
      <div className="row">
        {btn(-1, "Previous", edge.start, "left-1", "‹")}
        <ul ref={ref} tabIndex={0} aria-label={title} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); step(e.key === "ArrowRight" ? 1 : -1); } }} className="row-track" style={{ "--fl": edge.start ? "0px" : "2.5rem", "--fr": edge.end ? "0px" : "2.5rem" }}>{items.map(render)}</ul>
        {btn(1, "Next", edge.end, "right-1", "›")}
      </div>
    </div>
  );
}

function Hero({ items }) {
  const [n, setN] = useState(() => Math.floor(Date.now() / 864e5) % items.length), a = items[n];
  return (
    <section className="relative overflow-hidden bg-navy-fill text-white">
      <div className="absolute inset-0" style={{ background: grad(a, 120) }} aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-r from-navy-fill/95 via-navy-fill/70 to-navy-fill/10" aria-hidden="true" />
      <div key={a.id} className="rise relative mx-auto grid max-w-6xl min-[1536px]:max-w-[88rem] items-center gap-8 px-4 py-10 sm:px-8 md:grid-cols-[1fr_13rem] md:py-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky">Featured · {a.categories?.[0] || "IJODeL"}</p>
          {/* the one h1 above text-3xl on purpose: the home hero (R153); every route h1 is font-serif text-3xl, normal weight */}
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">{a.title}</h1>
          <p className="mt-3 text-white/80">{by(a)} · {a.year}</p>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/90">{clip(a.abstract, 300)}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={"/read/" + a.id} className="rounded-full bg-surface px-6 py-2.5 font-bold text-navy transition hover:brightness-105">Read</Link>
            {a.url?.startsWith("https://") && <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/40 bg-white/10 px-6 py-2.5 font-medium backdrop-blur hover:bg-white/20">Original article ↗</a>}
            <button onClick={() => setN((n + 1 + Math.floor(Math.random() * (items.length - 1))) % items.length)} className="rounded-full px-4 py-2.5 text-sm text-white/80 hover:text-white">Surprise me ↻</button>
          </div>
        </div>
        <Link to={"/read/" + a.id} className="pub-link hidden md:block"><Cover a={a} className="rotate-2 !shadow-2xl" /></Link>
      </div>
    </section>
  );
}


// Type-ahead like the OER app: matching topics, categories, issues and titles; recent searches when empty.
function suggestions(q, fix) {
  const S = window.__S, t = q.trim().toLowerCase(), terms = t.split(/\s+/).filter(Boolean);
  if (t.length < 2) return recents().map((r) => ({ kind: "recent", label: r, to: "/search/" + encodeURIComponent(r) }));
  if (!S.sugg) { // counted once per load, not per keystroke
    const tags = {}; S.articles.forEach((a) => a.subjects.forEach((s) => { tags[s] = (tags[s] || 0) + 1; }));
    S.sugg = { tags: Object.entries(tags).sort((x, y) => y[1] - x[1]), cats: [...new Set(S.articles.flatMap((a) => a.categories))], issues: [...new Map(S.articles.map((a) => [issueKey(a), a.issue.label]))], low: S.articles.map((a) => a.title.toLowerCase()) };
  }
  const { tags, cats, issues, low } = S.sugg;
  return [
    ...(fix ? [{ kind: "did you mean", label: fix, to: "/search/" + encodeURIComponent(fix) }] : []),
    ...tags.filter(([s]) => s.toLowerCase().includes(t)).slice(0, 3).map(([s, n]) => ({ kind: "tag", label: s + " · " + n, to: tagTo(s) })),
    ...cats.filter((c) => c.toLowerCase().includes(t)).slice(0, 2).map((c) => ({ kind: "category", label: c, to: "/cat/" + slug(c) })),
    ...issues.filter(([, l]) => l.toLowerCase().includes(t)).slice(0, 2).map(([k, l]) => ({ kind: "issue", label: l, to: "/issue/" + k })),
    ...S.articles.filter((a, i) => terms.every((w) => low[i].includes(w))).slice(0, 4).map((a) => ({ kind: "chapter", label: a.title, to: "/read/" + a.id })),
    { kind: "search", label: `Search all for “${q.trim()}”`, to: "/search/" + encodeURIComponent(q.trim()) },
  ];
}
function SearchBox({ value, onChange, placeholder, className = "", btn = "bg-action-fill hover:bg-action-2-fill" }) {
  const [open, setOpen] = useState(false), [cur, setCur] = useState(-1), [fix, setFix] = useState(null), m = useModel();
  // "did you mean" runs in the search worker; a late answer for an older value is dropped
  // R196: one worker request per typing pause (120 ms), not one per keystroke
  useEffect(() => { let on = true; const id = open && value.trim().length >= 2 ? setTimeout(() => didYouMeanAsync(value).then((f) => on && setFix(f)).catch(() => {}), 120) : setFix(null); return () => { on = false; clearTimeout(id); }; }, [value, open]);
  const list = open ? suggestions(value, fix) : [];
  const go = (to, q) => { setOpen(false); if (q) remember(q); location.hash = to; };
  const submit = (e) => { e.preventDefault(); const it = list[cur]; if (it) go(it.to, it.kind === "search" || it.kind === "recent" || it.kind === "did you mean" ? it.label.replace(/^Search all for “|”$/g, "") : null); else if (value.trim()) go("/search/" + encodeURIComponent(value.trim()), value.trim()); };
  const key = (e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setCur((cur + 1) % Math.max(list.length, 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setCur((cur - 1 + list.length) % Math.max(list.length, 1)); } else if (e.key === "Escape") { setOpen(false); setCur(-1); } else if (e.key === "Home" && open && list.length) { e.preventDefault(); setCur(0); } else if (e.key === "End" && open && list.length) { e.preventDefault(); setCur(list.length - 1); } };
  return (
    <form onSubmit={submit} className={`relative flex gap-2 ${className}`} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input role="combobox" aria-expanded={open && list.length > 0} aria-controls="sugg" aria-activedescendant={cur >= 0 && list[cur] ? "sg" + cur : undefined} aria-autocomplete="list" autoComplete="off" value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); setCur(-1); }} onFocus={() => { setOpen(true); warmSearch(); if (allow("model")) startModel(true); }} onKeyDown={key} placeholder={placeholder} aria-label="Search chapters" className="min-w-0 flex-1 rounded-md border border-line bg-surface px-4 py-3 text-base text-ink" />
      <button className={`inline-flex items-center gap-2 rounded-md px-5 py-3 font-bold text-white sm:px-7 ${btn}`}><Icon m="search" w={2} className="h-[18px] w-[18px]" />Search</button>
      <Link to="/advanced" onClick={(e) => { const t = value.trim(); if (!t) return; e.preventDefault(); import("./Advanced.jsx").then((m) => m.addChip("req", { k: "words", v: t, l: t })).catch(() => {}).finally(() => { location.hash = "/advanced"; }); }} title="Advanced search: combine categories, tags, authors, issues and years. Your search words become a Required filter" aria-label="Advanced search" className="pulse-orange inline-flex shrink-0 items-center gap-2 rounded-md bg-[#c2410c] px-4 py-3 font-bold text-white hover:bg-[#9a3412]">
        <Icon m="sliders" w={2} className="h-5 w-5" />
        <span className="hidden sm:inline">Advanced</span>
      </Link>
      {list.length > 0 && <ul id="sugg" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-surface py-1 text-ink shadow-xl">
        {list.map((s, i) => <li key={s.kind + s.label} id={"sg" + i} role="option" aria-selected={i === cur}><a href={"#" + s.to} onClick={() => { setOpen(false); if (s.kind === "search" || s.kind === "recent") remember(s.label.replace(/^Search all for “|”$/g, "")); }} onMouseEnter={() => setCur(i)} className={`flex items-baseline gap-3 px-4 py-2 ${i === cur ? "bg-navy-soft" : ""}`}><span className="w-20 shrink-0 text-xs uppercase tracking-wide text-ink-3">{s.kind}</span><span className="line-clamp-1">{s.label}</span></a></li>)}
      </ul>}
      {!list.length && (m.s === "loading" || m.s === "failed") && <p role="status" data-model={m.s} className="pointer-events-none absolute left-0 top-full z-20 mt-1 rounded bg-surface/95 px-2 py-0.5 text-xs text-ink-2 shadow">{m.s === "loading" ? `Loading semantic search… ${m.pct}%` : "Semantic search unavailable: keyword search only"}</p>}
    </form>
  );
}

const issueList = () => {
  const m = new Map(); [...window.__S.articles].sort((x, y) => y.year - x.year).forEach((a) => { const k = issueKey(a); (m.get(k) || m.set(k, { k, label: a.issue.label, items: [] }).get(k)).items.push(a); });
  return [...m.values()].sort((x, y) => y.k.localeCompare(x.k, undefined, { numeric: true }) || 0).sort((x, y) => parseFloat(y.k) - parseFloat(x.k) || (y.k > x.k ? 1 : -1));
};
// An issue is a "book": the journal's own cover, an LLM-written theme as its title, chapters inside.
function IssueCard({ it, eager }) {
  const m = window.__S.issues[it.k];
  return (
    <li className="pub">
      <Link to={"/issue/" + it.k} className="pub-link block h-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative aspect-[3/4] overflow-hidden bg-navy-fill"><img src={asset(m.cover)} width="420" height="592" decoding="async" alt={"Cover of " + it.label} loading={eager ? "eager" : "lazy"} fetchpriority={eager ? "high" : undefined} className="h-full w-full object-cover transition duration-500 hover:scale-105" />
          <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2.5 py-0.5 text-xs font-bold text-navy">{it.items.length} chapters</span></div>
        <div className="p-3"><h3 className="font-serif text-lg leading-snug text-ink">{m.theme}</h3><p className="mt-1 text-xs text-ink-3">{it.label}</p></div>
      </Link>
    </li>
  );
}
function Issues() {
  const list = issueList();
  return (
    <section className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 py-8 sm:px-8">
      <h1 className="font-serif text-3xl">Issues</h1><p className="text-ink-3">{list.length} issues, 2015 to {list[0].items[0].year}. Open an issue to see its chapters.</p>
      <ul className="mt-6 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(13rem, 1fr))" }}>{list.map((it, i) => <IssueCard key={it.k} it={it} eager={i < 4} />)}</ul>
    </section>
  );
}
function Topics() {
  const S = window.__S, cats = [...new Set(S.articles.flatMap((a) => a.categories))].map((c) => [c, S.articles.filter((a) => a.categories.includes(c))]).sort((x, y) => y[1].length - x[1].length);
  const tc = {}; S.articles.forEach((a) => a.subjects.forEach((s) => { tc[s] = (tc[s] || 0) + 1; }));
  return (
    <section className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 py-8 sm:px-8">
      <h1 className="font-serif text-3xl">Topics</h1>
      <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{cats.map(([c, items]) => <li key={c}><Link to={"/cat/" + slug(c)} className="block h-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="relative flex h-28 items-center justify-center overflow-hidden text-white" style={{ background: grad(items[0], 120) }}><Icon m={items[0].motif} className="h-20 w-20 opacity-80" w={1.5} /></div>
        <div className="p-3"><h3 className="font-serif text-lg leading-snug">{c}</h3><p className="text-xs text-ink-3">{items.length} chapters</p></div></Link></li>)}</ul>
      <h2 className="mt-10 font-serif text-2xl">Popular tags</h2>
      <p className="mt-3 flex flex-wrap gap-2">{Object.entries(tc).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 60).map(([s, n]) => <Link key={s} to={tagTo(s)} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 hover:border-action-2 hover:text-action">{s} <span className="opacity-60">{n}</span></Link>)}</p>
    </section>
  );
}

// Floating nudge on the home page: there is a lot more below the hero. Stays until the footer comes into view.
function ScrollHint() {
  const [top, setTop] = useState(true), consent = useConsent();
  useEffect(() => { const f = document.querySelector("footer"); if (!f || !("IntersectionObserver" in window)) return; const io = new IntersectionObserver(([e]) => setTop(!e.isIntersecting)); io.observe(f); return () => io.disconnect(); }, []);
  if (!top || !consent) return null; // the cookie banner sits at the bottom until the visitor chooses: never both
  const go = () => scrollTo({ top: scrollY + innerHeight * 0.85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return <button type="button" onClick={go} className="fixed bottom-5 left-1/2 z-30 inline-flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-action-fill px-5 py-2 text-sm font-bold text-white shadow-xl ring-2 ring-white transition hover:bg-action-2-fill"><span>Scroll for more categories and chapters</span><span aria-hidden="true" className="hint-bob">↓</span></button>;
}
// First-visit tour: three short steps. Its dismissal is a preference, so it is kept on the device only with "prefs" consent (memory otherwise).
const TOUR = [["Search", "Type a topic or a question in the box above; suggestions appear as you type.", "/search"], ["Advanced", "Combine categories, tags, authors and years: Required, Expand, Boost and Exclude.", "/advanced"], ["Maps and view lists", "See how chapters connect on the relationship map, and collect chapters in view lists with +.", "/maps"]];
function Tour() {
  const [n, setN] = useState(() => (pref.get("ijodel-tour") ? -1 : 0));
  if (n < 0) return null;
  const done = () => { pref.set("ijodel-tour", "1"); setN(-1); }, [h, t, to] = TOUR[n];
  return (
    <section aria-label="Quick tour" className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Quick tour · step {n + 1} of {TOUR.length}</p>
      <h2 className="mt-1 font-serif text-xl">{h}</h2><p className="mt-1 text-sm text-ink-2">{t} <Link to={to} className="text-link underline">Open {h.split(" ")[0]}</Link></p>
      <div className="mt-3 flex flex-wrap gap-2">{n > 0 && <button type="button" onClick={() => setN(n - 1)} className="min-h-10 rounded-full border border-line px-4 text-sm">Back</button>}
        {n < TOUR.length - 1 ? <button type="button" onClick={() => setN(n + 1)} className="min-h-10 rounded-full bg-action-fill px-4 text-sm font-bold text-white hover:bg-action-2-fill">Next</button> : <button type="button" onClick={done} className="min-h-10 rounded-full bg-action-fill px-4 text-sm font-bold text-white hover:bg-action-2-fill">Done</button>}
        <button type="button" onClick={done} className="min-h-10 px-2 text-sm text-link hover:underline">Skip tour</button></div>
    </section>
  );
}
// own state, so a keystroke re-renders the box and not the whole catalogue below it (1000 records: 450 ms frames)
function HomeSearch() { const [q, setQ] = useState(""); return <SearchBox value={q} onChange={setQ} placeholder="Search titles, tags, summaries, topics…" className="w-full" />; }
function Browse() {
  const S = window.__S, [mode, setMode] = useState("category");
  const arts = [...S.articles].sort((x, y) => y.year - x.year), withAbs = arts.filter((a) => a.abstract);
  const cats = [...new Set(S.articles.flatMap((a) => a.categories || []))].map((c) => [c, arts.filter((a) => a.categories?.includes(c))]).sort((x, y) => y[1].length - x[1].length);
  const issues = [...new Map(arts.map((a) => [issueKey(a), a.issue.label])).entries()].map(([k, l]) => [k, l, arts.filter((a) => issueKey(a) === k)]);
  const tc = {}; arts.forEach((a) => a.subjects.forEach((s) => { tc[s] = (tc[s] || 0) + 1; }));
  const topics = Object.entries(tc).filter(([, n]) => n >= 3).sort((x, y) => y[1] - x[1]).map(([s]) => [s, arts.filter((a) => a.subjects.includes(s))]);
  return (
    <>
      <Hero items={withAbs} />
      <ScrollHint />
      <div className="mx-auto flex max-w-6xl min-[1536px]:max-w-[88rem] flex-col gap-3 px-4 pt-8 sm:px-8">
        <HomeSearch />
        <Tour />
      </div>
      <div className="mt-4">
        <section className="band"><Row title="Latest issues" items={issueList().slice(0, 8)} to="/issues" sub="books, with their chapters" render={(it) => <IssueCard key={it.k} it={it} />} /></section>
        <div className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 pt-6 sm:px-8">
          <div role="group" aria-label="Organize by" className="flex self-start rounded-full border border-line bg-surface p-1 text-sm">
          {[["category", "By category"], ["issue", "By issue"], ["topic", "By tag"]].map(([k, l]) => <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k} className={`rounded-full px-4 py-1.5 font-medium ${mode === k ? "bg-action-fill text-white" : "text-ink-2"}`}>{l}</button>)}
        </div>
        </div>
        {mode === "category" && <><section className="band"><Row title="New chapters" items={arts.slice(0, 12)} sub="most recent" /></section></>}
        {mode === "category" && cats.map(([g, items]) => <section className="band" key={g}><Row title={g} items={items} to={"/cat/" + slug(g)} /></section>)}
        {mode === "issue" && issues.map(([k, l, items]) => <section className="band" key={k}><Row title={l} items={items} to={"/issue/" + k} /></section>)}
        {mode === "topic" && topics.map(([g, items]) => <section className="band" key={g}><Row title={g} items={items} to={tagTo(g)} /></section>)}
      </div>
    </>
  );
}

export function Crumbs({ trail }) {
  return <nav aria-label="Breadcrumb" className="text-sm print:hidden"><ol className="flex flex-wrap gap-x-1.5 text-ink-3">{trail.map(([to, l], i) => <li key={i}>{i > 0 && <span aria-hidden="true">› </span>}{to ? <Link to={to} className="text-link hover:underline">{l}</Link> : <span aria-current="page">{l}</span>}</li>)}</ol></nav>;
}
function Group({ kind, id }) {
  const S = window.__S, d = dec(id || "");
  const test = { year: (a) => a.year === d, issue: (a) => issueKey(a) === d, tag: (a) => a.subjects.includes(d), cat: (a) => a.categories?.some((c) => slug(c) === d) }[kind];
  const items = S.articles.filter(test).sort((x, y) => y.year - x.year);
  const title = kind === "year" ? `Published ${d}` : kind === "issue" ? items[0]?.issue.label || "Issue not found" : kind === "tag" ? d : S.articles.flatMap((a) => a.categories || []).find((c) => slug(c) === d) || "Category";
  const rel = {}, rc = {}; if (kind === "tag" || kind === "cat") items.forEach((a) => a.subjects.forEach((s) => { if (s !== d) rel[s] = (rel[s] || 0) + 1; }));
  if (kind === "cat") items.forEach((a) => a.categories.forEach((c) => { if (slug(c) !== d) rc[c] = (rc[c] || 0) + 1; })); // topic hub: categories that share chapters with this one
  const im = kind === "issue" && S.issues[d];
  return (
    <section className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 py-8 sm:px-8">
      <Crumbs trail={[["/", "Home"], ...(kind === "issue" ? [["/issues", "Issues"]] : kind === "year" ? [] : [["/topics", "Topics"]]), [null, kind === "tag" ? "Tag: " + title : title]]} />
      <div className="mt-2 flex gap-5">{im && <img src={asset(im.cover)} width="420" height="592" decoding="async" alt={`Cover of ${title}`} className="hidden w-28 shrink-0 rounded border border-line sm:block" />}<div>
      <h1 className="font-serif text-3xl">{kind === "tag" && <span className="text-ink-3">Tag: </span>}{title}</h1>{im?.theme && <p className="font-serif text-lg text-ink-2">{im.theme}</p>}<p className="text-ink-3">{items.length} chapters{kind === "issue" ? " in this issue" : ""}</p>
      {kind === "cat" && Object.keys(rc).length > 0 && <p className="mt-3 flex flex-wrap gap-2 text-sm"><span className="text-ink-3">Related topics:</span>{Object.entries(rc).sort((x, y) => y[1] - x[1]).map(([c]) => <Link key={c} to={"/cat/" + slug(c)} className="rounded-full bg-crimson-soft px-3 py-0.5 text-link hover:underline">{c}</Link>)}</p>}</div></div>
      {kind === "issue" && items.length > 0 && <ol aria-label="Contents" className="mt-4 list-decimal space-y-1 pl-6 text-sm">{items.map((a) => <li key={a.id}><Link to={"/read/" + a.id} className="text-link hover:underline">{a.title}</Link> <span className="text-ink-3">· {by(a)}</span></li>)}</ol>}
      {(kind === "tag" || kind === "cat") && Object.keys(rel).length > 0 && <p className="mt-3 flex flex-wrap gap-2 text-sm"><span className="text-ink-3">{kind === "cat" ? "Common tags:" : "Related tags:"}</span>{Object.entries(rel).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([s]) => <Link key={s} to={tagTo(s)} className="rounded-full bg-navy-soft px-3 py-0.5 text-navy hover:underline">{s}</Link>)}</p>}
      <ul className="grid-pubs mt-6">{items.map((a) => <Pub key={a.id} a={a} />)}</ul>
      {im && (() => { const ks = Object.keys(S.issues).sort((x, y) => x.localeCompare(y, "en", { numeric: true })), i = ks.indexOf(d), lab = (k) => S.articles.find((a) => issueKey(a) === k)?.issue.label || k, ln = "min-h-11 items-center rounded-full border border-line px-4 py-2 text-sm font-medium text-link hover:bg-navy-soft";
        return <nav aria-label="Other issues" className="mt-8 flex flex-wrap justify-between gap-3">{i > 0 ? <Link to={"/issue/" + ks[i - 1]} rel="prev" className={"inline-flex " + ln}>← {lab(ks[i - 1])}</Link> : <span />}{i >= 0 && i < ks.length - 1 && <Link to={"/issue/" + ks[i + 1]} rel="next" className={"inline-flex " + ln}>{lab(ks[i + 1])} →</Link>}</nav>; })()}
    </section>
  );
}

const hl = (t, q) => { const w = (q || "").toLowerCase().match(/[a-z0-9]{3,}/g); return w ? t.split(new RegExp("(" + w.join("|") + ")", "ig")).map((s, i) => i % 2 ? <mark key={i} className="rounded bg-sky/60 px-0.5">{s}</mark> : s) : t; };
export function Passage({ p, small, id }) {
  return p ? <div className={`border-t border-line bg-sky/20 text-left ${small ? "px-3 py-2" : "mt-3 rounded-md border px-3 py-2"}`} role="group" aria-label="Best-fit passage">
    <p className="flex items-baseline gap-2 text-2xs font-bold uppercase tracking-wide text-ink-3">Best passage · PDF page {p.page}{id && <Link to={`/read/${id}/p/${p.page}/${encodeURIComponent(p.terms || "")}`} className="ml-auto normal-case tracking-normal text-link hover:underline">Show in chapter</Link>}</p>
    <p className={`mt-0.5 leading-snug text-ink-2 ${small ? "line-clamp-3 text-xs" : "text-sm"}`}>{hl(p.snip, p.terms)}</p></div> : null;
}
export const Card = memo(function Card({ a, q, qa, terms, extra }) {
  return (
    <li draggable onDragStart={dragChip(a)} className="flex gap-4 rounded-xl border border-line bg-surface p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <Link to={"/read/" + a.id} className="pub-link hidden w-28 shrink-0 sm:block" aria-hidden="true" tabIndex={-1}><Cover a={a} small /></Link>
      <div className="min-w-0 flex-1"><Link to={"/read/" + a.id} className="line-clamp-2 font-serif text-2xl leading-snug text-link hover:underline">{hl(a.title, q)}</Link>
      <p className="mt-1 text-sm text-ink-3">{by(a)} · {a.issue.label}</p>
      <p className="mt-3 text-base leading-relaxed text-ink-2">{hl(clip(a.abstract || a.half || "", 380), q)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {a.matched?.length > 0 && <span className={BADGE_C}>best match: {FIELD_LABEL[a.matched[0]]}{a.matched.length > 1 ? ` +${a.matched.length - 1} more` : ""}</span>}
        <AddBtn id={a.id} className="ml-auto !bg-navy-soft" label /><Link to={"/maps/pub/" + a.id} className="font-medium text-link hover:underline">Map</Link>{a.subjects.find((t) => tagN(t) > 1) && <Link to={"/maps/tag/" + encodeURIComponent(a.subjects.find((t) => tagN(t) > 1))} title={`Map of topic: ${a.subjects.find((t) => tagN(t) > 1)}`} className="line-clamp-1 max-w-[10rem] text-link hover:underline">Topic map</Link>}{a.authors[0] && <Link to={"/maps/author/" + encodeURIComponent(a.authors[0])} title={`Map of author: ${a.authors[0]}`} className="text-link hover:underline">Author map</Link>}<Link to={"/read/" + a.id} className="font-medium text-link hover:underline">Read →</Link>
      </div>
      <Passage p={a.passage} id={a.id} />
      {extra}
      {qa && qa !== "off" && <div className="mt-3 overflow-hidden rounded-md border border-line"><QA a={a} mode={qa} terms={terms} /></div>}</div>
    </li>
  );
});

export function ViewToggle({ view, setView }) {
  return <div className="flex overflow-hidden rounded-md border border-line text-sm" role="group" aria-label="Result layout">{[["grid", "Big cards"], ["list", "Details"]].map(([k, l]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)} className={`min-h-10 px-3 ${view === k ? "bg-action-fill text-white" : "bg-surface text-ink-2"}`}>{l}</button>)}</div>;
}
// A chunk that fails to load (stale hash after a deploy, flaky network) gets one automatic reload instead of a blank page.
/* intros live in the entry so the lazy-route fallbacks paint the LCP text before the chunk arrives */
export const AdvIntro = () => <p className="mt-1 text-sm text-ink-2"><b>Required</b> must all match, <b>Expand</b> also includes any of these (or, set to “at least one of these”, becomes <b>Additional</b>: results must match one of them), <b>Boost</b> ranks matches higher (first listed most), <b>Exclude</b> leaves them out. Drag chips between areas (or use the ⇄ on a chip), and drag any result card into an area to filter by that chapter (or, in Details, use the chapter’s ＋). Undo with Ctrl+Z.</p>;
export const MapsIntro = () => <p className="mt-1 text-sm text-ink-2">Pick a chapter, topic or author and see what it connects to. Click a node for details, or Tab to a node and use the arrow keys (Home and End jump to the first and last node, Esc clears the selection). Hover a line to see why two nodes connect. 3D: drag to rotate, scroll to zoom, right-drag to pan. 2D: drag to pan, scroll to zoom; with the map focused, + and - zoom, arrow keys pan and 0 resets.</p>;
export const lazyRetry = (load, pick = (m) => m) => lazy(() => load().then((m) => ({ default: pick(m) })).catch((e) => {
  const k = "ijodel-chunk-retry";
  try { if (!sessionStorage.getItem(k)) { sessionStorage.setItem(k, "1"); location.reload(); return new Promise(() => {}); } sessionStorage.removeItem(k); } catch { /* storage blocked: just fail */ }
  throw e;
}));
const LOAD = { "/advanced": () => import("./Advanced.jsx"), "/maps": () => import("./Maps.jsx") }; // also fetched on tab hover/focus/touch (intent)
const Advanced = lazyRetry(LOAD["/advanced"], (m) => m.Advanced);
const Maps = lazyRetry(LOAD["/maps"], (m) => m.Maps);
const Privacy = lazyRetry(() => import("./Legal.jsx"), (m) => m.Privacy), About = lazyRetry(() => import("./Legal.jsx"), (m) => m.About); // long static text, own chunk
// The journal's own cover of a whole issue, small, linking to the issue.
export function IssueThumb({ a, className = "" }) {
  const m = window.__S.issues[issueKey(a)];
  return m ? <Link to={"/issue/" + issueKey(a)} title={`From the issue: ${m.theme} (${a.issue.label})`} aria-label={`Issue ${a.issue.label}: ${m.theme}`} className={`pub-link block shrink-0 overflow-hidden rounded border border-line ${className}`}><img src={asset(m.cover)} width="420" height="592" decoding="async" alt="" loading="lazy" className="h-full w-full object-cover" /></Link> : null;
}
// Which issues the results come from, with their original covers.
export function ResultIssues({ rows }) {
  const S = window.__S, n = new Map();
  rows.forEach((a) => n.set(issueKey(a), (n.get(issueKey(a)) || 0) + 1));
  const top = [...n].sort((x, y) => y[1] - x[1]).filter(([k]) => S.issues[k]);
  const rail = useRef(null), [over, setOver] = useState(false), step = (d) => rail.current.scrollBy({ left: d * rail.current.clientWidth * 0.8, behavior: "smooth" });
  useEffect(() => { const m = () => rail.current && setOver(rail.current.scrollWidth > rail.current.clientWidth + 4); m(); addEventListener("resize", m); return () => removeEventListener("resize", m); }, [top.length]);
  if (!top.length) return null;
  return (
    <section aria-label="Issues in these results" className="relative mb-5 rounded-xl border border-line bg-surface p-3">
      <h2 className="text-2xs font-bold uppercase tracking-wide text-ink-3">Issues in these results ({n.size})</h2>
      <ul ref={rail} tabIndex={0} aria-label="Issues in these results, scroll sideways" className="-mr-3 mt-2 flex snap-x gap-3 overflow-x-auto scroll-smooth pb-1 pr-3">{top.map(([k, c]) => <li key={k} className="w-24 shrink-0 snap-start"><Link to={"/issue/" + k} className="pub-link block" title={S.issues[k].theme}><img src={asset(S.issues[k].cover)} width="420" height="592" decoding="async" alt={"Cover of " + k} loading="lazy" className="aspect-[3/4] w-full rounded border border-line object-cover" /><span className="mt-1 line-clamp-2 block text-2xs leading-tight text-ink-2">{c} chapter{c > 1 ? "s" : ""} · {S.issues[k].theme}</span></Link></li>)}</ul>
      {over && <div className="absolute right-3 top-2 flex gap-1">{[[-1, "‹", "Scroll left"], [1, "›", "Scroll right"]].map(([d, g, l]) => <button key={d} type="button" aria-label={l} onClick={() => step(d)} className="grid h-7 w-7 place-items-center rounded-full border border-line bg-surface text-lg leading-none text-ink-2 hover:bg-navy-soft">{g}</button>)}</div>}
    </section>);
}
const PAGE = 24;
const SCOPES = [["title", "Title & authors"], ["abstract", "Abstract"], ["half,one,two", "Full content"]];
function Chip({ on, onClick, children }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`min-h-10 rounded-full border px-3.5 py-1.5 text-sm transition ${on ? "border-action bg-action-fill text-white" : "border-line bg-surface text-ink-2 hover:border-action-2 hover:text-action"}`}>{children}</button>;
}
function Search({ q0 }) {
  const all = window.__S.articles;
  const [years, cats, issues] = useMemo(() => [[...new Set(all.map((a) => a.year))].sort((x, y) => x - y), [...new Set(all.flatMap((a) => a.categories))].sort(), new Map(all.map((a) => [issueKey(a), a.issue.label]))], [all]); // R206
  const [q, setQ] = useState(q0 || ""), [base, setBase] = useState(null);
  const [scope, setScope] = useState(SCOPES.flatMap((s) => s[0].split(","))), [cat, setCat] = useState([]), [subj, setSubj] = useState([]);
  const [from, setFrom] = useState(years[0]), [to, setTo] = useState(years.at(-1)), [author, setAuthor] = useState(""), [sort, setSort] = useState("relevance"), [view, setView] = useState("grid");
  const [open, setOpen] = useState(() => matchMedia("(min-width:1024px)").matches), [allSubj, setAllSubj] = useState(false), [last, setLast] = useState("");
  const [err, setErr] = useState(false);
  const gen = useRef(0); // a slower earlier search must not overwrite the later list
  const run = async (raw) => { const text = parseQuery(raw).text, g = ++gen.current; setErr(false); try { const r = text ? await searchArticles(text, { k: 200, fields: scope.join(",").split(",") }) : all.map((a) => ({ ...a, matched: [] })); if (g === gen.current) setBase(r); } catch { if (g === gen.current) { setErr(true); setBase([]); } } };
  useEffect(() => { setQ(q0 || ""); run(q0 || ""); setShown(PAGE); }, [q0, scope]);
  const ms = useModel().s; useEffect(() => { if (ms === "ready" && q0) run(q0); }, [ms]); // re-rank once the vectors are in
  const [issue, setIssue] = useState(""), [shown, setShown] = useState(PAGE);
  const au = author.trim().toLowerCase(), pq = parseQuery(q0);
  const hay = (a) => (a.title + " " + a.abstract + " " + (a.half || "") + " " + (a.one || "") + " " + (a.two || "")).toLowerCase();
  // A quoted phrase with no literal match is not a dead end: keep the words' ranking (the model ranks by meaning) and say so.
  const soft = pq.phrases.length > 0 && !!base && !base.some((a) => pq.phrases.every((x) => hay(a).includes(x)));
  const P = { op: (a) => (!pq.y || (a.year >= pq.y[0] && a.year <= pq.y[1])) && (!pq.author || by(a).toLowerCase().includes(pq.author)) && (!pq.phrases.length && !pq.neg.length || ((h) => (soft || pq.phrases.every((x) => h.includes(x))) && !pq.neg.some((x) => new RegExp("\\b" + x.replace(/[^\w-]/g, "") + "\\b").test(h)))(hay(a))), year: (a) => a.year >= from && a.year <= to, au: (a) => !au || by(a).toLowerCase().includes(au), subj: (a) => !subj.length || subj.every((s) => a.subjects.includes(s)), issue: (a) => !issue || issueKey(a) === issue, cat: (a) => !cat.length || a.categories.some((c) => cat.includes(c)) };
  // Facet lists show only what the other filters leave; the facet clicked last also ignores its own filter so more can be picked from it.
  const match = (skip) => (base || []).filter((a) => Object.entries(P).every(([k, f]) => k === skip || f(a)));
  const pre = match("cat"), res = pre.filter(P.cat), resCats = new Set(res.flatMap((a) => a.categories)); // res = match(""): reuse it (R156)
  const list = sort === "newest" ? [...res].sort((x, y) => y.year - x.year) : sort === "oldest" ? [...res].sort((x, y) => x.year - y.year) : sort === "title" ? [...res].sort((x, y) => x.title.localeCompare(y.title)) : res;
  const count = {}; pre.forEach((a) => a.categories.forEach((c) => { count[c] = (count[c] || 0) + 1; }));
  const sc = {}; (last === "subj" ? match("subj") : res).forEach((a) => a.subjects.forEach((s) => { sc[s] = (sc[s] || 0) + 1; }));
  const subjects = Object.entries(sc).sort((x, y) => y[1] - x[1]).slice(0, allSubj ? 60 : 14).map((x) => x[0]);
  const tog = (arr, set, v, f) => { setLast(f); set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]); };
  const fix =base && base.length <= 3 && pq.text ? didYouMean(pq.text) : null;
  const without = (raw) => "/search/" + encodeURIComponent(q0.replace(raw, " ").replace(/\s+/g, " ").trim());
  const topId = (q0 || cat.length || subj.length || au) && list[0]?.id; // the logo emblem opens the map from the top result while filters are set
  useEffect(() => { window.__top = topId || null; return () => { window.__top = null; }; }, [topId]);
  const [, bump] = useState(0), isSaved = q0 && saved().includes(q0);
  const toggleSave = () => { store("ijodel-saved", isSaved ? saved().filter((x) => x !== q0) : pushUniq(saved(), q0, 30)); bump((n) => n + 1); };
  const authors = [...new Set(match("au").flatMap((a) => a.authors))].sort();
  const shownCats = last === "cat" || !cat.length ? cats.filter((c) => count[c] || cat.includes(c)) : cats.filter((c) => resCats.has(c) || cat.includes(c));
  const yrs = new Set(match("year").map((a) => a.year)), shownYears = years.filter((y) => yrs.has(y) || y === from || y === to);
  const active = [...cat.map((c) => [c, () => tog(cat, setCat, c, "cat")]), ...subj.map((s) => [s, () => tog(subj, setSubj, s, "subj")]), ...(au ? [["Author: " + author, () => setAuthor("")]] : []), ...(issue ? [[issues.get(issue), () => setIssue("")]] : []), ...(from > years[0] || to < years.at(-1) ? [[`${from}–${to}`, () => { setFrom(years[0]); setTo(years.at(-1)); }]] : [])];
  const reset = () => { setCat([]); setSubj([]); setAuthor(""); setIssue(""); setFrom(years[0]); setTo(years.at(-1)); setScope(SCOPES.flatMap((s) => s[0].split(","))); };
  const lab = "mb-2 block text-xs font-bold uppercase tracking-wide text-ink-3";
  return (
    <section className="-mx-4 overflow-hidden sm:mx-0 sm:rounded-xl">
      <div className="bg-navy-fill px-4 pb-6 pt-8 text-white sm:px-8">
        <h1 className="font-serif text-3xl">Search</h1>
        <p className="mt-1 text-white/75">Search all {all.length} chapters; matches in a title count most, then the abstract, then the paper’s content. Best passages appear only when “Full content” is searched.</p>
        <SearchBox value={q} onChange={setQ} placeholder="Keywords or a question, e.g. micro-credentials" className="mt-4" btn="bg-action-2-fill hover:bg-action-fill" />
        <a href="#count" onClick={(e) => { e.preventDefault(); document.getElementById("count")?.focus(); }} className="skip">Skip to results</a>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-white/70">Search in:</span>
          {SCOPES.map(([k, l]) => { const on = scope.includes(k.split(",")[0]); return <button type="button" key={k} aria-pressed={on} onClick={() => { const f = k.split(","); const next = on ? scope.filter((x) => !f.includes(x)) : [...scope, ...f]; if (next.length) setScope(next); }} className={`min-h-11 rounded-full border px-4 ${on ? "border-sky bg-sky text-navy font-bold" : "border-white/50 text-white hover:bg-white/10"}`}>{on ? "✓ " : ""}{l}</button>; })}
        </div>
      </div>
      <div className="px-4 pt-5 sm:px-0 lg:grid lg:grid-cols-[17rem_1fr] lg:gap-8">
        <aside aria-label="Filters" className="mb-6 lg:mb-0">
          <button type="button" className="mb-3 min-h-11 w-full rounded-md border border-line bg-surface px-4 py-2 text-left font-bold text-ink lg:hidden" aria-expanded={open} onClick={() => setOpen(!open)}>Filters {active.length ? `(${active.length})` : ""} {open ? "▴" : "▾"}</button>
          <div className={`${open ? "" : "hidden"} space-y-6 rounded-xl border border-line bg-surface p-4 lg:block`}>
            <div><span className={lab}>Category</span><div className="flex flex-wrap gap-1.5">{shownCats.map((c) => <Chip key={c} on={cat.includes(c)} onClick={() => tog(cat, setCat, c, "cat")}>{c} <span className="opacity-60">{count[c] || 0}</span></Chip>)}</div></div>
            <div><span className={lab}>Year</span><div className="flex items-center gap-2">
              <select value={from} onChange={(e) => { const v = +e.target.value; setFrom(v); if (v > to) setTo(v); }} aria-label="From year" className="flex-1 rounded-md border border-line px-2 py-1.5">{shownYears.map((y) => <option key={y}>{y}</option>)}</select>–
              <select value={to} onChange={(e) => { const v = +e.target.value; setTo(v); if (v < from) setFrom(v); }} aria-label="To year" className="flex-1 rounded-md border border-line px-2 py-1.5">{shownYears.map((y) => <option key={y}>{y}</option>)}</select></div></div>
            <div><label className={lab} htmlFor="au">Author</label><input id="au" list="authors" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Type a name" className="w-full rounded-md border border-line px-3 py-1.5" /><datalist id="authors">{authors.map((x) => <option key={x} value={x} />)}</datalist></div>
            <div><label className={lab} htmlFor="iss">Issue (book)</label><select id="iss" value={issue} onChange={(e) => setIssue(e.target.value)} className="w-full rounded-md border border-line px-2 py-1.5"><option value="">All issues</option>{[...issues].sort((x, y) => y[0].localeCompare(x[0], undefined, { numeric: true })).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div><span className={lab}>Tags</span><div className="flex flex-wrap gap-1.5">{subjects.map((s) => <Chip key={s} on={subj.includes(s)} onClick={() => tog(subj, setSubj, s, "subj")}>{s}</Chip>)}</div>
              <button type="button" className="mt-2 text-sm text-link hover:underline" onClick={() => setAllSubj(!allSubj)}>{allSubj ? "Fewer" : "More tags"}</button></div>
            {active.length > 0 && <button type="button" onClick={reset} className="text-sm font-medium text-link hover:underline">Clear all filters</button>}
          </div>
        </aside>
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p id="count" tabIndex={-1} className="mr-auto text-sm text-ink-2" role="status" aria-atomic="true"><b>{list.length}</b> of {all.length} chapters{q0 ? <> for “{q0}”</> : ""}<span className="sr-only">{active.length ? `, ${active.length} filter${active.length > 1 ? "s" : ""}` : ""}, sorted by {{ relevance: q0 ? "relevance" : "default order", newest: "newest first", oldest: "oldest first", title: "title A to Z" }[sort]}</span></p>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm"><option value="relevance">{q0 ? "Most relevant" : "Default order"}</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select>
            {q0 && <button type="button" aria-pressed={!!isSaved} onClick={toggleSave} title={allow("prefs") ? "Saved on this device" : "Saved for this visit; allow search history and settings in Cookie settings to keep it"} className="min-h-10 rounded-md border border-line bg-surface px-3 text-sm text-link hover:bg-navy-soft disabled:opacity-40">{isSaved ? "★ Saved" : "☆ Save search"}</button>}
            <ViewToggle view={view} setView={setView} />
          </div>
          {pq.ops.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" aria-label="Query operators"><span className="text-ink-3">Query:</span>{pq.ops.map(([l, raw]) => <Link key={raw} to={without(raw)} aria-label={"Remove " + l} className="rounded-full border border-action-2/40 bg-crimson-soft px-3 py-1 text-link hover:underline">{l} ×</Link>)}</div>}
          {soft && <p role="status" className="mb-3 text-sm text-ink-2">No chapter contains that exact phrase, so these are the closest by meaning{ms === "ready" ? " (ranked with the language model)" : ""}.</p>}
          {!q0 && (saved().length > 0 || recents().length > 0) && <div className="mb-4 space-y-2 text-sm">{[["Saved searches", saved(), "ijodel-saved"], ["Recent searches", recents(), "ijodel-recent"]].map(([h, l, k]) => l.length > 0 && <p key={k} className="flex flex-wrap items-center gap-2"><span className="text-ink-3">{h}:</span>{l.map((x) => <Link key={x} to={"/search/" + encodeURIComponent(x)} className="rounded-full bg-navy-soft px-3 py-0.5 text-navy hover:underline">{x}</Link>)}<button type="button" onClick={() => { store(k, []); bump((n) => n + 1); }} className="min-h-9 px-1 text-link hover:underline">{k === "ijodel-saved" ? "Clear saved" : "Clear history"}</button></p>)}</div>}
          {active.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{active.map(([l, f]) => <button key={l} type="button" onClick={f} className="rounded-full bg-navy-soft px-3 py-1 text-sm text-navy hover:bg-sky/50" aria-label={"Remove filter " + l}>{l} ×</button>)}</div>}
          {fix && <p className="mb-4 rounded-md bg-navy-soft px-4 py-2 text-sm">Did you mean <Link to={"/search/" + encodeURIComponent(fix)} className="font-bold text-link underline">{fix}</Link>?</p>}
          {!q0 && <p className="mb-4 flex flex-wrap items-center gap-2 text-sm"><span className="text-ink-3">Popular tags:</span>{Object.entries(sc).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([s]) => <Link key={s} to={tagTo(s)} className="rounded-full bg-navy-soft px-3 py-0.5 text-navy hover:underline">{s}</Link>)}</p>}
          {err ? <div role="alert" className="rounded-xl border border-dashed border-line p-10 text-center text-ink-2"><p>The search data could not be loaded. Check your connection and try again.</p><button type="button" onClick={() => run(q0 || "")} className="mt-2 min-h-11 font-medium text-link hover:underline">Retry</button></div>
            : base === null ? <p role="status" className="rounded-xl border border-dashed border-line p-10 text-center text-ink-3">Searching…</p>
            : list.length === 0 ? <div className={EMPTY}><p>Nothing found{q ? ` for “${q}”` : ""}. Try fewer or different words, or widen the search:</p>
              <p className="mt-2 flex flex-wrap justify-center gap-x-4">{scope.length < SCOPES.flatMap((s) => s[0].split(",")).length && <button type="button" onClick={() => setScope(SCOPES.flatMap((s) => s[0].split(",")))} className="min-h-11 font-medium text-link hover:underline">Search in all fields</button>}
              {active.length > 0 && <button type="button" onClick={() => { const sc = scope; reset(); setScope(sc); }} className="min-h-11 font-medium text-link hover:underline">Clear {active.length} filter{active.length > 1 ? "s" : ""}</button>}
              {pq.ops.length > 0 && <Link to={"/search/" + encodeURIComponent(pq.text)} className="inline-flex min-h-11 items-center font-medium text-link hover:underline">Drop the query operators</Link>}
              {fix && <Link to={"/search/" + encodeURIComponent(fix)} className="inline-flex min-h-11 items-center font-medium text-link hover:underline">Search “{fix}”</Link>}
              <button type="button" onClick={reset} className="min-h-11 font-medium text-link hover:underline">Reset search and filters</button></p>
              <p className="mt-2 flex flex-wrap justify-center gap-2 text-sm"><span className="text-ink-3">Or browse a popular tag:</span>{Object.entries(all.flatMap((a) => a.subjects).reduce((m, t) => ((m[t] = (m[t] || 0) + 1), m), {})).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([t]) => <Link key={t} to={tagTo(t)} className="rounded-full bg-navy-soft px-3 py-0.5 text-navy hover:underline">{t}</Link>)}</p></div>
            : <>{q0 && <ResultIssues rows={list} />}{view === "grid" ? <ul className="grid-pubs">{list.slice(0, shown).map((a) => <Pub key={a.id} a={a} />)}</ul> : <ol className="cv-list space-y-4">{list.slice(0, shown).map((a) => <Card key={a.id} a={a} q={q0} />)}</ol>}</>}
          {list.length > shown && <div className="mt-6 text-center"><button type="button" onClick={() => setShown(shown + PAGE)} className="rounded-md bg-action-fill px-6 py-2.5 font-bold text-white hover:bg-action-2-fill">Show more ({list.length - shown} left)</button></div>}
        </div>
      </div>
    </section>
  );
}

const LENS = [["half", "Half page"], ["one", "1 page"], ["two", "2 pages"]];
// Abstract by default; the three AI summaries sit behind a toggle, with the disclaimer on top.
const NO_CITE = "Never cite from the AI-generated questions and answers. Check the chapter itself before citing it.";
function AiLabel() {
  return <abbr title={NO_CITE} tabIndex={0} aria-label={"AI-generated. " + NO_CITE} className="ml-1 inline-block cursor-help rounded bg-amber-100 px-1 text-2xs font-bold uppercase no-underline text-amber-950">AI</abbr>;
}
function NoCite({ what = "AI summary", className = "" }) {
  return <p role="note" className={`rounded-md border-l-4 border-amber-500 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950 ${className}`}>Never cite from the {what}. Check the chapter itself before citing it.</p>;
}
function Cite({ a }) {
  const [state, setState] = useState("idle"), [st, setSt] = useState(() => { try { return STYLES.some(([k]) => k === pref.get("ijodel-cite")) ? pref.get("ijodel-cite") : "apa"; } catch { return "apa"; } });
  const pick = (k) => { setSt(k); try { pref.set("ijodel-cite", k); } catch { /* no consent / private mode */ } };
  const text = styleText(a, st);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setState("copied"); setTimeout(() => setState("idle"), 2000); } catch { setState("manual"); } };
  return (
    <section aria-label="How to cite" className="mb-5 max-w-2xl rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2"><h2 className="text-2xs font-bold uppercase tracking-wide text-ink-3">How to cite</h2>
        <button type="button" onClick={copy} aria-label="Copy citation" title="Copy citation" className="grid min-h-9 min-w-9 place-items-center rounded-md px-2 text-sm font-medium text-link hover:bg-navy-soft">{state === "copied" ? "Copied ✓" : <Icon m="copy" w={2} className="h-[18px] w-[18px]" />}</button>
        <div role="group" aria-label="Citation style" className="ml-auto flex overflow-hidden rounded-md border border-line text-xs">{STYLES.map(([k, l]) => <button key={k} type="button" aria-pressed={st === k} onClick={() => pick(k)} className={`min-h-9 px-2.5 ${st === k ? "bg-action-fill text-white" : "bg-surface text-ink-2"}`}>{l}</button>)}</div>
        <span role="status" className="text-xs text-ink-2">{state === "copied" && <span className="sr-only">Citation copied to clipboard</span>}{state === "manual" && "Select the text and press Ctrl+C."}</span></div>
      <p className="mt-1 select-text whitespace-pre-line text-sm leading-normal text-ink-2 [overflow-wrap:anywhere]">{citeStyle(a, st).map((p, i) => p.i ? <i key={i}>{p.t}</i> : p.t)}</p>
    </section>);
}
function Overview({ a, mode, setMode }) {
  const [k, setK] = useState("half");
  useEffect(() => { setMode("abstract"); setK("half"); }, [a.id]);
  const seg = (on) => `min-h-10 px-3 ${on ? "bg-action-fill text-white" : "bg-surface text-ink-2"}`;
  const text = mode === "abstract" ? a.abstract || "No abstract available. Open the original article." : a[k] || "";
  return (
    <>
    <section className="mt-6">
      <Cite a={a} />
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-2"><h2 className="mr-auto font-serif text-2xl">{mode === "abstract" ? "Abstract" : "Summary"}</h2>
        <div role="group" aria-label="Show" className="flex overflow-hidden rounded-md border border-line text-sm">{[["abstract", "Abstract"], ["summary", "AI summary"]].map(([x, l]) => <button key={x} type="button" aria-pressed={mode === x} onClick={() => setMode(x)} className={seg(mode === x)}>{l}</button>)}</div>
        {mode === "summary" && <div role="group" aria-label="Summary length" className="flex overflow-hidden rounded-md border border-line text-sm">{LENS.map(([x, l]) => <button key={x} type="button" aria-pressed={k === x} onClick={() => setK(x)} className={seg(k === x)}>{l}</button>)}</div>}</div>
      {mode === "summary" && <p role="note" className="mt-3 rounded-md bg-crimson-soft px-3 py-2 text-sm text-ink-2"><b>AI-generated.</b> These summaries were written by a language model from the full text and may contain errors; check the original article.</p>}
      {mode === "summary" && <NoCite className="mt-2" />}
      <div className="mt-4 space-y-4 text-lg leading-8 text-ink">{text.split(/\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
    </section>
    {a.diff && <section aria-label="What sets this chapter apart" className="mt-8"><h2 className="border-b border-line pb-2 font-serif text-2xl">What sets this chapter apart<AiLabel /></h2>
        <NoCite what="AI comparison" className="mt-3" />
        <div className="mt-4 space-y-4 text-lg leading-8 text-ink">{a.diff.map((p, i) => <p key={i}>{p}</p>)}</div></section>}
    </>
  );
}
// Reader toolbar: sticky jump links to the page's sections, reading progress, previous/next in the issue, share.
const SIZES = [1, 1.15, 1.3];
function ReaderBar({ a, faq, z, setZ }) {
  const [pct, setPct] = useState(0), [msg, setMsg] = useState("");
  useEffect(() => { const f = () => { const h = document.documentElement.scrollHeight - innerHeight; setPct(h > 0 ? Math.round(Math.min(1, scrollY / h) * 100) : 100); }; f(); addEventListener("scroll", f, { passive: true }); addEventListener("resize", f); return () => { removeEventListener("scroll", f); removeEventListener("resize", f); }; }, [a.id]);
  const its = window.__S.articles.filter((b) => issueKey(b) === issueKey(a)), i = its.indexOf(a), prev = its[i - 1], next = its[i + 1];
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const share = async () => { const url = location.href; try { if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: a.title, url }); return; } await navigator.clipboard.writeText(url); setMsg("Link copied"); } catch (e) { if (e?.name !== "AbortError") setMsg("Copy the address bar to share"); } setTimeout(() => setMsg(""), 2500); };
  const btn = "min-h-10 rounded-full px-3 text-sm text-link hover:bg-navy-soft";
  return (
    <nav aria-label="On this page" className="sticky top-0 z-20 -mx-4 mt-3 border-b border-line bg-paper/95 px-4 py-1 backdrop-blur print:hidden">
      <div className="flex flex-wrap items-center gap-x-1">
        <button type="button" className={btn} onClick={() => jump("r-overview")}>Abstract</button>
        {faq && <button type="button" className={btn} onClick={() => jump("r-faq")}>Questions</button>}
        <button type="button" className={btn} onClick={() => jump("r-related")}>Related</button>
        <span className="ml-auto flex flex-wrap items-center gap-x-1">
          {prev && <Link to={"/read/" + prev.id} title={prev.title} className={btn + " inline-flex items-center"}>‹ Previous in issue</Link>}
          {next && <Link to={"/read/" + next.id} title={next.title} className={btn + " inline-flex items-center"}>Next in issue ›</Link>}
          <button type="button" onClick={share} className={btn}>Share link</button>
          <button type="button" onClick={() => print()} className={btn}>Print</button>
          <span role="group" aria-label="Text size" className="inline-flex">{[[-1, "A−", "Smaller text"], [1, "A+", "Larger text"]].map(([d, l, t]) => <button key={d} type="button" aria-label={t} title={t} disabled={!SIZES[z + d]} onClick={() => { setZ(z + d); pref.set("ijodel-text", String(z + d)); }} className={btn + " disabled:opacity-40"}>{l}</button>)}</span>
          <span role="status" className="text-xs text-ink-2">{msg}</span></span>
      </div>
      <div role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1 overflow-hidden rounded bg-line"><div className="h-full bg-action-2-fill" style={{ width: pct + "%" }} /></div>
    </nav>
  );
}
// The passage a search result pointed at (route /read/ID/p/PAGE/TERMS), highlighted and scrolled into view.
function AtPassage({ a, at }) {
  const [p, setP] = useState(undefined), ref = useRef(null);
  useEffect(() => { let live = true; pagePassage(a.id, at[0], at[1]).then((x) => live && setP(x), () => live && setP(null)); return () => { live = false; }; }, [a.id, at[0], at[1]]);
  useEffect(() => { if (p) { ref.current?.scrollIntoView({ block: "center" }); ref.current?.focus({ preventScroll: true }); } }, [p]);
  if (p === undefined) return null;
  return <section ref={ref} tabIndex={-1} id="r-passage" aria-label="Passage from your search" className="mt-6 scroll-mt-16 rounded-xl border-l-4 border-action-2 bg-sky/20 px-4 py-3">
    <h2 className="text-2xs font-bold uppercase tracking-wide text-ink-3">From your search · PDF page {at[0]}</h2>
    {p ? <p className="mt-1 text-lg leading-8 text-ink">{hl(p.text, p.terms)}</p> : <p className="mt-1 text-sm text-ink-2">That passage could not be loaded; open the original article and go to page {at[0]}.</p>}</section>;
}
// "Copy link" beside a reader section heading: #/read/ID/s/<section> opens the chapter at that section
function SecLink({ id, sec }) {
  const [ok, setOk] = useState(false);
  return <button type="button" onClick={() => navigator.clipboard.writeText(location.href.split("#")[0] + `#/read/${id}/s/${sec}`).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); }, () => {})} aria-label="Copy link to this section" title="Copy link to this section" className="min-h-8 rounded-full px-2 text-sm font-normal text-link hover:bg-navy-soft print:hidden">{ok ? "Copied" : "#"}</button>;
}
function Reader({ id, at, sec }) {
  const [z, setZ] = useState(() => Math.min(2, Math.max(0, +pref.get("ijodel-text") || 0)));
  const [mode, setMode] = useState("abstract"); // lifted: the Q&A no-cite note follows the Abstract/AI-summary toggle
  const a = window.__S.byId[id], faqs = useFaqs(a?.id); // hook before the early return
  useEffect(() => { if (sec) document.getElementById("r-" + sec)?.scrollIntoView(); }, [sec, faqs.length]);
  if (!a) return <p>We couldn’t find that chapter; it may have moved. <Link to="/search" className="text-link underline">Search the journal</Link> or <Link to="/" className="text-link underline">browse the catalogue</Link>.</p>;
  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <Crumbs trail={[["/", "Home"], ["/issues", "Issues"], ["/issue/" + issueKey(a), a.issue.label], [null, clip(a.title, 50)]]} />
        <div className="rise mt-3 flex gap-5"><div className="hidden w-36 shrink-0 sm:block"><Cover a={a} small /></div><div>
        {a.categories?.map((c) => <Link key={c} to={"/cat/" + slug(c)} className="mr-2 inline-block rounded-full bg-crimson-soft px-3 py-0.5 text-xs font-medium text-link hover:underline">{c}</Link>)}
        <h1 className="mt-2 font-serif text-3xl leading-tight">{a.title}</h1>
        <div className="mt-2 text-ink-3">{by(a)} · <Link to={"/issue/" + issueKey(a)} className="text-link underline">{a.issue.label}</Link></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{a.subjects.map((s) => tagN(s) > 1 ? <Link key={s} to={tagTo(s)} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-2 hover:border-action-2 hover:text-action">#{s}</Link> : <span key={s} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-2">#{s}</span>)}</div></div></div>
        <ReaderBar a={a} faq={faqs.length > 0} z={z} setZ={setZ} /><div className="max-w-[35rem]" style={{ zoom: SIZES[z] }}>
        {at && <AtPassage a={a} at={at} />}
        <div id="r-overview" className="scroll-mt-16"><Overview a={a} mode={mode} setMode={setMode} /></div>
        <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden"><AddBtn id={a.id} label className="!bg-navy-soft" /><Link to={"/maps/pub/" + a.id} className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-medium text-link hover:bg-navy-soft">Relationship map</Link>{(() => { const l = (getLists().find((x) => x.items.includes(a.id)) || { items: [] }).items, nx = l[l.indexOf(a.id) + 1]; return nx && window.__S.byId[nx] ? <Link to={"/read/" + nx} className="rounded-full border border-line px-4 py-2 text-sm font-medium text-link hover:bg-navy-soft">Next in my list →</Link> : null; })()}{a.url?.startsWith("https://") && <a href={a.url} target="_blank" rel="noopener noreferrer" className="rounded-full bg-action-fill px-5 py-2.5 text-sm font-medium text-white hover:bg-action-2-fill">Open the original article ↗</a>}</div>
        {faqs.length > 0 && <section id="r-faq" className="mt-10 scroll-mt-16"><h2 className="flex items-center gap-2 font-serif text-2xl">Questions this chapter answers <span className={BADGE_C} title="Generated by a language model; check the original article">AI</span><SecLink id={a.id} sec="faq" /></h2>
          {mode === "summary" && <NoCite what="AI-generated questions and answers" className="mt-3" />}
          {[["key", "Key questions"], ["topic", "By topic"]].map(([k, h]) => { const g = faqs.filter((f) => (f.kind || "key") === k); return g.length > 0 && <div key={k} data-faq-group={k}><h3 className="mt-5 text-sm font-bold uppercase tracking-wide text-ink-3">{h}</h3>
          <div className="mt-2 divide-y divide-line rounded-xl border border-line bg-surface">{g.map((f) => <details key={f.id} className="group p-4"><summary className="cursor-pointer font-medium">{f.about && <span className={BADGE_N + " mr-2"}>{f.about}</span>}{f.q}</summary><p className="mt-2 text-ink-2">{f.a} <AiLabel /></p><Ref f={f} /></details>)}</div></div>; })}</section>}
      </div></div>
      <aside id="r-related" className="scroll-mt-16"><h2 className="flex items-center gap-2 font-serif text-2xl">Related reading<SecLink id={a.id} sec="related" /></h2>
        <ul className="mt-3 space-y-3">{(a.related || []).map((r) => { const o = window.__S.byId[r.id]; return o && <li key={r.id} className="rounded-xl border border-line bg-surface p-4"><Link to={"/read/" + o.id} className="font-medium text-link hover:underline">{o.title}</Link><div className="mt-1 flex items-center gap-2"><div className="min-w-0 flex-1 text-xs text-ink-3">{by(o)} · {o.year}</div><AddBtn id={o.id} label /></div>{r.why && <p className="mt-2 text-sm text-ink-2">{r.why}</p>}</li>; })}</ul></aside>
    </article>
  );
}

// One error boundary per route: a crash shows a message with Retry instead of a blank page; a new route starts clean.
class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return <div role="alert" className="mx-auto max-w-xl p-8 text-center"><h1 className="font-serif text-2xl">Something went wrong on this page</h1><p className="mt-2 text-ink-2">{navigator.onLine ? "Try again, or go back to the catalogue." : "You seem to be offline. Reconnect and try again."}</p>
      <div className="mt-4 flex justify-center gap-3"><button type="button" onClick={() => this.setState({ err: null })} className="min-h-11 rounded-full bg-action-fill px-5 font-bold text-white hover:bg-action-2-fill">Retry</button><Link to="/" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-link">Home</Link></div></div>;
  }
}
const useOnline = () => { const [on, set] = useState(navigator.onLine); useEffect(() => { const f = () => set(navigator.onLine); addEventListener("online", f); addEventListener("offline", f); return () => { removeEventListener("online", f); removeEventListener("offline", f); }; }, []); return on; };
const ROUTES = ["privacy", "about", "read", "list", "issues", "topics", "advanced", "maps", "search", "cat", "year", "issue", "tag"];
function NotFound({ route }) {
  const [q, setQ] = useState(() => dec(route.replace(/%(?![0-9a-f]{2})/gi, "")).replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 60));
  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl">Page not found</h1>
      <p className="mt-2 text-ink-2">There is no page at “{route.slice(0, 80)}”. Search the journal instead, or open one of these:</p>
      <SearchBox value={q} onChange={setQ} placeholder="Search titles, tags, summaries, topics…" className="mt-4" />
      <p className="mt-4 flex flex-wrap gap-3 text-sm">{[["/", "Home"], ["/issues", "Issues"], ["/topics", "Topics"], ["/advanced", "Advanced search"], ["/maps", "Maps"]].map(([to, l]) => <Link key={to} to={to} className="rounded-full bg-navy-soft px-3 py-1 text-navy hover:underline">{l}</Link>)}</p>
    </section>
  );
}
// R204/R205: "/" focuses the main search box, "?" lists the shortcuts; neither fires in a field, with a modifier, or over another dialog
const KEYS = [["/", "Focus the search box"], ["Ctrl+Z / Ctrl+Shift+Z", "Undo / redo on the map and in Advanced search"], ["Arrow keys, Enter", "Move between map nodes; Enter explores from the selected one"], ["Alt+Left / Alt+Right", "Step through the chips of an Advanced search area"], ["?", "Show this list"]];
// R225: after two screens of scrolling, a Back to top button returns to the top and puts focus on <main>
function ToTop() {
  const [on, setOn] = useState(false), [lift, setLift] = useState(16);
  // lift the button above a bottom-docked cookie banner (it sits at the bottom from 640 px up and would cover the button)
  useEffect(() => { const f = () => { setOn(scrollY > 2 * innerHeight); const r = document.querySelector('[role=dialog][aria-label^="Cookie"]')?.getBoundingClientRect(); setLift(r && r.top > innerHeight / 2 ? innerHeight - r.top + 8 : 16); }; f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  return on && <button type="button" aria-label="Back to top" onClick={() => { scrollTo(0, 0); document.getElementById("main")?.focus({ preventScroll: true }); }} style={{ bottom: lift }} className="fixed right-4 z-30 min-h-11 rounded-full bg-action-fill px-4 text-sm font-bold text-white shadow hover:bg-action-2-fill print:hidden">↑ Top</button>;
}
function Shortcuts() {
  const d = useRef(null);
  useEffect(() => {
    const f = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input,textarea,select,[contenteditable]") || document.querySelector("dialog[open]")) return;
      if (e.key === "/") { const i = document.querySelector('input[role="combobox"]'); if (i) { e.preventDefault(); i.focus(); } }
      else if (e.key === "?") { e.preventDefault(); d.current?.showModal(); }
    };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  }, []);
  return (
    <dialog ref={d} aria-label="Keyboard shortcuts" className="m-auto w-full max-w-lg rounded-xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-ink-fill/50 print:hidden">
      <h2 className="font-serif text-xl">Keyboard shortcuts</h2>
      <ul className="mt-3 space-y-2 text-sm">{KEYS.map(([k, t]) => <li key={k}><kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{k}</kbd> {t}</li>)}</ul>
      <form method="dialog" className="mt-4 text-right"><button className="min-h-11 rounded-md bg-navy-fill px-4 text-white">Close</button></form>
    </dialog>
  );
}
export default function App() {
  const route = useHash(), [state, setState] = useState("loading");
  const [, setFaqTick] = useState(0);
  useEffect(() => { load().then((S) => { window.__S = S; setState("ok"); S.textsP.then(() => setFaqTick((n) => n + 1)); }).catch((e) => setState("Could not load the index: " + e.message)); }, []);
  const consent = useConsent(), online = useOnline(), [upd, setUpd] = useState(null);
  useEffect(() => { syncSW(); }, [consent?.prefs]);
  // R157: once the index is in, fetch the Maps and Advanced chunks while idle so those tabs open at once; weak devices skip it
  // shortcut: a fixed 1.5 s wait stands in for "first results rendered" (they land in ~0.3 s on a capable device); upgrade to a render signal if that changes
  useEffect(() => { if (state !== "ok" || weakDevice()) return; const t = setTimeout(() => (window.requestIdleCallback || setTimeout)(() => Object.values(LOAD).forEach((f) => f().catch(() => {})), { timeout: 2000 }), 1500); return () => clearTimeout(t); }, [state]);
  useEffect(() => { const f = (e) => setUpd(() => e.detail); addEventListener("ijodel-update", f); return () => removeEventListener("ijodel-update", f); }, []);
  // the semantic model is a third-party download: only with consent, and only once someone searches (box focus or a search route)
  useEffect(() => { if (state === "ok" && consent?.model && route.startsWith("/search/")) startModel(true); }, [state, consent?.model, route]);
  const parts = route.split("/").filter(Boolean);
  const art = state === "ok" && parts[0] === "read" ? window.__S.byId[parts[1]] : null;
  const PAGE = { search: "Search", advanced: "Advanced search", maps: "Maps", privacy: "Privacy notice", about: "About", issues: "Issues", topics: "Topics", list: "View lists" };
  const seoT = art ? art.title : PAGE[parts[0]] ? (parts[0] === "search" && parts[1] ? `Search: ${qcap(parts[1]).slice(0, 80)}` : PAGE[parts[0]]) : "";
  useSeo(seoT ? seoT + " | IJODeL" : "IJODeL — International Journal on Open and Distance e-Learning", art ? (art.abstract || art.half || "").replace(/\s+/g, " ").slice(0, 155) : "IJODeL: open-access scholarly articles on open and distance e-learning. Browse, search and read chapters by issue, topic and author.");
  return (
    <>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }} className="skip">Skip to content</a>
      <Header route={route} />
      {upd && <p role="status" className="bg-navy-soft px-4 py-2 text-center text-sm text-navy print:hidden">A new version of the site is ready. <button type="button" onClick={() => applyUpdate(upd)} className="ml-2 min-h-9 rounded-full bg-action-fill px-3 font-medium text-white">Reload</button></p>}
      {!online && <p role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950 print:hidden">You are offline. Pages already opened still work; new search data or chapters may not load until you reconnect.</p>}
      <main id="main" tabIndex={-1} className={parts[0] === undefined || state !== "ok" ? "min-h-[60vh]" : ["search", "advanced", "maps"].includes(parts[0]) ? "mx-auto max-w-6xl min-[1536px]:max-w-[88rem] px-4 py-8 sm:px-8" : "mx-auto max-w-5xl px-4 py-8"}>
        {state === "loading" ? <div className="mx-auto max-w-6xl min-[1536px]:max-w-[88rem] p-8" role="status" aria-label="Loading the journal index"><div className="skeleton h-64" /><div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton aspect-[3/4]" />)}</div></div> : state !== "ok" ? <div className="p-8" role="alert"><p>{state}</p>{!online && <p className="mt-1 text-ink-2">You are offline.</p>}<button type="button" onClick={() => location.reload()} className="mt-3 min-h-11 rounded-full bg-action-fill px-5 text-white">Retry</button></div> :
          <Boundary key={route.startsWith("/maps") ? "/maps" : route}>{parts[0] && !ROUTES.includes(parts[0]) ? <NotFound route={route} /> : parts[0] === "privacy" ? <Suspense fallback={<div className="skeleton h-[60vh]" role="status" aria-label="Loading" />}><Privacy /></Suspense> : parts[0] === "about" ? <Suspense fallback={<div className="skeleton h-[60vh]" role="status" aria-label="Loading" />}><About /></Suspense> : parts[0] === "read" ? <Reader id={parts[1]} at={parts[2] === "p" && /^\d+$/.test(parts[3] || "") ? [parts[3], dec(parts[4] || "")] : null} sec={parts[2] === "s" && /^(overview|faq|related)$/.test(parts[3] || "") ? parts[3] : null} /> : parts[0] === "list" ? (parts[1] === "share" ? <SharedList name={parts[2]} ids={parts[3]} /> : <MyList lid={parts[1]} />) : parts[0] === "issues" ? <Issues /> : parts[0] === "topics" ? <Topics /> : parts[0] === "advanced" ? <Suspense fallback={<><h1 className="font-serif text-3xl">Advanced search</h1><AdvIntro /><div className="skeleton mt-4 h-[85vh]" role="status" aria-label="Loading" /></>}><Advanced share={parts[1] === "s" ? parts[2] : null} /></Suspense> : parts[0] === "maps" ? <Suspense fallback={<><h1 className="font-serif text-3xl">Relationship map</h1><MapsIntro /><div className="skeleton mt-4 h-[85vh]" role="status" aria-label="Loading" /></>}><Maps kind={parts[1]} id={parts[2] && dec(parts[2])} /></Suspense> : parts[0] === "search" ? <Search q0={qcap(parts[1] || "")} /> :
          ["cat", "year", "issue", "tag"].includes(parts[0]) ? <Group kind={parts[0]} id={parts[1]} /> : <Browse />}</Boundary>}
      </main>
      <footer className="mt-10 bg-ink-fill text-sm text-white/80 print:hidden">
        <div className="mx-auto grid max-w-6xl min-[1536px]:max-w-[88rem] gap-8 px-4 py-8 sm:px-8 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <h2 className="font-serif text-lg text-white">IJODeL</h2>
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block"><img src={asset("img/cc-by.png")} width="88" height="31" alt="Creative Commons Attribution 4.0 licence" loading="lazy" /></a>
            <p className="mt-3">© {new Date().getFullYear()} International Journal on Open and Distance e-Learning · ISSN 2467-7469</p>
          </div>
          <div>
            <h2 className="font-serif text-lg text-white">Contact</h2>
            <address className="mt-3 not-italic leading-relaxed">UPOU IJODeL<br />3F UPOU Bldg., OVCAA, Los Baños, Laguna, Philippines 4031<br />(049) 536 6001<br /><a href="mailto:ijodel@upou.edu.ph" className="underline hover:text-white">ijodel@upou.edu.ph</a></address>
          </div>
          <div className="flex flex-wrap items-start gap-3 md:flex-col">
            <img src={asset("img/openaccess.png")} width="150" height="54" alt="Open Access" loading="lazy" className="rounded bg-surface p-1.5" />
            <a href="https://scholar.google.com/scholar?hl=en&as_sdt=0%2C5&q=site%3Aijodel.com" target="_blank" rel="noopener noreferrer" aria-label="IJODeL on Google Scholar (opens in a new tab)"><img src={asset("img/google-scholar.png")} width="150" height="105" alt="" loading="lazy" className="rounded bg-surface p-1.5" /></a>
            {consent?.counter && <a href="https://www.flagcounter.me/details/c0i" target="_blank" rel="noopener noreferrer"><img src="https://www.flagcounter.me/c0i/" alt="Flag Counter: visitors by country" referrerPolicy="no-referrer" className="max-w-[150px]" /></a>}
          </div>
        </div>
        <p className="border-t border-white/15 px-4 pt-4 text-center text-xs text-white/80"><a href="mailto:roque.almodiel@gmail.com?subject=A%20similar%20site%20for%20our%20repository" className="inline-flex min-h-11 items-center gap-2 underline hover:text-white"><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>Want a similar site for your repository, public or intranet? Email the developer.</a></p>
        <p className="px-4 pb-4 pt-1 text-center text-xs text-white/65">Proof of concept: summaries, questions and answers, and related-reading notes are AI-generated, so check the original. · <a href="#/about" className="underline hover:text-white">About</a> · <a href="#/privacy" className="underline hover:text-white">Privacy</a> · <button type="button" onClick={openCookieSettings} className="inline-block py-3 underline hover:text-white">Cookie settings</button></p>
      </footer>
      <CookieConsent />
      <ToTop />
      <Shortcuts />
    </>
  );
}
