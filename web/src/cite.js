// APA 7 journal-article reference for an IJODeL article, as parts so the display can italicise
// the journal and volume ({i:true}) while Copy gets plain text.
const JOURNAL = "International Journal on Open and Distance e-Learning";
const SUFFIX = /^(jr|sr|ii|iii|iv)\.?$/i;
const up = (c) => c.toUpperCase() + ".";
// "DL." / "T.K." are several initials; "Ma." / "Md." are abbreviations of one name.
const initials = (given) => given.split(/\s+/).filter(Boolean).map((w) => /^(ma|md)\.$/i.test(w) || !/^[A-Za-z]{2,3}\.$|^([A-Za-z]\.)+$/.test(w) ? w.split("-").map((p) => up(p[0])).join("-") : [...w.replace(/\./g, "")].map(up).join(" ")).join(" ");
// APA 7: initials only, and a suffix follows them ("Flor, A. B., Jr."); all-caps surnames are re-cased.
const name = (n) => {
  const [l, ...rest] = n.split(","); let sfx = "";
  const strip = (t) => t.split(/\s+/).filter((w) => SUFFIX.test(w) ? ((sfx = w.replace(/\.?$/, /^[js]r/i.test(w) ? "." : "")), false) : true).join(" ");
  const last = strip(l.trim()), g = strip(rest.join(",").trim()), fix = (t) => t === t.toUpperCase() && /[A-Z]{2}/.test(t) ? t.toLowerCase().replace(/(^|[\s-])\S/g, (m) => m.toUpperCase()).replace(/\b(Van|Von|Der|Den|De|Del|Dela|La|Le|Da|Di|Du)\s(?=\S)/g, (m) => m.toLowerCase()) : t;
  const out = g ? `${fix(last)}, ${initials(g)}` : fix(last);
  return sfx ? `${out}, ${sfx}` : out;
};
export function citeParts(a) {
  const names = a.authors.map(name), who = names.length > 1 ? names.slice(0, -1).join(", ") + ", & " + names.at(-1) : names[0] || "";
  const t = a.title.trim(), title = /[.?!]$/.test(t) ? t : t + ".";
  return [{ t: `${who} (${a.year}). ${title} ` }, { t: JOURNAL, i: true }, { t: ", " }, { t: String(a.issue.vol), i: true }, { t: `(${a.issue.no}). ${a.url}` }];
}
export const citeText = (a) => citeParts(a).map((p) => p.t).join("");
// BibTeX and RIS for a view list's chapters (export). Braces/newlines in fields are dropped so a title cannot break the entry.
const bib = (s) => String(s ?? "").replace(/[{}\\\n\r]/g, "");
export const bibtex = (as) => as.map((a) => `@article{ijodel${a.id},\n  author = {${bib(a.authors.join(" and "))}},\n  title = {${bib(a.title)}},\n  journal = {${JOURNAL}},\n  year = {${bib(a.year)}},\n  volume = {${bib(a.issue.vol)}},\n  number = {${bib(a.issue.no)}},\n  url = {${bib(a.url)}}\n}`).join("\n\n") + "\n";
export const ris = (as) => as.map((a) => ["TY  - JOUR", ...a.authors.map((x) => "AU  - " + bib(x)), "TI  - " + bib(a.title), "JO  - " + JOURNAL, "PY  - " + bib(a.year), "VL  - " + bib(a.issue.vol), "IS  - " + bib(a.issue.no), "UR  - " + bib(a.url), "ER  - "].join("\r\n")).join("\r\n") + "\r\n";
// MLA 9 and Chicago author-date use full names as printed ("Last, Given" first, "Given Last" after); APA uses initials.
const full = (n, first) => { const [l, ...g] = n.split(","), given = g.join(",").trim(); return !given ? l.trim() : first ? `${l.trim()}, ${given}` : `${given} ${l.trim()}`; };
// the first name is inverted ("Cruz, Ana"), so even two authors take a comma before "and"
const andList = (ns) => ns.length > 1 ? ns.slice(0, -1).join(", ") + ", and " + ns.at(-1) : ns[0] || "";
const dot = (t) => (/[.?!]$/.test(t.trim()) ? t.trim() : t.trim() + ".");
export function citeStyle(a, style) {
  if (style === "mla") {
    const who = a.authors.length > 2 ? full(a.authors[0], true) + ", et al" : andList(a.authors.map((n, i) => full(n, !i)));
    return [{ t: `${dot(who)} “${dot(a.title)}” ` }, { t: JOURNAL, i: true }, { t: `, vol. ${a.issue.vol}, no. ${a.issue.no}, ${a.year}, ${a.url}.` }];
  }
  if (style === "chicago") return [{ t: `${dot(andList(a.authors.map((n, i) => full(n, !i))))} ${a.year}. “${dot(a.title)}” ` }, { t: JOURNAL, i: true }, { t: ` ${a.issue.vol} (${a.issue.no}). ${a.url}.` }];
  return citeParts(a);
}
export const STYLES = [["apa", "APA"], ["mla", "MLA"], ["chicago", "Chicago"]];
export const styleText = (a, s) => citeStyle(a, s).map((p) => p.t).join("");
