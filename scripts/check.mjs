import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DIST, GUIDE, RU_GUIDE, ORIGIN, SNAPSHOT, RU_DOC_ROOT, LOCALIZATION_DIR, files } from './paths.mjs';
import { auditTranslations } from './translation-audit.mjs';

const errors = [];
// The owner keeps license documents locally; they are not required in a checkout.
const localOnlyLicenses = new Set([
  'LICENSE',
  'content/en/OWASP/CheatSheetSeries/LICENSE.md',
  'content/en/OWASP/WSTG-v4.2/LICENSE',
]);
async function sourceBytes(relative) {
  try { return await fs.readFile(path.join(ROOT, relative)); }
  catch (error) {
    if (error.code === 'ENOENT' && localOnlyLicenses.has(relative)) return null;
    throw error;
  }
}
const translationAudit = await auditTranslations();
errors.push(...translationAudit.errors);
const ids = new Map();
const htmlFiles = (await files(DIST)).filter(f => f.endsWith('.html'));
const decode = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  ids.set(file, new Set([...html.matchAll(/\b(?:id|name)="([^"]+)"/g)].map(m => decode(m[1]))));
}
let links = 0;
const brokenFragments = [];
for (const file of htmlFiles) {
  const html = await fs.readFile(file, 'utf8');
  const relative = '/' + path.relative(DIST, file).split(path.sep).join('/');
  const visibleHtml = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '').replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '');
  const references = [...visibleHtml.matchAll(/\b(href|src)="([^"]+)"/g)];
  for (const match of html.matchAll(/(?:content="\d+;url=|(?:window\.)?location\.replace\(")([^"]+)/g)) references.push(['', 'redirect', match[1]]);
  for (const m of references) {
    const value = decode(m[2]);
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) continue;
    const u = new URL(value, ORIGIN + relative);
    if (u.origin !== ORIGIN) {
      if (/^https:\/\/(?:wstg\.owasp\.org\/(?:v4\.2|stable|v42)\/|owasp\.org\/www-project-web-security-testing-guide\/(?:v42|v4\.2|stable)\/)/.test(u.href)) errors.push(`${relative}: nonlocal WSTG link ${value}`);
      if (/^https:\/\/cheatsheetseries\.owasp\.org\/cheatsheets\//.test(u.href)) {
        try { await fs.access(path.join(ROOT, 'vendor/cheatsheets/site', u.pathname)); errors.push(`${relative}: nonlocal Cheat Sheet link ${value}`); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      continue;
    }
    links++;
    let dest = path.join(DIST, decodeURIComponent(u.pathname));
    if (!dest.startsWith(DIST + path.sep) && dest !== DIST) { errors.push(`${relative}: path escapes dist`); continue; }
    try {
      if ((await fs.stat(dest)).isDirectory()) dest = path.join(dest, 'index.html');
      await fs.access(dest);
    } catch { errors.push(`${relative}: missing ${value}`); continue; }
    if (u.hash && ids.has(dest)) {
      let id;
      try { id = decodeURIComponent(u.hash.slice(1)); } catch { id = u.hash.slice(1); }
      if (!ids.get(dest).has(id)) brokenFragments.push({ page: relative, target: u.pathname + u.hash });
    }
  }
}

// The mirrored article and navigation markup must retain the original structure,
// titles, numbering, code highlighting, and prose. Only link destinations differ.
let compared = 0;
const ignoreDestinations = text => text.replace(/\b(?:href|src|content)="[^"]*"/g, 'url=""');
for (const original of (await files(path.join(SNAPSHOT, 'v4.2'))).filter(f => f.endsWith('.html'))) {
  const rel = path.relative(path.join(SNAPSHOT, 'v4.2'), original);
  const before = await fs.readFile(original, 'utf8');
  const after = await fs.readFile(path.join(DIST, GUIDE, rel), 'utf8');
  for (const pattern of [/<article class="doc-content">[\s\S]*?<\/article>/, /<nav class="wstg-nav"[\s\S]*?<\/nav>/]) {
    const a = before.match(pattern)?.[0];
    const b = after.match(pattern)?.[0];
    if (a && ignoreDestinations(a) !== ignoreDestinations(b || '')) errors.push(`Original article/sidebar changed: ${rel}`);
  }
  compared++;
}
for (const asset of await files(path.join(ROOT, 'assets'))) {
  const rel = path.relative(ROOT, asset);
  if (!(await fs.readFile(asset)).equals(await fs.readFile(path.join(DIST, rel)))) errors.push(`Site asset differs from source: ${rel}`);
}

// Verify all 138 release Markdown files have their corresponding published page.
const docRoot = path.join(ROOT, 'content/en/OWASP/WSTG-v4.2/document');
const sourceDocs = await files(docRoot);
for (const file of sourceDocs.filter(f => f.endsWith('.md'))) {
  const rel = path.relative(docRoot, file).split(path.sep).join('/');
  const page = rel.replace(/README\.md$/, 'index.html').replace(/\.md$/, '/index.html');
  try { await fs.access(path.join(DIST, GUIDE, page)); }
  catch { errors.push(`Release page missing: ${rel}`); }
}
const cheatsheetRoot = path.join(ROOT, 'content/en/OWASP/CheatSheetSeries/cheatsheets');
const cheatsheetSources = (await files(cheatsheetRoot)).filter(f => f.endsWith('.md'));
for (const file of cheatsheetSources) {
  const rel = path.basename(file, '.md') + '.html';
  try { await fs.access(path.join(DIST, 'en/OWASP/CheatSheetSeries/cheatsheets', rel)); }
  catch { errors.push(`Published Cheat Sheet missing: ${rel}`); }
}
if (!htmlFiles.some(f => f.replaceAll('\\', '/').includes('en/OWASP/CheatSheetSeries/index.html'))) errors.push('Cheat Sheet Series catalog missing');
// Every series page uses the documentation shell, including its introduction.
for (const file of htmlFiles.filter(f => f.replaceAll('\\', '/').includes('/en/OWASP/CheatSheetSeries/'))) {
  const html = await fs.readFile(file, 'utf8');
  const sidebar = html.match(/<aside id="doc-sidebar"[\s\S]*?<\/aside>/)?.[0] || '';
  const outline = html.match(/<nav id="page-toc">([\s\S]*?)<\/nav>/)?.[1] || '';
  const article = html.match(/<article class="doc-content">([\s\S]*?)<\/article>/)?.[1] || '';
  if (!html.includes('class="docs-layout"') || !sidebar.includes('id="series-filter"')) errors.push(`Series documentation layout missing: ${file}`);
  if (/\bid="(?:sheet|series)-filter"/.test(article)) errors.push(`Contents search inside series article: ${file}`);
  for (const source of cheatsheetSources) {
    const slug = path.basename(source, '.md') + '.html';
    if (!sidebar.includes(`href="/en/OWASP/CheatSheetSeries/cheatsheets/${slug}"`)) errors.push(`Sidebar missing ${slug}: ${file}`);
  }
  if (/<h[23]\b[^>]*\bid="/.test(article) && !outline.includes('<a ')) errors.push(`Series outline empty: ${file}`);
}
let seriesCompared = 0;
for (const original of (await files(path.join(ROOT, 'vendor/cheatsheets/site'))).filter(f => f.endsWith('.html'))) {
  const rel = path.relative(path.join(ROOT, 'vendor/cheatsheets/site'), original);
  const before = await fs.readFile(original, 'utf8');
  const after = await fs.readFile(path.join(DIST, 'en/OWASP/CheatSheetSeries', rel), 'utf8');
  const a = before.match(/<article class="md-content__inner md-typeset">([\s\S]*?)<\/article>/)?.[1]?.trim();
  const b = after.match(/<article class="doc-content">([\s\S]*?)<\/article>/)?.[1]?.trim();
  if (!a || ignoreDestinations(a) !== ignoreDestinations(b || '')) errors.push(`Cheat Sheet article changed: ${rel}`);
  seriesCompared++;
}
const seriesManifest = JSON.parse(await fs.readFile(path.join(ROOT, 'vendor/cheatsheets/provenance.json'), 'utf8'));
let verifiedSeriesChecksums = 0;
for (const [relative, expected] of Object.entries(seriesManifest.sha256)) {
  const bytes = await sourceBytes(relative);
  if (bytes === null) continue;
  verifiedSeriesChecksums++;
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) errors.push(`Cheat Sheet checksum mismatch: ${relative}`);
}
const seriesSourceFiles = await files(path.join(ROOT, 'content/en/OWASP/CheatSheetSeries'));
const missingLocalSeriesLicenses = [...localOnlyLicenses].filter(f => f.startsWith('content/en/OWASP/CheatSheetSeries/') && !seriesSourceFiles.some(s => path.relative(ROOT, s).replaceAll('\\', '/') === f)).length;
if (seriesSourceFiles.length !== seriesManifest.source_count - missingLocalSeriesLicenses) errors.push('Cheat Sheet source file count differs from provenance');
const blogRoot = path.join(ROOT, 'content/en/harmj0y');
const blog = JSON.parse(await fs.readFile(path.join(blogRoot, 'manifest.json'), 'utf8'));
if (blog.articles.length !== blog.reported_article_count || new Set(blog.articles.map(p => p.id)).size !== blog.articles.length) errors.push('Incomplete or duplicated harmj0y articles');
for (const category of blog.categories) {
  if (category.articles.length !== category.reported_count || blog.articles.filter(p => p.categories.includes(category.id)).length !== category.reported_count) errors.push(`Incomplete harmj0y category: ${category.name}`);
  const local = JSON.parse(await fs.readFile(path.join(blogRoot, category.folder, 'manifest.json'), 'utf8'));
  if (JSON.stringify(local) !== JSON.stringify(category)) errors.push(`harmj0y category manifest differs: ${category.name}`);
  const output = await fs.readFile(path.join(DIST, 'en/harmj0y', category.folder, 'index.html'), 'utf8');
  for (const post of blog.articles.filter(p => p.categories.includes(category.id))) {
    if (!output.includes(`href="${post.local_url}"`)) errors.push(`harmj0y category link missing: ${category.name}/${post.slug}`);
  }
}
const blogText = html => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
for (const post of blog.articles) {
  const source = post.archive_status === 'source-link' ? null : await fs.readFile(path.join(blogRoot, post.source), 'utf8');
  if (source !== null && crypto.createHash('sha256').update(source).digest('hex') !== post.sha256) errors.push(`harmj0y source checksum mismatch: ${post.slug}`);
  const output = await fs.readFile(path.join(DIST, post.local_url, 'index.html'), 'utf8');
  const body = output.match(/<div class="blog-article-body">([\s\S]*?)<\/div><footer class="article-source"/)[1];
  if (source !== null && blogText(source) !== blogText(body)) errors.push(`harmj0y article text changed: ${post.slug}`);
  if (source === null && !body.includes('not included in this local archive')) errors.push(`harmj0y source-only page not identified: ${post.slug}`);
  if (!output.includes(`href="${post.url}" rel="author external"`) || !/<footer class="article-source"[\s\S]*?<\/footer><\/article>/.test(output)) errors.push(`Missing source at end of harmj0y article: ${post.slug}`);
  if (!output.includes('id="harmjoy-filter"') || !output.includes('id="page-toc"><a')) errors.push(`harmj0y navigation missing: ${post.slug}`);
  if (/<img\b[^>]*\bsrc=["']https?:/i.test(body) || /\bsrcset=/.test(body)) errors.push(`harmj0y image not saved locally: ${post.slug}`);
}
for (const asset of blog.assets) {
  const source = await fs.readFile(path.join(blogRoot, asset.file));
  const output = await fs.readFile(path.join(DIST, 'en/harmj0y', asset.file));
  if (!source.equals(output) || crypto.createHash('sha256').update(source).digest('hex') !== asset.sha256) errors.push(`harmj0y asset differs: ${asset.file}`);
}
// Image bytes must remain identical to the release, not just have matching names.
for (const file of sourceDocs.filter(f => !f.endsWith('.md'))) {
  const rel = path.relative(docRoot, file);
  const output = path.join(DIST, GUIDE, rel);
  try {
    if (!(await fs.readFile(file)).equals(await fs.readFile(output))) errors.push(`Changed release asset: ${rel}`);
  } catch { errors.push(`Missing release asset: ${rel}`); }
}
// Confirm the vendored original has not drifted since import.
const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'vendor/wstg/provenance.json'), 'utf8'));
let verifiedWstgChecksums = 0;
for (const [relative, expected] of Object.entries(manifest.sha256)) {
  const bytes = await sourceBytes(relative);
  if (bytes === null) continue;
  verifiedWstgChecksums++;
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) errors.push(`Snapshot checksum mismatch: ${relative}`);
}
// Verify Russian edition
const ruSourceDocs = (await files(RU_DOC_ROOT)).filter(f => f.endsWith('.md'));
const ruSourceImages = (await files(RU_DOC_ROOT)).filter(f => !f.endsWith('.md'));
if (ruSourceImages.length !== sourceDocs.filter(f => !f.endsWith('.md')).length) errors.push('RU image inventory is incomplete or has unexpected assets');
const enLicense = await sourceBytes('content/en/OWASP/WSTG-v4.2/LICENSE');
let ruLicense = null;
try { ruLicense = await fs.readFile(path.join(RU_DOC_ROOT, '../LICENSE')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (enLicense && ruLicense && !enLicense.equals(ruLicense)) errors.push('RU license differs from the original');
const pagesData = JSON.parse(await fs.readFile(path.join(LOCALIZATION_DIR, 'pages.json'), 'utf8'));
const anchorsData = JSON.parse(await fs.readFile(path.join(LOCALIZATION_DIR, 'anchors.json'), 'utf8'));

for (const img of ruSourceImages) {
  const rel = path.relative(RU_DOC_ROOT, img);
  const enImg = path.join(docRoot, rel);
  const distImg = path.join(DIST, RU_GUIDE.slice(1), rel);
  try {
    const origBytes = await fs.readFile(enImg);
    const ruBytes = await fs.readFile(img);
    const distBytes = await fs.readFile(distImg);
    if (!origBytes.equals(ruBytes)) errors.push(`RU source image differs from EN original: ${rel}`);
    if (!origBytes.equals(distBytes)) errors.push(`RU dist image differs from EN original: ${rel}`);
  } catch {
    errors.push(`Missing RU image: ${rel}`);
  }
}

for (const p of pagesData) {
  const dest = path.join(DIST, p.url.slice(1).replace(/\/$/, '') + '/index.html');
  try {
    const html = await fs.readFile(dest, 'utf8');
    if (!html.includes('lang="ru"')) errors.push(`Missing lang="ru" on ${p.url}`);
    if (!html.includes(`<link rel="canonical" href="${ORIGIN}${p.url}">`)) errors.push(`Missing or incorrect canonical on ${p.url}`);
    if (!html.includes('hreflang="en"') || !html.includes('hreflang="ru"')) errors.push(`Missing hreflang on ${p.url}`);
    const enUrl = p.url.replace(/^\/ru\//, '/en/');
    if (!html.includes(`class="lang-link" href="${enUrl}"`)) errors.push(`Wrong EN counterpart on ${p.url}`);
    const enHtml = await fs.readFile(path.join(DIST, enUrl, 'index.html'), 'utf8');
    if (!enHtml.includes(`class="lang-link" href="${p.url}"`)) errors.push(`Wrong RU counterpart on ${enUrl}`);
    const nav = html.match(/<nav class="wstg-nav"[\s\S]*?<\/nav>/)?.[0] || '';
    if (!nav || [...nav.matchAll(/data-title="([^"]+)"/g)].some(m => !/[А-Яа-яЁё]/.test(m[1]))) errors.push(`Untranslated Russian navigation: ${p.url}`);
    const article = html.match(/<article class="doc-content">([\s\S]*?)<\/article>/)?.[1] || '';
    if (p.status === 'pending' && !article.includes('Перевод данного раздела находится в подготовке.')) errors.push(`Pending RU document has no honest notice: ${p.path}`);
    if (p.status !== 'pending' && article.includes('class="translation-notice"')) errors.push(`Translated RU document rendered as a placeholder: ${p.path}`);
    if (/href="\/en\/OWASP\/WSTG-v4\.2\//.test(article) && p.status !== 'pending') errors.push(`RU article points internally to EN: ${p.path}`);
  } catch {
    errors.push(`RU page missing in dist: ${p.url}`);
  }
}

let ruTranslatedChecked = 0;
for (const ruDoc of ruSourceDocs) {
  const rel = path.relative(RU_DOC_ROOT, ruDoc).split(path.sep).join('/');
  const md = await fs.readFile(ruDoc, 'utf8');
  if (/TODO|LOREM IPSUM/i.test(md)) errors.push(`Placeholder text found in ${rel}`);

  const anchors = anchorsData[rel];
  if (anchors) {
    const mdHeadings = [];
    let inCode = false;
    for (const line of md.split(/\r?\n/)) {
      if (line.startsWith('```')) { inCode = !inCode; continue; }
      if (inCode) continue;
      const m = line.match(/^(#{1,6})\s+(.+)$/);
      if (m) mdHeadings.push(m[1].length);
    }
    const expectedHeadings = anchors.headings.map(h => h.level);
    if (JSON.stringify(mdHeadings) !== JSON.stringify(expectedHeadings)) {
      errors.push(`RU document heading count mismatch in ${rel}: expected ${expectedHeadings.length}, got ${mdHeadings.length}`);
    }
  }
  ruTranslatedChecked++;
}

for (const catUrl of ['ru/index.html', 'ru/OWASP/index.html']) {
  try {
    const html = await fs.readFile(path.join(DIST, catUrl), 'utf8');
    if (!html.includes('lang="ru"')) errors.push(`Missing lang="ru" on /${catUrl}`);
  } catch {
    errors.push(`Missing Russian catalog: ${catUrl}`);
  }
}

if (brokenFragments.length) {
  const unique = [...new Set(brokenFragments.map(f => f.target))];
  errors.push(`Broken fragment targets (${unique.length} unique):\n${unique.join('\n')}`);
}
console.log(`Checked ${htmlFiles.length} HTML files and ${links} local links; ${sourceDocs.filter(f => f.endsWith('.md')).length} release documents; ${sourceDocs.filter(f => !f.endsWith('.md')).length} release images; ${verifiedWstgChecksums} source checksums (${Object.keys(manifest.sha256).length - verifiedWstgChecksums} local-only license documents absent).`);
console.log(`Compared ${compared} mirrored pages with original article/navigation markup and verified the custom design assets.`);
console.log(`Checked ${cheatsheetSources.length} Cheat Sheet source files against the published pages.`);
console.log(`Compared ${seriesCompared} Cheat Sheet articles and ${verifiedSeriesChecksums} source checksums (${Object.keys(seriesManifest.sha256).length - verifiedSeriesChecksums} local-only license documents absent).`);
console.log(`Checked ${blog.articles.filter(p => p.archive_status !== 'source-link').length} complete harmj0y articles, ${blog.articles.filter(p => p.archive_status === 'source-link').length} source-only pages, final source links, and ${blog.assets.length} local image checksums.`);
console.log(`Checked Russian edition: ${pagesData.length} RU routes, ${ruTranslatedChecked} translated documents, ${translationAudit.verified} verified, ${translationAudit.pending} pending; ${ruSourceImages.length} RU images; Markdown structure, code, inline tokens, links, WSTG IDs and anchors.`);
if (errors.length) throw Error([...new Set(errors)].join('\n'));
console.log('All checks passed.');
