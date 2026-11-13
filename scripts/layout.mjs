import { GUIDE, ORIGIN } from './paths.mjs';

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function page({ title, description = 'Security testing documentation.', url, body, document = false }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} | Raw2Crawl</title><meta name="description" content="${escape(description)}">
<link rel="canonical" href="${ORIGIN}${url}"><link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#202020">
<script>try{var t=localStorage.getItem('raw2crawl-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}</script>
<link rel="stylesheet" href="/assets/site.css"><script src="/assets/site.js" defer></script>
</head><body${document ? ' class="documentation"' : ''}>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header"><a class="brand" href="/en/">Raw2Crawl<span class="brand-divider" aria-hidden="true">/</span><span class="brand-label">Documentation</span></a>
<div class="header-actions"><span class="language" aria-label="Language: English">EN</span><button id="theme-toggle" type="button" aria-label="Switch color theme">Theme</button></div></header>
${body}
<footer class="site-footer"><span>Raw2Crawl · Security documentation</span><span>WSTG © OWASP Foundation &amp; contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · <a href="https://github.com/OWASP/wstg">Source</a></span></footer>
</body></html>`;
}

export function documentPage(html, url) {
  const article = html.match(/<article class="doc-content">([\s\S]*?)<\/article>/)?.[0];
  const navigation = html.match(/<nav class="wstg-nav"[\s\S]*?<\/nav>/)?.[0];
  if (!article || !navigation) throw Error('Missing guide article or navigation: ' + url);
  const title = article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '') || 'WSTG v4.2';
  return page({ title, url, document: true, body: `
<div class="mobile-toolbar"><button id="contents-toggle" type="button" aria-controls="doc-sidebar" aria-expanded="false">Contents</button><span>WSTG v4.2</span></div>
<div class="docs-layout">
<aside id="doc-sidebar" class="sidebar" aria-label="Guide contents"><div class="sidebar-book"><span class="eyebrow">OWASP</span><a href="${GUIDE}/">Web Security Testing Guide</a><span class="edition">Version 4.2 <span aria-hidden="true">·</span> Stable</span></div>${navigation}</aside>
<main id="main-content" class="reading-pane"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a><span>/</span><a href="/en/OWASP/">OWASP</a><span>/</span><a href="${GUIDE}/">WSTG v4.2</a></nav>${article}<nav class="page-navigation" aria-label="Previous and next page"></nav></main>
<aside class="page-outline" aria-label="On this page"><p class="eyebrow">On this page</p><nav id="page-toc"></nav><a class="back-top" href="#top">Back to top ↑</a></aside>
</div>` }).replace('<body class="documentation">', '<body id="top" class="documentation">');
}

export function catalogPage(owasp = false) {
  const title = owasp ? 'OWASP' : 'Security library';
  const card = owasp
    ? `<a class="catalog-card" href="${GUIDE}/"><span class="card-meta">WEB APPLICATION SECURITY</span><h2>Web Security Testing Guide</h2><p>A comprehensive framework for testing the security of web applications and web services.</p><span class="card-bottom"><span>WSTG v4.2 <span class="badge">Stable</span></span><span aria-hidden="true">→</span></span></a>`
    : '<a class="catalog-card" href="/en/OWASP/"><span class="card-meta">ORGANIZATION</span><h2>OWASP</h2><p>Open Worldwide Application Security Project. Guides and methods for application security testing.</p><span class="card-bottom"><span>1 guide</span><span aria-hidden="true">→</span></span></a>';
  return page({ title, url: owasp ? '/en/OWASP/' : '/en/', body: `<main id="main-content" class="catalog"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a>${owasp ? '<span>/</span><span>OWASP</span>' : ''}</nav><div class="catalog-heading"><span class="eyebrow">RAW2CRAWL / REFERENCE LIBRARY</span><h1>${title}</h1><p>${owasp ? 'Application security standards and testing guidance.' : 'Security testing guides, organized for careful reading.'}</p></div><div class="catalog-grid">${card}</div><p class="catalog-note">English edition</p></main>` });
}
