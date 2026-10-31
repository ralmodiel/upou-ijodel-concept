import { pref } from "./consent.js";
import { weakDevice } from "./device.js";
import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { recommend } from "./recommend.js";
import { adjacency, shortestPath } from "./graph.js";
import { AddBtn, Icon, Link, MapsIntro, clip, issueKey, lazyRetry, slug } from "./App.jsx";
import { AREAS, addChip, chipCount, setMode as setAdvMode, undo, useAdv } from "./Advanced.jsx";

// Relationship map: one seed (chapter, topic or author) and what surrounds it, drawn as SVG.
// the logo's circuit colours: cyan lines and nodes for chapters, navy outline
export const LOGO = { cyan: "#50e0f8", navy: "#283058", pale: "#c8dcdc" };
const COLOR = { pub: LOGO.cyan, tag: "#2f7d6d", category: "#c9791b", author: "#8e182e", issue: "#6b7fd7" };
const KIND_LABEL = { pub: "chapter", tag: "topic", category: "category", author: "author", issue: "issue" };
// priority of each relation kind: "Levels" follows the ticked options, and choosing a level ticks the first N tiers
const TIER = { tag: 1, tagrel: 1, rel: 2, rec: 2, category: 3, author: 4, issue: 5 };
const relKey = (r) => r.replace(/\d+ (items?|chapters?)/g, "# items").replace(/\d+/g, "#");
// legend swatch: same outline as the node when "Shapes by kind" is on
const Swatch = ({ k, shapes }) => <svg width="14" height="14" viewBox="-8 -8 16 16" aria-hidden="true" className="shrink-0" fill={COLOR[k]}>{shapes ? shape(k, 5.5) : <circle r="5.5" />}</svg>;
// one pass over the articles gives every count and tag pair the map needs (instead of a filter per node)
const idx = () => window.__S.mapIdx ||= (() => {
  const m = { subjects: new Map(), categories: new Map(), authors: new Map(), issue: new Map(), co: new Map() }, add = (f, k, a) => (m[f].get(k) || m[f].set(k, []).get(k)).push(a);
  for (const a of window.__S.articles) {
    a.subjects.forEach((t) => add("subjects", t, a)); a.categories.forEach((c) => add("categories", c, a)); a.authors.forEach((x) => add("authors", x, a)); add("issue", issueKey(a), a);
    const ts = [...new Set(a.subjects)].sort(); for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const k = ts[i] + "\u0001" + ts[j]; m.co.set(k, (m.co.get(k) || 0) + 1); }
  }
  return m;
})();
const OPTS = [["rel", "Related reading", "pub"], ["rec", "Recommended", "pub"], ["tag", "Tags", "tag"], ["tagrel", "Tag relations", "tag"], ["issue", "Same issue", "issue"], ["category", "Categories", "category"], ["author", "Authors", "author"]];
const load3D = () => import("./Graph3D.jsx");
const Graph3D = lazyRetry(load3D, (m) => m.default);
const W = 900, H = 600;

function build(kind, id, on) {
  const S = window.__S, nodes = new Map(), links = [];
  const node = (nid, k, label, n = 1, ref) => { if (!nodes.has(nid)) nodes.set(nid, { id: nid, kind: k, label, n, ref }); return nodes.get(nid); };
  const link = (s, t, rel) => { if (s !== t && !links.some((l) => (l.s === s && l.t === t) || (l.s === t && l.t === s))) links.push({ s, t, rel }); };
  const X = idx(), cnt = (f, v) => X[f].get(v)?.length || 0;
  const pub = (a) => node("p:" + a.id, "pub", a.title, 1, a.id);
  const tag = (t) => node("t:" + t, "tag", t, cnt("subjects", t), t);
  const cat = (c) => node("c:" + c, "category", c, cnt("categories", c), c);
  const auth = (x) => node("a:" + x, "author", x, cnt("authors", x), x);
  const iss = (a) => node("i:" + issueKey(a), "issue", S.issues[issueKey(a)]?.theme || a.issue.label, cnt("issue", issueKey(a)), issueKey(a));
  let seed;
  if (kind === "pub") {
    const a = S.byId[id]; if (!a) return null;
    seed = pub(a).id;
    if (on.tag) a.subjects.forEach((t) => link(seed, tag(t).id, "topic"));
    if (on.category) a.categories.forEach((c) => link(seed, cat(c).id, "category"));
    if (on.author) a.authors.forEach((x) => { link(seed, auth(x).id, "by"); S.articles.filter((b) => b.id !== a.id && b.authors.includes(x)).slice(0, 4).forEach((b) => link(auth(x).id, pub(b).id, "also wrote")); });
    if (on.rel) (a.related || []).forEach((r) => { const b = S.byId[r.id]; if (!b) return; link(seed, pub(b).id, clip(r.why || "related", 60)); if (on.tag) b.subjects.filter((t) => a.subjects.includes(t)).forEach((t) => link(pub(b).id, tag(t).id, "topic")); });
    if (on.issue) { const i = iss(a).id; link(seed, i, "issue"); S.articles.filter((b) => b.id !== a.id && issueKey(b) === issueKey(a)).slice(0, 8).forEach((b) => link(i, pub(b).id, "same issue")); }
  } else if (kind === "tag") {
    if (!S.articles.some((a) => a.subjects.includes(id))) return null;
    seed = tag(id).id;
    const arts = S.articles.filter((a) => a.subjects.includes(id)).sort((x, y) => y.year - x.year).slice(0, 14), co = new Map(), cc = new Map();
    arts.forEach((a) => { link(seed, pub(a).id, "topic"); a.subjects.forEach((t) => t !== id && co.set(t, (co.get(t) || 0) + 1)); a.categories.forEach((c) => cc.set(c, (cc.get(c) || 0) + 1)); if (on.author) link(pub(a).id, auth(a.authors[0]).id, "by"); });
    if (on.tag) [...co].sort((x, y) => y[1] - x[1]).slice(0, 8).forEach(([t, n]) => { link(seed, tag(t).id, `together in ${n} item${n > 1 ? "s" : ""}`); arts.filter((a) => a.subjects.includes(t)).forEach((a) => link(pub(a).id, tag(t).id, "topic")); });
    if (on.category) [...cc].forEach(([c, n]) => link(seed, cat(c).id, `${n} chapter${n > 1 ? "s" : ""}`));
    if (on.issue) arts.forEach((a) => link(pub(a).id, iss(a).id, "issue"));
  } else {
    if (!S.articles.some((a) => a.authors.includes(id))) return null;
    seed = auth(id).id;
    const arts = S.articles.filter((a) => a.authors.includes(id)).slice(0, 14), tg = new Map();
    arts.forEach((a) => { link(seed, pub(a).id, "wrote"); a.subjects.forEach((t) => tg.set(t, (tg.get(t) || 0) + 1)); if (on.author) a.authors.filter((x) => x !== id).forEach((x) => link(seed, auth(x).id, "co-author")); if (on.category) a.categories.forEach((c) => link(pub(a).id, cat(c).id, "category")); if (on.issue) link(pub(a).id, iss(a).id, "issue"); });
    if (on.tag) [...tg].sort((x, y) => y[1] - x[1]).slice(0, 8).forEach(([t, n]) => { link(seed, tag(t).id, `${n} chapter${n > 1 ? "s" : ""}`); arts.filter((a) => a.subjects.includes(t)).forEach((a) => link(pub(a).id, tag(t).id, "topic")); });
  }
  if (on.tagrel && on.tag) { // tags drawn on the map that also occur together in the journal: strongest pairs only
    const ts = [...nodes.values()].filter((n) => n.kind === "tag"), pairs = [];
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const [x, y] = [ts[i].label, ts[j].label].sort(), n = X.co.get(x + "\u0001" + y); if (n) pairs.push([ts[i].id, ts[j].id, n]); }
    pairs.sort((p, q) => q[2] - p[2]).slice(0, 14).forEach(([x, y, n]) => link(x, y, `together in ${n} item${n > 1 ? "s" : ""}`));
  }
  if (on.rec) { // items the recommender picks from the items on the map (same scoring as the View List page)
    const seeds = [...nodes.values()].filter((n) => n.kind === "pub").slice(0, 14).map((n) => S.byId[n.ref]).filter(Boolean);
    recommend(seeds, S.articles, 5).forEach(({ a, why }) => link(seed, pub(a).id, "recommended: " + (why[0] || "similar")));
  }
  return { seed, nodes: [...nodes.values()], links };
}

// Free layout: a force simulation run to rest. Rings layout: concentric by steps from the seed.
// 3D needs WebGL; without it (or if it throws) the whole page used to go white, so fall back to the 2D map
const canGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };
class Guard extends Component {
  state = { bad: false, why: "" };
  static getDerivedStateFromError(e) { return { bad: true, why: String(e?.message || e).slice(0, 160) }; }
  componentDidCatch(e) { console.error("3D map failed:", e); this.props.onFail(String(e?.message || e).slice(0, 160)); }
  render() { return this.state.bad ? <p role="alert" className="p-10 text-center text-ink-3">The 3D map could not start on this device. Showing the 2D map instead. <span className="block text-xs">Reason: {this.state.why}. If you have just updated the site, reload the page and try again.</span></p> : this.props.children; }
}
function layout(g, mode) {
  const ns = g.nodes.map((n) => ({ ...n, r: n.kind === "pub" ? 9 : 8 + Math.min(14, Math.sqrt(n.n) * 3), x: 0, y: 0 })), by = new Map(ns.map((n) => [n.id, n]));
  const ls = g.links.map((l) => ({ source: l.s, target: l.t, rel: l.rel })), relN = new Map(); // count of lines per relation kind, shown as rel(n) on the line
  for (const l of ls) if (l.rel) { const k = relKey(l.rel); relN.set(k, (relN.get(k) || 0) + 1); }
  for (const l of ls) if (l.rel) { const c = relN.get(relKey(l.rel)); l.tag = `${l.rel}(${c})`; l.w = 1 + Math.min(2.2, Math.log2(Math.max(+l.rel.match(/\d+/)?.[0] || 1, c)) * 0.55); if (/^same (collection|issue)/.test(l.rel)) { l.weak = true; l.w = 0.6; } } // line weight grows with the count, capped
  const deg = new Map(); for (const l of ls) for (const e of [l.source, l.target]) deg.set(e, (deg.get(e) || 0) + 1);
  ns.forEach((n) => { n.r += Math.min(6, Math.sqrt(deg.get(n.id) || 0) * 1.2); }); // busier nodes are bigger
  if (mode === "rings" || mode === "circuit") {
    const depth = new Map([[g.seed, 0]]), q = [g.seed];
    while (q.length) { const c = q.shift(); ls.forEach((l) => { const [x, y] = [l.source, l.target]; for (const [p, o] of [[x, y], [y, x]]) if (p === c && !depth.has(o)) { depth.set(o, depth.get(c) + 1); q.push(o); } }); }
    const rings = new Map(); ns.forEach((n) => { const d = depth.get(n.id) ?? 3; rings.set(d, [...(rings.get(d) || []), n]); });
    if (mode === "circuit") {
      // like the logo's circuit board: the seed in the middle, neighbours in columns left and right, one row each
      rings.forEach((arr, d) => { if (!d) return; [0, 1].forEach((s) => { const col = arr.filter((_, i) => i % 2 === s); col.forEach((n, i) => { n.x = (s ? 1 : -1) * d * 210; n.y = (i - (col.length - 1) / 2) * 58; }); }); });
    } else rings.forEach((arr, d) => arr.forEach((n, i) => { const a = (i / arr.length) * Math.PI * 2 - Math.PI / 2 + d; n.x = d ? Math.cos(a) * d * 150 : 0; n.y = d ? Math.sin(a) * d * 150 : 0; }));
  } else {
    ns.forEach((n, i) => { const a = i * 2.4; n.x = Math.cos(a) * 20 * Math.sqrt(i); n.y = Math.sin(a) * 20 * Math.sqrt(i); });
    const sim = forceSimulation(ns).force("link", forceLink(ls).id((n) => n.id).distance(75).strength(0.7)).force("charge", forceManyBody().strength(-260)).force("center", forceCenter(0, 0)).force("collide", forceCollide((n) => n.r + 12)).stop();
    for (let i = 0; i < 320; i++) sim.tick();
  }
  return { nodes: ns, by, links: ls.map((l) => ({ ...l, source: by.get(l.source.id || l.source), target: by.get(l.target.id || l.target) })) };
}

// a circuit trace between two nodes: straight runs with one 45-degree bend, as on the logo
const trace = (a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  if (!dx) return `M${a.x} ${a.y}h24v${dy}h-24`;
  return ax >= ay ? `M${a.x} ${a.y}h${sx * (ax - ay) / 2}l${dx > 0 ? ay : -ay} ${dy}h${sx * (ax - ay) / 2}` : `M${a.x} ${a.y}l${dx} ${sy * ax}v${dy - sy * ax}`;
};
// the corners of that trace, drawn as solder dots like the logo's bends
const bends = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, ax = Math.abs(dx), ay = Math.abs(dy), sx = Math.sign(dx), sy = Math.sign(dy);
  if (!dx) return dy ? [[a.x + 24, a.y], [a.x + 24, b.y]] : []; if (ax >= ay) { const x1 = a.x + sx * (ax - ay) / 2; return ay ? [[x1, a.y], [x1 + sx * ay, b.y]] : []; } return [[b.x, a.y + sy * ax]]; };
const shape = (k, r) => k === "tag" ? <rect x={-r} y={-r} width={2 * r} height={2 * r} rx="3" /> : k === "author" ? <polygon points={`0,${-r * 1.25} ${r * 1.15},${r * 0.9} ${-r * 1.15},${r * 0.9}`} /> : k === "category" ? <polygon points={`0,${-r * 1.3} ${r * 1.3},0 0,${r * 1.3} ${-r * 1.3},0`} /> : k === "issue" ? <rect x={-r * 1.2} y={-r * 0.8} width={r * 2.4} height={r * 1.6} rx="4" /> : <circle r={r} />;

function seedOptions(kind) {
  const S = window.__S;
  if (kind === "pub") return S.articles.map((a) => [a.title, a.id]);
  const m = new Map(); S.articles.forEach((a) => (kind === "tag" ? a.subjects : a.authors).forEach((v) => m.set(v, (m.get(v) || 0) + 1)));
  return [...m].sort((x, y) => y[1] - x[1]).map(([v]) => [v, v]);
}

export function Maps({ kind = "pub", id }) {
  const S = window.__S, { areas, past, mode: advMode } = useAdv(), svg = useRef(null);
  if (!["pub", "tag", "author"].includes(kind)) kind = "pub";
  useEffect(() => { if (id) pref.set("ijodel-map-seed", JSON.stringify({ kind, id })); }, [kind, id]);
  useEffect(() => { if (id) return; try { const q = JSON.parse(pref.get("ijodel-map-seed") || "null"); if (q && ["pub", "tag", "author"].includes(q.kind) && typeof q.id === "string" && q.id.length < 300 && seedOptions(q.kind).some(([, v]) => v === q.id)) location.replace(`#/maps/${q.kind}/${encodeURIComponent(q.id)}`); } catch { /* no saved seed */ } }, []);
  const seedId = id || S.articles[0].id;
  const [on, setOn] = useState({ rel: true, rec: true, tag: true, tagrel: false, issue: false, category: true, author: true }), [shapes, setShapes] = useState(true), [choice, setMode] = useState(null), [dim, setDim] = useState("2d"), g3 = useRef(null), [fail, setFail] = useState("");
  const lv = Math.max(1, ...OPTS.filter(([o]) => on[o]).map(([o]) => TIER[o])); // Levels follows the ticked options (and ticks follow it when chosen)
  const panel = useRef(null), [fs, setFs] = useState(false), [more, setMore] = useState(false), [th, setTh] = useState(false), [thX, setThX] = useState(0), [winH, setWinH] = useState(innerHeight), [winW, setWinW] = useState(document.documentElement.clientWidth), [pw, setPw] = useState(0);
  const nh = Math.max(520, Math.round(pw * H / W)); // 2D and 3D share the taller of the two heights
  useEffect(() => { const f = () => { setFs(document.fullscreenElement === panel.current); setWinH(innerHeight); setWinW(document.documentElement.clientWidth); }; document.addEventListener("fullscreenchange", f); addEventListener("resize", f); return () => { document.removeEventListener("fullscreenchange", f); removeEventListener("resize", f); }; }, []);
  useLayoutEffect(() => { setPw(panel.current?.clientWidth || 0); if (th) setThX(-panel.current.parentElement.getBoundingClientRect().left); }, [th, winW, fs]); // breakout offset: the panel sits in a column, theater spans the viewport
  useEffect(() => { if (!th) return; const k = (e) => { if (e.key === "Escape" && !document.fullscreenElement) setTh(false); }; addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [th]); // theater mode: Esc leaves it
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen(); else panel.current?.requestFullscreen?.(); };
  const [find, setFind] = useState(""), [found, setFound] = useState(""), [low, setLow] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.hardwareConcurrency || 8) <= 4 || weakDevice());
  const [sel, setSel] = useState(null), [hov, setHov] = useState(null), [view, setView] = useState({ x: 0, y: 0, k: 1 }), [text, setText] = useState("");
  const g = useMemo(() => build(kind, seedId, on), [kind, seedId, on]);
  const solo = (n) => n.kind === "tag" && n.n < 2 && n.id !== g?.seed; // a topic with one chapter is drawn but not clickable
  // Circuit (the logo's circuit board) is the default in 2D and 3D; Force only exists in 3D
  const want = choice ?? "circuit", mode = dim === "2d" && want === "force" ? "circuit" : want;
  const lay = useMemo(() => g && layout(g, mode), [g, mode]);
  const options = useMemo(() => seedOptions(kind), [kind]);
  useEffect(() => { setSel(null); setView({ x: 0, y: 0, k: 1 }); setText(kind === "pub" ? S.byId[seedId]?.title || "" : seedId); }, [kind, seedId]);
  useEffect(() => setView({ x: 0, y: 0, k: 1 }), [mode, on]);
  const go = (k, v) => { location.hash = `/maps/${k}/${encodeURIComponent(v)}`; };
  // Undo/redo of the map's own choices (seed, Show options, shapes, layout, view), like the Advanced filters
  const key = JSON.stringify({ kind, id: seedId, on, shapes, choice, dim }), hist = useRef({ past: [], future: [], cur: null, want: null }), [, bump] = useState(0);
  useEffect(() => {
    const h = hist.current, now = JSON.parse(key);
    if (!h.cur) { h.cur = now; return; }
    if (h.want) { if (JSON.stringify(h.want) === key) { h.want = null; h.cur = now; } return; } // still arriving at an undo/redo target
    if (JSON.stringify(h.cur) !== key) { h.past = [...h.past, h.cur].slice(-50); h.future = []; h.cur = now; bump((n) => n + 1); }
  }, [key]);
  const jump = (t) => { const h = hist.current; h.want = t; h.cur = t; setOn(t.on); setShapes(t.shapes); setMode(t.choice); setDim(t.dim); if (t.kind !== kind || t.id !== seedId) location.replace(`#/maps/${t.kind}/${encodeURIComponent(t.id)}`); bump((n) => n + 1); };
  const undoMap = () => { const h = hist.current; if (!h.past.length) return; const t = h.past.at(-1), c = h.cur; h.past = h.past.slice(0, -1); h.future = [c, ...h.future]; jump(t); };
  const redoMap = () => { const h = hist.current; if (!h.future.length) return; const [t, ...rest] = h.future, c = h.cur; h.future = rest; h.past = [...h.past, c]; jump(t); };
  useEffect(() => {
    const f = (e) => { if (!(e.ctrlKey || e.metaKey) || e.target.matches("textarea,select,input:not([type=checkbox],[type=radio])")) return; const k = e.key.toLowerCase(); if (k === "z") { e.preventDefault(); e.shiftKey ? redoMap() : undoMap(); } else if (k === "y") { e.preventDefault(); redoMap(); } };
    addEventListener("keydown", f); return () => removeEventListener("keydown", f);
  });
  const pick = (v) => { setText(v); const o = options.find(([l]) => l === v); if (o) go(kind, o[1]); };
  const adj = useMemo(() => lay ? adjacency(lay.links) : new Map(), [lay]);
  const focus = hov || sel, lit = focus && lay ? new Set([focus, ...(adj.get(focus) || []).map((e) => e[0])]) : null;
  // shortest path from the selection back to the seed (breadth-first): drawn bold and spelled out as "why connected"
  const path = useMemo(() => (!lay || !sel || sel === g.seed ? [] : shortestPath(adj, sel, g.seed)), [lay, sel, g, adj]); // seed first
  const onPath = new Set(path);
  // circuit polish: the seed emblem grows with its fan-in; a label goes on the node's outer side unless a trace leaves that way
  const deg = lay ? lay.links.filter((l) => l.source.id === g.seed || l.target.id === g.seed).length : 0, seedK = Math.min(2, 1 + deg / 30);
  const outward = useMemo(() => new Set(lay && mode === "circuit" ? lay.links.flatMap((l) => [[l.source, l.target], [l.target, l.source]]).filter(([a, b]) => Math.abs(b.x) > Math.abs(a.x) && Math.sign(b.x || 1) === Math.sign(a.x || 1)).map(([a]) => a.id) : []), [lay, mode]);
  const drag = useRef(null);
  const down = (e) => { drag.current = { x: e.clientX, y: e.clientY, v: view, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const move = (e) => { const d = drag.current; if (!d) return; const s = W / svg.current.getBoundingClientRect().width; if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true; setView({ ...d.v, x: d.v.x + (e.clientX - d.x) * s, y: d.v.y + (e.clientY - d.y) * s }); };
  const wheel = (e) => { e.preventDefault(); setView((v) => ({ ...v, k: Math.max(0.4, Math.min(3, v.k * (e.deltaY < 0 ? 1.12 : 0.89))) })); };
  // keyboard: + / - zoom, arrows pan, 0 resets (only when the map itself has focus, not a node)
  const mapKey = (e) => { if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return; const z = e.key === "+" || e.key === "=" ? 1.12 : e.key === "-" ? 1 / 1.12 : 0, a = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
    if (e.key === "0") setView({ x: 0, y: 0, k: 1 }); else if (z) setView((v) => ({ ...v, k: Math.max(0.4, Math.min(3, v.k * z)) })); else if (a) setView((v) => ({ ...v, x: v.x + a[0], y: v.y + a[1] })); else return; e.preventDefault(); };
  const wheelRef = useRef(wheel); wheelRef.current = wheel;
  // React's onWheel is passive, so preventDefault needs a native listener (page must not scroll while zooming)
  useEffect(() => { const el = svg.current; if (!el) return; const f = (e) => wheelRef.current(e); el.addEventListener("wheel", f, { passive: false }); return () => el.removeEventListener("wheel", f); }, [dim, !!lay]);
  const save = () => {
    if (dim === "3d") { const a = document.createElement("a"); a.download = "ijodel-map.png"; a.href = g3.current.png(); a.click(); return; }
    const s = new XMLSerializer().serializeToString(svg.current), img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2; const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); const a = document.createElement("a"); a.download = "ijodel-map.png"; a.href = c.toDataURL("image/png"); a.click(); };
    img.onerror = () => setFound("Could not save the image"); // R181: say so instead of doing nothing
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  };
  // Fit the whole graph in the frame; the user's zoom and pan sit on top of this.
  const fit = useMemo(() => { if (!lay) return { k: 1, cx: 0, cy: 0 }; const xs = lay.nodes.map((n) => n.x), ys = lay.nodes.map((n) => n.y), pad = 90, rx = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys) + pad; /* circuit: side labels take ~150 screen px whatever the zoom */ const lp = winW >= 640 && pw ? Math.min(330, 175 * W / pw) : 0; return { k: Math.min(2, (mode === "circuit" ? (W - 420 - lp) / (rx + pad * 2) : (W - lp) / (rx + pad * 2)), H / bh), cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, ox: (mode === "circuit" ? 60 : 0) + lp / 2 }; }, [lay, mode, winW, pw]); /* ox: keep labels clear of the top-left legend */
  const sc = view.k * fit.k, cur = lay?.by.get(sel);
  const chipOf = (n) => ({ pub: { k: "pub", v: n.ref, l: n.label }, tag: { k: "tag", v: n.ref, l: n.label }, category: { k: "category", v: n.ref, l: n.label }, author: { k: "author", v: n.ref, l: n.label }, issue: { k: "issue", v: n.ref, l: n.label } })[n.kind];
  const total = chipCount(areas), chipKeys = useMemo(() => new Set(AREAS.flatMap(([a]) => areas[a].map((c) => c.k + "\0" + c.v))), [areas]), inSearch = (n) => chipKeys.has(n.kind + "\0" + n.ref);
  const trunc = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
  return (
    <section>
      <h1 className="font-serif text-2xl sm:text-3xl">Relationship map</h1>
      {winW >= 640 ? <MapsIntro /> : <details><summary className="flex min-h-10 cursor-pointer items-center text-sm text-link">About this map</summary><MapsIntro /></details>}
      <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2 rounded-xl border border-line bg-surface p-3 sm:mt-4 sm:gap-y-3 sm:p-4">
        <div><span className="text-sm text-ink-3">Seed kind</span>
          <div className="mt-1 flex overflow-hidden rounded-md border border-line" role="group" aria-label="Seed kind">{[["pub", "Chapter"], ["tag", "Topic"], ["author", "Author"]].map(([k, l]) => <Link key={k} to={`/maps/${k}`} className={`inline-flex min-h-10 items-center px-4 text-sm ${kind === k ? "bg-action-fill text-white" : "text-ink-2 hover:bg-navy-soft"}`}>{l}</Link>)}</div></div>
        <label className="min-w-[14rem] flex-1 text-sm text-ink-3">Seed
          <input list="seeds" value={text} onChange={(e) => pick(e.target.value)} onFocus={(e) => e.target.select()} className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink" />
          <datalist id="seeds">{options.slice(0, 400).map(([l]) => <option key={l} value={l} />)}</datalist></label>
      </div>
      <div className={`mt-2 grid gap-4 sm:mt-4 grid-cols-[minmax(0,1fr)] ${th && !fs ? "" : "lg:grid-cols-[minmax(0,1fr)_20rem]"}`}>
        <div ref={panel} className={`overflow-hidden rounded-xl border border-line bg-surface ${fs ? "flex h-screen flex-col !rounded-none" : ""} ${th && !fs ? "relative !rounded-none" : ""}`} style={th && !fs ? { width: winW, marginLeft: thX } : undefined}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 text-sm"><span className="text-ink-3">Layout</span>
            <div className="flex overflow-hidden rounded-md border border-line">{[["circuit", "Circuit"], ...(dim === "3d" ? [["force", "Force"]] : []), ["rings", "Rings"]].map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`min-h-10 px-3 ${mode === k ? "bg-action-fill text-white" : "text-ink-2"}`}>{l}</button>)}</div>
            <span className="text-ink-3">View</span>
            <div className="flex overflow-hidden rounded-md border border-line">{[["3d", "3D"], ["2d", "2D"]].map(([k, l]) => <button key={k} type="button" aria-pressed={dim === k} onClick={() => { setFail(""); setDim(k); }} onMouseEnter={k === "3d" ? load3D : undefined} onFocus={k === "3d" ? load3D : undefined} className={`min-h-10 px-3 ${dim === k ? "bg-action-fill text-white" : "text-ink-2"}`}>{l}</button>)}</div>
            {fail && <p role="alert" className="w-full text-sm text-red-800">The 3D map could not start, so the 2D map is shown. Reason: {fail}. If the site was just updated, reload the page and try again.</p>}{dim === "3d" && <label className="inline-flex min-h-10 items-center gap-1.5 text-ink-2"><input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />Low power</label>}
<button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="min-h-10 rounded-md border border-line px-3 text-ink-2 sm:hidden">{more ? "Fewer" : "More"}</button>{(more || winW >= 640) && <><span className="inline-flex gap-1"><button type="button" onClick={undoMap} disabled={!hist.current.past.length} aria-keyshortcuts="Control+Z" title="Undo (Ctrl+Z)" className="min-h-10 rounded-md border border-line px-3 text-ink-2 disabled:opacity-40">↶ Undo</button><button type="button" onClick={redoMap} disabled={!hist.current.future.length} aria-keyshortcuts="Control+Shift+Z" title="Redo (Ctrl+Shift+Z or Ctrl+Y)" className="min-h-10 rounded-md border border-line px-3 text-ink-2 disabled:opacity-40">↷ Redo</button></span>
            <span className="ml-auto text-ink-3">{lay ? `${lay.nodes.length} nodes · ${lay.links.length} links` : ""}</span>
            <button type="button" onClick={() => (dim === "3d" ? g3.current?.reset() : setView({ x: 0, y: 0, k: 1 }))} className="min-h-10 rounded-md border border-line px-3">Reset view</button>
            <button type="button" onClick={save} className="min-h-10 rounded-md border border-line px-3">Save image</button></>}</div>
          <div className={`relative ${fs ? "min-h-0 flex-1" : ""}`}>
{(more || winW >= 640) && <fieldset className="z-10 flex flex-wrap gap-x-3 gap-y-0.5 border-b border-line bg-surface/95 px-3 py-1.5 text-xs sm:absolute sm:left-2 sm:top-2 sm:max-w-[15rem] sm:flex-col sm:rounded-lg sm:border sm:shadow"><legend className="sr-only">Show on the map</legend>
          <label className="mb-1 flex text-sm"><select aria-label="Levels" title="How many priority levels of relationships are drawn: 1 Tags, 2 + Related and Recommended, 3 + Categories, 4 + Authors, 5 + Same issue" value={lv} onChange={(e) => setOn(Object.fromEntries(OPTS.map(([k]) => [k, k !== "tagrel" && TIER[k] <= +e.target.value])))} className="min-h-10 w-full rounded-md border border-line bg-white px-2">{[[1, "1 · Tags"], [2, "2 · + Related"], [3, "3 · + Categories"], [4, "4 · + Authors"], [5, "5 · + Same issue"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          {OPTS.map(([k, l, c]) => <label key={k} title={k === "tagrel" && !on.tag ? "Needs Tags" : undefined} className={`flex min-h-10 sm:min-h-7 items-center gap-1.5 ${k === "tagrel" && !on.tag ? "opacity-50" : ""}`}><input type="checkbox" disabled={k === "tagrel" && !on.tag} checked={on[k] && !(k === "tagrel" && !on.tag)} onChange={() => setOn({ ...on, [k]: !on[k] })} /><Swatch k={c} shapes={shapes} />{l}</label>)}
          <label className="flex min-h-10 sm:min-h-7 items-center gap-1.5"><input type="checkbox" checked={shapes} onChange={() => setShapes(!shapes)} />Shapes by kind</label></fieldset>}
          {!lay ? <p className="p-10 text-center text-ink-3">Nothing to map for that seed. Pick another.</p> : dim === "3d" ?
            <Guard onFail={(why) => { setFail(why); setDim("2d"); }}><Suspense fallback={<p className="p-10 text-center text-ink-3">Loading 3D map…</p>}><Graph3D ref={g3} nodes={lay.nodes} links={lay.links} seed={g.seed} colors={COLOR} mode={mode} shapes={shapes} focus={focus} sel={sel} marked={inSearch} low={low} height={fs ? Math.max(360, winH - 140) : th ? Math.max(360, winH - 150) : nh} onSelect={(id) => { const n = id && lay.nodes.find((x) => x.id === id); if (!(n && solo(n))) setSel(id); }} onHover={setHov} /></Suspense></Guard> :
            <svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Relationship map" tabIndex={0} onKeyDown={mapKey} className={`block w-full select-none ${fs ? "h-full" : th ? "" : "h-auto"}`} style={{ touchAction: view.k > 1 ? "none" : "pan-y", ...(!fs ? { height: th ? Math.max(360, winH - 150) : nh } : {}), cursor: drag.current ? "grabbing" : "grab", background: "radial-gradient(circle, #eef1f7 1px, transparent 1px) 0 0/22px 22px" }}
              onPointerDown={down} onPointerMove={move} onPointerUp={() => { const m = drag.current?.moved; drag.current = null; if (!m) setSel(null); }}>
              <g transform={`translate(${W / 2 + (fit.ox || 0) + view.x} ${H / 2 + view.y}) scale(${view.k * fit.k}) translate(${-fit.cx} ${-fit.cy})`}>
                {lay.links.map((l, i) => { const f = (focus && (l.source.id === focus || l.target.id === focus)) || onPath.has(l); return <g key={i} data-path={onPath.has(l) || undefined} opacity={focus && !f ? 0.12 : 1}><title>{`${l.source.label} → ${l.rel || "linked"} → ${l.target.label}`}</title>
                  {mode === "circuit" ? <><path d={trace(l.source, l.target)} fill="none" strokeLinejoin="round" stroke={onPath.has(l) ? LOGO.navy : LOGO.cyan} strokeDasharray={l.weak ? "3 4" : undefined} strokeOpacity={f ? 1 : l.weak ? 0.4 : 0.75} strokeWidth={(l.w || 1) * (f ? 1.7 : 1.1)} />{bends(l.source, l.target).map(([x, y], j) => <circle key={j} cx={x} cy={y} r={2.6} fill={LOGO.navy} aria-hidden="true" />)}</> : <line x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} stroke={onPath.has(l) ? LOGO.navy : LOGO.cyan} strokeDasharray={l.weak ? "3 4" : undefined} strokeOpacity={f ? 1 : l.weak ? 0.4 : 0.65} strokeWidth={(l.w || 1) * (f ? 1.8 : 1)} />}
                  {l.rel && <text x={(l.source.x + l.target.x) / 2} y={(l.source.y + l.target.y) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={(f ? 10 : 9) / sc} fontStyle="italic" fill={f ? "#28345a" : "#5b6480"} stroke="#fff" strokeWidth={3 / sc} paintOrder="stroke">{trunc(l.tag || l.rel, f ? 44 : 28)}</text>}</g>; })}
                {lay.nodes.map((n) => { const dim = lit && !lit.has(n.id) && n.id !== focus, isSeed = n.id === g.seed, label = true; return (
                  <g key={n.id} data-node={n.id} {...(solo(n) ? {} : { tabIndex: 0, role: "button", "aria-pressed": n.id === sel })} aria-label={`${KIND_LABEL[n.kind]}: ${n.label}`} transform={`translate(${n.x} ${n.y})`} opacity={dim ? 0.4 : 1} style={{ cursor: solo(n) ? "default" : "pointer", transition: "opacity .2s" }}
                    onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); if (!solo(n)) setSel(n.id); }} onKeyDown={(e) => { if (solo(n)) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(n.id); } else if (e.key === "Escape") setSel(null); else if (/^Arrow/.test(e.key)) { e.preventDefault(); const all = [...svg.current.querySelectorAll("g[data-node][tabindex]")], i = all.indexOf(e.currentTarget); all[(i + (/Right|Down/.test(e.key) ? 1 : -1) + all.length) % all.length]?.focus(); } else if (e.key === "Home" || e.key === "End") { e.preventDefault(); const all = svg.current.querySelectorAll("g[data-node][tabindex]"); all[e.key === "Home" ? 0 : all.length - 1]?.focus(); } }} onMouseEnter={() => setHov(n.id)} onMouseLeave={() => setHov(null)} onFocus={() => setHov(n.id)} onBlur={() => setHov(null)}>
                    {isSeed && <g fill="none" aria-hidden="true" transform={`scale(${seedK})`}><circle r={n.r * 3.1} stroke={LOGO.navy} strokeWidth="1.3" strokeDasharray="1 4" strokeLinecap="round" /><circle r={n.r * 2.6} stroke={LOGO.cyan} strokeWidth="4" strokeDasharray="11 6" /><circle r={n.r * 2.3} stroke={LOGO.navy} strokeWidth="2" strokeDasharray="4 9" /><circle r={n.r * 2} stroke={LOGO.pale} strokeWidth="5" /></g>}
                    <g fill={COLOR[n.kind]} stroke={n.id === sel ? "#000" : inSearch(n) ? "#8a5a00" : n.kind === "pub" ? LOGO.navy : "#fff"} strokeWidth={n.id === sel || inSearch(n) ? 3 : 2} strokeDasharray={inSearch(n) && n.id !== sel ? "5 3" : undefined}>{shapes ? shape(n.kind, isSeed ? n.r * 1.4 * seedK : n.r) : <circle r={isSeed ? n.r * 1.4 * seedK : n.r} />}</g>
                    {label && <text {...(isSeed ? { y: n.r * 3.1 * seedK + 14 / sc, textAnchor: "middle" } : mode === "circuit" && n.x && !outward.has(n.id) ? { x: Math.sign(n.x) * (n.r + 6), y: 4 / sc, textAnchor: n.x < 0 ? "end" : "start" } : { y: n.r + 14 / sc, textAnchor: "middle" })} fontSize={(isSeed ? 13 : 11) / sc} fontWeight={isSeed ? 700 : 400} fill="#28345a" stroke="#fff" strokeWidth={3.5 / sc} paintOrder="stroke">{trunc(n.label, isSeed ? 44 : 26)}</text>}</g>); })}
              </g>
            </svg>}
          {!fs && <button type="button" onClick={() => setTh(!th)} aria-pressed={th} aria-label="Theater mode" title={th ? "Exit theater mode (Esc)" : "Theater mode: wide and tall, page stays visible"} className={`absolute bottom-2 right-14 z-10 grid h-10 w-10 place-items-center rounded-md border border-line bg-surface/95 shadow hover:text-action ${th ? "text-action" : "text-ink-2"}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="1.5" /></svg></button>}
          <button type="button" onClick={toggleFs} aria-label={fs ? "Exit full screen" : "Full screen map"} title={fs ? "Exit full screen" : "Full screen"} className="absolute bottom-2 right-2 z-10 grid h-10 w-10 place-items-center rounded-md border border-line bg-surface/95 text-ink-2 shadow hover:text-action"><Icon m={fs ? "shrink" : "expand"} w={2} className="h-5 w-5" /></button>
          {fs && cur && <div className="absolute bottom-2 left-2 z-10 max-w-[min(26rem,60%)] rounded-lg border border-line bg-surface/95 p-2 text-sm shadow"><span className="text-xs uppercase text-ink-3">{KIND_LABEL[cur.kind]}</span> <b>{trunc(cur.label, 70)}</b>{cur.kind === "pub" && <> · <Link to={"/read/" + cur.ref} className="text-link underline">Read</Link></>}{["pub", "tag", "author"].includes(cur.kind) && cur.id !== g.seed && <> · <button type="button" className="text-link underline" onClick={() => go(cur.kind, cur.ref)}>Explore from here</button></>}</div>}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-line px-3 py-2 text-xs">{Object.entries(KIND_LABEL).map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1"><Swatch k={k} shapes={shapes} />{l}</span>)}<span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1"><span className="h-0.5 w-5" style={{ background: LOGO.cyan }} />line = how two nodes relate (named on the line)</span><span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1"><span className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: LOGO.cyan }} />weak line = same collection or issue only</span><span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-[#f2b705]" />in your advanced search</span></div>
        </div>
        <aside className="space-y-4">
          <form role="search" onSubmit={(e) => { e.preventDefault(); const t = find.trim().toLowerCase(), m = t && lay?.nodes.find((n) => !solo(n) && n.label.toLowerCase().includes(t)); setFound(m ? "" : "No node matches"); if (m) { setSel(m.id); svg.current?.querySelector(`g[data-node="${CSS.escape(m.id)}"]`)?.focus(); } }} className="flex gap-2">
            <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a node on the map" aria-label="Find a node on the map" className="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-base" />
            <button className="min-h-11 rounded-md bg-navy-soft px-3 text-sm text-navy hover:bg-sky">Find</button></form>
          {found && <p role="status" className="text-sm text-ink-2">{found}</p>}
          <p role="status" className="sr-only">{(() => { const n = sel && lay?.nodes.find((x) => x.id === sel), c = (adj.get(sel) || []).length; return n ? `Selected ${KIND_LABEL[n.kind]}: ${trunc(n.label, 60)}, ${c} link${c === 1 ? "" : "s"}` : ""; })()}</p>
          <select aria-label="Select a node" value={sel || ""} onChange={(e) => setSel(e.target.value || null)} className="min-h-11 w-full rounded-md border border-line bg-surface px-3 text-base"><option value="">Select a node…</option>{lay?.nodes.map((n) => <option key={n.id} value={n.id}>{KIND_LABEL[n.kind]} · {trunc(n.label, 40)}</option>)}</select>
          <div className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Selection</h2>
            {!cur ? <p className="mt-2 text-sm text-ink-2">Click a node, or pick one from the list, to see its details, add it to the advanced search or explore from it.</p> : <div className="mt-2 text-sm">
              <p className="text-xs uppercase text-ink-3">{KIND_LABEL[cur.kind]}{cur.kind !== "pub" && ` · ${cur.n} chapter${cur.n === 1 ? "" : "s"}`}</p>
              <p className="font-serif text-lg leading-snug">{cur.label}</p>
              {cur.kind === "pub" && <p className="mt-1 text-ink-3">{S.byId[cur.ref].authors.join("; ")} · {S.byId[cur.ref].year}</p>}
              {path.length > 0 && <p data-why className="mt-2 text-ink-2"><span className="text-xs uppercase text-ink-3">Why connected: </span>{lay.by.get(g.seed).label}{(() => { let c = g.seed; return path.map((l) => { const o = l.source.id === c ? l.target : l.source; c = o.id; return ` → ${l.rel || "linked"} → ${o.label}`; }).join(""); })()}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {cur.kind === "pub" && <Link to={"/read/" + cur.ref} className="min-h-10 rounded-full bg-action-fill px-4 py-2 text-white">Read</Link>}{cur.kind === "pub" && <AddBtn id={cur.ref} label className="!bg-navy-soft" />}
                {["pub", "tag", "author"].includes(cur.kind) && cur.id !== g.seed && <button type="button" onClick={() => go(cur.kind, cur.ref)} className="min-h-10 rounded-full border border-action px-4 text-action">Explore from here</button>}
                {cur.kind === "category" && <Link to={"/cat/" + slug(cur.ref)} className="min-h-10 rounded-full border border-action px-4 py-2 text-action">Open category</Link>}
                {cur.kind === "issue" && <Link to={"/issue/" + cur.ref} className="min-h-10 rounded-full border border-action px-4 py-2 text-action">Open issue</Link>}
                {cur.kind === "tag" && <Link to={"/tag/" + encodeURIComponent(cur.ref)} className="min-h-10 rounded-full border border-line px-4 py-2">Open topic page</Link>}
              </div>
              <p className="mt-3 text-xs text-ink-3">Add to Advanced Search as</p>
              <div className="mt-1 flex flex-wrap gap-1.5">{AREAS.flatMap(([k, n]) => k === "exp" ? [[k, n, "any"], [k, "Additional", "one"]] : [[k, n]]).map(([k, n, md]) => <button key={n} type="button" title={md === "one" ? "Expand, with results needing at least one of these" : undefined} onClick={() => { if (md) setAdvMode(md); addChip(k, chipOf(cur)); }} className="min-h-9 rounded-full bg-navy-soft px-3 text-navy hover:bg-sky">{n}</button>)}</div>
            </div>}
          </div>
          {lay && <details className="rounded-xl border border-line bg-surface p-4 text-sm"><summary className="flex min-h-10 cursor-pointer items-center font-medium text-link">Node list (text version of the map)</summary>
            <ul aria-label="Nodes and their connections" className="mt-2 max-h-80 space-y-2 overflow-y-auto">{lay.nodes.map((n) => { const ls = (adj.get(n.id) || []).map((e) => e[1]);
              return <li key={n.id}>{solo(n) ? <span className="font-medium text-ink-2">{KIND_LABEL[n.kind]}: {trunc(n.label, 60)}</span> : <button type="button" aria-pressed={n.id === sel} onClick={() => setSel(n.id)} className="text-left font-medium text-link hover:underline">{KIND_LABEL[n.kind]}: {trunc(n.label, 60)}{n.id === g.seed ? " (seed)" : ""}</button>}{n.kind === "pub" && <AddBtn id={n.ref} className="!h-8 !w-8 !text-base ml-2 align-middle" />}
                <p className="text-xs text-ink-3">{ls.length} link{ls.length === 1 ? "" : "s"}: {ls.slice(0, 5).map((l) => `${l.rel || "linked"} ${trunc((l.source === n ? l.target : l.source).label, 30)}`).join("; ")}{ls.length > 5 ? "; …" : ""}</p></li>; })}</ul></details>}
          <div className="rounded-xl border border-line bg-surface p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Collected for Advanced Search <span className="ml-1 font-normal">{total}</span></h2>
            <ul className="mt-2 space-y-1 text-sm">{AREAS.flatMap(([k, n]) => areas[k].map((c) => <li key={k + c.k + c.v} className="line-clamp-1"><b className="font-medium text-ink-3">{n}</b> {c.l}</li>))}{!total && <li className="text-ink-3">Nothing yet.</li>}</ul>
            {past.length > 0 && <button type="button" onClick={() => undo()} className="mt-2 min-h-9 rounded-full border border-line px-3 text-sm">↶ Undo “{past.at(-1).m}”</button>}
            {areas.exp.length > 0 && <p className="mt-2 text-xs text-ink-3">Expand applies as: {advMode === "one" ? "Additional (at least one)" : "include any"} (kept for next time)</p>}
            <Link to="/advanced" className="mt-3 block min-h-11 rounded-md bg-link-fill px-4 py-2.5 text-center font-medium text-white hover:bg-link-2-fill">Back to Advanced Search ({total} item{total === 1 ? "" : "s"})</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
