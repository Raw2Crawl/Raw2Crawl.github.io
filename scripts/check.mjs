import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, DIST, GUIDE, ORIGIN, SNAPSHOT, files } from './paths.mjs';

const errors = [];
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
  const references = [...html.matchAll(/\b(href|src)="([^"]+)"/g)];
  for (const match of html.matchAll(/(?:content="\d+;url=|(?:window\.)?location\.replace\(")([^"]+)/g)) references.push(['', 'redirect', match[1]]);
  for (const m of references) {
    const value = decode(m[2]);
    if (/^(?:mailto:|tel:|javascript:|data:)/.test(value)) continue;
    const u = new URL(value, ORIGIN + relative);
    if (u.origin !== ORIGIN) {
      if (/^https:\/\/(?:wstg\.owasp\.org\/(?:v4\.2|stable|v42)\/|owasp\.org\/www-project-web-security-testing-guide\/(?:v42|stable)\/)/.test(u.href)) errors.push(`${relative}: nonlocal WSTG link ${value}`);
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
for (const [relative, expected] of Object.entries(manifest.sha256)) {
  const actual = crypto.createHash('sha256').update(await fs.readFile(path.join(ROOT, relative))).digest('hex');
  if (actual !== expected) errors.push(`Snapshot checksum mismatch: ${relative}`);
}
if (brokenFragments.length) {
  const unique = [...new Set(brokenFragments.map(f => f.target))];
  errors.push(`Broken fragment targets (${unique.length} unique):\n${unique.join('\n')}`);
}
console.log(`Checked ${htmlFiles.length} HTML files and ${links} local links; ${sourceDocs.filter(f => f.endsWith('.md')).length} release documents; ${sourceDocs.filter(f => !f.endsWith('.md')).length} release images; ${Object.keys(manifest.sha256).length} source checksums.`);
console.log(`Compared ${compared} mirrored pages with original article/navigation markup and verified the custom design assets.`);
if (errors.length) throw Error([...new Set(errors)].join('\n'));
console.log('All checks passed.');
