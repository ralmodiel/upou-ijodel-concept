import { useEffect, useRef, useState } from "react";

// Cookie / storage consent. Nothing but the choice itself is written to the device until the visitor allows it:
//   lists: the view lists only (localStorage)
//   prefs: search history and settings: advanced-search filters, saved and recent searches, citation style, text size, offline copy (localStorage)
//   (undo/redo never needs either: its history lives in memory for the visit)
//   model: download of the semantic-search model from Hugging Face (a third party sees the visitor's IP)
//   counter: the journal's Flag Counter visit counter (flagcounter.me counts visitors by IP and country)
const K = "ijodel-consent", mem = new Map(), subs = new Set();
const read = () => { try { const v = JSON.parse(localStorage.getItem(K)); return v && typeof v === "object" ? { prefs: !!v.prefs, lists: v.lists === undefined ? !!v.prefs : !!v.lists, model: !!v.model, counter: !!v.counter } : null; } catch { return null; } };
let c = read(); // null = not decided yet
export const allow = (k) => !!c?.[k];
const cls = (k) => (/^ijodel-lists?$/.test(k) ? "lists" : "prefs"); // which consent a stored key belongs to
export function setConsent(v) {
  c = { prefs: !!v.prefs, lists: !!v.lists, model: !!v.model, counter: !!v.counter };
  try {
    localStorage.setItem(K, JSON.stringify({ ...c, at: new Date().toISOString() }));
    mem.forEach((val, k) => { if (allow(cls(k))) localStorage.setItem(k, val); });
    Object.keys(localStorage).filter((k) => k.startsWith("ijodel-") && k !== K && !allow(cls(k))).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked: choices last for this visit only */ }
  if (!c.model) dropModelCache();
  subs.forEach((f) => f());
}
// Model files (Cache Storage, transformers.js) and the passage vectors (IndexedDB) are kept only under the model consent.
const dropModelCache = () => { try { ["transformers-cache", "experimental_transformers-hash-cache"].forEach((n) => caches?.delete(n)); indexedDB?.deleteDatabase("ijodel"); } catch { /* ignore */ } };
export const forgetConsent = () => { c = null; dropModelCache(); try { localStorage.removeItem(K); } catch { /* ignore */ } subs.forEach((f) => f()); };
export function useConsent() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  return c;
}
// Preference storage: the device only when allowed, otherwise memory for this visit.
export const pref = {
  get(k) { const v = allow(cls(k)) ? (() => { try { return localStorage.getItem(k); } catch { return null; } })() : mem.get(k) ?? null; return v && v.length > 200000 ? null : v; }, // oversized: ignore
  set(k, v) { mem.set(k, v); if (allow(cls(k))) { try { localStorage.setItem(k, v); } catch { /* private mode */ } } },
};

// R144/R145: modal dialog behaviour shared by the Find filters and Cookie settings dialogs: focus moves in, Tab wraps inside, closing returns focus to the opener.
export function useDialog(box) {
  const opener = useRef(document.activeElement); // read during the first render: an autoFocus input has already stolen focus by the time effects run
  useEffect(() => {
    const prev = opener.current, items = () => [...box.current.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex]:not([tabindex="-1"])')];
    if (!box.current.contains(document.activeElement)) items()[0]?.focus();
    const tab = (e) => {
      if (e.key !== "Tab" || !box.current) return;
      const l = items(), a = document.activeElement; if (!l.length) return e.preventDefault();
      if (!box.current.contains(a) || (e.shiftKey && a === l[0]) || (!e.shiftKey && a === l[l.length - 1])) { e.preventDefault(); l[e.shiftKey ? l.length - 1 : 0].focus(); }
    };
    addEventListener("keydown", tab);
    return () => { removeEventListener("keydown", tab); if (prev?.isConnected) prev.focus(); };
  }, []);
}
