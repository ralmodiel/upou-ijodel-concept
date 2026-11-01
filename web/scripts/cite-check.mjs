// Citation styles vs hand-checked samples: node scripts/cite-check.mjs  -> "N checks, M FAIL", exit 1 on FAIL.
import fs from "node:fs";
import { styleText, bibtex, ris, csv } from "../src/cite.js";
const A = (authors) => ({ id: "7", authors, title: "Learning online: a study", year: 2020, issue: { vol: 6, no: "1" }, url: "https://ijodel.com/x" });
const J = "International Journal on Open and Distance e-Learning";
const cases = [
  ["apa 1", styleText(A(["Cruz, Ana Maria"]), "apa"), `Cruz, A. M. (2020). Learning online: a study. ${J}, 6(1). https://ijodel.com/x`],
  ["apa 3", styleText(A(["Cruz, Ana", "Reyes, Ben", "Lim, Cy"]), "apa"), `Cruz, A., Reyes, B., & Lim, C. (2020). Learning online: a study. ${J}, 6(1). https://ijodel.com/x`],
  ["mla 2", styleText(A(["Cruz, Ana Maria", "Reyes, Ben"]), "mla"), `Cruz, Ana Maria, and Ben Reyes. “Learning online: a study.” ${J}, vol. 6, no. 1, 2020, https://ijodel.com/x.`],
  ["mla 3+", styleText(A(["Cruz, Ana", "Reyes, Ben", "Lim, Cy"]), "mla"), `Cruz, Ana, et al. “Learning online: a study.” ${J}, vol. 6, no. 1, 2020, https://ijodel.com/x.`],
  ["chicago 3", styleText(A(["Cruz, Ana", "Reyes, Ben", "Lim, Cy"]), "chicago"), `Cruz, Ana, Ben Reyes, and Cy Lim. 2020. “Learning online: a study.” ${J} 6 (1). https://ijodel.com/x.`],
  ["bibtex", bibtex([A(["Cruz, Ana"])]).includes("author = {Cruz, Ana}") && bibtex([A(["Cruz, Ana"])]).includes("@article{ijodel7,"), true],
  ["ris", ris([A(["Cruz, Ana"])]).startsWith("TY  - JOUR\r\nAU  - Cruz, Ana\r\n"), true],
  // R158: a hostile title cannot close a BibTeX field or start a new RIS tag line (no CSV export exists, so no formula cells)
  ["hostile title", ((x) => bibtex([x]).includes("title = {=cmd XER  - TY  - BOOK}") && ris([x]).split("\r\n").filter((l) => /^(TY|ER)  - /.test(l)).length === 2)({ ...A(["Cruz, Ana"]), title: "=cmd} X\r\nER  - \nTY  - BOOK{" }), true],
  // whole-result export: CSV quotes every field, keeps the stable id, and defuses formula cells; RIS carries the abstract
  ["csv", csv([{ ...A(["Cruz, Ana", "Lim, Cy"]), title: '=HYPERLINK("x") "q"', abstract: "Line one\nline two" }]).split("\r\n")[1], `"https://ijodel.com/x","'=HYPERLINK(""x"") ""q""","Cruz, Ana; Lim, Cy","2020","${J}","6","1","","Line one line two"`],
  ["ris abstract", ris([{ ...A(["Cruz, Ana"]), abstract: "A\nB" }]).includes("\r\nAB  - A B\r\nER  - "), true],
  // R160: particles keep lower case, suffixes follow initials, an all-caps surname is re-cased around the particle
  ["particle", styleText(A(["van der Berg, Jan"]), "apa").startsWith("van der Berg, J. ("), true],
  ["caps particle", styleText(A(["DE LA CRUZ, ANA"]), "apa").startsWith("de la Cruz, A. ("), true],
  ["suffix", styleText(A(["Cruz, Ana, Jr."]), "apa").startsWith("Cruz, A., Jr. ("), true],
  ["roman suffix", styleText(A(["Cruz, Ana III"]), "apa").startsWith("Cruz, A., III ("), true],
  // every real author: no empty, undefined or lone-dot initial in the APA name
  ["all authors", (() => { const arts = JSON.parse(fs.readFileSync(new URL("../public/index/articles.json", import.meta.url), "utf8")); return arts.filter((a) => a.authors?.length).flatMap((a) => a.authors).filter((n) => /undefined|(^|[\s,])\.|\s,|,\s*$|\(\s/.test(styleText(A([n]), "apa").split(" (2020")[0])).slice(0, 5); })(), []],
];
let bad = 0;
for (const [n, got, want] of cases) if (JSON.stringify(got) !== JSON.stringify(want)) { bad++; console.log(`FAIL ${n}\n  got  ${got}\n  want ${want}`); }
console.log(`${cases.length} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
