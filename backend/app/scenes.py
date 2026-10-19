"""
Animated card scenes for experiments: every experiment card (built-in or saved by a user) gets a looping SVG
"video" background. Scenes are procedural — a motif chosen from the title/topic keywords (bars, cards, phones,
network, rocket, podium, radar, converge, orbs) and colours seeded from the title — so a brand-new experiment
gets its scene instantly, offline and licence-free. Output is plain SVG with SMIL animations (runs inside <img>).
"""
from __future__ import annotations

import hashlib
import math
import random
import re

W, H = 400, 260
INK, ACCENT, GOLD, ROSE, SKY, VIOLET, PEACH, MINT, PAPER, SURFACE, LINE = "#1B2320", "#2F6B5D", "#C9A24A", "#E6A19A", "#8FB7D3", "#A99BD9", "#F2C9A0", "#9FCDA8", "#F5F7F5", "#FFFFFF", "#DCE2DE"
PALETTES = [("#EAF1EC", "#D7E6DD"), ("#EEF0F7", "#DDE3F0"), ("#FBF1E9", "#F3E0D0"), ("#E9EEF6", "#DCE7F1"), ("#EEE9F5", "#E2DCEF"), ("#F6F0E4", "#EEE2C9"), ("#E6ECEA", "#C9D6D1"), ("#EEF4EC", "#DBE8DA")]

MOTIFS: list[tuple[str, tuple[str, ...]]] = [
    ("weather", ("clima", "weather", "pronóstico", "pronostico", "lluvia", "paraguas", "tormenta", "temperatura", "meteor", "viento", "nube", "soleado", "tiempo atmosférico", "forecast", "humedad", "granizo")),
    ("cards", ("tienda", "ecommerce", "e-commerce", "venta", "vender", "producto", "catálogo", "catalogo", "carrito", "shop")),
    ("phones", ("móvil", "movil", "mobile", "ios", "android", "celular", "app móvil", "teléfono", "telefono")),
    ("rocket", ("startup", "lanzar", "lanzamiento", "cohete", "crecimiento", "growth", "escalar", "mvp")),
    ("podium", ("juicio", "mejor", "ranking", "competencia", "premio", "torneo", "versus", "vs", "debate")),
    ("radar", ("detective", "misterio", "incidente", "caído", "caido", "bug", "investig", "seguridad", "ataque", "forense", "sismo", "terremoto", "temblor", "alerta", "sensor", "monitoreo")),
    ("converge", ("negoci", "compra", "acuerdo", "precio", "contrato", "oferta", "trato")),
    ("bars", ("saas", "b2b", "dashboard", "métrica", "metrica", "datos", "analítica", "analitica", "finanzas", "kpi", "reporte", "marketing", "campaña", "ventas", "plan", "estrategia", "cliente")),
    ("network", ("ia", "agente", "red", "api", "integra", "automat", "herramienta", "interna", "workflow", "pipeline")),
    ("blueprint", ("construir", "app", "arquitect", "equipo", "software", "sistema", "plataforma", "backend", "frontend")),
    ("orbs", ("derecho", "ética", "etica", "filosof", "moral", "futuro", "sociedad", "idea")),
]


GENERIC = {"blueprint", "network", "bars", "orbs"}  # words like "app", "construir", "datos" appear in almost every brief: they only win when nothing specific does


def pick_motif(text: str, title: str = "") -> str:
    low = (text or "").lower()
    tlow = (title or "").lower()
    best, score = "orbs", 0.0
    for motif, keys in MOTIFS:
        hits = [k for k in keys if k in low]
        n = sum(1.0 + (1.0 if k in tlow else 0.0) for k in hits)
        if motif in GENERIC:
            n = min(n * 0.2, 0.9)  # a single specific hit (1.0) always beats any pile of generic words
        if n > score:
            best, score = motif, n
    return best


def _head(seed: int) -> str:
    bg1, bg2 = PALETTES[seed % len(PALETTES)]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>'
            f'<filter id="blur"><feGaussianBlur stdDeviation="14"/></filter></defs><rect width="{W}" height="{H}" fill="url(#bg)"/>')


def _grid(op=0.35, step=20, color=ACCENT) -> str:
    out = [f'<line x1="{x}" y1="0" x2="{x}" y2="{H}" stroke="{color}" stroke-opacity="{op * 0.35:.3f}"/>' for x in range(0, W + 1, step)]
    out += [f'<line x1="0" y1="{y}" x2="{W}" y2="{y}" stroke="{color}" stroke-opacity="{op * 0.35:.3f}"/>' for y in range(0, H + 1, step)]
    return "".join(out)


def _orb(cx, cy, r, color, dur, dx=30, dy=20, op=0.5) -> str:
    return (f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}" fill-opacity="{op}" filter="url(#blur)">'
            f'<animateTransform attributeName="transform" type="translate" values="0 0; {dx} {dy}; 0 0" dur="{dur}s" repeatCount="indefinite"/></circle>')


def _blueprint(rnd: random.Random) -> str:
    s = _grid(0.6)
    mods = [(60, 70, 110, 60), (230, 60, 120, 70), (90, 160, 120, 60), (250, 165, 100, 50)]
    for i, (x, y, w, h) in enumerate(mods):
        s += (f'<g><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{SURFACE}" stroke="{ACCENT}" stroke-width="1.5">'
              f'<animate attributeName="opacity" values="0;1;1;1;0" keyTimes="0;0.15;0.8;0.95;1" dur="7s" begin="{i * 0.6}s" repeatCount="indefinite"/>'
              f'<animateTransform attributeName="transform" type="translate" values="0 24;0 0;0 0;0 0;0 24" keyTimes="0;0.15;0.8;0.95;1" dur="7s" begin="{i * 0.6}s" repeatCount="indefinite"/></rect>'
              f'<rect x="{x + 12}" y="{y + 14}" width="{w - 24}" height="8" rx="4" fill="{MINT}"><animate attributeName="width" values="0;{w - 24}" dur="7s" begin="{i * 0.6 + 0.5}s" repeatCount="indefinite"/></rect>'
              f'<rect x="{x + 12}" y="{y + 30}" width="{w - 50}" height="6" rx="3" fill="{LINE}"/><rect x="{x + 12}" y="{y + 42}" width="{w - 70}" height="6" rx="3" fill="{LINE}"/></g>')
    for (x1, y1, x2, y2) in [(170, 100, 230, 95), (150, 130, 150, 160), (210, 190, 250, 190), (290, 130, 300, 165)]:
        L = math.hypot(x2 - x1, y2 - y1)
        s += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{ACCENT}" stroke-width="2" stroke-dasharray="{L:.0f}" stroke-dashoffset="{L:.0f}"><animate attributeName="stroke-dashoffset" values="{L:.0f};0;0;{L:.0f}" keyTimes="0;0.4;0.85;1" dur="7s" begin="1.5s" repeatCount="indefinite"/></line>'
    s += f'<circle r="4" fill="{GOLD}"><animateMotion dur="3.5s" repeatCount="indefinite" path="M170,100 L230,95 L290,130 L300,165"/></circle>'
    return s


def _bars(rnd: random.Random) -> str:
    s = _grid(0.4, 24, "#5A6B9A") + f'<rect x="40" y="40" width="320" height="180" rx="14" fill="{SURFACE}" stroke="{LINE}"/>'
    heights = [rnd.randint(50, 140) for _ in range(6)]
    for i, hgt in enumerate(heights):
        x = 70 + i * 40
        s += (f'<rect x="{x}" y="{200 - hgt}" width="22" height="{hgt}" rx="5" fill="{ACCENT}" fill-opacity="{0.45 + i * 0.09:.2f}">'
              f'<animate attributeName="height" values="0;{hgt};{hgt};0" keyTimes="0;0.35;0.85;1" dur="6s" begin="{i * 0.25}s" repeatCount="indefinite"/>'
              f'<animate attributeName="y" values="200;{200 - hgt};{200 - hgt};200" keyTimes="0;0.35;0.85;1" dur="6s" begin="{i * 0.25}s" repeatCount="indefinite"/></rect>')
    pts = " ".join(f"{70 + i * 40},{150 - rnd.randint(0, 90)}" for i in range(7))
    s += f'<polyline points="{pts}" fill="none" stroke="{GOLD}" stroke-width="3" stroke-linecap="round" stroke-dasharray="420" stroke-dashoffset="420"><animate attributeName="stroke-dashoffset" values="420;0;0;420" keyTimes="0;0.5;0.85;1" dur="6s" repeatCount="indefinite"/></polyline>'
    s += f'<rect x="56" y="52" width="90" height="10" rx="5" fill="{LINE}"/><rect x="56" y="68" width="60" height="8" rx="4" fill="{LINE}"/>'
    return s


def _cards(rnd: random.Random) -> str:
    s = ""
    cols = [PEACH, MINT, SKY, ROSE, VIOLET]
    for off in (0, 550):
        for i in range(5):
            x = -120 + i * 110 + off
            s += (f'<g><rect x="{x}" y="70" width="90" height="120" rx="12" fill="{SURFACE}" stroke="{LINE}"/><rect x="{x + 10}" y="80" width="70" height="60" rx="8" fill="{cols[(i + off // 110) % 5]}"/>'
                  f'<rect x="{x + 10}" y="150" width="50" height="7" rx="3" fill="{LINE}"/><rect x="{x + 10}" y="164" width="30" height="9" rx="4" fill="{ACCENT}"/>'
                  f'<animateTransform attributeName="transform" type="translate" values="0 0;-550 0" dur="14s" repeatCount="indefinite"/></g>')
    s += f'<g><path d="M300 210 h12 l10 -30 h50 l-8 22 h-40" fill="none" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="326" cy="216" r="4" fill="{INK}"/><circle cx="356" cy="216" r="4" fill="{INK}"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="2s" repeatCount="indefinite"/></g>'
    s += f'<circle cx="372" cy="176" r="9" fill="{ROSE}"><animate attributeName="r" values="7;10;7" dur="1.4s" repeatCount="indefinite"/></circle>'
    return s


def _phones(rnd: random.Random) -> str:
    s = ""
    for k, (x, y, rot) in enumerate([(120, 30, -8), (220, 45, 6)]):
        s += (f'<g transform="rotate({rot} {x + 45} {y + 95})"><rect x="{x}" y="{y}" width="90" height="190" rx="18" fill="{INK}"/><rect x="{x + 6}" y="{y + 8}" width="78" height="174" rx="12" fill="{SURFACE}"/>'
              f'<rect x="{x + 6}" y="{y + 8}" width="78" height="40" rx="12" fill="{ACCENT}"><animate attributeName="fill" values="{ACCENT};{SKY};{GOLD};{ACCENT}" dur="9s" begin="{k * 3}s" repeatCount="indefinite"/></rect>')
        for j in range(4):
            s += f'<rect x="{x + 14}" y="{y + 60 + j * 28}" width="62" height="18" rx="6" fill="{PAPER}" stroke="{LINE}"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.2;0.8;1" dur="9s" begin="{k * 3 + j * 0.4}s" repeatCount="indefinite"/></rect>'
        s += f'<circle cx="{x + 80}" cy="{y + 14}" r="6" fill="{ROSE}"><animate attributeName="r" values="4;7;4" dur="1.5s" begin="{k}s" repeatCount="indefinite"/></circle></g>'
    return s + _orb(60, 220, 50, MINT, 8) + _orb(350, 40, 45, VIOLET, 10, -20, 25, 0.4)


def _network(rnd: random.Random) -> str:
    s = _grid(0.3, 26)
    nodes = [(rnd.randint(50, 350), rnd.randint(40, 220)) for _ in range(7)]
    edges = [(i, (i + 1) % 7) for i in range(7)] + [(0, 3), (2, 5)]
    for i, (a, b) in enumerate(edges):
        (x1, y1), (x2, y2) = nodes[a], nodes[b]
        s += f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{ACCENT}" stroke-opacity="0.35" stroke-width="2"/>'
        s += f'<circle r="4" fill="{GOLD}"><animateMotion dur="{2.2 + i * 0.3:.1f}s" begin="{i * 0.4:.1f}s" repeatCount="indefinite" path="M{x1},{y1} L{x2},{y2}"/></circle>'
    for i, (x, y) in enumerate(nodes):
        s += f'<circle cx="{x}" cy="{y}" r="14" fill="{SURFACE}" stroke="{ACCENT}" stroke-width="2"><animate attributeName="r" values="13;16;13" dur="{2.5 + i * 0.2:.1f}s" repeatCount="indefinite"/></circle><circle cx="{x}" cy="{y}" r="5" fill="{ACCENT}"/>'
    return s


def _orbs(rnd: random.Random) -> str:
    s = _orb(110, 110, 70, VIOLET, 9, 25, 15) + _orb(290, 150, 80, SKY, 11, -30, -20, 0.45) + _orb(200, 60, 50, ROSE, 7, 10, 25, 0.35)
    s += (f'<g stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"><line x1="200" y1="90" x2="200" y2="210"/><line x1="150" y1="210" x2="250" y2="210"/>'
          f'<g><line x1="120" y1="110" x2="280" y2="110"/><path d="M120 110 l-25 40 h50 z M280 110 l-25 40 h50 z" fill="{SURFACE}" fill-opacity="0.9"/>'
          f'<animateTransform attributeName="transform" type="rotate" values="-6 200 110;6 200 110;-6 200 110" dur="8s" repeatCount="indefinite"/></g></g>')
    return s


def _rocket(rnd: random.Random) -> str:
    s = ""
    for _ in range(26):
        s += f'<circle cx="{rnd.randint(10, 390)}" cy="{rnd.randint(10, 250)}" r="{rnd.choice([1, 1.5, 2])}" fill="{SURFACE}"><animate attributeName="opacity" values="0.2;1;0.2" dur="{rnd.uniform(2, 5):.1f}s" repeatCount="indefinite"/></circle>'
    s += f'<path d="M40 220 C 140 200, 220 120, 360 50" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="6 8" stroke-opacity="0.7"><animate attributeName="stroke-dashoffset" values="0;-140" dur="4s" repeatCount="indefinite"/></path>'
    s += (f'<g><path d="M0 -14 C 8 -6, 8 8, 0 16 C -8 8, -8 -6, 0 -14 z" fill="{SURFACE}" stroke="{INK}" stroke-width="2"/><circle r="3.5" fill="{SKY}"/><path d="M-6 8 l-8 10 h8 z M6 8 l8 10 h-8 z" fill="{ROSE}"/>'
          f'<path d="M-4 16 q4 16 8 0 z" fill="{GOLD}"><animate attributeName="opacity" values="1;0.3;1" dur="0.3s" repeatCount="indefinite"/></path>'
          f'<animateMotion dur="6s" repeatCount="indefinite" rotate="auto" path="M40,220 C 140,200 220,120 360,50"/></g>')
    return s


def _podium(rnd: random.Random) -> str:
    s = f'<g opacity="0.35"><path d="M200 -20 L120 260 L280 260 z" fill="{GOLD}"><animateTransform attributeName="transform" type="rotate" values="-18 200 -20;18 200 -20;-18 200 -20" dur="7s" repeatCount="indefinite"/></path></g>'
    for i, (x, h, c) in enumerate([(90, 70, SKY), (170, 120, GOLD), (250, 90, MINT)]):
        s += (f'<rect x="{x}" y="{230 - h}" width="70" height="{h}" rx="8" fill="{c}"><animate attributeName="height" values="0;{h};{h};0" keyTimes="0;0.3;0.85;1" dur="7s" begin="{i * 0.3}s" repeatCount="indefinite"/>'
              f'<animate attributeName="y" values="230;{230 - h};{230 - h};230" keyTimes="0;0.3;0.85;1" dur="7s" begin="{i * 0.3}s" repeatCount="indefinite"/></rect>'
              f'<circle cx="{x + 35}" cy="{230 - h - 30}" r="16" fill="{SURFACE}" stroke="{INK}" stroke-width="2"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.3;0.85;1" dur="7s" begin="{i * 0.3}s" repeatCount="indefinite"/></circle>')
    s += f'<path d="M190 60 h20 l6 18 h-32 z M196 78 h8 v10 h-8 z" fill="{GOLD}" stroke="{INK}" stroke-width="1.5"><animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="2s" repeatCount="indefinite"/></path>'
    return s


def _radar(rnd: random.Random) -> str:
    s = "".join(f'<circle cx="150" cy="130" r="{r}" fill="none" stroke="{ACCENT}" stroke-opacity="0.35"/>' for r in (95, 60, 25))
    s += f'<path d="M150 130 L150 35 A95 95 0 0 1 232 83 z" fill="{ACCENT}" fill-opacity="0.35"><animateTransform attributeName="transform" type="rotate" values="0 150 130;360 150 130" dur="4s" repeatCount="indefinite"/></path>'
    s += f'<circle cx="190" cy="95" r="5" fill="{ROSE}"><animate attributeName="opacity" values="0;1;0" dur="4s" begin="0.6s" repeatCount="indefinite"/></circle>'
    for i in range(4):
        y = 70 + i * 36
        blink = '<animate attributeName="opacity" values="1;0;1" dur="0.8s" repeatCount="indefinite"/>' if i == 2 else ""
        s += f'<rect x="280" y="{y}" width="90" height="28" rx="6" fill="{SURFACE}" stroke="{LINE}"/><circle cx="296" cy="{y + 14}" r="4" fill="{MINT}"/><circle cx="310" cy="{y + 14}" r="4" fill="{ROSE if i == 2 else MINT}">{blink}</circle><rect x="326" y="{y + 10}" width="36" height="8" rx="4" fill="{LINE}"/>'
    s += f'<g><circle cx="70" cy="200" r="18" fill="none" stroke="{INK}" stroke-width="4"/><line x1="83" y1="213" x2="100" y2="230" stroke="{INK}" stroke-width="5" stroke-linecap="round"/><animateTransform attributeName="transform" type="translate" values="0 0;30 -10;0 0" dur="5s" repeatCount="indefinite"/></g>'
    return s


def _weather(rnd: random.Random) -> str:
    """Sun with slowly turning rays, two clouds drifting across, a shower of drops under the darker one, a small umbrella."""
    s = f'<g><circle cx="300" cy="78" r="30" fill="{GOLD}" fill-opacity="0.9"/>'
    s += "".join(f'<line x1="300" y1="78" x2="300" y2="26" stroke="{GOLD}" stroke-width="5" stroke-linecap="round" transform="rotate({a} 300 78)"/>' for a in range(0, 360, 45))
    s += '<animateTransform attributeName="transform" type="rotate" values="0 300 78;360 300 78" dur="40s" repeatCount="indefinite"/></g>'
    cloud = lambda x, y, sc, c, dur, dx: (f'<g transform="translate({x} {y}) scale({sc})"><g><ellipse cx="0" cy="0" rx="46" ry="22" fill="{c}"/><circle cx="-18" cy="-12" r="22" fill="{c}"/><circle cx="12" cy="-16" r="26" fill="{c}"/>'
                                          f'<animateTransform attributeName="transform" type="translate" values="0 0;{dx} 0;0 0" dur="{dur}s" repeatCount="indefinite"/></g></g>')
    s += cloud(120, 92, 1.0, SURFACE, 14, 40)
    s += cloud(230, 140, 0.8, "#C9D3DA", 11, -30)
    for i in range(7):
        x = 200 + i * 12
        s += f'<line x1="{x}" y1="165" x2="{x - 4}" y2="181" stroke="{SKY}" stroke-width="3" stroke-linecap="round"><animate attributeName="transform" attributeType="XML" type="translate" values="0 0;0 40" dur="{1.1 + (i % 3) * 0.3:.1f}s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="{1.1 + (i % 3) * 0.3:.1f}s" repeatCount="indefinite"/></line>'
    s += (f'<g><path d="M40 205 a40 40 0 0 1 80 0 z" fill="{ROSE}" stroke="{INK}" stroke-width="2"/><line x1="80" y1="205" x2="80" y2="240" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
          f'<path d="M80 240 a8 8 0 0 1 -16 0" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/><animateTransform attributeName="transform" type="rotate" values="-4 80 205;4 80 205;-4 80 205" dur="3s" repeatCount="indefinite"/></g>')
    for i, (x, w) in enumerate([(280, 60), (280, 44), (280, 70)]):
        s += f'<rect x="{x}" y="{150 + i * 22}" width="{w}" height="10" rx="5" fill="{SURFACE}" stroke="{LINE}"/>'
    s += f'<text x="350" y="200" font-family="ui-monospace, monospace" font-size="26" font-weight="700" fill="{INK}" text-anchor="middle">23°<animate attributeName="opacity" values="1;0.6;1" dur="4s" repeatCount="indefinite"/></text>'
    return s


def _converge(rnd: random.Random) -> str:
    s = (f'<path d="M30 60 C 150 60, 250 130, 370 130" fill="none" stroke="{ACCENT}" stroke-width="3" stroke-dasharray="400" stroke-dashoffset="400"><animate attributeName="stroke-dashoffset" values="400;0;0;400" keyTimes="0;0.45;0.85;1" dur="8s" repeatCount="indefinite"/></path>'
         f'<path d="M30 200 C 150 200, 250 130, 370 130" fill="none" stroke="{GOLD}" stroke-width="3" stroke-dasharray="400" stroke-dashoffset="400"><animate attributeName="stroke-dashoffset" values="400;0;0;400" keyTimes="0;0.45;0.85;1" dur="8s" repeatCount="indefinite"/></path>'
         f'<circle cx="370" cy="130" r="10" fill="{SURFACE}" stroke="{INK}" stroke-width="2"><animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite"/></circle>')
    for (x, y, c, dy) in [(40, 38, ACCENT, -6), (40, 178, GOLD, 6)]:
        s += f'<g><rect x="{x}" y="{y}" width="76" height="26" rx="8" fill="{SURFACE}" stroke="{c}" stroke-width="1.5"/><rect x="{x + 14}" y="{y + 9}" width="48" height="8" rx="4" fill="{LINE}"/><animateTransform attributeName="transform" type="translate" values="0 0;0 {dy};0 0" dur="3s" repeatCount="indefinite"/></g>'
    s += f'<g><path d="M300 180 l18 -12 l18 12 l-10 10 h-16 z" fill="{PEACH}" stroke="{INK}" stroke-width="1.5"/><path d="M336 180 l18 -12 l18 12 l-10 10 h-16 z" fill="{MINT}" stroke="{INK}" stroke-width="1.5"/><animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="2.4s" repeatCount="indefinite"/></g>'
    return s


GEN = {"weather": _weather, "blueprint": _blueprint, "bars": _bars, "cards": _cards, "phones": _phones, "network": _network, "orbs": _orbs, "rocket": _rocket, "podium": _podium, "radar": _radar, "converge": _converge}


def generate(title: str, topic: str = "", motif: str | None = None) -> str:
    """A complete animated SVG for an experiment card, deterministic for the same title."""
    seed = int(hashlib.sha1((title or "").encode()).hexdigest()[:8], 16)
    rnd = random.Random(seed)
    m = motif if motif in GEN else pick_motif(f"{title} {topic}", title)
    return _head(seed) + GEN[m](rnd) + "</svg>"


def safe_id(s: str) -> str:
    return re.sub(r"[^a-z0-9-]", "", (s or "").lower())[:40]
