import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DIST = path.join(ROOT, 'dist');
export const GUIDE = '/en/OWASP/WSTG-v4.2';
export const RU_GUIDE = '/ru/OWASP/WSTG-v4.2';
export const ORIGIN = 'https://raw2crawl.github.io';
export const SNAPSHOT = path.join(ROOT, 'vendor/wstg/site');
export const RU_DOC_ROOT = path.join(ROOT, 'content/ru/OWASP/WSTG-v4.2/document');
export const EN_DOC_ROOT = path.join(ROOT, 'content/en/OWASP/WSTG-v4.2/document');
export const LOCALIZATION_DIR = path.join(ROOT, 'localization/ru/wstg-v4.2');

export async function files(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(name));
    else result.push(name);
  }
  return result.sort();
}

export async function write(relative, text) {
  const target = path.resolve(DIST, relative.replace(/^\/+/, ''));
  if (!target.startsWith(DIST + path.sep)) throw Error('Output outside dist');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, text);
}
