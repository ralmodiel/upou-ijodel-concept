import { openCookieSettings } from "./Consent.jsx";

export function Privacy() {
  const h = "mt-6 font-serif text-xl text-ink", p = "mt-2 text-ink-2";
  return (
    <article className="mx-auto max-w-3xl leading-relaxed">
      <h1 className="font-serif text-3xl text-ink">Privacy notice</h1>
      <p className="mt-2 rounded-md bg-navy-soft px-4 py-2 text-sm text-ink-2">Draft for a proof of concept. Before public launch, the University's data protection officer should review it and fill in the operator details below.</p>
      <h2 className={h}>Who runs this site</h2>
      <p className={p}>[Operator name (personal information controller), address and contact e-mail to be completed by UP Open University.] This is a browsing and reading tool for the open-access International Journal on Open and Distance e-Learning (IJODeL).</p>
      <h2 className={h}>What we collect</h2>
      <p className={p}>Nothing about you reaches us. The site itself has no accounts, no analytics and no advertising, and sets no tracking cookies of its own. The one exception is the optional visit counter described below (Flag Counter, a third-party tracker): it is off until you allow it. Everything you do here (searching, filters, view lists) happens in your browser.</p>
      <h2 className={h}>What is kept on your device</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
        <li><b>Your choice (not optional, no tracking):</b> your cookie choice (<code>ijodel-consent</code>), and a flag for this tab only (<code>ijodel-chunk-retry</code>) that lets the page reload itself once if a part failed to load. No consent is needed for these. Your choice (with the version of this notice you saw) is kept until you change it or clear this site's data; if this notice changes what is stored or sent, we ask again.</li>
        <li><b>View lists (only if you allow “View lists”):</b> the chapters you add to your view lists (<code>ijodel-lists</code>; at most 20 lists, names up to 60 characters). They stay on your device and are deleted when you withdraw consent. Without consent they last only until you close or reload the page.</li>
        <li><b>Search history and settings (only if you allow):</b> your advanced-search filters, their mode, saved and recent searches, your citation style, the reader text size, the last relationship-map seed (<code>ijodel-map-seed</code>, last map seed) and whether you closed the quick tour, plus an offline copy of the site and of the chapters you open (service worker <code>sw.js</code>, browser cache <code>ijodel-offline-…</code>) so they still open without a connection. They stay on your device and are deleted when you withdraw consent. Without consent they last only until you close or reload the page.</li>
        <li><b>Search model (only if you allow it):</b> the model files (browser cache <code>transformers-cache</code>) and the article search vectors (<code>ijodel</code> database), so the next visit does not download them again. They are deleted when you withdraw this consent.</li>
      </ul>
      <h2 className={h}>Other services your browser contacts</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
        <li><b>GitHub Pages</b> serves this site and, like any web host, receives your IP address and browser details in its server logs. See GitHub's privacy statement.</li>
        <li><b>Hugging Face</b> (only if you allow the semantic search model): your browser downloads a ~34 MB model (Xenova/bge-small-en-v1.5, a quantized BGE-small English embedding model, huggingface.co/Xenova/bge-small-en-v1.5; its files may be served from hf.co hosts), so Hugging Face receives your IP address and browser details. Without it, search uses keyword scoring only.</li>
        <li><b>jsDelivr</b> (cdn.jsdelivr.net, same consent): serves the ~6 MB ONNX runtime that runs the model, and receives your IP address and browser details.</li>
        <li><b>Flag Counter</b> (flagcounter.me, only if you allow the visit counter): the footer shows the journal's visitor counter, so Flag Counter receives your IP address and browser details, counts your visit by country, and may set its own cookie. It is the same counter the journal's site uses.</li>
        <li><b>ijodel.upou.edu.ph</b>: links to the original articles and PDFs open the journal's own site, which has its own policies.</li>
      </ul>
      <h2 className={h}>Your choices and rights</h2>
      <p className={p}>You can change or withdraw your choices at any time with “Cookie settings” in the footer. The site itself collects and stores no personal information about you; the services listed above process your IP address under their own policies. Under the Data Privacy Act of 2012 (Republic Act No. 10173) you have the right to be informed, to object, to access, to rectification, to erasure or blocking, to data portability, to damages, and to file a complaint with the National Privacy Commission (privacy.gov.ph). Contact the operator's Data Protection Officer: [DPO name and e-mail to be completed by UP Open University].</p>
      <h2 className={h}>Content notices</h2>
      <p className={p}>Articles are open access under CC BY 4.0 and belong to their authors and the journal. Summaries, questions and answers, and related-reading notes are AI-generated, can contain errors, and must not be cited. Always check the original article.</p>
      <p className="mt-6"><button type="button" onClick={openCookieSettings} className="min-h-11 rounded-full bg-action-fill px-5 text-sm font-bold text-white hover:bg-action-2-fill">Open cookie settings</button></p>
    </article>
  );
}

export function About() {
  const h = "mt-6 font-serif text-xl text-ink", p = "mt-2 text-ink-2";
  return (
    <article className="mx-auto max-w-3xl leading-relaxed">
      <h1 className="font-serif text-3xl text-ink">About this site</h1>
      <p className="mt-2 rounded-md bg-navy-soft px-4 py-2 text-sm text-ink-2">Proof of concept, pending sign-off by the IJODeL editors. It is not an official journal site.</p>
      <h2 className={h}>What it is</h2>
      <p className={p}>A reader and search tool for the International Journal on Open and Distance e-Learning: browse issues and topics, search the articles, explore maps of related work and keep reading lists. Everything runs in your browser.</p>
      <h2 className={h}>AI-generated content</h2>
      <p className={p}>Summaries, questions and answers, tags and related-reading notes are AI-generated. They can contain errors and must not be cited. Always read and cite the original article.</p>
      <h2 className={h}>Source and licence</h2>
      <p className={p}>Article content comes from IJODeL (ISSN 2467-7469), published by UP Open University under <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-link underline">CC BY 4.0</a>. Credit belongs to the authors and the journal; each reader page links to the original article.</p>
      <h2 className={h}>Contact</h2>
      <p className={p}>Questions about the journal: <a href="mailto:ijodel@upou.edu.ph" className="text-link underline">ijodel@upou.edu.ph</a>. See also the <a href="#/privacy" className="text-link underline">privacy notice</a>.</p>
    </article>
  );
}
