import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { Marked } from 'marked';
import { EN_DOC_ROOT, RU_DOC_ROOT, LOCALIZATION_DIR, files } from './paths.mjs';

const marked = new Marked();
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Compare syntax and protected data, never infer semantic review from a ratio.
export function markdownInventory(md) {
  const result = { blocks: [], headings: [], code: [], inlineCode: [], destinations: [], ids: [], untranslated: [] };
  function inline(tokens = []) {
    for (const t of tokens) {
      if (t.type === 'codespan') result.inlineCode.push(t.raw);
      if (t.type === 'link' || t.type === 'image') result.destinations.push([t.type, t.href]);
      if (t.tokens) inline(t.tokens);
    }
  }
  function blocks(tokens) {
    for (const t of tokens) {
      if (t.type === 'space') continue;
      result.blocks.push(t.type);
      if (t.type === 'heading') result.headings.push(t.depth);
      if (t.type === 'code') result.code.push(t.raw.replace(/\r\n/g, '\n'));
      if (t.type === 'list') {
        result.blocks.push([t.ordered, t.start, t.items.length]);
        for (const item of t.items) blocks(item.tokens);
      } else if (t.type === 'blockquote') blocks(t.tokens);
      else if (t.type === 'table') {
        result.blocks.push([t.align, t.header.length, t.rows.map(row => row.length)]);
        for (const cell of [...t.header, ...t.rows.flat()]) inline(cell.tokens);
      } else inline(t.tokens);
      if (t.type === 'paragraph' && !/[А-Яа-яЁё]/.test(t.text) && /\b(?:the|this|that|should|must|these|which|with)\b/i.test(t.text)) {
        result.untranslated.push(t.text.slice(0, 180));
      }
    }
  }
  blocks(marked.lexer(md));
  result.ids = [...md.matchAll(/\bWSTG-[A-Z]+-\d+\b/g)].map(m => m[0]);
  return result;
}

export async function auditTranslations() {
  const pages = JSON.parse(await fs.readFile(path.join(LOCALIZATION_DIR, 'pages.json'), 'utf8'));
  const english = (await files(EN_DOC_ROOT)).filter(f => f.endsWith('.md')).map(f => path.relative(EN_DOC_ROOT, f).replaceAll('\\', '/'));
  const russian = (await files(RU_DOC_ROOT)).filter(f => f.endsWith('.md')).map(f => path.relative(RU_DOC_ROOT, f).replaceAll('\\', '/'));
  const errors = [];
  const reports = [];
  if (!equal(english.toSorted(), pages.map(p => p.path).toSorted())) errors.push('Translation registry does not match English document inventory');
  if (new Set(pages.map(p => p.url)).size !== pages.length) errors.push('Duplicate Russian routes');
  for (const rel of russian) if (!english.includes(rel)) errors.push(`Unexpected RU document: ${rel}`);
  for (const p of pages) {
    const exists = russian.includes(p.path);
    if (!['pending', 'translated', 'compared', 'verified'].includes(p.status)) errors.push(`Unknown translation status: ${p.path}: ${p.status}`);
    if (!exists) {
      if (p.status !== 'pending' || Object.values(p.checks).some(Boolean)) errors.push(`Missing translation marked complete: ${p.path}`);
      continue;
    }
    if (p.status === 'pending') errors.push(`Unregistered translation: ${p.path}`);
    const source = await fs.readFile(path.join(EN_DOC_ROOT, p.path), 'utf8');
    const translation = await fs.readFile(path.join(RU_DOC_ROOT, p.path), 'utf8');
    if (['compared', 'verified'].includes(p.status)) {
      const sha = s => createHash('sha256').update(s).digest('hex');
      if (p.reviewedSourceSha256 !== sha(source) || p.reviewedTranslationSha256 !== sha(translation)) errors.push(`Translation changed since semantic review: ${p.path}`);
    }
    const a = markdownInventory(source), b = markdownInventory(translation);
    const checks = {};
    for (const key of ['blocks', 'headings', 'code', 'inlineCode', 'destinations', 'ids']) {
      checks[key] = equal(a[key], b[key]);
      if (!checks[key]) errors.push(`Translation ${key} differ: ${p.path}`);
    }
    if (source === translation || !/[А-Яа-яЁё]/.test(translation)) errors.push(`English copy instead of translation: ${p.path}`);
    if (b.untranslated.length) errors.push(`Possible untranslated prose: ${p.path}: ${b.untranslated.join(' / ')}`);
    if (p.status === 'verified' && !Object.values(p.checks).every(Boolean)) errors.push(`Verified translation has incomplete checks: ${p.path}`);
    reports.push({ path: p.path, checks });
  }
  return { errors, reports, translated: russian.length, pending: english.length - russian.length, verified: pages.filter(p => p.status === 'verified').length };
}
