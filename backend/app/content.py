"""Public content for search engines and answer engines: the blog, the FAQ and the machine-readable files around them.

Articles live in content/blog/*.md (front matter + Markdown), the FAQ in content/faq.md ("## question" + answer). The same
content feeds the JSON API (the landing reads it) and the server-rendered pages (/blog, /blog/<slug>, /faq), which carry
canonical URLs, Open Graph tags and JSON-LD (Article, FAQPage, BreadcrumbList, Organization) so crawlers and LLM crawlers
get real HTML, not an empty SPA shell. /sitemap.xml, /robots.txt, /llms.txt and /llms-full.txt are generated from the same files.
"""
from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

import markdown

from .config import env

CONTENT_DIR = Path(env("ARENA_CONTENT_DIR", str(Path(__file__).resolve().parents[1] / "content")))
SITE_URL = (env("ARENA_PUBLIC_URL", "https://tablyteam.com") or "https://tablyteam.com").rstrip("/")
SITE_NAME = "Tably Team"
SITE_TAGLINE = "Tu equipo de IA que diseña y construye apps"
SITE_DESCRIPTION = ("Tably Team arma un equipo de inteligencias artificiales (CEO, CTO, ingeniería, producto, diseño y QA) que debate tu idea, "
                    "estudia apps de referencia, diseña las pantallas, escribe el código y lo revisa antes de entregarte una app lista para correr.")

_MD_EXT = ["extra", "toc", "sane_lists", "smarty"]
_WORDS_PER_MIN = 200


@dataclass
class Post:
    slug: str
    title: str
    description: str
    date: str  # ISO
    updated: str  # ISO
    tags: list[str]
    body_md: str
    body_html: str
    toc_html: str
    reading_min: int
    provider: str | None = None  # the AI the article is about (for the logo)
    keywords: list[str] = field(default_factory=list)

    def url(self) -> str:
        return f"{SITE_URL}/blog/{self.slug}"

    def meta(self) -> dict:
        return {"slug": self.slug, "title": self.title, "description": self.description, "date": self.date, "updated": self.updated, "tags": self.tags,
                "reading_min": self.reading_min, "provider": self.provider, "url": f"/blog/{self.slug}"}


@dataclass
class Faq:
    question: str
    answer_md: str
    answer_html: str
    answer_text: str
    slug: str


_cache: dict = {"stamp": None, "posts": [], "faq": []}


def _front_matter(text: str) -> tuple[dict, str]:
    """A minimal YAML-ish front matter: `key: value` lines between --- fences; lists as [a, b] or comma-separated."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)
    if not m:
        return {}, text
    meta: dict = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip().strip('"').strip("'")
        if v.startswith("[") and v.endswith("]"):
            meta[k.strip()] = [x.strip().strip('"').strip("'") for x in v[1:-1].split(",") if x.strip()]
        else:
            meta[k.strip()] = v
    return meta, text[m.end():]


def _render(md_text: str) -> tuple[str, str]:
    md = markdown.Markdown(extensions=_MD_EXT, extension_configs={"toc": {"toc_depth": "2-3", "anchorlink": False}})
    body = md.convert(md_text)
    return body, getattr(md, "toc", "") or ""


def _strip_html(s: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()


def _stamp() -> tuple:
    files = sorted(CONTENT_DIR.glob("blog/*.md")) + [CONTENT_DIR / "faq.md"]
    return tuple((str(f), f.stat().st_mtime) for f in files if f.exists())


def _load() -> None:
    st = _stamp()
    if _cache["stamp"] == st:
        return
    posts: list[Post] = []
    for f in sorted(CONTENT_DIR.glob("blog/*.md")):
        meta, body = _front_matter(f.read_text(encoding="utf-8"))
        if meta.get("draft") in ("true", "yes", "1"):
            continue
        body_html, toc = _render(body)
        words = len(re.findall(r"\w+", body))
        d = str(meta.get("date") or date.today().isoformat())
        tags = meta.get("tags") if isinstance(meta.get("tags"), list) else [t.strip() for t in str(meta.get("tags") or "").split(",") if t.strip()]
        kws = meta.get("keywords") if isinstance(meta.get("keywords"), list) else [t.strip() for t in str(meta.get("keywords") or "").split(",") if t.strip()]
        posts.append(Post(slug=meta.get("slug") or f.stem, title=str(meta.get("title") or f.stem), description=str(meta.get("description") or ""), date=d,
                          updated=str(meta.get("updated") or d), tags=tags, body_md=body, body_html=body_html, toc_html=toc, reading_min=max(1, round(words / _WORDS_PER_MIN)),
                          provider=meta.get("provider") or None, keywords=kws))
    posts.sort(key=lambda p: (p.date, p.slug), reverse=True)
    faq: list[Faq] = []
    fp = CONTENT_DIR / "faq.md"
    if fp.exists():
        _, text = _front_matter(fp.read_text(encoding="utf-8"))
        for block in re.split(r"^## +", text, flags=re.M)[1:]:
            q, _, a = block.partition("\n")
            q, a = q.strip(), a.strip()
            if not q or not a:
                continue
            a_html, _ = _render(a)
            faq.append(Faq(question=q, answer_md=a, answer_html=a_html, answer_text=_strip_html(a_html), slug=re.sub(r"[^a-z0-9]+", "-", q.lower()).strip("-")[:80]))
    _cache.update(stamp=st, posts=posts, faq=faq)


def posts() -> list[Post]:
    _load()
    return list(_cache["posts"])


def post(slug: str) -> Post | None:
    _load()
    return next((p for p in _cache["posts"] if p.slug == slug), None)


def faq() -> list[Faq]:
    _load()
    return list(_cache["faq"])


# ------------------------------------------------------------------ server-rendered pages

_CSS = """
:root{--paper:#EEF1EF;--surface:#fff;--surface-2:#F5F7F5;--line:#DCE2DE;--ink:#1E2622;--ink-2:#46514B;--ink-3:#717C76;--accent:#2F6B5D;--accent-soft:#E2EDE8;--gold:#9C7622}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Instrument Sans",ui-sans-serif,system-ui,sans-serif;line-height:1.6;font-size:16px}
a{color:var(--accent)}a:hover{text-decoration-thickness:2px}
.serif{font-family:"Newsreader",ui-serif,Georgia,serif}
header.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:0 24px;height:56px;border-bottom:1px solid var(--line);background:rgba(238,241,239,.85);backdrop-filter:blur(8px)}
header.top img{width:28px;height:28px;border-radius:8px}
header.top .brand{font-family:"Newsreader",serif;font-size:19px;color:var(--ink);text-decoration:none}header.top .brand em{color:var(--accent)}
header.top nav{margin-left:auto;display:flex;gap:4px;align-items:center}
header.top nav a{text-decoration:none;color:var(--ink-2);padding:6px 12px;border-radius:10px;font-size:14px}header.top nav a:hover{color:var(--ink);background:var(--surface-2)}
header.top nav a.cta{background:var(--accent);color:#fff;font-weight:500}header.top nav a.cta:hover{filter:brightness(1.1)}
main{max-width:1100px;margin:0 auto;padding:40px 24px 80px}
.eyebrow{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--accent)}
h1{font-family:"Newsreader",serif;font-weight:400;font-size:clamp(34px,5vw,52px);line-height:1.08;margin:8px 0 12px;letter-spacing:-.01em}
.lede{font-size:18px;color:var(--ink-2);max-width:760px}
.meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13px;color:var(--ink-3);margin:16px 0 28px}
.tag{display:inline-block;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--ink-2)}
.grid{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.card{display:block;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:22px;text-decoration:none;color:inherit;transition:border-color .2s,transform .2s}
.card:hover{border-color:var(--accent);transform:translateY(-2px)}
.card h2{font-family:"Newsreader",serif;font-weight:400;font-size:24px;line-height:1.15;margin:8px 0 8px}
.card p{margin:0;color:var(--ink-2);font-size:14.5px}
.card .row{display:flex;gap:8px;align-items:center;font-size:12px;color:var(--ink-3)}
.card .row img{width:22px;height:22px}
.article{display:grid;grid-template-columns:minmax(0,1fr);gap:40px}
@media(min-width:960px){.article{grid-template-columns:minmax(0,1fr) 260px}}
.toc{position:sticky;top:76px;align-self:start;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;font-size:13.5px}
.toc .t{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--ink-3);margin-bottom:8px}
.toc ul{list-style:none;margin:0;padding:0}.toc li{margin:4px 0}.toc ul ul{padding-left:12px}.toc a{color:var(--ink-2);text-decoration:none}.toc a:hover{color:var(--accent)}
.prose{max-width:760px;font-size:17px}
.prose h2{font-family:"Newsreader",serif;font-weight:400;font-size:32px;line-height:1.15;margin:44px 0 12px}
.prose h3{font-size:20px;font-weight:600;margin:30px 0 8px}
.prose p{margin:0 0 16px}.prose ul,.prose ol{padding-left:22px;margin:0 0 16px}.prose li{margin:4px 0}
.prose blockquote{margin:20px 0;padding:12px 18px;border-left:3px solid var(--accent);background:var(--surface);border-radius:0 12px 12px 0;color:var(--ink-2)}
.prose code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.88em;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1px 5px}
.prose pre{background:#1E2622;color:#EEF1EF;border-radius:12px;padding:16px 18px;overflow:auto;font-size:14px}.prose pre code{background:none;border:0;padding:0;color:inherit}
.prose table{border-collapse:collapse;width:100%;margin:0 0 20px;font-size:15px}.prose th,.prose td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}.prose th{background:var(--surface-2)}
.prose img{max-width:100%;border-radius:12px}
.faq details{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:4px 18px;margin:0 0 10px}
.faq summary{cursor:pointer;font-weight:600;padding:12px 0;list-style:none;display:flex;justify-content:space-between;gap:12px}
.faq summary::-webkit-details-marker{display:none}.faq summary::after{content:"+";color:var(--accent);font-weight:400;font-size:20px;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq .a{padding:0 0 14px;color:var(--ink-2);max-width:760px}
.cta-box{margin:56px 0 0;background:var(--accent);color:#fff;border-radius:20px;padding:32px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}
.cta-box h3{font-family:"Newsreader",serif;font-weight:400;font-size:28px;margin:0 0 4px}.cta-box p{margin:0;opacity:.9}
.cta-box a{background:#fff;color:var(--accent);text-decoration:none;font-weight:600;border-radius:999px;padding:12px 22px}
footer{border-top:1px solid var(--line);padding:28px 24px;font-size:13px;color:var(--ink-3);display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;max-width:1100px;margin:0 auto}
footer a{color:var(--ink-2);text-decoration:none;margin-right:14px}
.more{margin-top:56px}.more h2{font-family:"Newsreader",serif;font-weight:400;font-size:28px;margin:0 0 16px}
"""

_FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
          '<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">')


def _org_ld() -> dict:
    return {"@type": "Organization", "@id": f"{SITE_URL}/#organization", "name": SITE_NAME, "url": SITE_URL, "logo": f"{SITE_URL}/icon-512.png",
            "description": SITE_DESCRIPTION, "sameAs": []}


def _page(*, title: str, description: str, path: str, body: str, ld: list[dict], og_type: str = "website", published: str | None = None, modified: str | None = None,
          keywords: list[str] | None = None) -> str:
    canonical = f"{SITE_URL}{path}"
    esc = html.escape
    meta_extra = ""
    if published:
        meta_extra += f'<meta property="article:published_time" content="{esc(published)}">'
    if modified:
        meta_extra += f'<meta property="article:modified_time" content="{esc(modified)}">'
    if keywords:
        meta_extra += f'<meta name="keywords" content="{esc(", ".join(keywords))}">'
    ld_json = json.dumps({"@context": "https://schema.org", "@graph": ld}, ensure_ascii=False)
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} · {SITE_NAME}</title>
<meta name="description" content="{esc(description)}">
<link rel="canonical" href="{esc(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta property="og:site_name" content="{SITE_NAME}">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(description)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{SITE_URL}/icon-512.png">
<meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(description)}">
{meta_extra}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<meta name="theme-color" content="#2F6B5D">
<link rel="alternate" type="application/rss+xml" title="{SITE_NAME} · Blog" href="{SITE_URL}/blog/feed.xml">
{_FONTS}
<style>{_CSS}</style>
<script type="application/ld+json">{ld_json}</script>
</head>
<body>
<header class="top">
  <img src="/icon.svg" alt="" aria-hidden="true">
  <a class="brand" href="/">Tably <em>Team</em></a>
  <nav aria-label="Principal">
    <a href="/blog">Blog</a>
    <a href="/faq">Preguntas frecuentes</a>
    <a href="/#login">Iniciar sesión</a>
    <a class="cta" href="/#signup">Crear cuenta</a>
  </nav>
</header>
<main>
{body}
<section class="cta-box">
  <div><h3>Probá Tably Team con tu idea</h3><p>Escribí lo que querés construir y mirá cómo el equipo lo debate, lo diseña y lo construye.</p></div>
  <a href="/#signup">Crear cuenta gratis</a>
</section>
</main>
<footer>
  <div>© {date.today().year} {SITE_NAME} · {SITE_TAGLINE}</div>
  <div><a href="/">Inicio</a><a href="/blog">Blog</a><a href="/faq">Preguntas frecuentes</a><a href="/llms.txt">llms.txt</a><a href="/sitemap.xml">Sitemap</a></div>
</footer>
</body>
</html>"""


def _card(p: Post) -> str:
    esc = html.escape
    logo = f'<img src="/logos/{esc(p.provider)}.png" alt="" aria-hidden="true">' if p.provider else ""
    tags = " ".join(f'<span class="tag">{esc(t)}</span>' for t in p.tags[:3])
    return (f'<a class="card" href="/blog/{esc(p.slug)}"><div class="row">{logo}<time datetime="{esc(p.date)}">{_fmt_date(p.date)}</time> · {p.reading_min} min de lectura</div>'
            f'<h2>{esc(p.title)}</h2><p>{esc(p.description)}</p><div class="row" style="margin-top:12px">{tags}</div></a>')


_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def _fmt_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
        return f"{d.day} de {_MONTHS[d.month - 1]} de {d.year}"
    except ValueError:
        return iso


def blog_index_html() -> str:
    ps = posts()
    body = (f'<div class="eyebrow">Blog</div><h1>Guías sobre construir apps con un equipo de IA</h1>'
            f'<p class="lede">Qué hace bien cada inteligencia artificial, cómo elegir una para cada rol, qué cuesta construir una app y cómo funciona Tably Team por dentro. '
            f'Escrito por el equipo que lo construye.</p><div class="meta">{len(ps)} artículos</div><div class="grid">{"".join(_card(p) for p in ps)}</div>')
    ld = [_org_ld(), {"@type": "Blog", "@id": f"{SITE_URL}/blog#blog", "name": f"{SITE_NAME} · Blog", "url": f"{SITE_URL}/blog", "publisher": {"@id": f"{SITE_URL}/#organization"},
                      "blogPost": [{"@type": "BlogPosting", "headline": p.title, "url": p.url(), "datePublished": p.date, "dateModified": p.updated} for p in ps]},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE_URL}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE_URL}/blog"}]}]
    return _page(title="Blog: guías sobre IA para construir apps", description="Guías detalladas sobre Claude, GPT, Gemini, DeepSeek, Grok, Llama, Kimi, Mistral y más: para qué sirve cada una, cómo elegirlas por rol y cómo Tably Team construye apps con ellas.",
                 path="/blog", body=body, ld=ld)


def post_html(p: Post) -> str:
    esc = html.escape
    others = [o for o in posts() if o.slug != p.slug]
    related = [o for o in others if set(o.tags) & set(p.tags)][:3] or others[:3]
    toc = f'<aside class="toc"><div class="t">En este artículo</div>{p.toc_html}</aside>' if p.toc_html.strip() else ""
    logo = f'<img src="/logos/{esc(p.provider)}.png" alt="" width="20" height="20" style="vertical-align:middle">' if p.provider else ""
    body = (f'<div class="eyebrow">Blog</div><h1>{esc(p.title)}</h1><p class="lede">{esc(p.description)}</p>'
            f'<div class="meta">{logo}<time datetime="{esc(p.date)}">Publicado el {_fmt_date(p.date)}</time>'
            + (f' · actualizado el {_fmt_date(p.updated)}' if p.updated != p.date else "")
            + f' · {p.reading_min} min de lectura · por el equipo de {SITE_NAME}' + "".join(f' <span class="tag">{esc(t)}</span>' for t in p.tags) + '</div>'
            f'<div class="article"><article class="prose">{p.body_html}</article>{toc}</div>'
            f'<section class="more"><h2>Seguir leyendo</h2><div class="grid">{"".join(_card(o) for o in related)}</div></section>')
    ld = [_org_ld(),
          {"@type": "Article", "@id": f"{p.url()}#article", "headline": p.title, "description": p.description, "url": p.url(), "mainEntityOfPage": p.url(), "inLanguage": "es",
           "datePublished": p.date, "dateModified": p.updated, "keywords": ", ".join(p.keywords or p.tags), "wordCount": len(re.findall(r"\w+", p.body_md)),
           "author": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL}, "publisher": {"@id": f"{SITE_URL}/#organization"}, "image": f"{SITE_URL}/icon-512.png"},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE_URL}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE_URL}/blog"},
                                                          {"@type": "ListItem", "position": 3, "name": p.title, "item": p.url()}]}]
    return _page(title=p.title, description=p.description, path=f"/blog/{p.slug}", body=body, ld=ld, og_type="article", published=p.date, modified=p.updated, keywords=p.keywords or p.tags)


def faq_html() -> str:
    esc = html.escape
    items = faq()
    body = (f'<div class="eyebrow">Preguntas frecuentes</div><h1>Todo lo que te preguntás antes de construir con Tably Team</h1>'
            f'<p class="lede">Qué es, cuánto cuesta, qué IA usar, dónde queda tu código, cómo se publica la app y qué pasa con tus claves. Respuestas directas, sin vueltas.</p>'
            f'<div class="meta">{len(items)} preguntas</div><div class="faq">'
            + "".join(f'<details id="{esc(i.slug)}"><summary>{esc(i.question)}</summary><div class="a">{i.answer_html}</div></details>' for i in items) + "</div>")
    ld = [_org_ld(), {"@type": "FAQPage", "@id": f"{SITE_URL}/faq#faq", "url": f"{SITE_URL}/faq", "inLanguage": "es",
                      "mainEntity": [{"@type": "Question", "name": i.question, "acceptedAnswer": {"@type": "Answer", "text": i.answer_text}} for i in items]},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE_URL}, {"@type": "ListItem", "position": 2, "name": "Preguntas frecuentes", "item": f"{SITE_URL}/faq"}]}]
    return _page(title="Preguntas frecuentes", description="Respuestas directas sobre Tably Team: qué es, cuánto cuesta, qué IA conviene para cada rol, cómo se publica la app, dónde queda tu código y cómo se cuidan tus API keys.",
                 path="/faq", body=body, ld=ld)


# ------------------------------------------------------------------ machine-readable files

def sitemap_xml() -> str:
    today = date.today().isoformat()
    urls = [(SITE_URL + "/", today, "weekly", "1.0"), (f"{SITE_URL}/blog", max([p.updated for p in posts()] or [today]), "weekly", "0.8"), (f"{SITE_URL}/faq", today, "monthly", "0.8")]
    urls += [(p.url(), p.updated, "monthly", "0.7") for p in posts()]
    body = "".join(f"<url><loc>{html.escape(u)}</loc><lastmod>{d}</lastmod><changefreq>{c}</changefreq><priority>{pr}</priority></url>" for u, d, c, pr in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'


def robots_txt() -> str:
    return "\n".join(["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /ws/", "Disallow: /git/", "Disallow: /apps/", "Disallow: /run/", "", f"Sitemap: {SITE_URL}/sitemap.xml", ""])


def rss_xml() -> str:
    esc = html.escape
    items = "".join(f"<item><title>{esc(p.title)}</title><link>{esc(p.url())}</link><guid>{esc(p.url())}</guid><pubDate>{p.date}</pubDate><description>{esc(p.description)}</description></item>" for p in posts())
    return (f'<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>{SITE_NAME} · Blog</title><link>{SITE_URL}/blog</link>'
            f'<description>{esc(SITE_DESCRIPTION)}</description><language>es</language>{items}</channel></rss>')


def llms_txt() -> str:
    """llms.txt: a short, structured guide for LLM crawlers and answer engines (what the site is, where the canonical content lives)."""
    lines = [f"# {SITE_NAME}", "", f"> {SITE_DESCRIPTION}", "",
             "Tably Team es una plataforma donde un equipo de agentes de IA con roles (CEO, CTO, Head of Engineering, Product, Diseño y QA), cada uno con el modelo que elijas "
             "(Claude, GPT, Gemini, DeepSeek, Grok, Llama, Kimi, Mistral, OpenRouter u Ollama), debate una idea, la investiga contra apps de referencia, la diseña, la construye "
             "(con Claude Code, Codex o un modelo por API) y la revisa. La app se puede correr, descargar o publicar en Tably Cloud.", "",
             "## Páginas principales", "", f"- [Inicio]({SITE_URL}/): la plataforma", f"- [Preguntas frecuentes]({SITE_URL}/faq): respuestas directas sobre precio, modelos, privacidad y publicación",
             f"- [Blog]({SITE_URL}/blog): guías detalladas", "", "## Artículos", ""]
    lines += [f"- [{p.title}]({p.url()}): {p.description}" for p in posts()]
    lines += ["", "## Opcional", "", f"- [llms-full.txt]({SITE_URL}/llms-full.txt): todo el contenido en un solo archivo de texto", f"- [Sitemap]({SITE_URL}/sitemap.xml)", ""]
    return "\n".join(lines)


def llms_full_txt() -> str:
    parts = [llms_txt(), "", "---", "", "# Preguntas frecuentes", ""]
    parts += [f"## {i.question}\n\n{i.answer_md}\n" for i in faq()]
    for p in posts():
        parts += ["", "---", "", f"# {p.title}", "", f"URL: {p.url()}", f"Publicado: {p.date} · Actualizado: {p.updated}", "", p.description, "", p.body_md, ""]
    return "\n".join(parts)
