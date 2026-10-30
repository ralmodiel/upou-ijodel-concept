import { useEffect, useRef, useState } from "react";
import { setConsent, useConsent } from "./consent.js";

const OPEN = "ijodel-open-cookies";
export const openCookieSettings = () => dispatchEvent(new Event(OPEN));

function Switch({ id, label, hint, on, set, locked }) {
  return (
    <div className="flex items-start gap-3 border-t border-line py-3">
      <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={on} disabled={locked} onChange={(e) => set(e.target.checked)} />
      <label htmlFor={id} className="text-sm"><span className="font-bold text-ink">{label}{locked && <span className="ml-2 font-normal text-ink-3">always on</span>}</span><span className="mt-0.5 block text-ink-2">{hint}</span></label>
    </div>
  );
}

function Settings({ initial, onClose }) {
  const [prefs, setPrefs] = useState(!!initial?.prefs), [lists, setLists] = useState(!!initial?.lists), [model, setModel] = useState(!!initial?.model), [counter, setCounter] = useState(!!initial?.counter), box = useRef(null);
  useEffect(() => {
    box.current?.querySelector("input:not(:disabled)")?.focus();
    const esc = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", esc); return () => removeEventListener("keydown", esc);
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div ref={box} role="dialog" aria-modal="true" aria-label="Cookie and privacy settings" onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl">
        <h2 className="font-serif text-2xl text-ink">Cookie and privacy settings</h2>
        <p className="mt-1 text-sm text-ink-2">This site has no accounts, no analytics and no advertising. Only if you allow the visit counter does a third-party tracker, Flag Counter, see your visit. Choose what it may keep on your device or fetch from other services; every item below is off until you switch it on. Only your choice itself is remembered on this device, as one small record, so we do not ask again. You can change this at any time from the footer.</p>
        <div className="mt-3">
          <Switch id="c-lists" label="View lists" hint="Keeps the chapters you add to your view lists on this device, so they are still there next visit. Never sent anywhere." on={lists} set={setLists} />
          <Switch id="c-pref" label="Search history and settings" hint="Keeps your advanced-search filters, saved and recent searches, citation style, text size, the tour and an offline copy of the pages you open on this device. Undo and redo work without it. Never sent anywhere." on={prefs} set={setPrefs} />
          <Switch id="c-model" label="Semantic search model" hint="Downloads a ~34 MB language model (Xenova/bge-small-en-v1.5, quantized q8, from Hugging Face) and its ~6 MB runtime from jsDelivr, so searches also match meaning, not only words. Both then see your IP address. The model and search vectors are kept in this browser until you withdraw. Without it, search still works on keywords." on={model} set={setModel} />
          <Switch id="c-counter" label="Visit counter" hint="Shows the journal's Flag Counter in the footer. Flag Counter (flagcounter.me) then receives your IP address and counts your visit by country; it may set its own cookie." on={counter} set={setCounter} />
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <a href="#/privacy" onClick={onClose} className="mr-auto inline-flex min-h-11 items-center text-sm font-medium text-link hover:underline">Privacy notice</a>
          <button type="button" onClick={() => { setConsent({ prefs, lists, model, counter }); onClose(); }} className="min-h-11 rounded-full bg-action-fill px-5 text-sm font-bold text-white hover:bg-action-2-fill">Save choices</button>
        </div>
      </div>
    </div>
  );
}

// First-visit banner (non-blocking) plus the settings dialog, reopened from the footer.
export function CookieConsent() {
  const c = useConsent(), [open, setOpen] = useState(false);
  useEffect(() => { const f = () => setOpen(true); addEventListener(OPEN, f); return () => removeEventListener(OPEN, f); }, []);
  return (
    <>
      {!c && !open && (
        <div role="dialog" aria-label="Cookie and privacy choices" className="fixed inset-x-3 bottom-3 z-40 print:hidden mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:p-5">
          <p className="text-sm text-ink-2"><b className="text-ink">Your privacy.</b> We run no analytics or advertising of our own. With your permission we keep your view lists and filters on this device, download a search model from Hugging Face, and show the journal’s visit counter (Flag Counter, a third-party tracker that counts visits by country and may set its own cookie). <a href="#/privacy" className="font-medium text-link underline">Read the privacy notice</a>.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setConsent({ prefs: true, lists: true, model: true, counter: true })} className="min-h-11 rounded-full bg-action-fill px-5 text-sm font-bold text-white hover:bg-action-2-fill">Accept all</button>
            <button type="button" onClick={() => setConsent({ prefs: false, lists: false, model: false, counter: false })} className="min-h-11 rounded-full border-2 border-action px-5 text-sm font-bold text-action hover:bg-navy-soft">Essential only</button>
            <button type="button" onClick={() => setConsent({ prefs: false, lists: true, model: false, counter: false })} className="min-h-11 rounded-full border-2 border-action px-5 text-sm font-bold text-action hover:bg-navy-soft">View lists only</button>
            <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-full border-2 border-action px-5 text-sm font-bold text-action hover:bg-navy-soft">Customize…</button>
          </div>
        </div>
      )}
      {open && <Settings initial={c} onClose={() => setOpen(false)} />}
    </>
  );
}

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
        <li><b>Your choice (not optional, no tracking):</b> your cookie choice (<code>ijodel-consent</code>), and a flag for this tab only (<code>ijodel-chunk-retry</code>) that lets the page reload itself once if a part failed to load. No consent is needed for these. Your choice is kept until you change it or clear this site's data.</li>
        <li><b>View lists (only if you allow “View lists”):</b> the chapters you add to your view lists (<code>ijodel-lists</code>). They stay on your device and are deleted when you withdraw consent. Without consent they last only until you close or reload the page.</li>
        <li><b>Search history and settings (only if you allow):</b> your advanced-search filters, their mode, saved and recent searches, your citation style, the reader text size, the last relationship-map seed (<code>ijodel-map-seed</code>, last map seed) and whether you closed the quick tour, plus an offline copy of the site and of the chapters you open (service worker <code>sw.js</code>, browser cache <code>ijodel-offline-…</code>) so they still open without a connection. They stay on your device and are deleted when you withdraw consent. Without consent they last only until you close or reload the page.</li>
        <li><b>Search model (only if you allow it):</b> the model files (browser cache <code>transformers-cache</code>) and the article search vectors (<code>ijodel</code> database), so the next visit does not download them again. They are deleted when you withdraw this consent.</li>
      </ul>
      <h2 className={h}>Other services your browser contacts</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
        <li><b>GitHub Pages</b> serves this site and, like any web host, receives your IP address and browser details in its server logs. See GitHub's privacy statement.</li>
        <li><b>Hugging Face</b> (only if you allow the semantic search model): your browser downloads a ~34 MB model (Xenova/bge-small-en-v1.5, a quantized BGE-small English embedding model, huggingface.co/Xenova/bge-small-en-v1.5), so Hugging Face receives your IP address and browser details. Without it, search uses keyword scoring only.</li>
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
