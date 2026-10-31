// Query operators: "exact phrase", -word, author:name (or author:"two words"), year:2020 or year:2018-2020; each kept as a removable chip.
export const parseQuery = (q) => {
  const o = { phrases: [], neg: [], author: "", y: null, ops: [] };
  const text = (q || "").replace(/"([^"]+)"|(^|\s)-([\p{L}\p{N}][\p{L}\p{N}-]*)|\bauthor:("[^"]+"|\S+)|\byear:(\d{4})(?:-(\d{4}))?/giu, (m, ph, sp, ng, au, y1, y2) => {
    if (ph) { o.phrases.push(ph.toLowerCase()); o.ops.push([`“${ph}”`, m]); return " " + ph + " "; }
    if (ng) { o.neg.push(ng.toLowerCase()); o.ops.push(["not " + ng, m.trim()]); return " "; }
    if (au) { o.author = au.replace(/"/g, "").toLowerCase(); o.ops.push(["author: " + au.replace(/"/g, ""), m]); return " "; }
    o.y = [+y1, +(y2 || y1)].sort((a, b) => a - b); o.ops.push(["year: " + (o.y[0] === o.y[1] ? o.y[0] : o.y.join("–")), m]); return " ";
  }).replace(/\s+/g, " ").trim();
  return { ...o, text };
};
