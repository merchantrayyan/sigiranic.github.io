#!/usr/bin/env python3
"""Build the static site into an output folder.

Every page is a template in templates/ wrapped with the shared <head>, header and footer slots.
Titles, descriptions and labels come from data/site.json; one page per language is generated
from data/languages.json. The build fails on broken internal links or unfilled placeholders.

    python3 tools/build.py --out _site
"""
import argparse, html, json, re, shutil, sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
esc = lambda s: html.escape(str(s), quote=True)

FONTS = ("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500"
         "&family=Jost:wght@400;500&family=Fira+Code:wght@400;500&family=Vazirmatn:wght@400;500&display=swap")
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' data: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com "
       "https://tile.openstreetmap.org; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'")

# page id -> (template, output path, needs map)
PAGES = {
    "home": ("home.html", "index.html", True),
    "languages": ("languages.html", "languages/index.html", True),
    "family": ("family.html", "family/index.html", False),
    "research": ("research.html", "research/index.html", False),
    "datasets": ("datasets.html", "datasets/index.html", False),
    "toolkit": ("toolkit.html", "toolkit/index.html", False),
    "community": ("community.html", "community/index.html", False),
    "privacy": ("legal.html", "privacy/index.html", False),
    "terms": ("legal.html", "terms/index.html", False),
    "notfound": ("404.html", "404.html", False),
}
SCRIPT = {"notfound": None, "privacy": "legal", "terms": "legal"}
# Removed pages that redirect to new locations
REDIRECTS = {
    "scripts/index.html": "/family/#scripts",
}


def lookup(ctx, key):
    cur = ctx
    for part in key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            raise KeyError(key)
        cur = cur[part]
    return cur


def fill(text, ctx):
    return re.sub(r"\{\{([\w.]+)\}\}", lambda m: esc(lookup(ctx, m.group(1))), text)


def fmt(tpl, **kw):
    return re.sub(r"\{(\w+)\}", lambda m: str(kw.get(m.group(1), m.group(0))), tpl)


def page(site, *, page_id, path, title, description, body, script, needs_map, jsonld):
    url = site["brand"]["url"].rstrip("/") + "/" + ("" if path == "index.html" else path.removesuffix("index.html"))
    scripts = (['<script src="/assets/vendor/leaflet/leaflet.js"></script>'] if needs_map else []) + ['<script src="/assets/js/core.js"></script>']
    if needs_map:
        scripts.append('<script src="/assets/js/map.js"></script>')
    if script:
        scripts.append(f'<script src="/assets/js/pages/{script}.js"></script>')
    ld = "".join(f'\n  <script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in jsonld)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="{CSP}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(description)}">
  <link rel="canonical" href="{esc(url)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{esc(site['brand']['name'])}">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:url" content="{esc(url)}">
  <meta property="og:image" content="{esc(site['brand']['url'].rstrip('/'))}/assets/img/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#f7f3ea" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#15110d" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="/assets/img/logo.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="{FONTS}">
  <link rel="stylesheet" href="/assets/css/site.css">{'''
  <link rel="stylesheet" href="/assets/vendor/leaflet/leaflet.css">''' if needs_map else ''}
  <script src="/assets/js/theme.js"></script>{ld}
</head>
<body data-page="{esc(page_id)}">
<a class="skip" href="#main">{esc(site['labels']['skip'])}</a>
<header class="site-header" id="site-header"></header>
{body}
<footer class="site-footer" id="site-footer"></footer>
<noscript><p class="container">{esc(site['labels']['noscript'])}</p></noscript>
{chr(10).join(scripts)}
</body>
</html>
"""


def build(out: Path):
    site = json.loads((ROOT / "data/site.json").read_text())
    languages = json.loads((ROOT / "data/languages.json").read_text())
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    for d in ("assets", "data"):
        shutil.copytree(ROOT / d, out / d)
    for f in ("favicon.ico", "LICENSE"):
        if (ROOT / f).exists():
            shutil.copy(ROOT / f, out / f)

    base = site["brand"]["url"].rstrip("/")
    org = {"@context": "https://schema.org", "@type": "Organization", "name": site["brand"]["name"], "alternateName": site["brand"]["long"],
           "url": site["brand"]["url"], "logo": base + "/assets/img/icon-512.png", "sameAs": [site["brand"]["github"], site["brand"]["huggingface"]]}
    written = []
    for pid, (tpl, path, needs_map) in PAGES.items():
        p = site["pages"][pid]
        body = fill((ROOT / "templates" / tpl).read_text(), {"brand": site["brand"], "labels": site["labels"], "page": {**p, "doc": pid}})
        ld = [org, {"@context": "https://schema.org", "@type": "WebSite", "name": site["brand"]["name"], "url": site["brand"]["url"]}] if pid == "home" else []
        (out / path).parent.mkdir(parents=True, exist_ok=True)
        (out / path).write_text(page(site, page_id=pid, path=path, title=p["title"], description=p["description"], body=body,
                                     script=SCRIPT.get(pid, pid), needs_map=needs_map, jsonld=ld))
        if pid != "notfound":
            written.append(path)

    # Write redirect pages for removed pages
    for rpath, target in REDIRECTS.items():
        (out / rpath).parent.mkdir(parents=True, exist_ok=True)
        (out / rpath).write_text(f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={target}"><link rel="canonical" href="{target}"><title>Redirecting…</title><p>Redirecting to <a href="{target}">{target}</a>…</p>')

    L = site["pages"]["language"]
    tpl = (ROOT / "templates/language.html").read_text()
    for l in languages:
        code = l["code"]
        if not re.fullmatch(r"[a-z]{3}", code):
            sys.exit(f"bad language code: {code!r}")
        branch = site["taxonomy"]["branches"].get(l["branch"], {}).get("label", l["branch"])
        title = fmt(L["title"], name=l["name"], code=code)
        desc = fmt(L["description"], name=l["name"], code=code, branch=branch, area=l.get("area") or "–")
        body = fill(tpl, {"labels": site["labels"], "code": code, "name": l["name"]})
        path = f"languages/{code}/index.html"
        crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": site["labels"]["home"], "item": base + "/"},
            {"@type": "ListItem", "position": 2, "name": site["labels"]["languages"], "item": base + "/languages/"},
            {"@type": "ListItem", "position": 3, "name": l["name"], "item": f"{base}/languages/{code}/"}]}
        lang = {"@context": "https://schema.org", "@type": "Language", "name": l["name"], "alternateName": code, "url": f"{base}/languages/{code}/"}
        (out / path).parent.mkdir(parents=True, exist_ok=True)
        (out / path).write_text(page(site, page_id="languages", path=path, title=title, description=desc, body=body,
                                     script="language", needs_map=True, jsonld=[crumbs, lang]))
        written.append(path)

    today = date.today().isoformat()
    urls = "".join(f"  <url><loc>{esc(base + '/' + p.removesuffix('index.html'))}</loc><lastmod>{today}</lastmod></url>\n" for p in written)
    (out / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}</urlset>\n')
    (out / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n")
    (out / ".nojekyll").write_text("")
    return written


def check(out: Path):
    errors = []
    for f in out.rglob("*.html"):
        text = f.read_text()
        if "{{" in text:
            errors.append(f"{f}: unfilled placeholder")
        for ref in re.findall(r'(?:href|src)="(/[^"#?]*)', text):
            target = out / ref.lstrip("/")
            if not (target.is_file() or (target / "index.html").is_file()):
                errors.append(f"{f.relative_to(out)}: broken link {ref}")
    return errors


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="_site")
    out = Path(ap.parse_args().out).resolve()
    pages = build(out)
    errs = check(out)
    print(f"built {len(pages)} pages into {out}")
    if errs:
        print("\n".join(errs))
        sys.exit(1)
