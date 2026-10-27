(async () => {
  const { esc, href, ext, $ } = SI;
  try {
    const site = await SI.site;
    const P = site.pages.community, repo = site.brand.repo;
    $('#hero').innerHTML = `<span class="kicker">${esc(P.kicker)}</span><h1>${esc(P.h1)}</h1><p class="lead">${esc(P.lead)}</p>`;
    $('#contribute-title').textContent = P.contribute_title;
    $('#contribute-text').textContent = P.contribute_text || '';
    $('#contribute').innerHTML = P.contribute.map(c => `<div class="card contrib-card"><h3>${esc(c.title)}</h3><p class="muted">${esc(c.text)}</p>
      <div class="contrib-foot"><a class="btn btn--sm" href="${href(`${repo}/edit/main/${c.file}`)}"${ext(repo)}>${esc(site.labels.edit_on_github)} ↗</a><code class="small">${esc(c.file)}</code></div></div>`).join('');
    $('#actions-title').textContent = P.actions_title;
    $('#actions').innerHTML = (P.actions || []).map(a => `<div class="card contrib-card"><h3><span aria-hidden="true" class="contrib-icon">${esc(a.icon)}</span>${esc(a.title)}</h3><p class="muted">${esc(a.text)}</p>
      <div class="contrib-foot"><a class="btn btn--sm" href="${href(a.url)}"${ext(a.url)}>${esc(a.label)} ↗</a></div></div>`).join('');
    $('#links').innerHTML = P.links.map(c => `<a class="card" href="${href(c.url)}"${ext(c.url)}><div style="font-size:1.5rem" aria-hidden="true">${esc(c.icon)}</div><h3>${esc(c.title)}</h3><p class="muted" style="margin:0">${esc(c.text)}</p></a>`).join('');
    $('#cite-title').textContent = P.cite_title;
    $('#cite-text').textContent = P.cite_text;
  } catch (e) { SI.showError($('#hero'), e); }
})();
