// Citation styles vs hand-checked samples: node scripts/cite-check.mjs  -> "N checks, M FAIL", exit 1 on FAIL.
import { styleText, bibtex, ris } from "../src/cite.js";
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
];
let bad = 0;
for (const [n, got, want] of cases) if (got !== want) { bad++; console.log(`FAIL ${n}\n  got  ${got}\n  want ${want}`); }
console.log(`${cases.length} checks, ${bad} FAIL`); process.exit(bad ? 1 : 0);
