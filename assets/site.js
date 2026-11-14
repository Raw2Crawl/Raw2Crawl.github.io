(() => {
  'use strict';
  const isRu = document.documentElement.lang === 'ru';
  const themeButton = document.querySelector('#theme-toggle');
  const media = matchMedia('(prefers-color-scheme: dark)');
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (!themeButton) return;
    if (isRu) {
      themeButton.textContent = dark ? 'Светлая тема' : 'Тёмная тема';
      themeButton.setAttribute('aria-label', `Переключить на ${dark ? 'светлую' : 'тёмную'} тему`);
    } else {
      themeButton.textContent = dark ? 'Light theme' : 'Dark theme';
      themeButton.setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} theme`);
    }
  }
  updateThemeButton();
  themeButton?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('raw2crawl-theme', next); } catch {}
    updateThemeButton();
  });
  media.addEventListener('change', () => {
    let saved;
    try { saved = localStorage.getItem('raw2crawl-theme'); } catch {}
    if (!saved) { document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'; updateThemeButton(); }
  });

  const langLink = document.querySelector('.lang-link');
  if (langLink) {
    langLink.hash = location.hash;
    window.addEventListener('hashchange', () => { langLink.hash = location.hash; });
    langLink.addEventListener('click', () => {
      langLink.hash = location.hash;
    });
  }

  const toggle = document.querySelector('#contents-toggle');
  function closeContents() { document.body.classList.remove('contents-open'); toggle?.setAttribute('aria-expanded', 'false'); }
  toggle?.addEventListener('click', () => {
    const open = document.body.classList.toggle('contents-open');
    toggle.setAttribute('aria-expanded', String(open));
    if (open) document.querySelector('.wstg-nav-filter')?.focus();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') { closeContents(); toggle?.focus(); } });
  document.addEventListener('click', event => {
    if (document.body.classList.contains('contents-open') && !event.target.closest('#doc-sidebar, #contents-toggle')) closeContents();
  });

  const nav = document.querySelector('.wstg-nav');
  if (nav) {
  const normalize = value => new URL(value, location.href).pathname.replace(/\/index\.html$|\/$/g, '');
  const navLinks = [...nav.querySelectorAll('a[data-nav-url]')];
  const current = normalize(location.href);
  const active = navLinks.find(a => a.getAttribute('aria-current') === 'page' && normalize(a.href) === current)
    || navLinks.find(a => normalize(a.href) === current && !new URL(a.href).hash);
  if (active) {
    active.setAttribute('aria-current', 'page');
    let ancestor = active.parentElement;
    while (ancestor && ancestor !== nav) { if (ancestor.tagName === 'DETAILS') ancestor.open = true; ancestor = ancestor.parentElement; }
  }
  nav.querySelectorAll('[data-wstg-expand], [data-wstg-collapse]').forEach(button => button.addEventListener('click', () => {
    nav.querySelectorAll('details').forEach(d => { d.open = button.hasAttribute('data-wstg-expand'); });
  }));
  const input = nav.querySelector('.wstg-nav-filter');
  const clear = nav.querySelector('.wstg-nav-filter-clear');
  const counter = nav.querySelector('.wstg-nav-filter-count');
  const items = [...nav.querySelectorAll('.wstg-nav-item')];
  let openBeforeSearch;
  function filter() {
    const query = input.value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    if (query && !openBeforeSearch) openBeforeSearch = new Set([...nav.querySelectorAll('details[open]')]);
    let count = 0;
    for (const item of [...items].reverse()) {
      const ownLink = item.querySelector(':scope > a, :scope > details > summary a');
      const text = `${item.dataset.title || ''} ${ownLink?.textContent || ''} ${item.dataset.hints || ''}`.toLowerCase();
      const matches = terms.every(term => text.includes(term));
      const childVisible = [...item.querySelectorAll(':scope > details > ul > li, :scope > ul > li')].some(child => !child.hidden);
      item.hidden = Boolean(query) && !matches && !childVisible;
      if (matches && query) count++;
      const details = item.querySelector(':scope > details');
      if (details && query && !item.hidden) details.open = true;
    }
    if (!query && openBeforeSearch) { nav.querySelectorAll('details').forEach(d => { d.open = openBeforeSearch.has(d); }); openBeforeSearch = null; }
    if (clear) clear.hidden = !query;
    if (counter) {
      counter.hidden = !query;
      counter.textContent = isRu
        ? `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'раздел' : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? 'раздела' : 'разделов'}`
        : `${count} matching sections`;
      counter.className = 'search-status';
    }
  }
  input?.addEventListener('input', filter);
  clear?.addEventListener('click', () => { input.value = ''; filter(); input.focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      event.preventDefault();
      if (matchMedia('(max-width: 760px)').matches) { document.body.classList.add('contents-open'); toggle?.setAttribute('aria-expanded', 'true'); }
      input?.focus();
    }
  });

  }
  const toc = document.querySelector('#page-toc');
  const headings = [...document.querySelectorAll('.doc-content h2[id], .doc-content h3[id]')];
  if (toc && !toc.children.length) for (const heading of headings) {
    const a = document.createElement('a');
    a.href = '#' + encodeURIComponent(heading.id);
    a.textContent = heading.textContent;
    if (heading.tagName === 'H3') a.className = 'toc-sub';
    toc?.append(a);
  }
  if (!headings.length) document.querySelector('.page-outline')?.setAttribute('hidden', '');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(e => e.isIntersecting);
      if (!entry) return;
      toc?.querySelectorAll('a').forEach(a => a.setAttribute('aria-current', String(decodeURIComponent(a.hash.slice(1)) === entry.target.id)));
    }, { rootMargin: '-80px 0px -65% 0px' });
    headings.forEach(h => observer.observe(h));
  }
  if (!nav) return;
  const normalize = value => new URL(value, location.href).pathname.replace(/\/index\.html$|\/$/g, '');
  const current = normalize(location.href);
  const pages = [...nav.querySelectorAll('a[data-nav-url]')].filter(a => !new URL(a.href).hash);
  const index = pages.findIndex(a => normalize(a.href) === current);
  const pager = document.querySelector('.page-navigation');
  if (pager && !pager.children.length && index >= 0) {
    const prevLabel = isRu ? 'Назад' : 'Previous';
    const nextLabel = isRu ? 'Вперёд' : 'Next';
    for (const [label, link] of [[prevLabel, pages[index - 1]], [nextLabel, pages[index + 1]]]) {
      if (!link) continue;
      const a = document.createElement('a'); a.href = link.href;
      a.rel = label === prevLabel ? 'prev' : 'next';
      const small = document.createElement('small'); small.textContent = label;
      a.append(small, document.createTextNode(link.textContent)); pager.append(a);
    }
  }
})();
