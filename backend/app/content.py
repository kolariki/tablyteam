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
from .providers import PROVIDERS


def _brand(provider: str | None) -> tuple[str, str]:
    """(logo path, brand color) for the AI an article is about."""
    spec = PROVIDERS.get(provider or "")
    return (f"/logos/{provider}.png", spec.color if spec else "#2F6B5D") if provider else ("", "#2F6B5D")

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
:root{--paper:#EEF1EF;--surface:#fff;--surface-2:#F5F7F5;--line:#DCE2DE;--ink:#1E2622;--ink-2:#46514B;--ink-3:#717C76;--ink-4:#A2ACA6;--accent:#2F6B5D;--accent-soft:#E2EDE8;--gold:#9C7622}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Instrument Sans",ui-sans-serif,system-ui,sans-serif;line-height:1.6;font-size:16px;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0;z-index:-1;background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:22px 22px;opacity:.55}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px}
.serif{font-family:"Newsreader",ui-serif,Georgia,serif}
header.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:0 28px;height:60px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.92);backdrop-filter:saturate(1.3) blur(10px)}
header.top img{width:30px;height:30px;border-radius:9px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
header.top .brand{font-family:"Newsreader",serif;font-size:21px;color:var(--ink);text-decoration:none;letter-spacing:-.01em}header.top .brand em{color:var(--accent)}
header.top nav{margin-left:auto;display:flex;gap:2px;align-items:center}
header.top nav a{text-decoration:none;color:var(--ink-2);padding:7px 12px;border-radius:999px;font-size:14px;font-weight:500}header.top nav a:hover{color:var(--ink);background:var(--surface-2)}
header.top nav a.on{color:var(--accent);background:var(--accent-soft)}
header.top nav a.cta{background:var(--accent);color:#fff;margin-left:6px;padding:8px 16px}header.top nav a.cta:hover{filter:brightness(1.08);background:var(--accent)}
@media(max-width:640px){header.top nav a.hide-sm{display:none}}
main{max-width:1120px;margin:0 auto;padding:48px 28px 72px;min-height:calc(100vh - 60px)}
.hero{max-width:820px;margin-bottom:28px}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--accent);font-weight:600}
.eyebrow::before{content:"";width:18px;height:1px;background:var(--accent)}
h1{font-family:"Newsreader",serif;font-weight:400;font-size:clamp(36px,5vw,56px);line-height:1.04;margin:14px 0 16px;letter-spacing:-.015em}
.lede{font-size:19px;line-height:1.55;color:var(--ink-2);max-width:720px;margin:0}
.meta{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:13px;color:var(--ink-3);margin:22px 0 0}
.meta .logo{width:22px;height:22px;border-radius:6px;vertical-align:middle;margin-right:4px}
.tag{display:inline-block;white-space:nowrap;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:3px 10px;font-size:11.5px;color:var(--ink-2);text-decoration:none;letter-spacing:.01em}
a.tag:hover{border-color:var(--accent);color:var(--accent)}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 28px}
.filters .tag.on{background:var(--accent);border-color:var(--accent);color:#fff}
.grid{display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(310px,1fr))}
.card{position:relative;display:flex;flex-direction:column;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:24px;text-decoration:none;color:inherit;transition:border-color .2s,transform .2s,box-shadow .2s;overflow:hidden}
.card:hover{border-color:var(--accent);transform:translateY(-2px);box-shadow:0 14px 30px -18px rgba(30,38,34,.35)}
.card .top{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;color:var(--ink-3)}
.card .top img{width:26px;height:26px;border-radius:7px}
.card .top .kind{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);font-weight:600}
.card h2{font-family:"Newsreader",serif;font-weight:400;font-size:23px;line-height:1.18;margin:4px 0 0;letter-spacing:-.01em}
.card p{margin:0;color:var(--ink-2);font-size:14.5px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card .foot{margin-top:auto;padding-top:14px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--ink-3);border-top:1px solid var(--surface-2)}
.card .foot .read{color:var(--accent);font-weight:600;white-space:nowrap}
.card.feature{grid-column:1/-1;padding:32px;background:linear-gradient(135deg,var(--surface) 55%,var(--accent-soft))}
.card.feature h2{font-size:34px;max-width:720px}.card.feature p{-webkit-line-clamp:2;max-width:720px;font-size:16px}
.article{display:grid;grid-template-columns:minmax(0,1fr);gap:48px;margin-top:40px;padding-top:40px;border-top:1px solid var(--line)}
@media(min-width:980px){.article{grid-template-columns:minmax(0,1fr) 280px}}
.toc-box{position:sticky;top:84px;align-self:start;font-size:13.5px}
.toc-box .t{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--ink-3);margin-bottom:10px;font-weight:600}
.toc-box .toc{border-left:2px solid var(--line);padding-left:14px}
.toc-box ul{list-style:none;margin:0;padding:0}.toc-box li{margin:6px 0}.toc-box ul ul{padding-left:12px;font-size:12.5px}
.toc-box a{color:var(--ink-2);text-decoration:none;display:block;line-height:1.35}.toc-box a:hover{color:var(--accent)}
.toc-box .share{margin-top:22px;padding-top:16px;border-top:1px solid var(--line);color:var(--ink-3);font-size:12.5px}
.toc-box .share a{display:inline-block;margin:6px 10px 0 0;color:var(--accent)}
.prose{max-width:720px;font-size:17.5px;line-height:1.72}
.prose>p:first-child{font-size:19px;color:var(--ink-2)}
.prose h2{font-family:"Newsreader",serif;font-weight:400;font-size:31px;line-height:1.15;margin:52px 0 14px;letter-spacing:-.01em}
.prose h2+h3{margin-top:18px}
.prose h3{font-size:19px;font-weight:600;margin:34px 0 10px}
.prose p{margin:0 0 18px}.prose ul,.prose ol{padding-left:22px;margin:0 0 18px}.prose li{margin:6px 0}.prose li::marker{color:var(--accent)}
.prose strong{font-weight:600;color:var(--ink)}
.prose blockquote{margin:24px 0;padding:16px 22px;border-left:3px solid var(--accent);background:var(--surface);border-radius:0 14px 14px 0;color:var(--ink-2);font-size:17px}
.prose blockquote p{margin:0}
.prose code{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.86em;background:var(--surface);border:1px solid var(--line);border-radius:6px;padding:1px 6px}
.prose pre{background:#1E2622;color:#EEF1EF;border-radius:14px;padding:18px 20px;overflow:auto;font-size:13.5px;line-height:1.6;margin:0 0 22px}.prose pre code{background:none;border:0;padding:0;color:inherit}
.prose table{border-collapse:separate;border-spacing:0;width:100%;margin:0 0 24px;font-size:14.5px;line-height:1.45;background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.prose th,.prose td{padding:11px 14px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}.prose th{background:var(--surface-2);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2)}
.prose tr:last-child td{border-bottom:0}
.prose img{max-width:100%;border-radius:14px}
.prose hr{border:0;border-top:1px solid var(--line);margin:40px 0}
.faq{max-width:none}
.faq details{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:6px 22px;margin:0 0 10px;transition:border-color .2s}
.faq details[open]{border-color:var(--accent)}
.faq summary{cursor:pointer;font-weight:600;font-size:16px;padding:14px 0;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;line-height:1.35}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";flex:0 0 28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-weight:400;font-size:20px;line-height:1}
.faq details[open] summary::after{content:"–"}
.faq .a{padding:0 0 18px;color:var(--ink-2);line-height:1.65}.faq .a p{margin:0 0 10px}.faq .a p:last-child{margin:0}
.faq-head{display:grid;gap:24px;grid-template-columns:1fr;align-items:end;margin-bottom:28px}
@media(min-width:900px){.faq-head{grid-template-columns:1fr 320px}}
.search-row{display:flex;align-items:center;gap:16px;margin:0 0 20px}.search-row .count{font-size:13px;color:var(--ink-3);white-space:nowrap}
.search{flex:1;width:100%;height:50px;border:1px solid var(--line);border-radius:999px;background:var(--surface);padding:0 18px;font:inherit;font-size:15px;color:var(--ink);outline:none}
.search:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.cta-box{margin:64px 0 0;background:var(--ink);color:#fff;border-radius:24px;padding:36px 40px;display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;position:relative;overflow:hidden}
.cta-box::after{content:"";position:absolute;right:-80px;top:-80px;width:280px;height:280px;border-radius:999px;background:radial-gradient(closest-side,rgba(47,107,93,.7),transparent)}
.cta-box h3{font-family:"Newsreader",serif;font-weight:400;font-size:30px;margin:0 0 6px;letter-spacing:-.01em}.cta-box p{margin:0;opacity:.8;max-width:520px}
.cta-box a{position:relative;background:#fff;color:var(--ink);text-decoration:none;font-weight:600;border-radius:999px;padding:13px 24px;white-space:nowrap}
.cta-box a:hover{background:var(--accent-soft)}
footer{border-top:1px solid var(--line);background:var(--surface)}
footer .in{max-width:1120px;margin:0 auto;padding:36px 28px;display:grid;gap:24px;grid-template-columns:1fr;font-size:13.5px;color:var(--ink-3)}
@media(min-width:760px){footer .in{grid-template-columns:1.4fr 1fr 1fr}}
footer .brand{font-family:"Newsreader",serif;font-size:20px;color:var(--ink)}footer .brand em{color:var(--accent)}
footer p{margin:8px 0 0;max-width:380px;line-height:1.55}
footer h4{margin:0 0 10px;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--ink-3);font-weight:600}
footer a{display:block;color:var(--ink-2);text-decoration:none;margin:0 0 8px}footer a:hover{color:var(--accent)}
footer .legal{grid-column:1/-1;padding-top:18px;border-top:1px solid var(--line);font-size:12.5px}
.more{margin-top:64px;padding-top:40px;border-top:1px solid var(--line)}.more h2{font-family:"Newsreader",serif;font-weight:400;font-size:30px;margin:0 0 18px;letter-spacing:-.01em}
.crumbs{font-size:12.5px;color:var(--ink-3);margin-bottom:8px}.crumbs a{color:var(--ink-3);text-decoration:none}.crumbs a:hover{color:var(--accent)}
.progress{position:fixed;left:0;top:0;height:3px;width:0;background:var(--accent);z-index:6;transition:width .1s linear}
.card.brand{--brand:#2F6B5D;background:linear-gradient(160deg,var(--surface) 45%,color-mix(in srgb,var(--brand) 14%,var(--surface)))}
.card.brand::before{content:"";position:absolute;right:-30px;top:-30px;width:180px;height:180px;border-radius:999px;background:radial-gradient(closest-side,color-mix(in srgb,var(--brand) 28%,transparent),transparent)}
.card.brand .wm{position:absolute;right:-18px;bottom:-22px;width:150px;height:150px;opacity:.14;filter:blur(1.5px) saturate(1.2);pointer-events:none;transform:rotate(-8deg)}
.card.brand:hover .wm{opacity:.22}
.card.brand>*:not(.wm){position:relative}
.hero.brand{--brand:#2F6B5D;position:relative;max-width:none;margin:-48px -28px 36px;padding:56px 28px 44px;overflow:hidden;background:linear-gradient(160deg,color-mix(in srgb,var(--brand) 10%,var(--paper)),var(--paper) 70%)}
.hero.brand::before{content:"";position:absolute;right:-120px;top:-160px;width:560px;height:560px;border-radius:999px;background:radial-gradient(closest-side,color-mix(in srgb,var(--brand) 30%,transparent),transparent)}
.hero.brand .wm{position:absolute;right:4%;top:50%;width:min(34vw,360px);height:min(34vw,360px);transform:translateY(-50%) rotate(-8deg);opacity:.16;filter:blur(2px) saturate(1.2);pointer-events:none}
.hero.brand>*:not(.wm){position:relative;max-width:760px}
.hero.brand .meta .logo{box-shadow:0 1px 3px rgba(0,0,0,.12)}
.cta-box{background:var(--accent)}
.cta-box::after{background:radial-gradient(closest-side,rgba(255,255,255,.22),transparent)}
.cta-box a{background:#fff;color:var(--accent)}.cta-box a:hover{background:var(--accent-soft)}
.cta-box p{opacity:.9}
"""

_FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
          '<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">')


def _org_ld() -> dict:
    return {"@type": "Organization", "@id": f"{SITE_URL}/#organization", "name": SITE_NAME, "url": SITE_URL, "logo": f"{SITE_URL}/icon-512.png",
            "description": SITE_DESCRIPTION, "sameAs": []}


def _page(*, title: str, description: str, path: str, body: str, ld: list[dict], og_type: str = "website", published: str | None = None, modified: str | None = None,
          keywords: list[str] | None = None, current: str = "") -> str:
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
    <a href="/blog"{" class=on" if current == "blog" else ""}>Blog</a>
    <a href="/faq"{" class=on" if current == "faq" else ""}>Preguntas frecuentes</a>
    <a class="hide-sm" id="nav-login" href="/#login">Iniciar sesión</a>
    <a class="cta" id="nav-signup" href="/#signup">Crear cuenta</a>
  </nav>
</header>
<script>try{{if(localStorage.getItem("arena.token")){{const l=document.getElementById("nav-login"),c=document.getElementById("nav-signup");l.remove();c.textContent="Abrir la app";c.href="/";document.querySelectorAll(".cta-box a").forEach(a=>{{a.textContent="Abrir la app";a.href="/"}})}}}}catch(e){{}}</script>
{'<div class="progress" id="progress"></div><script>addEventListener("scroll",()=>{const d=document.documentElement;const p=d.scrollTop/(d.scrollHeight-d.clientHeight||1);document.getElementById("progress").style.width=(p*100)+"%"},{passive:true})</script>' if og_type == "article" else ""}
<main>
{body}
<section class="cta-box">
  <div><h3>Probá Tably Team con tu idea</h3><p>Escribí lo que querés construir y mirá cómo el equipo lo debate, lo diseña y lo construye.</p></div>
  <a href="/#signup">Crear cuenta gratis</a>
</section>
</main>
<footer>
  <div class="in">
    <div><div class="brand">Tably <em>Team</em></div><p>{SITE_TAGLINE}. Un equipo de IA con roles que debate tu idea, la diseña, la construye y la revisa. Vos aprobás cada paso.</p></div>
    <div><h4>Producto</h4><a href="/">Inicio</a><a href="/#signup">Crear cuenta</a><a href="/#login">Iniciar sesión</a></div>
    <div><h4>Recursos</h4><a href="/blog">Blog</a><a href="/faq">Preguntas frecuentes</a><a href="/blog/feed.xml">RSS</a><a href="/llms.txt">llms.txt</a><a href="/sitemap.xml">Sitemap</a></div>
    <div class="legal">© {date.today().year} {SITE_NAME}. Las marcas de los proveedores de IA pertenecen a sus dueños.</div>
  </div>
</footer>
</body>
</html>"""


def _card(p: Post, feature: bool = False) -> str:
    esc = html.escape
    logo_src, color = _brand(p.provider)
    logo = f'<img src="{esc(logo_src)}" alt="" aria-hidden="true">' if p.provider else f'<span class="kind">{esc(p.tags[0]) if p.tags else "Guía"}</span>'
    wm = f'<img class="wm" src="{esc(logo_src)}" alt="" aria-hidden="true">' if p.provider else ""
    cls = "card" + (" feature" if feature else "") + (" brand" if p.provider else "")
    return (f'<a class="{cls}" style="--brand:{esc(color)}" href="/blog/{esc(p.slug)}">{wm}<div class="top">{logo}<time datetime="{esc(p.date)}">{_fmt_date(p.date)}</time></div>'
            f'<h2>{esc(p.title)}</h2><p>{esc(p.description)}</p>'
            f'<div class="foot"><span>{p.reading_min} min de lectura</span><span class="read">Leer →</span></div></a>')


_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def _fmt_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
        return f"{d.day} de {_MONTHS[d.month - 1]} de {d.year}"
    except ValueError:
        return iso


def all_tags() -> list[tuple[str, int]]:
    counts: dict[str, int] = {}
    for p in posts():
        for t in p.tags:
            counts[t] = counts.get(t, 0) + 1
    return sorted(((t, n) for t, n in counts.items() if n >= 2), key=lambda kv: (-kv[1], kv[0]))[:12]


def blog_index_html(tag: str | None = None) -> str:
    esc = html.escape
    ps = [p for p in posts() if not tag or tag in p.tags]
    chips = '<a class="tag%s" href="/blog">Todos</a>' % ("" if tag else " on") + "".join(f'<a class="tag{" on" if t == tag else ""}" href="/blog?tag={esc(t)}">{esc(t)} · {n}</a>' for t, n in all_tags())
    cards = "".join(_card(p, feature=(i == 0 and not tag)) for i, p in enumerate(ps))
    body = (f'<div class="hero"><div class="eyebrow">Blog</div><h1>Guías para construir apps con un equipo de IA</h1>'
            f'<p class="lede">Qué hace bien cada inteligencia artificial, cómo elegir una para cada rol, qué cuesta construir una app y cómo funciona Tably Team por dentro. '
            f'Escrito por el equipo que lo construye.</p></div><div class="filters">{chips}</div><div class="grid">{cards}</div>')
    ld = [_org_ld(), {"@type": "Blog", "@id": f"{SITE_URL}/blog#blog", "name": f"{SITE_NAME} · Blog", "url": f"{SITE_URL}/blog", "publisher": {"@id": f"{SITE_URL}/#organization"},
                      "blogPost": [{"@type": "BlogPosting", "headline": p.title, "url": p.url(), "datePublished": p.date, "dateModified": p.updated} for p in posts()]},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE_URL}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE_URL}/blog"}]}]
    return _page(title="Blog: guías sobre IA para construir apps", description="Guías detalladas sobre Claude, GPT, Gemini, DeepSeek, Grok, Llama, Kimi, Mistral y más: para qué sirve cada una, cómo elegirlas por rol y cómo Tably Team construye apps con ellas.",
                 path="/blog", body=body, ld=ld, current="blog")


def post_html(p: Post) -> str:
    esc = html.escape
    others = [o for o in posts() if o.slug != p.slug]
    related = [o for o in others if set(o.tags) & set(p.tags)][:3] or others[:3]
    share = (f'<div class="share">Compartir<br><a href="https://twitter.com/intent/tweet?url={esc(p.url())}&text={esc(p.title)}" rel="noopener" target="_blank">X</a>'
             f'<a href="https://www.linkedin.com/sharing/share-offsite/?url={esc(p.url())}" rel="noopener" target="_blank">LinkedIn</a>'
             f'<a href="https://wa.me/?text={esc(p.title)}%20{esc(p.url())}" rel="noopener" target="_blank">WhatsApp</a></div>')
    toc = f'<aside class="toc-box"><div class="t">En este artículo</div>{p.toc_html}{share}</aside>' if p.toc_html.strip() else f'<aside class="toc-box">{share}</aside>'
    logo_src, color = _brand(p.provider)
    logo = f'<img class="logo" src="{esc(logo_src)}" alt="">' if p.provider else ""
    wm = f'<img class="wm" src="{esc(logo_src)}" alt="" aria-hidden="true">' if p.provider else ""
    tags = "".join(f'<a class="tag" href="/blog?tag={esc(t)}">{esc(t)}</a>' for t in p.tags)
    body = (f'<div class="hero{" brand" if p.provider else ""}" style="--brand:{esc(color)}">{wm}<div class="crumbs"><a href="/">Inicio</a> › <a href="/blog">Blog</a></div><div class="eyebrow">{esc(p.tags[0]) if p.tags else "Guía"}</div><h1>{esc(p.title)}</h1><p class="lede">{esc(p.description)}</p>'
            f'<div class="meta">{logo}<time datetime="{esc(p.date)}">{_fmt_date(p.date)}</time>'
            + (f'<span>actualizado el {_fmt_date(p.updated)}</span>' if p.updated != p.date else "")
            + f'<span>{p.reading_min} min de lectura</span><span>por el equipo de {SITE_NAME}</span><span class="tags">{tags}</span></div></div>'
            f'<div class="article"><article class="prose">{p.body_html}</article>{toc}</div>'
            f'<section class="more"><h2>Seguir leyendo</h2><div class="grid">{"".join(_card(o) for o in related)}</div></section>')
    ld = [_org_ld(),
          {"@type": "Article", "@id": f"{p.url()}#article", "headline": p.title, "description": p.description, "url": p.url(), "mainEntityOfPage": p.url(), "inLanguage": "es",
           "datePublished": p.date, "dateModified": p.updated, "keywords": ", ".join(p.keywords or p.tags), "wordCount": len(re.findall(r"\w+", p.body_md)),
           "author": {"@type": "Organization", "name": SITE_NAME, "url": SITE_URL}, "publisher": {"@id": f"{SITE_URL}/#organization"}, "image": f"{SITE_URL}/icon-512.png"},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE_URL}, {"@type": "ListItem", "position": 2, "name": "Blog", "item": f"{SITE_URL}/blog"},
                                                          {"@type": "ListItem", "position": 3, "name": p.title, "item": p.url()}]}]
    return _page(title=p.title, description=p.description, path=f"/blog/{p.slug}", body=body, ld=ld, og_type="article", published=p.date, modified=p.updated, keywords=p.keywords or p.tags, current="blog")


def faq_html() -> str:
    esc = html.escape
    items = faq()
    body = (f'<div class="hero"><div class="eyebrow">Preguntas frecuentes</div><h1>Lo que te preguntás antes de construir</h1>'
            f'<p class="lede">Qué es, cuánto cuesta, qué IA usar, dónde queda tu código, cómo se publica la app y qué pasa con tus claves. Respuestas directas.</p></div>'
            f'<div class="search-row"><input class="search" id="q" type="search" placeholder="Buscar entre {len(items)} preguntas…" autocomplete="off" aria-label="Buscar"><span class="count" id="count">{len(items)} preguntas</span></div><div class="faq" id="faq">'
            + "".join(f'<details id="{esc(i.slug)}"><summary>{esc(i.question)}</summary><div class="a">{i.answer_html}</div></details>' for i in items) + "</div>"
            '<script>const q=document.getElementById("q"),all=[...document.querySelectorAll("#faq details")];q.addEventListener("input",()=>{const v=q.value.trim().toLowerCase();let n=0;all.forEach(d=>{const hit=!v||d.textContent.toLowerCase().includes(v);d.style.display=hit?"":"none";if(hit)n++;if(v&&hit)d.open=true});document.getElementById("count").textContent=n+(n===1?" pregunta":" preguntas")});'
            'if(location.hash){const d=document.getElementById(location.hash.slice(1));if(d){d.open=true;d.scrollIntoView()}}</script>')
    ld = [_org_ld(), {"@type": "FAQPage", "@id": f"{SITE_URL}/faq#faq", "url": f"{SITE_URL}/faq", "inLanguage": "es",
                      "mainEntity": [{"@type": "Question", "name": i.question, "acceptedAnswer": {"@type": "Answer", "text": i.answer_text}} for i in items]},
          {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE_URL}, {"@type": "ListItem", "position": 2, "name": "Preguntas frecuentes", "item": f"{SITE_URL}/faq"}]}]
    return _page(title="Preguntas frecuentes", description="Respuestas directas sobre Tably Team: qué es, cuánto cuesta, qué IA conviene para cada rol, cómo se publica la app, dónde queda tu código y cómo se cuidan tus API keys.",
                 path="/faq", body=body, ld=ld, current="faq")


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
