// Build-time SEO: static read pages, sitemap, robots, 404 (hash routing is invisible to crawlers). SITE_URL env sets absolute URLs.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "fs";
import { join } from "path";
export const SITE = (process.env.SITE_URL || "https://example.github.io/ijodel-rag").replace(/\/+$/, ""); // default is a placeholder: set SITE_URL for the real Pages URL
const NAME = "International Journal on Open and Distance e-Learning";
const DESC = "IJODeL: open-access scholarly articles on open and distance e-learning. Browse, search and read 116 chapters by issue, topic and author.";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clip = (s, n = 155) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…"; };
const m = (k, v, a = "name") => `<meta ${a}="${k}" content="${esc(v)}">`;
const IMG = () => [m("og:image", SITE + "/img/social.png", "property"), m("og:image:width", "1278", "property"), m("og:image:height", "884", "property"), m("og:image:alt", "Relationship map of IJODeL chapters, topics, authors and issues", "property"), m("twitter:image", SITE + "/img/social.png")].join("\n");
const head = (title, desc, url) => [`<title>${esc(title)}</title>`, m("description", desc), `<link rel="canonical" href="${url}">`,
  m("og:type", "article", "property"), m("og:site_name", "IJODeL", "property"), m("og:title", title, "property"), m("og:description", desc, "property"), m("og:url", url, "property"),
  m("twitter:card", "summary_large_image"), IMG(), m("twitter:title", title), m("twitter:description", desc)].join("\n");
export const homeTags = () => [...["articles", "chunks", "issues"].map((f) => `<link rel="preload" as="fetch" href="./index/${f}.json" crossorigin>`), m("description", DESC), `<link rel="canonical" href="${SITE}/">`, m("theme-color", "#0b2a4a"),
  m("og:type", "website", "property"), m("og:site_name", "IJODeL", "property"), m("og:title", `IJODeL — ${NAME}`, "property"), m("og:description", DESC, "property"), m("og:url", SITE + "/", "property"),
  m("twitter:card", "summary_large_image"), IMG(), m("twitter:title", "IJODeL"), m("twitter:description", DESC),
  `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "IJODeL", url: SITE + "/", potentialAction: { "@type": "SearchAction", target: `${SITE}/#/search/{search_term_string}`, "query-input": "required name=search_term_string" } })}</script>`].join("\n");

export function seoPlugin() {
  return {
    name: "ijodel-seo", apply: "build",
    transformIndexHtml: { order: "post", handler: (h, ctx) => h.replace("</title>", "</title>\n" + homeTags() + "\n" + // first-screen fonts: found late in the CSS otherwise, and their swap shifts the layout
      Object.keys(ctx.bundle || {}).filter((f) => /(lato-latin-(400|700)|merriweather-latin-(300|400))-normal-.*\.woff2$/.test(f)).map((f) => `<link rel="preload" as="font" type="font/woff2" href="./${f}" crossorigin>`).join("\n")) },
    closeBundle() {
      const dist = join(import.meta.dirname, "..", "dist");
      const arts = JSON.parse(readFileSync(join(dist, "index/articles.json"), "utf8"));
      // startup diet: the 1-page and 2-page summaries (~60% of the file) load apart, after first paint (engine.js textsP)
      const texts = {}; for (const a of arts) { texts[a.id] = { one: a.one, two: a.two }; }
      writeFileSync(join(dist, "index/texts.json"), JSON.stringify(texts));
      writeFileSync(join(dist, "index/articles.json"), JSON.stringify(arts.map(({ one, two, ...a }) => a)));
      // per-article passages and FAQs (engine passFor / faqsFor fetch only what a result or the Reader shows); every article gets a file, [] if empty
      const J = (f) => JSON.parse(readFileSync(join(dist, "index", f), "utf8")), chunks = J("chunks.json"), pass = J("passages.json"), faqs = J("faqs.json");
      for (const d of ["pass", "faq"]) mkdirSync(join(dist, "index", d), { recursive: true });
      for (const a of arts) {
        writeFileSync(join(dist, "index/pass", a.id + ".json"), JSON.stringify(pass.filter((_, c) => chunks[c] === a.id)));
        writeFileSync(join(dist, "index/faq", a.id + ".json"), JSON.stringify(faqs.filter((f) => f.article === a.id)));
      }
      for (const f of ["passages.json", "faqs.json"]) rmSync(join(dist, "index", f));
      // round 83: offline service worker, versioned by the entry chunk name; registered only under the "prefs" consent (src/sw-reg.js)
      const assets = readdirSync(join(dist, "assets")).filter((f) => /\.(js|css)$/.test(f) && !/Graph3D|transformers/.test(f) || /(lato-latin-(400|700)|merriweather-latin-(300|400))-normal-.*\.woff2$/.test(f));
      const pre = ["./", "index/articles.json", "index/chunks.json", "index/issues.json", "index/texts.json", "img/logo.webp", ...assets.map((f) => "assets/" + f)];
      const ver = (readFileSync(join(dist, "index.html"), "utf8").match(/assets\/index-([^".]+)\.js/) || [, Date.now()])[1];
      writeFileSync(join(dist, "sw.js"), readFileSync(join(import.meta.dirname, "sw.tpl.js"), "utf8").replace("__VER__", ver).replace("[/*PRE*/]", JSON.stringify(pre)));
      // external redirect file: inline script would need a CSP hash
      writeFileSync(join(dist, "r.js"), `var s=document.currentScript;location.replace(s.src.replace(/r\\.js$/,"")+"#/read/"+s.dataset.id);\n`);
      const csp = readFileSync(join(import.meta.dirname, "..", "index.html"), "utf8").match(/<meta http-equiv="Content-Security-Policy"[^>]*>/)[0];
      // round 88: Trusted Types stay report-only (worker URL, three/3d-force-graph innerHTML break under enforcement)
      // rounds 86/93: response headers for hosts that read a _headers file (Netlify, Cloudflare Pages); GitHub Pages ignores it (docs/hosting.md)
      const pol = csp.match(/content="([^"]*)"/)[1] + "; frame-ancestors 'none'; upgrade-insecure-requests";
      writeFileSync(join(dist, "_headers"), `/*\n  Content-Security-Policy: ${pol}\n  Content-Security-Policy-Report-Only: require-trusted-types-for 'script'\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()\n  Cross-Origin-Opener-Policy: same-origin\n  X-Frame-Options: DENY\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n/index/*\n  Cache-Control: public, max-age=3600, must-revalidate\n/sw.js\n  Cache-Control: no-cache\n/index.html\n  Cache-Control: no-cache\n`);
      const urls = [SITE + "/"];
      for (const a of arts) {
        const url = `${SITE}/read/${a.id}/`, desc = clip(a.abstract) || `${a.title}. ${NAME}.`, authors = a.authors || [];
        const ld = { "@context": "https://schema.org", "@type": "ScholarlyArticle", headline: a.title, name: a.title, description: desc, url, inLanguage: "en",
          author: authors.map((n) => ({ "@type": "Person", name: n })), datePublished: String(a.year), sameAs: a.url, isPartOf: { "@type": "PublicationIssue", issueNumber: String(a.issue?.no ?? ""), isPartOf: { "@type": "PublicationVolume", volumeNumber: String(a.issue?.vol ?? ""), isPartOf: { "@type": "Periodical", name: NAME, issn: "2467-7469" } } } };
        const page = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${csp}
${head(`${a.title} | IJODeL`, desc, url)}
${m("citation_title", a.title)}
${authors.map((n) => m("citation_author", n)).join("\n")}
${m("citation_publication_date", a.year)}
${m("citation_journal_title", NAME)}
${m("citation_issn", "2467-7469")}
${m("citation_volume", a.issue?.vol)}
${m("citation_issue", a.issue?.no)}
${m("citation_abstract_html_url", url)}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head><body>
<main><article><h1>${esc(a.title)}</h1>
<p>${esc(authors.join("; "))}</p>
<p>${esc(a.issue?.label || a.year)} · ${NAME}</p>
<h2>Abstract</h2><p>${esc(a.abstract || "No abstract available.")}</p>
<p><a href="../../#/read/${esc(a.id)}">Open in the reader</a> · <a href="${esc(a.url)}">Original article</a></p>
</article></main>
<script src="../../r.js" data-id="${esc(a.id)}"></script>
</body></html>`;
        mkdirSync(join(dist, "read", String(a.id)), { recursive: true });
        writeFileSync(join(dist, "read", String(a.id), "index.html"), page);
        urls.push(url);
      }
      writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
      writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
      writeFileSync(join(dist, "404.html"), `<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Page not found | IJODeL</title></head><body><main><h1>Page not found</h1><p><a href="${SITE}/">Go to the IJODeL home page</a></p></main></body></html>\n`);
    },
  };
}
