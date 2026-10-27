/* SIG Iranic shared runtime: data loading, escaping, header/footer, theme, small helpers.
   All content comes from /data/*.json; pages only arrange it. */

const SI = (() => {
  /* ---------- safety ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
  // Only http(s), mailto, in-page anchors and site paths are allowed into href/src.
  const href = u => {
    const s = String(u ?? '').trim();
    if (/^(https?:|mailto:)/i.test(s)) return esc(s);
    if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '#';
    if (s.startsWith('#') || s.startsWith('?')) return esc(s);
    return esc('/' + s.replace(/^\/+/, ''));
  };
  const ext = u => /^https?:/i.test(String(u)) ? ' target="_blank" rel="noopener"' : '';
  const tok = s => String(s ?? '').replace(/[^\w#-]/g, '');
  // Colours from data: hex values or a CSS custom property, nothing else.
  const color = c => { const v = String(c ?? '').trim(); return /^#[0-9a-f]{3,8}$/i.test(v) || /^var\(--[\w-]+\)$/.test(v) ? v : 'currentColor'; };
  const fill = (tpl, vars) => String(tpl ?? '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

  /* ---------- data ---------- */
  const cache = {};
  const getJSON = path => cache[path] || (cache[path] = fetch('/' + path).then(r => { if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.json(); }));
  const data = name => getJSON(`data/${name}.json`);

  /* ---------- DOM ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fmt = n => n == null || n === '' ? '–' : Number(n).toLocaleString('en');
  const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  let LB = {}; // site.labels, set once site.json is loaded
  const showError = (el, e) => { if (el) el.innerHTML = `<div class="error" role="alert">${esc(LB.error || '')} (${esc(e.message || e)})</div>`; console.error(e); };

  /* ---------- URL state ---------- */
  const params = () => new URLSearchParams(location.search);
  const setParams = obj => {
    const p = params();
    Object.entries(obj).forEach(([k, v]) => (v == null || v === '' || v === 'all') ? p.delete(k) : p.set(k, v));
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  };

  /* ---------- files ---------- */
  function download(name, text, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const csv = rows => rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\n');
  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); if (btn) { const t = btn.textContent; btn.textContent = LB.copied || '✓'; setTimeout(() => { btn.textContent = t; }, 1400); } }
    catch (e) { if (btn) btn.textContent = LB.copy_fail || '×'; }
  }

  /* ---------- fonts for historical scripts ---------- */
  const loadedFonts = new Set();
  function useFont(el, family, text) {
    if (!el || !family) return;
    const key = family + '|' + text;
    if (!loadedFonts.has(key)) {
      loadedFonts.add(key);
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap&text=${encodeURIComponent(text)}`;
      document.head.appendChild(l);
    }
    el.style.fontFamily = `"${family}", var(--font)`;
  }

  /* ---------- domain helpers ---------- */
  // Papers and resources name languages with keys (e.g. "kurdish"); map them to ISO 639-3 codes.
  const keyCodes = (site, key) => site.taxonomy.lang_keys[key] || [];
  const keysForCode = (site, code) => Object.entries(site.taxonomy.lang_keys).filter(([, cs]) => cs.includes(code)).map(([k]) => k);
  const branch = (site, b) => site.taxonomy.branches[b] || { label: b, color: '#8a8073' };
  const status = (site, s) => site.taxonomy.status[s] || { label: s, color: '#8a8073' };
  const badge = (label, c, title = '') => `<span class="badge" style="--c:${color(c)}"${title ? ` title="${esc(title)}"` : ''}>${esc(label)}</span>`;
  const langUrl = code => `/languages/${encodeURIComponent(code)}/`;
  const realPapers = papers => papers.filter(p => !p.placeholder);
  function speakersNum(s) {
    const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
    if (!m) return 0;
    return parseFloat(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1);
  }

  // Long author lists: first six names, then "et al."
  const shortAuthors = a => { const n = String(a).split(', '); return n.length > 6 ? n.slice(0, 6).join(', ') + ' et al.' : a; };
  // "2025 · EMNLP": year, then the merged venue label (full venue name on hover)
  function paperMeta(p) {
    const v = p.venue_short || p.venue;
    return `<span class="p-year">${esc(p.year || '')}</span>${v ? ` · <span class="p-venue"${p.venue && p.venue !== v ? ` title="${esc(p.venue)}"` : ''}>${esc(v)}</span>` : ''}`;
  }
  function paperItem(p, site, { focus = false } = {}) {
    const T = site.taxonomy;
    const langs = (p.langs || []).map(k => T.paper_languages[k] ? `<a class="tag tag--lang" href="/research/?lang=${encodeURIComponent(k)}">${esc(T.paper_languages[k])}</a>` : '').join(' ');
    const areas = (p.areas || []).map(a => `<span class="tag">${esc(T.areas[a] || a)}</span>`).join(' ');
    const links = linkButtons({ paper: p.url, ...(p.links || {}) }, site);
    return `<li class="card paper${focus ? ' focus' : ''}" id="p-${tok(p.id)}">
      <h3><a href="${href(p.url)}"${ext(p.url)}>${esc(p.title)}</a></h3>
      <div class="meta">${paperMeta(p)}${p.authors ? ' · ' + esc(shortAuthors(p.authors)) : ''}</div>
      <div class="row">${langs} ${areas}</div>
      <div class="row">${p.abstract ? `<button class="btn btn--sm" type="button" aria-expanded="false" aria-controls="abs-${tok(p.id)}" data-abs>${esc(site.labels.abstract)}</button>` : ''}${links}<button class="btn btn--sm" type="button" data-bib="${tok(p.id)}">${esc(site.labels.copy_bib)}</button></div>
      ${p.abstract ? `<p class="abstract" id="abs-${tok(p.id)}" hidden>${esc(p.abstract)}${p.abstract.length > 250 || /[.!?)"\u201d]\s*$/.test(p.abstract) ? '' : `… <a href="${href(p.url)}"${ext(p.url)}>${esc(site.labels.read_more)} ↗</a>`}</p>` : ''}
    </li>`;
  }
  // Link buttons with an icon per type (site.link_types); the same URL is shown once.
  function linkButtons(links, site, { skip = [] } = {}) {
    const seen = new Set(skip);
    return Object.entries(links || {}).filter(([, u]) => u && !seen.has(u) && seen.add(u)).map(([k, u]) => {
      const t = site.link_types[k] || { label: k, icon: '↗' };
      const icon = t.icon === 'github' ? '<img class="ico ico-gh" src="/assets/img/icons/github.svg" alt="" width="15" height="15">' : `<span class="ico" aria-hidden="true">${esc(t.icon)}</span>`;
      return `<a class="btn btn--sm btn--link" href="${href(u)}"${ext(u)}>${icon}${esc(t.label)}</a>`;
    }).join('');
  }

  function bibtex(p) {
    if (p.bibtex) return p.bibtex;
    const clean = s => String(s || '').replace(/[{}\\]/g, '');
    const fields = [['title', `{${clean(p.title)}}`], p.authors ? ['author', clean(p.authors).split(', ').join(' and ')] : null, ['year', p.year], p.url ? ['howpublished', `\\url{${clean(p.url)}}`] : null, p.venue ? ['note', clean(p.venue)] : null].filter(Boolean);
    return `@misc{${tok(p.id)},\n${fields.map(([k, v]) => `  ${k} = {${v}}`).join(',\n')}\n}`;
  }
  function bindBib(root, papers) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-abs]');
      if (t) { const open = t.getAttribute('aria-expanded') !== 'true'; t.setAttribute('aria-expanded', open); document.getElementById(t.getAttribute('aria-controls')).hidden = !open; return; }
      const b = e.target.closest('[data-bib]'); if (!b) return;
      const p = papers.find(x => tok(x.id) === b.dataset.bib); if (p) copy(bibtex(p), b);
    });
  }

  /* ---------- accessible tabs ---------- */
  function tabs(root, onChange) {
    const list = $('[role="tablist"]', root), btns = $$('[role="tab"]', list);
    const select = (btn, focus) => {
      btns.forEach(b => { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; $('#' + b.getAttribute('aria-controls')).hidden = !on; });
      if (focus) btn.focus();
      onChange && onChange(btn.dataset.tab);
    };
    list.addEventListener('click', e => { const b = e.target.closest('[role="tab"]'); if (b) select(b); });
    list.addEventListener('keydown', e => {
      const i = btns.indexOf(document.activeElement); if (i < 0) return;
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: btns.length - 1 }[e.key];
      if (n == null) return; e.preventDefault(); select(btns[(n + btns.length) % btns.length], true);
    });
    return { select: id => { const b = btns.find(x => x.dataset.tab === id); if (b) select(b); } };
  }
  const tabList = (prefix, items) => `<div class="tabs" role="tablist">${items.map((t, i) => `<button role="tab" type="button" id="${prefix}-tab-${tok(t.id)}" data-tab="${tok(t.id)}" aria-controls="${prefix}-panel-${tok(t.id)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(t.label)}</button>`).join('')}</div>`;
  const tabPanel = (prefix, id, html, first) => `<div role="tabpanel" id="${prefix}-panel-${tok(id)}" aria-labelledby="${prefix}-tab-${tok(id)}" tabindex="0"${first ? '' : ' hidden'}>${html}</div>`;

  /* ---------- simple bar chart ---------- */
  const bars = (rows, { color: barColor, button } = {}) => {
    const max = Math.max(1, ...rows.map(r => r.value));
    return `<div class="bars">${rows.map(r => `<div class="bar-row">${button ? `<button type="button" data-v="${esc(r.key)}">${esc(r.label)}</button>` : `<span title="${esc(r.label)}">${esc(r.label)}</span>`}
      <div class="bar" aria-hidden="true"><i style="width:${(r.scaled ?? r.value / max) * 100}%;--c:${color(r.color || barColor || 'var(--lapis)')}"></i></div><b>${esc(r.display ?? fmt(r.value))}</b></div>`).join('')}</div>`;
  };

  /* ---------- header and footer ---------- */
  const THEME_ICON = { light: '☾', dark: '☀' };
  function currentTheme() {
    const t = document.documentElement.getAttribute('data-theme');
    return t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  async function chrome() {
    const site = await data('site');
    LB = site.labels;
    const page = document.body.dataset.page;
    const header = $('#site-header'), footer = $('#site-footer');
    if (header) {
      header.innerHTML = `<div class="container nav">
        <a class="brand" href="/"><img class="logo-img" src="${href(site.brand.logo)}" alt="" width="34" height="34"><span><b>${esc(site.brand.name)}</b><small>${site.brand.codes.map(c => `<span>${esc(c.label)}: ${esc(c.value)}</span>`).join(' · ')}</small></span></a>
        <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="nav-links" aria-label="${esc(LB.menu)}">☰</button>
        <ul class="nav-links" id="nav-links">${site.nav.map(n => `<li><a href="${href(n.href)}"${n.id === page ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('')}</ul>
        <button class="icon-btn" type="button" id="theme-btn" aria-label="${esc(LB.theme)}">${THEME_ICON[currentTheme()]}</button>
      </div>`;
      const menu = $('.menu-btn', header), links = $('#nav-links', header);
      menu.addEventListener('click', () => { const open = links.classList.toggle('open'); menu.setAttribute('aria-expanded', open); });
      $('#theme-btn', header).addEventListener('click', e => {
        const next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('si-theme', next); } catch (err) { /* ignore */ }
        e.currentTarget.textContent = THEME_ICON[next];
        document.dispatchEvent(new CustomEvent('si:theme', { detail: next }));
      });
    }
    if (footer) {
      const F = site.footer;
      footer.innerHTML = `<div class="container"><div class="footer-grid">
        <div><a class="brand" href="/"><img class="logo-img" src="${href(site.brand.logo)}" alt="" width="34" height="34"><span><b>${esc(site.brand.name)}</b><small>${site.brand.codes.map(c => `<span>${esc(c.label)}: ${esc(c.value)}</span>`).join(' · ')}</small></span></a><p class="muted" style="margin-top:14px;max-width:44ch">${esc(F.text)}</p></div>
        <div><h2>${esc(LB.explore)}</h2><ul>${site.nav.map(n => `<li><a href="${href(n.href)}">${esc(n.label)}</a></li>`).join('')}</ul></div>
        <div><h2>${esc(LB.elsewhere)}</h2><ul>
          <li><a href="${href(site.brand.github)}"${ext(site.brand.github)}>${esc(LB.github)} ↗</a></li>
          <li><a href="${href(site.brand.huggingface)}"${ext(site.brand.huggingface)}>${esc(LB.huggingface)} ↗</a></li>
          <li><a href="${href('mailto:' + site.brand.email)}">${esc(site.brand.email)}</a></li></ul></div>
      </div><div class="footer-bottom"><span>© ${new Date().getFullYear()} ${esc(F.copyright)}${(F.legal_links || []).map(l => ` · <a href="${href(l.href)}">${esc(l.label)}</a>`).join('')}</span><span>${esc(F.data_note)}</span></div></div>`;
    }
    return site;
  }
  const ready = new Promise(r => document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', r) : r());
  const site = ready.then(chrome);

  return { esc, href, ext, tok, color, fill, data, getJSON, $, $$, fmt, debounce, showError, params, setParams, download, csv, copy, useFont,
    keyCodes, keysForCode, branch, status, badge, langUrl, realPapers, speakersNum, paperItem, paperMeta, linkButtons, bibtex, bindBib, tabs, tabList, tabPanel, bars, currentTheme, site };
})();
