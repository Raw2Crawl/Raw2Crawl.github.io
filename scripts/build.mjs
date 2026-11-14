import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, DIST, GUIDE, ORIGIN, SNAPSHOT, files, write } from './paths.mjs';
import { documentPage, catalogPage, page } from './layout.mjs';
import { buildCheatSheets } from './cheatsheets.mjs';
import { buildHarmj0y } from './harmj0y.mjs';
import { buildRuSite } from './ru-builder.mjs';

// Only dist is disposable. Source snapshots are never modified by the build.
if (path.resolve(DIST) !== path.join(ROOT, 'dist')) throw Error('Unsafe output path');
await fs.rm(DIST, { recursive: true, force: true });
await fs.mkdir(DIST, { recursive: true });
await fs.cp(path.join(ROOT, 'assets'), path.join(DIST, 'assets'), { recursive: true });

const sourceFiles = await files(path.join(SNAPSHOT, 'v4.2'));
const sourcePaths = new Set(sourceFiles.map(f => '/' + path.relative(SNAPSHOT, f).split(path.sep).join('/')));
const sheetPaths = new Set((await files(path.join(ROOT, 'vendor/cheatsheets/site'))).map(f => '/' + path.relative(path.join(ROOT, 'vendor/cheatsheets/site'), f).split(path.sep).join('/')));
function existingPage(p) {
  let candidate = p.replace(/\.md$/i, '').replace(/\/README$/i, '/');
  if (sourcePaths.has(candidate)) return candidate;
  if (sourcePaths.has(candidate.replace(/\/$/, '') + '/index.html')) return candidate.replace(/\/$/, '') + '/';
  candidate = candidate.replace(/\.html$/i, '');
  if (sourcePaths.has(candidate + '/index.html')) return candidate + '/';
  return p;
}

function localize(value, sourceUrl) {
  const decoded = value.replace(/&amp;/g, '&');
  if (/^(?:#|mailto:|tel:|javascript:|data:)/i.test(decoded)) return value;
  let u;
  try { u = new URL(decoded, 'https://wstg.owasp.org' + sourceUrl); } catch { return value; }
  if (u.hostname === 'owasp.org') {
    const match = u.pathname.match(/^\/www-project-web-security-testing-guide\/(v42|v4\.2|stable)(\/.*)?$/);
    if (!match) return value;
    u = new URL('/v4.2' + (match[2] || '/'), 'https://wstg.owasp.org');
    const original = new URL(decoded, 'https://wstg.owasp.org');
    u.hash = original.hash;
    u.search = original.search;
  }
  if (u.hostname === 'cheatsheetseries.owasp.org' && (u.pathname.startsWith('/cheatsheets/') || /^\/(?:Glossary|IndexASVS|IndexMASVS|IndexProactiveControls|IndexTopTen)\.html$/.test(u.pathname))) {
    // This old page was retired upstream and is absent from the current series.
    if (!sheetPaths.has(u.pathname)) return value;
    if (u.pathname.endsWith('/Transport_Layer_Protection_Cheat_Sheet.html') && u.hash === '#carefully-consider-the-use-of-wildcard-certificates') u.pathname = u.pathname.replace('Transport_Layer_Protection', 'Transport_Layer_Security');
    return '/en/OWASP/CheatSheetSeries' + u.pathname + u.search + u.hash;
  }
  if (u.hostname !== 'wstg.owasp.org') return value;
  u.pathname = u.pathname.replace(/^\/(?:v42|stable)(?=\/|$)/, '/v4.2');
  let target;
  if (u.pathname.startsWith('/v4.2/')) target = existingPage(u.pathname).replace(/^\/v4\.2/, GUIDE);
  else if (u.pathname.startsWith('/assets/')) target = u.pathname;
  else if (u.pathname === '/') target = '/en/';
  else return u.href; // Versions outside 4.2 remain explicitly external.
  return target + u.search + u.hash;
}

let htmlCount = 0;
for (const source of sourceFiles) {
  const relative = path.relative(path.join(SNAPSHOT, 'v4.2'), source).split(path.sep).join('/');
  const dest = GUIDE.slice(1) + '/' + relative;
  if (!source.endsWith('.html')) {
    await fs.mkdir(path.dirname(path.join(DIST, dest)), { recursive: true });
    await fs.copyFile(source, path.join(DIST, dest));
    continue;
  }
  const sourceUrl = '/v4.2/' + relative.replace(/index\.html$/, '');
  let html = await fs.readFile(source, 'utf8');
  html = html.replace(/\b(href|src|content)="([^"]*)"/g, (all, attr, value) => {
    if (attr === 'content' && !/^https?:/.test(value)) return all;
    let target = localize(value, sourceUrl);
    if (attr === 'content' && target.startsWith('/')) target = ORIGIN + target;
    return `${attr}="${target.replace(/&(?!amp;)/g, '&amp;')}"`;
  });
  // Jekyll redirect aliases contain a JSON string in addition to the HTML URL.
  html = html.replace(/https:\/\/wstg\.owasp\.org\/(?:v4\.2|stable|v42)\//g, ORIGIN + GUIDE + '/');
  html = html.replace(/((?:window\.)?location\.replace\(")\/(?:v4\.2|stable|v42)\//g, '$1' + GUIDE + '/');
  html = html.replace(/(content="0;url=)\/(?:v4\.2|stable|v42)\//g, '$1' + GUIDE + '/');
  html = html.replace(/(<link rel="canonical" href=")\//g, '$1' + ORIGIN + '/');
  // A broken upstream same-page anchor; preserve the prose and correct the target.
  html = html.replace(/href="#example-4:-yet-another-\(useful\)-GET-Example"/g, 'href="#example-4-yet-another-useful-get-example"');
  const localUrl = GUIDE + '/' + relative.replace(/index\.html$/, '');
  await write(dest, html.includes('<article class="doc-content">') ? documentPage(html, localUrl) : html);
  htmlCount++;
}

await write('en/index.html', catalogPage());
await write('en/OWASP/index.html', catalogPage(true));
const cheatSheets = await buildCheatSheets();
const harmj0y = await buildHarmj0y();
const ru = await buildRuSite();
await write('index.html', '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/en/"><title>Raw2Crawl</title><link rel="canonical" href="' + ORIGIN + '/en/"><link rel="alternate" hreflang="en" href="' + ORIGIN + '/en/"><link rel="alternate" hreflang="ru" href="' + ORIGIN + '/ru/"></head><body><a href="/en/">English library</a> · <a href="/ru/">Русская библиотека</a></body></html>');
await write('404.html', page({ title: 'Page not found', url: '/404.html', body: '<main id="main-content" class="catalog"><h1>Page not found</h1><p><a href="/en/">Return to the library</a></p></main>' }));
await write('.nojekyll', '');
await write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const pages = (await files(DIST)).filter(f => f.endsWith('.html') && path.basename(f) !== '404.html').map(f => '/' + path.relative(DIST, f).split(path.sep).join('/').replace(/index\.html$/, ''));
await write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + pages.map(p => `<url><loc>${ORIGIN}${p}</loc></url>`).join('') + '</urlset>');
console.log(`Built ${htmlCount} WSTG EN HTML pages, ${ru.totalPages} RU pages (${ru.translatedCount} translated), ${sourceFiles.length - htmlCount} EN images, ${ru.imagesCount} RU images, ${cheatSheets.pages} Cheat Sheets, ${harmj0y.pages} harmj0y articles with ${harmj0y.assets} assets, and libraries in dist/.`);
