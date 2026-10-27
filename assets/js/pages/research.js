(async () => {
  const { esc, $, $$, fmt, data, fill } = SI;
  try {
    const site = await SI.site;
    const P = site.pages.research, T = site.taxonomy;
    const papersAll = await data('papers');
    const papers = SI.realPapers(papersAll);
    const url = SI.params();
    const focusId = url.get('id');
    const state = { q: url.get('q') || '', area: url.get('area') || 'all', lang: url.get('lang') || 'all', year: url.get('year') || 'all', venue: url.get('venue') || 'all', sort: url.get('sort') || 'new' };

    $('#hero').innerHTML = `<span class="kicker">${esc(P.kicker)}</span><h1>${esc(P.h1)}</h1><p class="lead">${esc(P.lead)}</p>`;
    const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`;
    const usedLangs = Object.keys(T.paper_languages).filter(k => papers.some(p => (p.langs || []).includes(k)));
    const years = [...new Set(papers.map(p => p.year))].sort((a, b) => b - a);
    const venueCount = {}; papers.forEach(p => { if (p.venue_short) venueCount[p.venue_short] = (venueCount[p.venue_short] || 0) + 1; });
    const venues = Object.keys(venueCount).sort((a, b) => venueCount[b] - venueCount[a] || a.localeCompare(b));
    $('#filters').innerHTML = `
      <label class="grow"><span class="visually-hidden">${esc(P.search_placeholder)}</span><input class="input" id="q" type="search" placeholder="${esc(P.search_placeholder)}" value="${esc(state.q)}"></label>
      <label><span class="visually-hidden">${esc(P.all_languages)}</span><select class="select" id="lang">${opt('all', P.all_languages, state.lang)}${usedLangs.map(k => opt(k, T.paper_languages[k], state.lang)).join('')}</select></label>
      <label><span class="visually-hidden">${esc(P.all_years)}</span><select class="select" id="year">${opt('all', P.all_years, state.year)}${years.map(y => opt(y, y, state.year)).join('')}</select></label>
      <label><span class="visually-hidden">${esc(P.all_venues)}</span><select class="select" id="venue">${opt('all', P.all_venues, state.venue)}${venues.map(v => opt(v, `${v} (${venueCount[v]})`, state.venue)).join('')}</select></label>
      <label><span class="visually-hidden">${esc(P.sort.new)}</span><select class="select" id="sort">${Object.entries(P.sort).map(([k, v]) => opt(k, v, state.sort)).join('')}</select></label>`;
    const groups = T.area_groups;
    const inGroup = (p, g) => (p.areas || []).some(a => g.includes.includes(a)) || (g.id === 'other' && !(p.areas || []).some(a => groups.some(x => x.id !== 'other' && x.includes.includes(a))));
    $('#area-chips').innerHTML = [`<button class="chip" type="button" data-area="all" aria-pressed="${state.area === 'all'}">${esc(P.all_areas)}</button>`]
      .concat(groups.map(g => `<button class="chip" type="button" data-area="${esc(g.id)}" aria-pressed="${state.area === g.id}">${esc(g.label)} <span class="muted">${papers.filter(p => inGroup(p, g)).length}</span></button>`)).join('');
    $('#per-year-title').textContent = P.per_year_title;
    $('#per-lang-title').textContent = P.per_lang_title;
    $('#export').innerHTML = `<button class="btn btn--sm" type="button" id="bib">${esc(P.export_bib)} ↓</button><button class="btn btn--sm" type="button" id="csv">${esc(P.export_csv)} ↓</button>`;

    let rows = [];
    function apply() {
      const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      const g = groups.find(x => x.id === state.area);
      rows = papers.filter(p =>
        (!g || inGroup(p, g)) &&
        (state.lang === 'all' || (p.langs || []).includes(state.lang)) &&
        (state.year === 'all' || String(p.year) === state.year) &&
        (state.venue === 'all' || p.venue_short === state.venue) &&
        terms.every(t => `${p.title} ${p.abstract || ''} ${p.venue || ''} ${p.venue_short || ''} ${p.year} ${p.authors || ''} ${(p.langs || []).map(k => T.paper_languages[k] || k).join(' ')}`.toLowerCase().includes(t)));
      const by = { new: (a, b) => b.year - a.year || a.title.localeCompare(b.title), old: (a, b) => a.year - b.year || a.title.localeCompare(b.title), title: (a, b) => a.title.localeCompare(b.title) }[state.sort] || (() => 0);
      rows.sort(by);
      $('#count').textContent = fill(P.count, { n: fmt(rows.length), total: fmt(papers.length) });
      $('#papers').innerHTML = rows.length ? rows.map(p => SI.paperItem(p, site, { focus: p.id === focusId })).join('') : `<li class="empty">${esc(P.empty)}</li>`;

      // charts follow the current filters
      const perYear = {}; rows.forEach(p => { perYear[p.year] = (perYear[p.year] || 0) + 1; });
      const ys = Object.keys(perYear).map(Number).sort((a, b) => a - b), maxY = Math.max(1, ...Object.values(perYear));
      $('#per-year').innerHTML = `<div class="cols">${ys.map(y => `<button type="button" class="col" data-year="${y}" aria-label="${y}: ${perYear[y]}"><b>${perYear[y]}</b><i style="height:${(perYear[y] / maxY) * 100}%"></i><small title="${y}">’${String(y).slice(2)}</small></button>`).join('')}</div>`;
      const perLang = {}; rows.forEach(p => (p.langs || []).forEach(k => { if (T.lang_keys[k]) perLang[k] = (perLang[k] || 0) + 1; }));
      $('#per-lang').innerHTML = SI.bars(Object.entries(perLang).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ key: k, label: T.paper_languages[k] || k, value: n })), { button: true, color: 'var(--carnelian)' });
      SI.setParams({ q: state.q, area: state.area, lang: state.lang, year: state.year, venue: state.venue, sort: state.sort === 'new' ? '' : state.sort, id: '' });
    }
    $('#q').addEventListener('input', SI.debounce(e => { state.q = e.target.value.trim(); apply(); }));
    ['lang', 'year', 'venue', 'sort'].forEach(id => $('#' + id).addEventListener('change', e => { state[id] = e.target.value; apply(); }));
    $('#area-chips').addEventListener('click', e => { const b = e.target.closest('[data-area]'); if (!b) return; state.area = b.dataset.area; $$('[data-area]').forEach(x => x.setAttribute('aria-pressed', x === b)); apply(); });
    $('#per-year').addEventListener('click', e => { const b = e.target.closest('[data-year]'); if (!b) return; state.year = state.year === b.dataset.year ? 'all' : b.dataset.year; $('#year').value = state.year; apply(); });
    $('#per-lang').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; state.lang = b.dataset.v; $('#lang').value = state.lang; apply(); });
    $('#bib').addEventListener('click', () => SI.download('iranic-papers.bib', rows.map(SI.bibtex).join('\n\n'), 'application/x-bibtex'));
    $('#csv').addEventListener('click', () => SI.download('iranic-papers.csv', SI.csv([['title', 'authors', 'venue', 'venue_short', 'year', 'languages', 'tasks', 'url'],
      ...rows.map(p => [p.title, p.authors, p.venue, p.venue_short, p.year, (p.langs || []).join('; '), (p.areas || []).join('; '), p.url])]), 'text/csv'));
    SI.bindBib($('#papers'), papers);
    apply();
    if (focusId) document.getElementById('p-' + SI.tok(focusId))?.scrollIntoView({ block: 'center' });
  } catch (e) { SI.showError($('#hero'), e); }
})();
