import { useEffect, useState } from "react";

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
