import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, DIST, ORIGIN, files, write } from './paths.mjs';
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

function textOf(html, selector) { return html.match(selector)?.[1]?.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() || ''; }

function readerPage(html, url, title, toc = true, wstgPaths = new Set()) {
  const article = renderedArticle(html);
  if (article == null) throw Error('Cheat Sheet published page has no article: ' + url);
  const cleanArticle = rewriteLinks(article, new URL(url, 'https://cheatsheetseries.owasp.org').pathname, wstgPaths);
  const nav = toc ? '<aside class="page-outline" aria-label="On this page"><p class="eyebrow">On this page</p><nav id="page-toc"></nav></aside>' : '';
  const body = `<div class="series-layout"><main id="main-content" class="reading-pane series-reading"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a><span>/</span><a href="/en/OWASP/">OWASP</a><span>/</span><a href="${ROOT_URL}/">Cheat Sheet Series</a></nav><article class="doc-content">${cleanArticle}</article></main>${nav}</div>`;
  return page({ title, description: 'OWASP Cheat Sheet Series · ' + title, url, document: toc, body })
    .replace('<body class="documentation">', '<body id="top" class="documentation series-document">');
}

export async function buildCheatSheets() {
  const wstgPaths = new Set((await files(path.join(ROOT, 'vendor/wstg/site/v4.2'))).map(f => '/' + path.relative(path.join(ROOT, 'vendor/wstg/site'), f).split(path.sep).join('/')));
  const sourceSheets = (await files(SOURCES)).filter(f => f.endsWith('.md'));
  const htmlFiles = (await files(path.join(STATIC, 'cheatsheets'))).filter(f => f.endsWith('.html'));
  const bySlug = new Map(htmlFiles.map(f => [path.basename(f), f]));
  const sheets = sourceSheets.flatMap(f => {
    const slug = path.basename(f, '.md') + '.html';
    const htmlPath = bySlug.get(slug);
    if (!htmlPath) throw Error('Missing published Cheat Sheet: ' + slug);
    return [{ slug, htmlPath, sourcePath: f }];
  });
  const sheetCards = [];
  for (const [i, item] of sheets.entries()) {
    const original = await fs.readFile(item.htmlPath, 'utf8');
    const title = titleOf(original, path.basename(item.slug, '.html'));
    const description = textOf(original, /<meta name="description" content="([^"]*)"/);
    const relative = 'cheatsheets/' + item.slug;
    const url = ROOT_URL + '/' + relative;
    await copyReferencedAssets(renderedArticle(original), '/cheatsheets/' + item.slug);
    const pageHtml = readerPage(original, url, title, true, wstgPaths);
    await write('en/OWASP/CheatSheetSeries/' + relative, pageHtml);
    sheetCards.push(`<a class="resource-card" data-sheet-title="${escape(title.toLowerCase())}" href="${ROOT_URL}/${relative}"><span class="eyebrow">CHEAT SHEET ${String(i + 1).padStart(3, '0')}</span><h2>${escape(title)}</h2><p>${escape(description || 'Practical OWASP application security guidance.')}</p><span class="resource-link">Read cheat sheet <span aria-hidden="true">→</span></span></a>`);
  }
  for (const originalPath of await files(STATIC)) {
    const base = path.basename(originalPath);
    if (!/^(?:Glossary|IndexASVS|IndexMASVS|IndexProactiveControls|IndexTopTen)\.html$/i.test(base)) continue;
    const original = await fs.readFile(originalPath, 'utf8');
    const title = titleOf(original, base.replace(/\.html$/i, ''));
    await copyReferencedAssets(renderedArticle(original), '/' + base);
    await write('en/OWASP/CheatSheetSeries/' + base, readerPage(original, ROOT_URL + '/' + base, title, true, wstgPaths));
  }

  const body = `<main id="main-content" class="catalog resource-catalog"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a><span>/</span><a href="/en/OWASP/">OWASP</a><span>/</span><span>Cheat Sheet Series</span></nav><div class="catalog-heading"><span class="eyebrow">OWASP / PRACTICAL SECURITY GUIDANCE</span><h1>OWASP Cheat Sheet Series</h1><p>Concise, practical security guidance for developers and application security professionals.</p><p class="resource-notice">Complete English series snapshot: ${sheets.length} cheat sheets. Source repository: <a href="https://github.com/OWASP/CheatSheetSeries">OWASP/CheatSheetSeries</a>. Published snapshot: <a href="${seriesUrl}">official OWASP website</a>. This is a dated mirror; check OWASP for newer revisions.</p><p class="resource-notice">Content is licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. This independent mirror preserves the source and license notices.</p><label for="sheet-filter" class="sheet-filter-label">Find a cheat sheet</label><input id="sheet-filter" class="sheet-filter" type="search" placeholder="Search the ${sheets.length} English cheat sheets" autocomplete="off"><p id="sheet-count" class="catalog-note" aria-live="polite">${sheets.length} cheat sheets</p></div><div class="resource-grid" id="sheet-list">${sheetCards.join('\n')}</div><p class="license-note">OWASP, the OWASP logo, and related marks belong to their respective owners. <a href="${ROOT_URL}/LICENSE.md">View the source license</a>.</p></main>`;
  await write('en/OWASP/CheatSheetSeries/index.html', page({ title: 'OWASP Cheat Sheet Series', description: 'The English OWASP Cheat Sheet Series in the Raw2Crawl security library.', url: ROOT_URL + '/', body }));
  await write('en/OWASP/CheatSheetSeries/LICENSE.md', await fs.readFile(path.join(ROOT, 'content/en/OWASP/CheatSheetSeries/LICENSE.md'), 'utf8'));
  return { pages: sheets.length, sheets };
}
