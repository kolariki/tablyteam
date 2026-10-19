"""
Design phase: before any code is written, the team's Product Designer produces a real, professional UI design
the builder is then obliged to implement — not a paragraph of intentions.

Deliverables (all under design/ in the project):
  design/DESIGN.md     the design system + every key screen specified (layout, hierarchy, components, states, copy)
  design/tokens.css    the tokens as CSS variables (color roles, type scale, spacing, radii, shadows, motion)
  design/mockup.html   a single self-contained hi-fi mockup of the key screens, built with those tokens — what the
                       product must look like, pixel by pixel; it doubles as the first "how it's shaping up" thumbnail
"""
from __future__ import annotations

import re
from pathlib import Path

from .expertise import EXPERTISE

DESIGN_SYSTEM = """Sos un/a Product Designer senior (UX/UI) de nivel Linear / Stripe / Vercel / Apple. Te pasan el BRIEF de un producto
y tu trabajo es DISEÑARLO de verdad, como lo harías en Figma, antes de que el equipo escriba código. El resultado tiene que ser
preciso y hermoso: jerarquía clara, espacio generoso, tipografía cuidada, color con roles, cero decoración gratuita, cero
"plantilla genérica". Nada de lorem ipsum: copy real del dominio del producto.

CÓMO TRABAJÁS: {craft}
TU ESTÁNDAR: {standards}

ENTREGÁS EXACTAMENTE TRES ARCHIVOS, con este protocolo (sin texto fuera de las etiquetas):
<say>en 4-8 líneas: la dirección visual elegida (y por qué encaja con el producto y su usuario), referencias, y qué pantallas diseñaste</say>
<file path="design/DESIGN.md">
# Diseño de <producto>
## 1. Dirección visual — concepto en 2-3 frases, referentes, tono (sobrio/cálido/técnico…), plataforma(s) y breakpoints.
## 2. Sistema
- Paleta con ROLES y HEX exactos: fondo, superficie, superficie elevada, borde, texto primario/secundario/terciario, acento, acento suave, éxito, aviso, error; contraste AA verificado (indicá ratios).
- Tipografía: familias (máx. 2, con fallback del sistema), escala modular con tamaños/pesos/interlineado por nivel (display, h1, h2, h3, body, small, mono).
- Espaciado en escala 4/8/12/16/24/32/48/64, radios, sombras (máx. 3 niveles), grilla y anchos de contenido, iconografía (una librería, un grosor).
- Movimiento: duraciones (150–250 ms) y easings; qué se anima y qué no.
## 3. Componentes — botón (primario/secundario/ghost/destructivo, tamaños, estados hover/focus/disabled/loading), inputs y formularios (labels, ayuda, error en línea), tarjetas, tablas/listas, navegación, badges/estados, toasts, modales, empty states. Para cada uno: medidas, tokens usados, estados.
## 4. Pantallas — para CADA pantalla clave del brief: objetivo, layout (zonas y proporciones), jerarquía (qué se ve primero), componentes, contenido real de ejemplo, estados (vacío / cargando con skeleton / error con acción / éxito), responsive (qué cambia en 360px), accesibilidad (foco, labels, orden), microinteracciones.
## 5. Flujo principal — paso a paso con las pantallas, y los momentos de feedback.
## 6. Checklist de calidad para el constructor — 10-15 ítems verificables (tokens, espaciado, contraste, estados, responsive, foco, copy).
</file>
<file path="design/tokens.css">
:root {{ --color-bg: #…; --color-surface: #…; … --font-sans: …; --text-xs: …; --space-1: 4px; … --radius-md: …; --shadow-sm: …; --ease: …; --dur-fast: 150ms; }}
(todas las variables del sistema, con los mismos nombres que usa DESIGN.md; incluí un bloque @media (prefers-color-scheme: dark) solo si el brief lo pide)
</file>
<file path="design/mockup.html">
UN solo HTML autocontenido (CSS inline en <style>, SIN dependencias externas salvo Google Fonts si definiste una familia; nada de frameworks)
que importa literalmente las variables de tokens.css (copiá el :root dentro del <style>) y muestra las 3-5 pantallas clave del producto
en alta fidelidad, navegables entre sí con JS mínimo (tabs/links), con datos de ejemplo reales del dominio, y al menos un estado vacío y uno de error.
Responsive de verdad (probá mentalmente 360px y 1440px). Tiene que verse como un producto terminado y pulido, no como un wireframe.
</file>

REGLAS: HEX reales, medidas reales, nombres reales. Contraste AA en texto. Un solo acento. Un CTA primario por pantalla. Espaciado en escala.
Si el brief ya fija nombre, tono o paleta, respetalo. Idioma del copy: {language}."""

DESIGN_USER = """BRIEF DEL PRODUCTO:

{brief}

---
Diseñá este producto. Primero decidí la dirección visual (adecuada a su usuario y contexto), después el sistema, después cada pantalla.
Recordá: tres archivos completos, el mockup tiene que ser hermoso y fiel al sistema."""

BUILDER_DESIGN_RULE = """
DISEÑO APROBADO: existe un diseño profesional en design/DESIGN.md (sistema + pantallas), design/tokens.css (variables) y design/mockup.html
(maqueta hi-fi). La interfaz DEBE implementarlo fielmente: usá tokens.css tal cual (copiala al proyecto e importala; nunca valores sueltos),
reproducí la estructura, jerarquía, espaciado, estados y copy de cada pantalla del mockup, y pasá la checklist del final de DESIGN.md.
Si algo del diseño es inviable, acercate lo más posible y anotá la desviación en NOTES.md. Una UI que no coincide con el mockup es un bug."""

ENGINE_DESIGN_PROMPT = """Actuá como Product Designer senior (UX/UI) de nivel Linear / Stripe / Vercel / Apple. Leé BRIEF.md y, ANTES de que se escriba
código, diseñá el producto de verdad: creá design/DESIGN.md (dirección visual, sistema con paleta en HEX y contraste AA, tipografía con escala,
espaciado 4/8, radios, sombras, movimiento; componentes con estados; CADA pantalla clave con layout, jerarquía, contenido real, estados
vacío/cargando/error, responsive 360px, accesibilidad; flujo principal; checklist de calidad), design/tokens.css (todas las variables CSS) y
design/mockup.html (UN HTML autocontenido con las 3-5 pantallas clave en alta fidelidad, usando esos tokens, con datos reales del dominio,
navegable, responsive; tiene que verse como un producto terminado y pulido). Nada de lorem ipsum ni plantillas genéricas. No escribas nada
fuera de design/ en este paso. Al terminar, resumí en 5 líneas la dirección visual elegida y qué pantallas diseñaste."""


# The official "frontend-design" skill (Anthropic, downloaded into the catalog): the craft notes that separate a
# distinctive, intentional UI from the generic generated page. Injected into the designer and the builder.
_FRONTEND_SKILL_PATH = Path(__file__).resolve().parents[1] / "data" / "skills-catalog" / "sources" / "anthropics--skills" / "skills" / "frontend-design" / "SKILL.md"


def frontend_design_guide(limit: int = 9000) -> str:
    try:
        text = _FRONTEND_SKILL_PATH.read_text(errors="ignore")
    except OSError:
        return ""
    text = re.sub(r"^---.*?---\s*", "", text, count=1, flags=re.S).strip()
    return ("\n\nGUÍA DE DISEÑO (skill oficial frontend-design; aplicala al pie de la letra, está en inglés):\n" + text[:limit]) if text else ""


POLISH_PROMPT = """PULIDO VISUAL OBLIGATORIO (última pasada antes de entregar). La app funciona; ahora tiene que VERSE profesional. Abrí la UI que
construiste al lado de design/mockup.html y design/DESIGN.md y corregí, archivo por archivo, hasta que coincidan:
1. Tipografía: la familia elegida en DESIGN.md cargada de verdad (Google Fonts o self-hosted), escala y pesos aplicados; nada en la fuente
   por defecto del navegador. Títulos con jerarquía clara, cuerpo legible (16px+, interlineado 1.5), líneas < 80 caracteres.
2. Tokens: TODO color, espacio, radio y sombra sale de tokens.css. Si encontrás valores sueltos o colores de sistema (azul link, gris
   #ccc, botones default), reemplazalos.
3. Layout: márgenes y espaciado en la escala 4/8; contenedor con ancho máximo centrado; alineación consistente; en móvil (360px) nada
   desborda ni se encima; la navegación y el CTA principal se ven sin scroll.
4. Componentes: botones con estados hover/focus/disabled, inputs con label y foco visible, tarjetas con jerarquía (no todo con el mismo
   borde y la misma sombra), listas y tablas con ritmo vertical; iconos de UNA librería y un solo grosor.
5. Estados: vacío con explicación y acción, cargando con skeleton, error con reintento, todos diseñados (no texto suelto en rojo).
6. Primer impacto: la primera pantalla tiene un elemento memorable (dato protagonista, hero, visual del dominio) y el resto queda sobrio.
   Nada de decoración gratuita, gradientes de relleno ni plantilla genérica.
7. Accesibilidad: contraste AA, foco visible, textos alternativos, tamaños de toque ≥ 44px.
Hacé los cambios ahora mismo en el código (no me describas lo que harías). Al final listá en 5-10 líneas qué cambiaste y qué quedó
pendiente, y dejá la checklist de DESIGN.md marcada en NOTES.md."""


def design_system_prompt(language: str = "español") -> str:
    e = EXPERTISE["product-designer"]
    return DESIGN_SYSTEM.format(craft=e["craft"], standards=e["standards"], language=language) + frontend_design_guide()


def design_context_for_builder(files: dict[str, str]) -> str:
    """What the API builder gets in its first message so it can follow the design without re-reading the tree."""
    md = files.get("design/DESIGN.md", "")
    css = files.get("design/tokens.css", "")
    mock = files.get("design/mockup.html", "")
    if not (md or css):
        return ""
    return (f"\n\n===== design/DESIGN.md =====\n{md[:14000]}\n\n===== design/tokens.css =====\n{css[:6000]}\n\n"
            f"===== design/mockup.html (extracto: estructura y estilos a replicar) =====\n{mock[:12000]}\n")


MOCK_DESIGN = """<say>**Dirección visual: sobria y precisa**, tipo herramienta profesional (referencias: Linear, Stripe). Paleta neutra con un acento verde; tipografía Inter; mucho aire. Diseñé 3 pantallas: inicio, detalle y ajustes.</say>
<file path="design/DESIGN.md">
# Diseño de {title}
## 1. Dirección visual
Sobria, precisa, confiable. Referencias: Linear, Stripe. Web responsive, breakpoints 360/768/1024/1440.
## 2. Sistema
- Paleta: bg #F7F8F7, surface #FFFFFF, border #E3E7E4, text #1B2320 (AA 14.9:1), text-2 #566059, accent #2F6B5D, ok #2E7D5B, warn #B8860B, error #B3382C.
- Tipografía: Inter; display 32/40 600, h1 24/32 600, h2 18/26 600, body 14/22 400, small 12/18 400.
- Espaciado 4/8/12/16/24/32/48; radio 8/12; sombra sm/md.
## 3. Componentes
Botón primario (accent, 36px, radio 8), secundario (borde), inputs 36px con label arriba y error en línea, tarjetas radio 12, tabla con zebra sutil.
## 4. Pantallas
### Inicio — lista de ítems con buscador y CTA "Nuevo"; vacío: ilustración + CTA; cargando: skeleton; error: mensaje + reintentar.
### Detalle — cabecera con título y estado, dos columnas (datos / actividad).
### Ajustes — formulario en una columna de 560px.
## 5. Flujo principal
Inicio → Nuevo → Detalle → guardado con toast.
## 6. Checklist
- tokens.css importado · espaciado en escala · contraste AA · estados vacío/cargando/error · foco visible · responsive 360px
</file>
<file path="design/tokens.css">
:root {{ --color-bg: #F7F8F7; --color-surface: #FFFFFF; --color-border: #E3E7E4; --color-text: #1B2320; --color-text-2: #566059; --color-accent: #2F6B5D; --color-ok: #2E7D5B; --color-warn: #B8860B; --color-error: #B3382C; --font-sans: Inter, system-ui, sans-serif; --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-6: 24px; --space-8: 32px; --radius-md: 8px; --radius-lg: 12px; --shadow-sm: 0 1px 2px rgba(0,0,0,.06); --dur-fast: 150ms; --ease: cubic-bezier(.2,.8,.2,1); }}
</file>
<file path="design/mockup.html">
<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title} · mockup</title>
<style>:root {{ --color-bg: #F7F8F7; --color-surface: #FFFFFF; --color-border: #E3E7E4; --color-text: #1B2320; --color-text-2: #566059; --color-accent: #2F6B5D; --space-4: 16px; --space-6: 24px; --radius-lg: 12px; --font-sans: Inter, system-ui, sans-serif; }}
body {{ margin:0; font-family: var(--font-sans); background: var(--color-bg); color: var(--color-text); }} header {{ display:flex; align-items:center; gap:16px; padding: 12px 24px; background: var(--color-surface); border-bottom:1px solid var(--color-border); }}
main {{ padding: 24px; max-width: 1100px; margin: 0 auto; }} .card {{ background: var(--color-surface); border:1px solid var(--color-border); border-radius: var(--radius-lg); padding: 16px; }} .btn {{ background: var(--color-accent); color:#fff; border:0; border-radius:8px; padding: 8px 14px; font-weight:600; }}
.grid {{ display:grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap:16px; }} .muted {{ color: var(--color-text-2); font-size:13px; }}</style></head>
<body><header><strong>{title}</strong><span class="muted">Inicio · Detalle · Ajustes</span><button class="btn" style="margin-left:auto">Nuevo</button></header>
<main><h1 style="font-size:24px;margin:0 0 16px">Inicio</h1><div class="grid"><div class="card"><strong>Ítem de ejemplo</strong><p class="muted">Estado: activo · actualizado hoy</p></div><div class="card"><strong>Otro ítem</strong><p class="muted">Estado: pendiente</p></div></div>
<div class="card" style="margin-top:24px;text-align:center"><p class="muted">Todavía no hay nada acá. Creá el primero.</p><button class="btn">Nuevo</button></div></main></body></html>
</file>"""
