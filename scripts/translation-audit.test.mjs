import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownInventory } from './translation-audit.mjs';

const source = '# Summary\n\nA paragraph with `id` and a [link](test.md#test).\n\n```http\nGET /?id=1 HTTP/1.1\n```\n\n| Name | Value |\n|---|---|\n| A | B |\n';
const translated = source.replace('Summary', 'Описание').replace('A paragraph with', 'Абзац с').replace('and a', 'и').replace('[link]', '[ссылкой]').replace('Name', 'Имя').replace('Value', 'Значение');
test('prose and table labels may change without changing syntax or technical data', () => {
  const a = markdownInventory(source), b = markdownInventory(translated);
  for (const key of ['blocks', 'headings', 'code', 'inlineCode', 'destinations', 'ids']) assert.deepEqual(a[key], b[key], key);
});
test('detects code, inline-token, link and heading corruption independently', () => {
  const original = markdownInventory(translated);
  for (const [from, to, key] of [
    ['GET /?id=1', 'GET /?id=2', 'code'],
    ['`id`', '`user`', 'inlineCode'],
    ['test.md#test', 'test.md#missing', 'destinations'],
    ['# Описание', '## Описание', 'headings'],
    ['| A | B |', '| A | B |\n| C | D |', 'blocks'],
  ]) assert.notDeepEqual(original[key], markdownInventory(translated.replace(from, to))[key], key);
});
test('detects removed paragraphs, list items and changed WSTG IDs', () => {
  const a = markdownInventory('# Title\n\nFirst.\n\nSecond.\n\n- one\n- two\n\nWSTG-INFO-01\n');
  const b = markdownInventory('# Title\n\nFirst.\n\n- one\n\nWSTG-INFO-02\n');
  assert.notDeepEqual(a.blocks, b.blocks);
  assert.notDeepEqual(a.ids, b.ids);
});
