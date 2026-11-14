import { GUIDE, RU_GUIDE, ORIGIN } from './paths.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const assetVersion = name => createHash('sha256').update(readFileSync(new URL('../assets/' + name, import.meta.url))).digest('hex').slice(0, 12);
const cssVersion = assetVersion('site.css');
const jsVersion = assetVersion('site.js');

const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function page({ title, description = 'Security testing documentation.', url, body, document = false, lang = 'en', alternate = null }) {
  const series = /^\/en\/OWASP\/CheatSheetSeries(?:\/|$)/.test(url);
  const wstg = url === GUIDE || url.startsWith(GUIDE + '/') || url === RU_GUIDE || url.startsWith(RU_GUIDE + '/');
  const isRu = lang === 'ru';
  const brandUrl = isRu ? '/ru/' : '/en/';
  const brandLabel = isRu ? 'Документация' : 'Documentation';
  const themeText = isRu ? 'Тема' : 'Theme';
  const themeAria = isRu ? 'Переключить тему оформления' : 'Switch color theme';
  const skipText = isRu ? 'Перейти к содержанию' : 'Skip to content';
  const footerNote = isRu ? '<span>Raw2Crawl · Документация по безопасности</span>' : '<span>Raw2Crawl · Security documentation</span>';
  const sourceLabel = isRu ? 'Исходный репозиторий' : 'Source';
  const authorsLabel = isRu ? 'авторы' : 'contributors';

  const attribution = series || wstg
    ? `<span>${series ? 'Cheat Sheet Series' : 'WSTG'} © OWASP Foundation &amp; ${authorsLabel} · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a> · <a href="https://github.com/OWASP/${series ? 'CheatSheetSeries' : 'wstg'}">${sourceLabel}</a></span>`
    : '';

  const altTag = alternate
    ? `<link rel="alternate" hreflang="${lang}" href="${ORIGIN}${url}"><link rel="alternate" hreflang="${isRu ? 'en' : 'ru'}" href="${ORIGIN}${alternate}">`
    : '';

  const langSwitch = alternate
    ? `<div class="language-switch">${
        isRu
          ? `<a class="lang-link" href="${alternate}" hreflang="en" title="Read in English">EN</a><span class="lang-divider">/</span><span class="lang-active" aria-current="true">RU</span>`
          : `<span class="lang-active" aria-current="true">EN</span><span class="lang-divider">/</span><a class="lang-link" href="${alternate}" hreflang="ru" title="Читать на русском">RU</a>`
      }</div>`
    : `<span class="language" aria-label="Language: ${isRu ? 'Russian' : 'English'}">${lang.toUpperCase()}</span>`;

  return `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)} | Raw2Crawl</title><meta name="description" content="${escape(description)}">
<link rel="canonical" href="${ORIGIN}${url}">${altTag}<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#202020">
<script>try{var t=localStorage.getItem('raw2crawl-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}</script>
<link rel="stylesheet" href="/assets/site.css?v=${cssVersion}"><script src="/assets/site.js?v=${jsVersion}" defer></script>
</head><body${document ? ' class="documentation"' : ''}>
<a class="skip-link" href="#main-content">${skipText}</a>
<header class="site-header"><a class="brand" href="${brandUrl}">Raw2Crawl<span class="brand-divider" aria-hidden="true">/</span><span class="brand-label">${brandLabel}</span></a>
<div class="header-actions">${langSwitch}<button id="theme-toggle" type="button" aria-label="${themeAria}">${themeText}</button></div></header>
${body}
<footer class="site-footer">${footerNote}${attribution}</footer>
</body></html>`;
}

export function documentPage(html, url, options = {}) {
  const isRu = options.lang === 'ru' || url.startsWith(RU_GUIDE);
  const lang = isRu ? 'ru' : 'en';
  const alternate = options.alternate || (isRu ? url.replace(/^\/ru\//, '/en/') : url.replace(/^\/en\//, '/ru/'));
  const article = html.match(/<article class="doc-content">([\s\S]*?)<\/article>/)?.[0];
  const navigation = html.match(/<nav class="wstg-nav"[\s\S]*?<\/nav>/)?.[0];
  if (!article || !navigation) throw Error('Missing guide article or navigation: ' + url);
  const title = article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]*>/g, '') || 'WSTG v4.2';

  const guideRoot = isRu ? RU_GUIDE : GUIDE;
  const libraryRoot = isRu ? '/ru/' : '/en/';
  const owaspRoot = isRu ? '/ru/OWASP/' : '/en/OWASP/';
  const contentsLabel = isRu ? 'Содержание' : 'Contents';
  const sidebarTitle = isRu ? 'Руководство по тестированию' : 'Web Security Testing Guide';
  const sidebarEdition = isRu ? 'Версия 4.2 <span aria-hidden="true">·</span> Stable' : 'Version 4.2 <span aria-hidden="true">·</span> Stable';
  const breadcrumbLib = isRu ? 'Библиотека' : 'Library';
  const pageTocEyebrow = isRu ? 'На этой странице' : 'On this page';
  const backTopLabel = isRu ? 'Наверх ↑' : 'Back to top ↑';
  const pageNavAria = isRu ? 'Предыдущая и следующая страница' : 'Previous and next page';

  return page({ title, url, document: true, lang, alternate, body: `
<div class="mobile-toolbar"><button id="contents-toggle" type="button" aria-controls="doc-sidebar" aria-expanded="false">${contentsLabel}</button><span>WSTG v4.2</span></div>
<div class="docs-layout">
<aside id="doc-sidebar" class="sidebar" aria-label="${isRu ? 'Содержание руководства' : 'Guide contents'}"><div class="sidebar-book"><span class="eyebrow">OWASP</span><a href="${guideRoot}/">${sidebarTitle}</a><span class="edition">${sidebarEdition}</span></div>${navigation}</aside>
<main id="main-content" class="reading-pane"><nav class="breadcrumbs" aria-label="${isRu ? 'Навигация' : 'Breadcrumb'}"><a href="${libraryRoot}">${breadcrumbLib}</a><span>/</span><a href="${owaspRoot}">OWASP</a><span>/</span><a href="${guideRoot}/">WSTG v4.2</a></nav>${article}<nav class="page-navigation" aria-label="${pageNavAria}"></nav></main>
<aside class="page-outline" aria-label="${pageTocEyebrow}"><p class="eyebrow">${pageTocEyebrow}</p><nav id="page-toc"></nav><a class="back-top" href="#top">${backTopLabel}</a></aside>
</div>` }).replace('<body class="documentation">', '<body id="top" class="documentation">');
}

export function catalogPage(owasp = false, lang = 'en') {
  const isRu = lang === 'ru';
  const alternate = owasp ? (isRu ? '/en/OWASP/' : '/ru/OWASP/') : (isRu ? '/en/' : '/ru/');

  if (isRu) {
    const title = owasp ? 'OWASP' : 'Библиотека безопасности';
    const card = owasp
      ? `<div class="catalog-grid"><a class="catalog-card" href="${RU_GUIDE}/"><span class="card-meta">БЕЗОПАСНОСТЬ ВЕБ-ПРИЛОЖЕНИЙ</span><h2>Руководство по тестированию безопасности веб-приложений</h2><p>Комплексная методология тестирования безопасности веб-приложений и веб-сервисов.</p><span class="card-bottom"><span>WSTG v4.2 <span class="badge">Stable</span></span><span aria-hidden="true">→</span></span></a></div>`
      : '<a class="catalog-card" href="/ru/OWASP/"><span class="card-meta">ОРГАНИЗАЦИЯ</span><h2>OWASP</h2><p>Open Worldwide Application Security Project. Руководства и методики тестирования безопасности приложений.</p><span class="card-bottom"><span>1 руководство</span><span aria-hidden="true">→</span></span></a>';
    return page({
      title,
      url: owasp ? '/ru/OWASP/' : '/ru/',
      lang: 'ru',
      alternate,
      body: `<main id="main-content" class="catalog"><nav class="breadcrumbs" aria-label="Навигация"><a href="/ru/">Библиотека</a>${owasp ? '<span>/</span><span>OWASP</span>' : ''}</nav><div class="catalog-heading"><span class="eyebrow">RAW2CRAWL / СПРАВОЧНАЯ БИБЛИОТЕКА</span><h1>${title}</h1><p>${owasp ? 'Стандарты безопасности приложений и методики тестирования.' : 'Руководства по тестированию безопасности, структурированные для внимательного изучения.'}</p></div>${owasp ? '' : '<div class="catalog-grid">'}${card}${owasp ? '' : '</div>'}<p class="catalog-note">Русское издание</p></main>`
    });
  }

  const title = owasp ? 'OWASP' : 'Security library';
  const harmj0y = owasp ? '' : `<a class="catalog-card" href="/en/harmj0y/"><span class="card-meta">BLOG ARCHIVE</span><h2>harmj0y</h2><p>Security research by Will Schroeder.</p><span class="card-bottom"><span>${JSON.parse(readFileSync(new URL('../content/en/harmj0y/manifest.json', import.meta.url), 'utf8')).articles.length} articles · 10 categories</span><span aria-hidden="true">→</span></span></a>`;
  const card = owasp
    ? `<div class="catalog-grid"><a class="catalog-card" href="${GUIDE}/"><span class="card-meta">WEB APPLICATION SECURITY</span><h2>Web Security Testing Guide</h2><p>A comprehensive framework for testing the security of web applications and web services.</p><span class="card-bottom"><span>WSTG v4.2 <span class="badge">Stable</span></span><span aria-hidden="true">→</span></span></a><a class="catalog-card" href="/en/OWASP/CheatSheetSeries/"><span class="card-meta">PRACTICAL SECURITY GUIDANCE</span><h2>OWASP Cheat Sheet Series</h2><p>The complete English series: 137 concise cheat sheets on application security.</p><span class="card-bottom"><span>English · 137 resources</span><span aria-hidden="true">→</span></span></a></div>`
    : '<a class="catalog-card" href="/en/OWASP/"><span class="card-meta">ORGANIZATION</span><h2>OWASP</h2><p>Open Worldwide Application Security Project. Guides and methods for application security testing.</p><span class="card-bottom"><span>2 resources</span><span aria-hidden="true">→</span></span></a>';
  return page({ title, url: owasp ? '/en/OWASP/' : '/en/', lang: 'en', alternate, body: `<main id="main-content" class="catalog"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a>${owasp ? '<span>/</span><span>OWASP</span>' : ''}</nav><div class="catalog-heading"><span class="eyebrow">RAW2CRAWL / REFERENCE LIBRARY</span><h1>${title}</h1><p>${owasp ? 'Application security standards and testing guidance.' : 'Security testing guides, organized for careful reading.'}</p></div>${owasp ? '' : '<div class="catalog-grid">'}${card}${harmj0y}${owasp ? '' : '</div>'}<p class="catalog-note">English edition</p></main>` });
}
