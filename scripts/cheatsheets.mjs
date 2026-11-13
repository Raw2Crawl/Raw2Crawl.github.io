import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, DIST, files, write } from './paths.mjs';
import { page } from './layout.mjs';

const seriesUrl = 'https://cheatsheetseries.owasp.org/';
const ROOT_URL = '/en/OWASP/CheatSheetSeries';
const STATIC = path.join(ROOT, 'vendor/cheatsheets/site');
const SOURCES = path.join(ROOT, 'content/en/OWASP/CheatSheetSeries/cheatsheets');
const WSTG_GUIDE = '/en/OWASP/WSTG-v4.2';

function resolveWstg(pathname, paths) {
  let url = pathname.replace(/^\/(?:v42|stable)(?=\/|$)/, '/v4.2');
  if (!url.startsWith('/v4.2/')) return null;
  let relative = url.slice('/v4.2/'.length).replace(/\.html?$/i, '').replace(/\/$/, '').replace(/(?:^|\/)README$/i, '');
  relative = relative.replace(/\/$/, '');
  const candidates = [relative ? `/v4.2/${relative}/index.html` : '/v4.2/index.html', `/v4.2/${relative}`];
  const found = candidates.find(p => paths.has(p));
  return found ? WSTG_GUIDE + '/' + found.slice('/v4.2/'.length).replace(/index\.html$/, '') : null;
}

function escape(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function rewriteLinks(article, sourcePath, wstgPaths) {
  return article.replace(/\b(href|src)="([^"]*)"/g, (all, attr, value) => {
    if (/^(?:#|mailto:|tel:|javascript:|data:)/i.test(value)) return all;
    let u;
    try { u = new URL(value, 'https://cheatsheetseries.owasp.org' + sourcePath); } catch { return all; }
    let dest = u.pathname;
    if (u.hostname === 'wstg.owasp.org') {
      const local = resolveWstg(dest, wstgPaths);
      return local ? `${attr}="${local}${u.search}${u.hash}"` : all;
    }
    if (u.hostname === 'owasp.org') {
      const match = dest.match(/^\/www-project-web-security-testing-guide\/(?:v42|v4\.2|stable)(\/.*)?$/);
      if (!match) return all;
      const local = resolveWstg('/v4.2' + (match[1] || '/'), wstgPaths);
      return local ? `${attr}="${local}${u.search}${u.hash}"` : all;
    }
    if (u.hostname === 'cheatsheetseries.owasp.org') {
      if (dest.startsWith('/cheatsheets/')) dest = ROOT_URL + dest;
      else if (dest === '/' || dest === '/index.html') dest = ROOT_URL + '/index.html';
      else if (dest.startsWith('/assets/')) dest = ROOT_URL + dest;
      else if (dest.startsWith('/img/')) dest = ROOT_URL + dest;
      else if (/^\/(?:Glossary|IndexASVS|IndexMASVS|IndexProactiveControls|IndexTopTen)\.html$/i.test(dest)) dest = ROOT_URL + dest;
      else return all;
    } else if ((u.hostname === 'wstg.owasp.org' || u.hostname === 'owasp.org') && dest.startsWith('/v4.2/')) {
      dest = '/en/OWASP/WSTG-v4.2' + dest.slice('/v4.2'.length);
    } else if (u.hostname === 'owasp.org') {
      const m = dest.match(/^\/www-project-web-security-testing-guide\/(?:v42|v4\.2|stable)(\/.*)?$/);
      if (!m) return all;
      dest = '/en/OWASP/WSTG-v4.2' + (m[1] || '/');
    } else return all;
    return `${attr}="${dest}${u.search}${u.hash}"`;
  });
}

async function copyReferencedAssets(html, sourcePath) {
  const refs = [];
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    let u;
    try { u = new URL(match[1], 'https://cheatsheetseries.owasp.org' + sourcePath); } catch { continue; }
    if (u.hostname === 'cheatsheetseries.owasp.org' && (u.pathname.startsWith('/assets/') || u.pathname.startsWith('/img/'))) refs.push(u.pathname);
  }
  for (const pathname of new Set(refs)) {
    const source = path.join(STATIC, decodeURIComponent(pathname.slice(1)));
    try {
      let content;
      try { content = await fs.readFile(source); }
      catch { content = await fs.readFile(path.join(ROOT, 'content/en/OWASP/CheatSheetSeries', decodeURIComponent(pathname.slice(1)))); }
      const target = path.join(DIST, 'en/OWASP/CheatSheetSeries', decodeURIComponent(pathname.slice(1)));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    } catch (error) { throw new Error('Cannot copy Cheat Sheet asset: ' + pathname, { cause: error }); }
  }
}

function renderedArticle(original) {
  const article = original.match(/<article class="md-content__inner md-typeset">([\s\S]*?)<\/article>/)?.[1];
  if (!article) return null;
  return article.trim();
}

function titleOf(html, fallback) {
  return (html.match(/<title>([^<]+?)\s+-\s+OWASP Cheat Sheet Series<\/title>/)?.[1] || fallback.replace(/_Cheat_Sheet$/, '').replace(/_/g, ' ')).trim();
}

function navigation(items, currentUrl) {
  const link = item => `<li class="wstg-nav-item" data-title="${escape(item.title)}"><a data-nav-url="${item.url}" href="${item.url}"${item.url === currentUrl ? ' aria-current="page"' : ''}>${escape(item.title)}</a></li>`;
  const group = (title, pages, open) => `<li class="wstg-nav-item" data-title="${title}"><details${open ? ' open' : ''}><summary><span class="wstg-nav-summary-row"><span class="wstg-nav-chevron" aria-hidden="true"></span><span>${title}</span></span></summary><ul>${pages.map(link).join('')}</ul></details></li>`;
  return `<nav class="wstg-nav series-nav" aria-label="Cheat Sheet Series contents"><label class="wstg-nav-filter-label" for="series-filter">Search contents</label><input id="series-filter" class="wstg-nav-filter" type="search" placeholder="Find a cheat sheet…" autocomplete="off"><div class="wstg-nav-filter-controls"><button type="button" class="wstg-nav-filter-clear" hidden>Clear</button><p class="wstg-nav-filter-count" aria-live="polite" hidden></p></div><div class="wstg-nav-controls"><button type="button" data-wstg-expand>Expand all</button><button type="button" data-wstg-collapse>Collapse all</button></div><ul class="wstg-nav-list">${link({ title: 'Introduction', url: ROOT_URL + '/' })}${group('Cheat Sheets', items.filter(i => i.sheet), true)}${group('Indexes', items.filter(i => !i.sheet && i.base !== 'Glossary.html'), items.some(i => !i.sheet && i.url === currentUrl))}${items.filter(i => i.base === 'Glossary.html').map(link).join('')}</ul></nav>`;
}

function outline(article) {
  return [...article.matchAll(/<h([23])\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g)].map(([, level, id, html]) => {
    const text = html.replace(/<a\b[^>]*class="headerlink"[^>]*>[\s\S]*?<\/a>/g, '').replace(/<[^>]*>/g, '').trim();
    return `<a href="#${encodeURIComponent(id)}"${level === '3' ? ' class="toc-sub"' : ''}>${text}</a>`;
  }).join('');
}

function readerPage(article, sourcePath, url, title, items, wstgPaths) {
  const cleanArticle = rewriteLinks(article, sourcePath, wstgPaths);
  const body = `<div class="mobile-toolbar"><button id="contents-toggle" type="button" aria-controls="doc-sidebar" aria-expanded="false">Contents</button><span>Cheat Sheet Series</span></div><div class="docs-layout"><aside id="doc-sidebar" class="sidebar" aria-label="Series contents"><div class="sidebar-book"><span class="eyebrow">OWASP</span><a href="${ROOT_URL}/">Cheat Sheet Series</a><span class="edition">English edition · ${items.filter(i => i.sheet).length} cheat sheets</span></div>${navigation(items, url)}</aside><main id="main-content" class="reading-pane"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a><span>/</span><a href="/en/OWASP/">OWASP</a><span>/</span><a href="${ROOT_URL}/">Cheat Sheet Series</a></nav><article class="doc-content">${cleanArticle}</article><nav class="page-navigation" aria-label="Previous and next page"></nav></main><aside class="page-outline" aria-label="On this page"><p class="eyebrow">On this page</p><nav id="page-toc">${outline(cleanArticle)}</nav><a class="back-top" href="#top">Back to top ↑</a></aside></div>`;
  return page({ title, description: 'OWASP Cheat Sheet Series · ' + title, url, document: true, body })
    .replace('<body class="documentation">', '<body id="top" class="documentation series-document">');
}

export async function buildCheatSheets() {
  const wstgPaths = new Set((await files(path.join(ROOT, 'vendor/wstg/site/v4.2'))).map(f => '/' + path.relative(path.join(ROOT, 'vendor/wstg/site'), f).split(path.sep).join('/')));
  const sourceSheets = (await files(SOURCES)).filter(f => f.endsWith('.md'));
  const items = [];
  for (const source of sourceSheets) {
    const base = path.basename(source, '.md') + '.html';
    const original = await fs.readFile(path.join(STATIC, 'cheatsheets', base), 'utf8');
    items.push({ base, original, title: titleOf(original, path.basename(base, '.html')), sourcePath: '/cheatsheets/' + base, relative: 'cheatsheets/' + base, url: ROOT_URL + '/cheatsheets/' + base, sheet: true });
  }
  for (const originalPath of await files(STATIC)) {
    const base = path.basename(originalPath);
    if (!/^(?:Glossary|IndexASVS|IndexMASVS|IndexProactiveControls|IndexTopTen)\.html$/i.test(base)) continue;
    const original = await fs.readFile(originalPath, 'utf8');
    items.push({ base, original, title: titleOf(original, base.replace(/\.html$/i, '')), sourcePath: '/' + base, relative: base, url: ROOT_URL + '/' + base, sheet: false });
  }
  for (const item of items) {
    const article = renderedArticle(item.original);
    if (!article) throw Error('Missing Cheat Sheet article: ' + item.base);
    await copyReferencedAssets(article, item.sourcePath);
    await write('en/OWASP/CheatSheetSeries/' + item.relative, readerPage(article, item.sourcePath, item.url, item.title, items, wstgPaths));
  }
  const indexes = items.filter(i => !i.sheet).map(i => `<li><a href="${i.url}">${escape(i.title)}</a></li>`).join('');
  const intro = `<h1 id="cheat-sheet-series">OWASP Cheat Sheet Series</h1><p>Concise, practical application security guidance for developers and security professionals.</p><h2 id="about-the-series">About the series</h2><p>Each cheat sheet focuses on a specific security topic, with recommendations, implementation details, and examples. This English edition contains ${sourceSheets.length} cheat sheets.</p><h2 id="cheat-sheets">Cheat sheets</h2><p>Browse the complete alphabetical list in the contents panel, or search it by topic. On smaller screens, open <strong>Contents</strong> to find a page.</p><ul><li><a href="${ROOT_URL}/cheatsheets/Authentication_Cheat_Sheet.html">Authentication</a></li><li><a href="${ROOT_URL}/cheatsheets/Authorization_Cheat_Sheet.html">Authorization</a></li><li><a href="${ROOT_URL}/cheatsheets/Input_Validation_Cheat_Sheet.html">Input Validation</a></li><li><a href="${ROOT_URL}/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html">SQL Injection Prevention</a></li></ul><h2 id="indexes">Indexes and glossary</h2><p>Find guidance by security standard, control, or terminology.</p><ul>${indexes}</ul><h2 id="sources-and-license">Sources and license</h2><p>Source: <a href="https://github.com/OWASP/CheatSheetSeries">OWASP/CheatSheetSeries</a>. Original publication: <a href="${seriesUrl}">OWASP Cheat Sheet Series</a>. Content is licensed under <a href="${ROOT_URL}/LICENSE.md">CC BY-SA 4.0</a>.</p>`;
  await write('en/OWASP/CheatSheetSeries/index.html', readerPage(intro, '/index.html', ROOT_URL + '/', 'OWASP Cheat Sheet Series', items, wstgPaths));
  await write('en/OWASP/CheatSheetSeries/LICENSE.md', await fs.readFile(path.join(ROOT, 'content/en/OWASP/CheatSheetSeries/LICENSE.md'), 'utf8'));
  return { pages: sourceSheets.length };
}
