// Search quality (run in web/): node scripts/search-eval.mjs [--no-vec] [--min1 0.93] [--min5 0.98]
// 100 query -> expected-article pairs through engine.searchArticles, twice: BM25 only (floor: --bm1 0.8 --bm5 0.9), then hybrid
// with the bge-small vector model (node, downloaded/cached by transformers.js; --no-vec skips it; gate --min1 0.93 --min5 0.98).
import fs from "node:fs"; import path from "node:path";
const dir = path.resolve(import.meta.dirname, "../public/index");
globalThis.fetch = async (u) => { const b = fs.readFileSync(path.join(dir, u.split("/index/")[1])); return { json: async () => JSON.parse(b), arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; };
const E = await import("../src/engine.js"); await E.load();
const SET = [
  // titles
  ["HiStorya game based mobile learning", "8"], ["teacher readiness for online teaching critical review", "18"],
  ["talk to them not at them", "21"], ["augmented reality nursing education", "24"], ["smart lecture video production", "36"],
  ["Ask Iska IskOU chatbot", "45"], ["virtual reality maritime education", "58"], ["Is the University of Makati e-Ready", "98"],
  ["ChatGPT threat or aid", "250"], ["micro-credentials in AI for assessment", "330"], ["oral examination OREX", "298"],
  ["predatory journal", "56"], ["MOOC readiness Pangasinan", "78"], ["conjoint study segmentation online learning", "108"],
  // authors
  ["Kondo", "36"], ["Phan Thanh", "18"], ["Bonito", "27"], ["Queroda", "78"], ["Oyeleke", "227"], ["Aigbovo", "286"],
  ["Magtoto", "250"], ["Serrano chatbot", "45"], ["Arumugam", "42"], ["Lapesigue", "273"],
  // topics
  ["cognitive load theory multimedia courseware", "27"], ["open educational resources cost savings", "42"],
  ["flipped learning videos instructors", "64"], ["Discord social presence", "294"], ["computer-based simulation", "75"],
  ["Community of Inquiry K-12 blended", "33"], ["indigenous knowledge management", "15"], ["Facebook personal learning environment", "39"],
  // typos
  ["augmentd realty nursing", "24"], ["chatgtp teaching", "250"], ["histroya game", "8"], ["maritme virtual realty", "58"],
  // questions
  ["how do students rate learner satisfaction in online learning", "227"], ["what are the gaps in learner support services", "286"],
  ["how did COVID-19 affect quality of study life of UPLB students", "266"], ["what is the effect of digital literacy on senior high school", "273"],
  // v2 (round 55): meaning without title words (the vector half), Taglish, more typos, authors, questions
  ["using smartphones to teach young children", "7"], ["game app for learning Philippine history", "8"], ["future teachers attitudes toward phone-based learning", "9"],
  ["history of the open university in the Philippines", "10"], ["cell biology DNA transcription simulations", "20"], ["wildlife habitat connectivity mapping", "22"],
  ["English speaking class innovations Vietnam", "25"], ["Indonesia open university online communication", "26"], ["helpdesk tickets for student concerns", "34"],
  ["graduates employment follow-up environment program", "35"], ["board exam review center distance learning", "37"], ["Facebook analytics engagement in Moodle", "38"],
  ["natural disasters affecting online learners", "47"], ["reducing waiting time for student transactions", "50"], ["social work field placement online", "68"],
  ["teaching PE online during pandemic", "109"], ["website traffic analytics for course design", "111"], ["digital twins in education", "229"],
  ["grammar test of Filipino online English tutors", "230"], ["virtual conference booth in metaverse", "280"], ["dance teaching flexible learning", "300"],
  ["validating the community of inquiry questionnaire", "304"], ["intercultural communication in global virtual teams", "295"], ["older learners intergenerational graduates", "268"],
  ["students wellbeing pandemic shift to remote learning", "89"], ["bioinformatics software for distance courses", "32"], ["chatbot answering student inquiries", "45"],
  ["faculty views on using ChatGPT in higher education", "249"], ["Rizal life and works academic performance", "265"],
  ["paggamit ng ChatGPT sa pagtuturo", "250"], ["kahandaan sa MOOC ng Pangasinan", "78"], ["augmented reality para sa nursing", "24"], ["virtual reality sa maritime", "58"],
  ["mga hamon sa reflective writing ng graduate students", "31"], ["epekto ng COVID-19 sa quality of study life ng UPLB", "266"], ["paano ginagamit ang Google Classroom", "293"],
  ["online na pagsusulit oral examination", "298"], ["chatbot ng UPOU", "45"], ["digital literacy ng senior high", "273"],
  ["predatroy journal", "56"], ["flipeed learning videos", "64"], ["metavrse conference exhibit", "280"], ["digtal twins", "229"], ["microcredentails AI", "330"],
  ["Discrod social presence", "294"], ["Tanzana oral examinaton", "298"], ["cognitiv load courseware", "27"], ["chatgbt threat", "250"],
  ["Librero predatory", "56"], ["Hawkinson", "229"], ["Dabrowski", "96"], ["Paderanga", "109"], ["Gutierez", "97"], ["Bhuiyan", "293"], ["Palma learning transitions", "254"],
  ["Phakathi", "104"], ["Clemente mindfulness", "264"],
  ["what are students preferred online learning attributes", "108"], ["how do instructors cope with online teaching in Tanzania", "292"], ["how ready are students for remote learning at a state university", "284"],
];
// round 120: one-transposition typos (the did-you-mean path); expected article in the top 3, gate TOP3 >= 0.9
const TYPO = [["tradtiional learning","77"],["nomral learning","284"],["appyling learning","67"],["consrtaints learning","74"],["augmneting learning","16"],["engaegment student","291"],["innoavtions learning","339"],["invesitgation online","227"],["perecived students","257"],["altenrative teaching","33"],["reaidness perception","9"],["facbeook developing","39"],["conojint study","108"],["soical presence","294"],["instrcutional higher","297"],["medaited technology","90"],["assoication nursing","41"],["hisotrya based","8"],["perecived classroom","19"],["interpertation learning","69"],["tranistions learning","254"],["chtagpt teaching","250"],["extneding open","231"],["evertyhing research","322"],["fleixble learning","300"]];
// round 191: short acronym and hyphen queries (tok keeps 2+ letter tokens: "AI", "e-learning" -> "learning"); expected in the top 5, gate >= 0.9
const ACR = [["AI micro-credentials","330"],["LMS Google Classroom","293"],["e-Ready Makati","98"],["MOOC graphic design","261"],["MOOCs social media","60"],["e-learning self-efficacy","40"],["e-learning ticketing","34"],["e-learning English listening","25"],["ODeL history UPOU","10"],["ODeL co-creation","52"],["ODL reflective practices","315"],["COVID-19 welfare","89"],["COVID-19 quality of instruction","243"],["COVID-19 Tanzania","288"],["K-12 teaching presence","33"],["OER website","59"],["STEM OER","46"],["VRTDs UPOU","17"],["VR maritime","58"],["AR nursing","24"]];
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
async function run(label) {
  let h1 = 0, h5 = 0; const miss = [];
  for (const [q, id] of SET) {
    let r = await E.searchArticles(q, { k: 5 });
    if (!r.length) { const f = E.didYouMean(q); if (f) r = await E.searchArticles(f, { k: 5 }); } // the UI's did-you-mean fallback
    const p = r.findIndex((a) => a.id === id);
    if (p === 0) h1++; if (p >= 0) h5++; else miss.push(`${label}: ${q} -> want ${id}, got ${r.slice(0, 3).map((a) => a.id).join(",") || "none"}`);
  }
  let h3 = 0;
  for (const [q, id] of TYPO) { let r = await E.searchArticles(q, { k: 3 }); if (!r.length) { const f = E.didYouMean(q); if (f) r = await E.searchArticles(f, { k: 3 }); } if (r.some((a) => a.id === id)) h3++; else miss.push(`${label}: typo ${q} -> want ${id}`); }
  for (const w of ["ann", "lee"]) { const a = (await E.searchArticles(w, { k: 1 }))[0]; if (!a || !(a.authors.join(" ").toLowerCase().match(/[a-z]+/g) || []).includes(w)) { miss.push(`${label}: author ${w} not exact-name first`); h3 = 0; } } // round 121
  for (const [, ex] of fs.readFileSync(path.resolve(import.meta.dirname, "../src/App.jsx"), "utf8").matchAll(/placeholder="[^"]*e\.g\. ([^"]+)"/g)) if (!(await E.searchArticles(ex, { k: 1 })).length) { miss.push(`${label}: placeholder example "${ex}" returns nothing`); h3 = 0; } // R285
  let ha = 0;
  for (const [q, id] of ACR) { if ((await E.searchArticles(q, { k: 5 })).some((a) => a.id === id)) ha++; else miss.push(`${label}: acronym ${q} -> want ${id}`); }
  console.log(`${label} transposition top3 ${(h3 / TYPO.length).toFixed(3)}, acronym top5 ${(ha / ACR.length).toFixed(3)}`);
  miss.slice(0, 8).forEach((m) => console.log("miss " + m));
  return [h1 / SET.length, h5 / SET.length, h3 / TYPO.length >= 0.9 && ha / ACR.length >= 0.9];
}
// BM25-only floor (before the model loads), then hybrid with the vector model (what the UI uses once ready)
const [b1, b5, t1] = await run("bm25"); console.log(`${SET.length} queries BM25 only: hit@1 ${b1.toFixed(3)}, hit@5 ${b5.toFixed(3)}`);
let v1 = b1, v5 = b5, t2 = t1;
if (!process.argv.includes("--no-vec")) { await E.ready(false); [v1, v5, t2] = await run("hybrid"); }
const ok = t1 && t2 && b1 >= arg("--bm1", 0.8) && b5 >= arg("--bm5", 0.9) && v1 >= arg("--min1", 0.93) && v5 >= arg("--min5", 0.98);
console.log(`${SET.length} queries hybrid: hit@1 ${v1.toFixed(3)}, hit@5 ${v5.toFixed(3)}, ${ok ? "0 FAIL" : "1 FAIL"}`); process.exit(ok ? 0 : 1);
