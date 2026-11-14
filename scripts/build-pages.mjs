import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, GUIDE, SNAPSHOT, files } from './paths.mjs';

const docRoot = path.join(ROOT, 'content/en/OWASP/WSTG-v4.2/document');
const sourceDocs = (await files(docRoot)).filter(f => f.endsWith('.md'));
const outDir = path.join(ROOT, 'localization/ru/wstg-v4.2');

const pages = [];
let previous = [];
try { previous = JSON.parse(await fs.readFile(path.join(outDir, 'pages.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

for (const file of sourceDocs) {
  const rel = path.relative(docRoot, file).split(path.sep).join('/');
  const pageRel = rel.replace(/README\.md$/, 'index.html').replace(/\.md$/, '/index.html');
  let htmlPath = path.join(SNAPSHOT, 'v4.2', pageRel);
  let html;
  try {
    html = await fs.readFile(htmlPath, 'utf8');
  } catch (e) {
    if (rel === 'README.md') {
      htmlPath = path.join(SNAPSHOT, 'v4.2', 'index.html');
      html = await fs.readFile(htmlPath, 'utf8');
    } else {
      throw e;
    }
  }

  const article = html.match(/<article class="doc-content">([\s\S]*?)<\/article>/)?.[1] || '';
  const enTitle = article.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]*>/g, '').trim() || path.basename(file, '.md');
  const markdown = await fs.readFile(file, 'utf8');
  const wstgIdMatch = markdown.match(/^\|\s*(WSTG-[A-Z0-9]+-[0-9]+)\s*\|/m);
  const wstgId = wstgIdMatch ? wstgIdMatch[1] : null;

  const url = '/ru/OWASP/WSTG-v4.2/' + (rel === 'README.md' ? '' : rel.replace(/README\.md$/, '').replace(/\.md$/, '/'));

  pages.push({
    path: rel,
    url,
    enTitle,
    ruTitle: '',
    wstgId,
    status: 'pending',
    checks: {
      structure_match: false,
      code_blocks_intact: false,
      links_valid: false,
      technical_review: false,
      language_review: false,
      qa_passed: false
    },
    sourceCommit: 'e7267903759671fa38b478628725d8ef78d07c03',
    issues: []
  });
  // Regeneration must never erase completed translations or their review record.
  const prior = previous.find(p => p.path === rel);
  if (prior) Object.assign(pages.at(-1), prior, { path: rel, url, wstgId });
}

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'pages.json'), JSON.stringify(pages, null, 2) + '\n');
console.log(`Generated pages.json with ${pages.length} pages.`);
