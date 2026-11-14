import fs from 'node:fs/promises';
import path from 'node:path';
import { Marked } from 'marked';
import { ROOT, GUIDE, SNAPSHOT, files } from './paths.mjs';

const docRoot = path.join(ROOT, 'content/en/OWASP/WSTG-v4.2/document');
const sourceDocs = (await files(docRoot)).filter(f => f.endsWith('.md'));

const anchorsMap = {};

for (const file of sourceDocs) {
  const rel = path.relative(docRoot, file).split(path.sep).join('/');
  let pageRel = rel.replace(/README\.md$/, 'index.html').replace(/\.md$/, '/index.html');
  let htmlPath = path.join(SNAPSHOT, 'v4.2', pageRel);

  // If README.md in root, in snapshot it was either index.html or 0-Foreword/index.html
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
  const headingMatches = [...article.matchAll(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi)];
  const headings = headingMatches.map((m, idx) => {
    const level = parseInt(m[1].slice(1), 10);
    const id = m[2].match(/\bid="([^"]+)"/)?.[1] || null;
    const en = m[3].replace(/<[^>]+>/g, '').trim();
    return { index: idx, level, id, en };
  });

  const allIds = [...new Set([...article.matchAll(/\b(?:id|name)="([^"]+)"/g)].map(m => m[1]))];

  const pageUrl = rel === 'README.md' ? GUIDE + '/' : GUIDE + '/' + rel.replace(/README\.md$/, '').replace(/\.md$/, '/');

  anchorsMap[rel] = {
    url: pageUrl,
    headings,
    allIds
  };
  // The root HTML duplicates Foreword, but the release Markdown is the book TOC.
  if (rel === 'README.md') {
    const source = await fs.readFile(file, 'utf8');
    const headingTokens = new Marked().lexer(source).filter(t => t.type === 'heading');
    const slug = text => text.toLowerCase().replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[^\p{L}\p{N}_\s-]/gu, '').replace(/\s/g, '-');
    anchorsMap[rel].headings = headingTokens.map((t, index) => ({ index, level: t.depth, id: slug(t.text), en: t.text }));
    anchorsMap[rel].allIds = anchorsMap[rel].headings.map(h => h.id);
  }
}

const outDir = path.join(ROOT, 'localization/ru/wstg-v4.2');
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, 'anchors.json'), JSON.stringify(anchorsMap, null, 2) + '\n');

console.log(`Generated anchors.json with ${Object.keys(anchorsMap).length} documents.`);
