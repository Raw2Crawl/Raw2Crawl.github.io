import fs from 'node:fs/promises';
import path from 'node:path';
import { Marked } from 'marked';
import { ROOT, DIST, GUIDE, RU_GUIDE, SNAPSHOT, RU_DOC_ROOT, LOCALIZATION_DIR, files, write } from './paths.mjs';
import { page, documentPage, catalogPage } from './layout.mjs';
import { ruNavTitles } from './ru-nav-data.mjs';
import { auditTranslations } from './translation-audit.mjs';

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function translatedTitle(enTitle) {
  const plain = text => text.replace(/^(?:\d+(?:\.\d+)*\.?\s+|Appendix [A-F][.:]\s+|Приложение [A-F]\.\s+)/, '');
  const match = Object.entries(ruNavTitles).find(([en]) => plain(en) === plain(enTitle));
  return ruNavTitles[enTitle] || (match ? plain(match[1]) : enTitle);
}

function resolveRuUrl(href, currentDocRel) {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return href;
  if (href.startsWith('#')) return '#' + href.slice(1).toLowerCase();
  let [targetPath, hash] = href.split('#');
  let [pathname, query] = targetPath.split('?');
  targetPath = pathname;
  const currentDir = path.dirname(currentDocRel);
  let resolvedRel;
  if (targetPath) {
    resolvedRel = path.normalize(path.join(currentDir, targetPath)).split(path.sep).join('/');
  } else {
    resolvedRel = currentDocRel;
  }
  // Only document links become routes. Preserve asset filenames and queries.
  if (path.posix.extname(resolvedRel) && !/\.md$/i.test(resolvedRel)) {
    return `${RU_GUIDE}/${resolvedRel}${query ? '?' + query : ''}${hash ? '#' + hash : ''}`;
  }
  let cleanRel = resolvedRel.replace(/\.md$/i, '').replace(/(?:^|\/)README$/i, '').replace(/\/+$/, '');
  if (cleanRel === '.') cleanRel = '';
  const url = cleanRel ? `${RU_GUIDE}/${cleanRel}/` : `${RU_GUIDE}/`;
  return url + (query ? '?' + query : '') + (hash ? '#' + hash.toLowerCase() : '');
}

function resolveRuImg(src, currentDocRel) {
  if (/^(?:https?:|data:)/i.test(src)) return src;
  const currentDir = path.dirname(currentDocRel);
  const resolved = path.normalize(path.join(currentDir, src)).split(path.sep).join('/');
  return `${RU_GUIDE}/${resolved}`;
}

export async function buildRuNavigation() {
  const sample = await fs.readFile(path.join(SNAPSHOT, 'v4.2/0-Foreword/index.html'), 'utf8');
  let nav = sample.match(/<nav class="wstg-nav"[\s\S]*?<\/nav>/)?.[0];
  if (!nav) throw Error('Could not extract wstg-nav from vendor snapshot');

  nav = nav.replace(/aria-label="WSTG Contents \(v4\.2\)"/g, 'aria-label="Оглавление WSTG (v4.2)"');
  nav = nav.replace(/<p class="wstg-nav-home"><a href="\/">[^<]*<\/a><\/p>/, '<p class="wstg-nav-home"><a href="/ru/">← Каталог</a></p>');
  nav = nav.replace(/<h2 class="wstg-nav-title"><a href="\/v4\.2\/">[^<]*<\/a><\/h2>/, `<h2 class="wstg-nav-title"><a href="${RU_GUIDE}/">Оглавление WSTG (v4.2)</a></h2>`);
  nav = nav.replace(/<label class="wstg-nav-filter-label" for="wstg-nav-filter-v42">[^<]*<\/label>/, '<label class="wstg-nav-filter-label" for="wstg-nav-filter-v42">Поиск по содержанию</label>');
  nav = nav.replace(/placeholder="Filter \([^"]*\)"/, 'placeholder="Поиск (XSS, SQL, WSTG-INPV-01, 4.7)"');
  nav = nav.replace(/>Clear Filter</g, '>Очистить<');
  nav = nav.replace(/>Expand All</g, '>Развернуть всё<');
  nav = nav.replace(/>Collapse All</g, '>Свернуть всё<');

  nav = nav.replace(/\/v4\.2\//g, `${RU_GUIDE}/`);

  // Translate individual attributes/text nodes: a <li> regexp consumes nested
  // children and used to leave the first item of every section in English.
  nav = nav.replace(/\b(data-title|title)="([^"]*)"/g, (all, attr, title) => {
    if (attr === 'data-title' && !ruNavTitles[title]) throw Error(`Missing RU navigation title: ${title}`);
    return ruNavTitles[title] ? `${attr}="${escape(ruNavTitles[title])}"` : all;
  });
  nav = nav.replace(/>([^<>]+)</g, (all, text) => ruNavTitles[text] ? `>${escape(ruNavTitles[text])}<` : all);

  return nav;
}

export async function buildRuSite() {
  const audit = await auditTranslations();
  if (audit.errors.length) throw Error(audit.errors.join('\n'));
  const anchorsData = JSON.parse(await fs.readFile(path.join(LOCALIZATION_DIR, 'anchors.json'), 'utf8'));
  const pagesData = JSON.parse(await fs.readFile(path.join(LOCALIZATION_DIR, 'pages.json'), 'utf8'));
  const ruNav = await buildRuNavigation();

  // Copy images
  const ruImageFiles = (await files(RU_DOC_ROOT)).filter(f => !f.endsWith('.md'));
  for (const img of ruImageFiles) {
    const rel = path.relative(RU_DOC_ROOT, img);
    const dest = path.join(DIST, RU_GUIDE.slice(1), rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(img, dest);
  }

  let translatedCount = 0;
  let placeholderCount = 0;

  for (const pageInfo of pagesData) {
    const docRel = pageInfo.path;
    const ruUrl = pageInfo.url;
    const enUrl = pageInfo.url.replace(/^\/ru\//, '/en/');
    const destRel = ruUrl.slice(1).replace(/\/$/, '') + '/index.html';
    const anchorsInfo = anchorsData[docRel] || { headings: [] };
    const headingsList = anchorsInfo.headings || [];

    const mdPath = path.join(RU_DOC_ROOT, docRel);
    let mdContent = null;
    try {
      mdContent = await fs.readFile(mdPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    let articleHtml = '';
    let pageTitle = pageInfo.ruTitle || pageInfo.enTitle;

    if (mdContent) {
      let headingIdx = 0;
      const marked = new Marked();
      marked.use({
        renderer: {
          heading({ tokens, depth }) {
            const text = this.parser.parseInline(tokens);
            const anchor = headingsList[headingIdx];
            if (!anchor || anchor.level !== depth) throw Error(`Heading map mismatch: ${docRel} #${headingIdx}`);
            const id = anchor.id;
            headingIdx++;
            return `<h${depth} id="${id}">${text}</h${depth}>\n`;
          },
          link({ href, title, tokens }) {
            const text = this.parser.parseInline(tokens);
            const resolved = resolveRuUrl(href, docRel);
            const titleAttr = title ? ` title="${escape(title)}"` : '';
            return `<a href="${escape(resolved)}"${titleAttr}>${text}</a>`;
          },
          image({ href, title, text }) {
            const resolved = resolveRuImg(href, docRel);
            const altAttr = text ? ` alt="${escape(text)}"` : ' alt=""';
            const titleAttr = title ? ` title="${escape(title)}"` : '';
            return `<img src="${escape(resolved)}"${altAttr}${titleAttr}>`;
          }
        }
      });

      const bodyHtml = marked.parse(mdContent);
      articleHtml = `<article class="doc-content">\n${bodyHtml}\n</article>`;
      const h1Match = bodyHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      if (h1Match) pageTitle = h1Match[1].replace(/<[^>]*>/g, '').trim();
      translatedCount++;
    } else {
      const enTitle = pageInfo.enTitle;
      const ruTitle = translatedTitle(enTitle);
      pageTitle = ruTitle;
      const anchorTags = (anchorsInfo.allIds || []).map(id => `<span id="${id}" aria-hidden="true"></span>`).join('');
      articleHtml = `<article class="doc-content">
${anchorTags}
<h1>${escape(ruTitle)}</h1>
<div class="translation-notice">
  <p><strong>Перевод данного раздела находится в подготовке.</strong></p>
  <p>Вы можете ознакомиться с оригинальным текстом руководства на английском языке:</p>
  <p><a href="${enUrl}" class="primary-link">${escape(enTitle)} ↗</a></p>
</div>
</article>`;
      placeholderCount++;
    }

    const fullPage = documentPage(
      `${ruNav}\n${articleHtml}`,
      ruUrl,
      { lang: 'ru', alternate: enUrl }
    );

    await write(destRel, fullPage);
  }

  // Catalogs
  await write('ru/index.html', catalogPage(false, 'ru'));
  await write('ru/OWASP/index.html', catalogPage(true, 'ru'));

  return { translatedCount, placeholderCount, totalPages: pagesData.length, imagesCount: ruImageFiles.length };
}
