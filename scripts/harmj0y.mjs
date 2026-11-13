import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DIST, write } from './paths.mjs';
import { page } from './layout.mjs';

export const HARMJOY = '/en/harmj0y/ActiveDirectory';
const SOURCE = path.join(ROOT, 'content/en/harmj0y/ActiveDirectory');
const escape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = s => s.replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => String.fromCodePoint(n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n))).replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const postUrl = post => `${HARMJOY}/${post.slug}/`;

function canonical(value, base) {
  const u = new URL(value.replace(/&amp;/g, '&'), base);
  if (u.protocol === 'http:') u.protocol = 'https:';
  if (u.hostname === 'www.harmj0y.net' && u.pathname.startsWith('/blog/')) {
    u.hostname = 'blog.harmj0y.net';
    u.pathname = u.pathname.slice('/blog'.length);
  }
  return u;
}

// Keep the complete article; replace presentation attributes and destinations.
export function renderHarmj0yArticle(original, post, manifest) {
  const media = new Map(manifest.assets.map(a => [canonical(a.url, post.url).href, HARMJOY + '/' + a.file]));
  const posts = new Map(manifest.articles.map(p => [p.slug, p]));
  let html = original.replace(/\s(?:srcset|sizes|style)=(?:"[^"]*"|'[^']*')/gi, '');
  html = html.replace(/\b(href|src|poster)=("([^"]*)"|'([^']*)')/gi, (all, attr, quoted, double, single) => {
    const value = double ?? single;
    if (/^(?:data:|mailto:|tel:|#)/i.test(value)) return all;
    let u;
    try { u = canonical(value, post.url); } catch { return all; }
    const asset = media.get(u.href);
    if (asset) return `${attr}="${asset}"`;
    if (u.hostname === 'blog.harmj0y.net') {
      const slug = u.pathname.replace(/\/$/, '').split('/').pop();
      const target = posts.get(slug);
      // Comments are not part of the article archive.
      if (target && !/^#(?:comment|respond)/.test(u.hash)) return `${attr}="${postUrl(target)}${u.search}${u.hash}"`;
      if (u.pathname === '/category/activedirectory/') return `${attr}="${HARMJOY}/"`;
    }
    return `${attr}="${escape(u.href)}"`;
  });
  const usedIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1]));
  let index = 0;
  html = html.replace(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi, (all, level, attrs, contents) => {
    if (/\bid=/.test(attrs)) return all;
    let id;
    do { id = 'section-' + (++index); } while (usedIds.has(id));
    usedIds.add(id);
    return `<h${level}${attrs} id="${id}">${contents}</h${level}>`;
  });
  return html;
}

function outline(html) {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/h\1>/gi)];
  const min = headings.length ? Math.min(...headings.map(m => Number(m[1]))) : 2;
  return headings.map(([, level, id, title]) => `<a href="#${encodeURIComponent(id)}"${Number(level) > min ? ' class="toc-sub"' : ''}>${escape(text(title))}</a>`).join('');
}

function sidebar(manifest, current) {
  const link = (url, title) => `<li class="wstg-nav-item" data-title="${escape(title)}"><a data-nav-url="${url}" href="${url}"${url === current ? ' aria-current="page"' : ''}>${escape(title)}</a></li>`;
  return `<aside id="doc-sidebar" class="sidebar" aria-label="Blog contents"><div class="sidebar-book"><span class="eyebrow">harmj0y</span><a href="/en/harmj0y/">Blog archive</a><span class="edition">ActiveDirectory · ${manifest.articles.length} articles</span></div><nav class="wstg-nav series-nav" aria-label="ActiveDirectory articles"><label for="harmjoy-filter" class="wstg-nav-filter-label">Search contents</label><input id="harmjoy-filter" type="search" class="wstg-nav-filter" placeholder="Find an article…" autocomplete="off"><div class="wstg-nav-filter-controls"><button type="button" class="wstg-nav-filter-clear" hidden>Clear</button><p class="wstg-nav-filter-count" aria-live="polite" hidden></p></div><ul class="wstg-nav-list">${link(HARMJOY + '/', 'ActiveDirectory')}${manifest.articles.map(p => link(postUrl(p), p.title)).join('')}</ul></nav></aside>`;
}

function document(title, url, article, manifest) {
  const toc = outline(article);
  const body = `<div class="mobile-toolbar"><button id="contents-toggle" type="button" aria-controls="doc-sidebar" aria-expanded="false">Contents</button><span>harmj0y / ActiveDirectory</span></div><div class="docs-layout">${sidebar(manifest, url)}<main id="main-content" class="reading-pane"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a><span>/</span><a href="/en/harmj0y/">harmj0y</a><span>/</span><a href="${HARMJOY}/">ActiveDirectory</a></nav><article class="doc-content">${article}</article><nav class="page-navigation" aria-label="Previous and next page"></nav></main><aside class="page-outline" aria-label="On this page"><p class="eyebrow">On this page</p><nav id="page-toc">${toc || '<a href="#article-title">Article</a><a href="#original-source">Original source</a>'}</nav><a class="back-top" href="#top">Back to top ↑</a></aside></div>`;
  return page({ title, url, document: true, body }).replace('<body class="documentation">', '<body id="top" class="documentation blog-document">');
}

export async function buildHarmj0y() {
  const manifest = JSON.parse(await fs.readFile(path.join(SOURCE, 'manifest.json'), 'utf8'));
  if (manifest.articles.length !== manifest.category.reported_count) throw Error('Incomplete harmj0y category snapshot');
  for (const asset of manifest.assets) {
    const source = path.join(SOURCE, asset.file);
    const bytes = await fs.readFile(source);
    if (!asset.sha256 || hash(bytes) !== asset.sha256) throw Error('Invalid harmj0y asset: ' + asset.file);
    const target = path.join(DIST, HARMJOY, asset.file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target);
  }
  for (const post of manifest.articles) {
    const original = await fs.readFile(path.join(SOURCE, post.source), 'utf8');
    if (hash(original) !== post.sha256) throw Error('Changed harmj0y source: ' + post.slug);
    const rendered = renderHarmj0yArticle(original, post, manifest);
    const article = `<h1 id="article-title">${escape(post.title)}</h1><p class="article-meta">${escape(post.author)} · <time datetime="${post.date.slice(0, 10)}">${post.date.slice(0, 10)}</time> · ActiveDirectory</p><div class="blog-article-body">${rendered}</div><footer class="article-source" id="original-source"><p>Original article by ${escape(post.author)}</p><a href="${escape(post.url)}" rel="author external">${escape(post.title)} — blog.harmj0y.net ↗</a></footer>`;
    await write(HARMJOY.slice(1) + '/' + post.slug + '/index.html', document(post.title, postUrl(post), article, manifest));
  }
  const list = manifest.articles.map(p => `<li><a href="${postUrl(p)}">${escape(p.title)}</a> <span class="article-meta">(${p.date.slice(0, 10)})</span></li>`).join('');
  const intro = `<h1 id="article-title">ActiveDirectory</h1><p>Articles by harmj0y, preserved in English with their original publication dates, images, and source links.</p><h2 id="articles">Articles</h2><ol class="archive-list">${list}</ol><h2 id="about-this-archive">About this archive</h2><p>This collection contains all ${manifest.articles.length} posts assigned to the <a href="${manifest.category.url}">ActiveDirectory category</a> at the time of import. Other categories can be added separately.</p><p>Copyright remains with the original author. The original source is linked at the end of each article.</p>`;
  await write(HARMJOY.slice(1) + '/index.html', document('ActiveDirectory | harmj0y', HARMJOY + '/', intro, manifest));
  const body = `<main id="main-content" class="catalog"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/en/">Library</a><span>/</span><span>harmj0y</span></nav><div class="catalog-heading"><span class="eyebrow">BLOG ARCHIVE</span><h1>harmj0y</h1><p>Security research by Will Schroeder.</p></div><div class="catalog-grid"><a class="catalog-card" href="${HARMJOY}/"><span class="card-meta">CATEGORY</span><h2>ActiveDirectory</h2><p>Active Directory security research, Kerberos, domain trusts, and certificate services.</p><span class="card-bottom"><span>${manifest.articles.length} articles · English</span><span aria-hidden="true">→</span></span></a></div></main>`;
  await write('en/harmj0y/index.html', page({ title: 'harmj0y', url: '/en/harmj0y/', body }));
  return { pages: manifest.articles.length, assets: manifest.assets.length };
}
