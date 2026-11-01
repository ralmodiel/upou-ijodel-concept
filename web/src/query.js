// Query operators: "exact phrase", -word, author:name (or author:"two words"), year:2020 or year:2018-2020; each kept as a removable chip.
export const parseQuery = (q) => {
  const o = { phrases: [], neg: [], author: "", y: null, ops: [] };
  const text = (q || "").replace(/"([^"]+)"|(^|\s)-([\p{L}\p{N}][\p{L}\p{N}-]*)|\bauthor:("[^"]+"|\S+)|\byear:(\d{4})(?:-(\d{4}))?/giu, (m, ph, sp, ng, au, y1, y2) => {
    if (ph) { o.phrases.push(ph.toLowerCase()); o.ops.push([`“${ph}”`, m]); return " " + ph + " "; }
    if (ng) { o.neg.push(ng.toLowerCase()); o.ops.push(["not " + ng, m.trim()]); return " "; }
    if (au) { o.author = au.replace(/"/g, "").toLowerCase(); o.ops.push(["author: " + au.replace(/"/g, ""), m]); return " "; }
    o.y = [+y1, +(y2 || y1)].sort((a, b) => a - b); o.ops.push(["year: " + (o.y[0] === o.y[1] ? o.y[0] : o.y.join("–")), m]); return " ";
  }).replace(/\s+/g, " ").trim();
  // bool: the query for the Boolean predicate (boolq.js), with only author: and year: taken out
  return { ...o, text, bool: (q || "").replace(/\bauthor:("[^"]+"|\S+)|\byear:\d{4}(?:-\d{4})?/giu, " ") };
};
// URL entry (#/search?… and #/advanced?…): query or q, years from/to, dateFromYear/dateToYear (OJS) or f.dateIssued.min/max (DSpace)
export const urlEntry = (qs) => {
  const p = new URLSearchParams(qs), y = (...k) => { for (const x of k) { const v = parseInt(p.get(x), 10); if (v > 0 && v < 10000) return v; } return null; };
  return { q: p.get("query") ?? p.get("q") ?? "", from: y("from", "dateFromYear", "f.dateIssued.min"), to: y("to", "dateToYear", "f.dateIssued.max") };
};
// The text the Boolean predicate reads for a chapter, per searched field (the engine's fields: title = title + authors)
export const hayOf = (a, fields = ["title", "abstract", "half", "one", "two"]) => fields.map((f) => f === "title" ? a.title + " " + a.authors.join(" ") : a[f] || "").join("\n");
// The visible count, also for zero results: the query is echoed so a screenshot documents the search (PRISMA 2020 item 7)
export const countLine = (n, q, from, to) => `${n} result${n === 1 ? "" : "s"} for “${q}” (${from === to ? from : `${from}–${to}`})`;
// Newest first, case-insensitive de-duplication, at most n entries (recent searches 10, saved 30).
export const pushUniq = (list, q, n) => [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, n);
