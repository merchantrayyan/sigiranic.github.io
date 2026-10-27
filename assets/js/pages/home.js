(async () => {
  const { esc, href, ext, tok, $, fmt, data, langUrl } = SI;
  const el = (id, prop, val) => { const e = $(`#${id}`); if (e) { e[prop] = val; } return e; };
  try {
    const site = await SI.site;
    const P = site.pages.home, T = site.taxonomy;
    const [languages, papersAll, resources, scripts] = await Promise.all([data('languages'), data('papers'), data('resources'), data('writing-systems')]);
    const papers = SI.realPapers(papersAll);
    const allRes = [...resources.datasets.map(r => ['datasets', r]), ...resources.tools.map(r => ['tools', r]), ...resources.code_mixed.map(r => ['code_mixed', r])];
    const nResources = allRes.length;

    /* hero + search */
    $('#hero-text').innerHTML = `<span class="kicker">${esc(P.kicker)}</span>
      <h1>${esc(P.h1)}</h1>
      <p class="lead">${esc(P.lead)}</p>
      <div class="search" role="search">
        <label class="visually-hidden" for="q">${esc(P.search_placeholder)}</label>
        <span class="glass" aria-hidden="true">⌕</span>
        <input class="input" id="q" type="search" autocomplete="off" placeholder="${esc(P.search_placeholder)}" role="combobox" aria-expanded="false" aria-controls="results" aria-autocomplete="list">
        <div class="results" id="results" role="listbox" hidden></div>
      </div>
      <p class="search-hint">${esc(P.search_hint)}</p>`;

    // One index across languages, scripts, papers and resources, shown in that order.
    const G = [
      { id: 'languages', label: site.labels.languages, all: q => `/languages/?q=${encodeURIComponent(q)}` },
      { id: 'scripts', label: site.pages.scripts.h1, all: () => '/family/#scripts' },
      { id: 'papers', label: site.pages.research.h1, all: q => `/research/?q=${encodeURIComponent(q)}` },
      { id: 'datasets', label: site.pages.datasets.h1, all: q => `/datasets/?q=${encodeURIComponent(q)}` },
    ];
    const langLabels = p => (p.langs || []).map(k => T.paper_languages[k] || k).join(' ');
    const index = [
      ...languages.map(l => ({ g: 'languages', label: l.name, sub: l.code, url: langUrl(l.code), text: `${l.name} ${l.code} ${l.area} ${l.glottolog}` })),
      ...scripts.filter(s => s.id !== 'unwritten').map(s => ({ g: 'scripts', label: s.name, sub: s.direction, url: `/family/#${tok(s.id)}`, text: `${s.name} ${s.nativeName} ${s.languages.join(' ')}` })),
      ...papers.map(p => ({ g: 'papers', label: p.title, sub: String(p.year), url: `/research/?id=${encodeURIComponent(p.id)}`, text: `${p.title} ${p.venue} ${(p.areas || []).map(a => T.areas[a] || a).join(' ')} ${langLabels(p)}` })),
      ...allRes.map(([kind, r]) => { const ls = [...(Array.isArray(r.languages) ? r.languages.map(x => x.lang) : []), ...(r.also || []), ...(r.keys || [])].map(k => T.paper_languages[k] || k);
        return { g: 'datasets', label: r.name, sub: ls.slice(0, 2).join(', ') + (ls.length > 2 ? ' …' : ''), url: `/datasets/?q=${encodeURIComponent(r.name)}${kind === 'datasets' ? '' : '&tab=' + kind}`, text: `${r.name} ${ls.join(' ')} ${r.tasks || ''} ${r.description || ''}` }; }),
    ].map(x => ({ ...x, hay: x.text.toLowerCase(), low: x.label.toLowerCase() }));
    const q = $('#q'), box = $('#results');
    let active = -1;
    const score = (x, phrase, terms) => x.low === phrase || x.sub.toLowerCase() === phrase ? 0 : x.low.startsWith(phrase) ? 1 : terms.every(t => x.low.split(/[\s:(),-]+/).some(w => w.startsWith(t))) ? 2 : 3;
    const mark = (text, terms) => {
      const re = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      return String(text).split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
    };
    const render = () => {
      const raw = q.value.trim(), phrase = raw.toLowerCase(), terms = phrase.split(/\s+/).filter(Boolean);
      if (!terms.length) { box.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
      const hits = index.filter(x => terms.every(t => x.hay.includes(t))).map(x => ({ ...x, s: score(x, phrase, terms) })).sort((a, b) => a.s - b.s || a.label.localeCompare(b.label));
      let html = '', n = 0;
      G.forEach(g => {
        const all = hits.filter(h => h.g === g.id); if (!all.length) return;
        html += `<div class="group" role="presentation"><span>${esc(g.label)}</span><span>${fmt(all.length)}</span></div>`;
        all.slice(0, 4).forEach(it => { html += `<a role="option" id="opt-${n++}" href="${href(it.url)}" aria-selected="false"><span>${mark(it.label, terms)}</span><small>${esc(it.sub)}</small></a>`; });
        if (all.length > 4) html += `<a class="more" role="option" id="opt-${n++}" href="${href(g.all(raw))}" aria-selected="false">${esc(SI.fill(P.search_all, { n: fmt(all.length), group: g.label }))} →</a>`;
      });
      box.innerHTML = html || `<p class="none">${esc(SI.fill(P.search_none, { q: raw }))}</p>`;
      box.hidden = false; box.scrollTop = 0; q.setAttribute('aria-expanded', 'true'); q.removeAttribute('aria-activedescendant'); active = -1;
    };
    const move = d => {
      const opts = [...box.querySelectorAll('[role="option"]')]; if (!opts.length) return;
      active = (active + d + opts.length) % opts.length;
      opts.forEach((o, i) => o.setAttribute('aria-selected', i === active));
      q.setAttribute('aria-activedescendant', opts[active].id); opts[active].scrollIntoView({ block: 'nearest' });
    };
    q.addEventListener('input', SI.debounce(render, 80));
    q.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { const o = box.querySelectorAll('[role="option"]')[Math.max(active, 0)]; if (o) location.href = o.getAttribute('href'); }
      else if (e.key === 'Escape') { box.hidden = true; q.setAttribute('aria-expanded', 'false'); }
    });
    document.addEventListener('click', e => { if (!e.target.closest('.search')) { box.hidden = true; q.setAttribute('aria-expanded', 'false'); } });

    /* the logo */
    const B = site.brand;
    $('#hero-art').innerHTML = `<img class="logo-img" src="${href(B.logo)}" alt="${esc(B.logo_alt)}" width="200" height="200"><b>${esc(B.name.split(' ')[0])}</b><span>${esc(B.name.split(' ').slice(1).join(' '))}</span>
      <dl>${B.codes.map(c => `<dt>${esc(c.label)}</dt><dd>${esc(c.value)}</dd>`).join('')}</dl>`;

    /* stats */
    const values = { languages: languages.length, papers: papers.length, datasets: nResources, scripts: scripts.filter(s => s.id !== 'unwritten').length };
    $('#stats').innerHTML = P.stats.map(s => `<div class="stat"><b>${fmt(values[s.key])}</b><span>${esc(s.label)}</span></div>`).join('');

    /* ---- MAP SECTION ---- */
    el('map-title', 'textContent', P.map_title);
    el('map-text', 'textContent', P.map_text);
    el('map-explore-link', 'textContent', P.map_explore);
    const mapEl = $('#home-map');
    if (mapEl) {
      const map = await SIMap.make(mapEl, { scroll: false, zoom: 3 });
      const mapLayer = L.layerGroup().addTo(map);
      const colorOf = l => SI.branch(site, l.branch).color;
      languages.forEach(l => {
        if (!Array.isArray(l.coordinates)) return;
        SIMap.dot(l, colorOf(l)).bindPopup(() => SIMap.popup(l, site)).addTo(mapLayer);
      });
    }
    el('map-legend', 'innerHTML', Object.values(T.branches).map(v => `<span><i style="background:${SI.color(v.color)}"></i>${esc(v.label)}</span>`).join(''));

    /* coverage: papers per language key */
    el('coverage-title', 'textContent', P.coverage_title);
    el('coverage-text', 'textContent', P.coverage_text);
    const perKey = {};
    papers.forEach(p => (p.langs || []).forEach(k => { if (T.lang_keys[k]) perKey[k] = (perKey[k] || 0) + 1; }));
    const rows = Object.entries(perKey).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: T.paper_languages[k] || k, value: n }));
    const covered = new Set(Object.keys(perKey).map(k => T.lang_primary[k]).filter(Boolean));
    el('coverage', 'innerHTML', SI.bars(rows, { color: 'var(--carnelian)' }) +
      `<p class="muted small" style="margin-top:14px">${esc(SI.fill(P.coverage_count, { n: fmt(languages.filter(l => covered.has(l.code)).length), total: fmt(languages.length) }))}</p>`);

    /* latest papers */
    el('latest-title', 'textContent', P.latest_title);
    const latest = [...papers].sort((a, b) => b.year - a.year).slice(0, 6);
    el('latest', 'innerHTML', latest.map(p => {
      const pUrl = p.url || (p.links && (p.links.paper || p.links.doi)) || '';
      return `<li class="card paper"><h3><a href="${href(pUrl)}"${ext(pUrl)}>${esc(p.title)}</a></h3><div class="meta">${SI.paperMeta(p)}${p.authors ? ' · ' + esc(p.authors.length > 60 ? p.authors.slice(0, 57) + '…' : p.authors) : ''}</div></li>`;
    }).join(''));

  } catch (e) { SI.showError($('#hero-text'), e); }

})();
