/* Combined family tree + scripts page */
(async () => {
  const { esc, tok, $, $$, data } = SI;
  try {
    const site = await SI.site;
    const P = site.pages.family, SP = site.pages.scripts, T = site.taxonomy, F = T.family;
    const [languages, scripts] = await Promise.all([data('languages'), data('writing-systems')]);

    /* ---- HERO ---- */
    $('#hero').innerHTML = `<span class="kicker">${esc(P.kicker)}</span><h1>${esc(P.h1)}</h1><p class="lead">${esc(P.lead)}</p>`;

    /* ---- FAMILY TREE ---- */
    $('#note').textContent = P.note;
    $('#controls').innerHTML = `<label class="grow"><span class="visually-hidden">${esc(P.filter_placeholder)}</span><input class="input" id="hl" type="search" placeholder="${esc(P.filter_placeholder)}"></label>
      <button class="btn" type="button" id="open-all">${esc(P.expand)}</button><button class="btn" type="button" id="close-all">${esc(P.collapse)}</button>`;
    $('#legend').innerHTML = Object.values(T.status).map(v => `<span><i style="background:${SI.color(v.color)}"></i>${esc(v.label)}</span>`).join('');

    const inBranch = b => languages.filter(l => l.branch === b).sort((a, c) => a.name.localeCompare(c.name));
    const leaf = l => `<li><a href="${SI.langUrl(l.code)}" data-name="${esc((l.name + ' ' + l.code).toLowerCase())}" title="${esc(SI.status(site, l.status).label)}"><i style="background:${SI.color(SI.status(site, l.status).color)}"></i>${esc(l.name)}</a></li>`;
    const branchNode = b => { const ls = inBranch(b), info = SI.branch(site, b);
      return `<li><details open><summary><span class="dot" style="width:10px;height:10px;border-radius:50%;background:${SI.color(info.color)}"></span><b>${esc(info.label)}</b><span class="n">${ls.length}</span></summary><ul class="leaves">${ls.map(leaf).join('')}</ul></details></li>`; };
    const groupNode = g => { const n = g.branches.reduce((s, b) => s + inBranch(b).length, 0);
      return `<li><details open><summary><b>${esc(g.label)}</b><span class="n">${n}</span></summary><ul>${g.branches.map(branchNode).join('')}</ul></details></li>`; };
    $('#tree').innerHTML = `<ul class="tree"><li class="root"><details open><summary><b>${esc(F.name)}</b><span class="n">${languages.length}</span></summary><ul>${F.groups.map(groupNode).join('')}</ul></details></li></ul>`;

    const all = () => $$('#tree details');
    $('#open-all').addEventListener('click', () => all().forEach(d => { d.open = true; }));
    $('#close-all').addEventListener('click', () => all().forEach((d, i) => { d.open = i === 0; }));
    $('#hl').addEventListener('input', SI.debounce(e => {
      const t = e.target.value.trim().toLowerCase();
      $$('#tree .leaves a').forEach(a => { const hit = t && a.dataset.name.includes(t); a.classList.toggle('match', !!hit); a.classList.toggle('dim', !!t && !hit); });
      if (t) $$('#tree .leaves a.match').forEach(a => { let d = a.closest('details'); while (d) { d.open = true; d = d.parentElement.closest('details'); } });
    }));

    /* ---- SCRIPTS TIMELINE ---- */
    $('#timeline-title').textContent = SP.timeline_title;
    $('#timeline-note').textContent = SP.timeline_note;

    const now = new Date().getFullYear(), from = -600, to = now;
    const x = y => ((y - from) / (to - from)) * 100;
    const dated = scripts.filter(s => s.start != null).sort((a, b) => a.start - b.start);
    const yearLabel = y => y < 0 ? `${-y} ${SP.bce}` : y === 0 ? `1 ${SP.ce}` : `${y}`;
    $('#timeline').innerHTML = dated.map(s => {
      const end = s.end ?? now;
      return `<div class="tl-row"><span title="${esc(s.name)}"><a href="#${tok(s.id)}" style="color:inherit;text-decoration:none">${esc(s.name)}</a></span>
        <div class="tl-track" role="img" aria-label="${esc(`${s.name}: ${yearLabel(s.start)} – ${s.end == null ? SP.present : yearLabel(s.end)}`)}"><i class="${s.end == null ? 'open' : ''}" style="left:${x(s.start)}%;width:${Math.max(.8, x(end) - x(s.start))}%;--c:${SI.color(s.color)}"></i></div></div>`;
    }).join('') + `<div class="tl-axis" aria-hidden="true">${[-500, 0, 500, 1000, 1500, 2000].map(y => `<span style="left:${x(y)}%">${yearLabel(y)}</span>`).join('')}</div>`;

    /* ---- SCRIPT CARDS ---- */
    const usedBy = id => languages.filter(l => l.scriptId === id).sort((a, b) => a.name.localeCompare(b.name));
    $('#scripts').innerHTML = scripts.map(s => {
      const langs = usedBy(s.id);
      const sample = (s.example || s.nativeName || '').split(' (')[0];
      return `<article class="card script-card" id="${tok(s.id)}">
        <div class="script-sample" data-font="${esc(s.font || '')}" dir="auto">${esc(sample)}</div>
        <div><h2 class="h3" style="margin:0 0 4px"><span class="swatch" style="--c:${SI.color(s.color)}"></span>${esc(s.name)}</h2><p class="muted small" style="margin:0 0 10px">${esc(s.example || '')}</p></div>
        <div><p class="small">${esc(s.description)}</p>
          <dl>
            <dt>${esc(SP.period_label)}</dt><dd>${esc(s.period)}</dd>
            <dt>${esc(SP.type_label)}</dt><dd>${esc(s.type)} · ${esc(s.family)}</dd>
            <dt>${esc(SP.direction_label)}</dt><dd>${esc(s.direction)}</dd>
            ${s.unicodeBlock ? `<dt>${esc(SP.unicode_label)}</dt><dd><code>${esc(s.unicodeBlock)}</code></dd>` : ''}
            ${s.notableTexts ? `<dt>${esc(SP.texts_label)}</dt><dd>${esc(s.notableTexts)}</dd>` : ''}
            <dt>${esc(SP.languages_label)}</dt><dd>${langs.length ? langs.map(l => `<a href="${SI.langUrl(l.code)}">${esc(l.name)}</a>`).join(', ') : esc(s.languages.join(', '))}</dd>
          </dl></div>
      </article>`;
    }).join('');
    // Lazy-load historical script fonts
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); SI.useFont(e.target, e.target.dataset.font, e.target.textContent); } }), { rootMargin: '300px' }) : null;
    document.querySelectorAll('.script-sample[data-font]').forEach(el => { if (el.dataset.font) io ? io.observe(el) : SI.useFont(el, el.dataset.font, el.textContent); });
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (e) { SI.showError($('#hero'), e); }
})();
