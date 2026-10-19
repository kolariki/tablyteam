"""
Skills: knowledge the user attaches to a role — a Markdown document with instructions, conventions, references or
domain facts ("iOS HIG for our app", "Stripe webhooks checklist", "our brand voice", "INPRES data format"…).

A role carries its skills into every prompt where it speaks: the design debate, the closing round, the pre-production
council, the parallel review/audit, and (for the designer) the design phase. Skills live per user in SQLite and can be
attached before a session starts or mid-session (they apply from the role's next call).
"""
from __future__ import annotations

import sqlite3
import time
import uuid

from .auth import _db

MAX_BODY = 120_000  # chars per skill (a whole role brief / design doc fits)
MAX_PER_ROLE = 60_000  # chars of skills injected into one role's prompt

with _db() as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
            body TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '', created REAL NOT NULL, updated REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS skills_user ON skills (user_id, updated);
        """
    )


# ------------------------------------------------------------------ templates (starting points the user can copy)

TEMPLATES: list[dict] = [
    {"id": "tpl-ios-hig", "name": "iOS Human Interface Guidelines", "tags": "diseño,mobile", "description": "Reglas de diseño para apps iOS: navegación, tipografía dinámica, tamaños de toque, safe areas.",
     "body": "# iOS HIG — lo esencial\n- Navegación: tab bar (3-5 ítems) para secciones; navigation stack con título grande en raíz; modales solo para tareas autocontenidas.\n- Tipografía: Dynamic Type (SF Pro); escala Large Title 34, Title1 28, Title2 22, Headline 17 semibold, Body 17, Subhead 15, Footnote 13, Caption 12.\n- Tamaños de toque ≥ 44×44 pt; espaciado 8/16/20; márgenes laterales 16-20 pt; safe areas respetadas (notch, home indicator).\n- Colores semánticos (label, secondaryLabel, systemBackground, separator) y soporte de modo oscuro desde el día uno.\n- Gestos estándar: swipe back, pull to refresh, swipe en celdas; nunca gestos no descubribles como única vía.\n- Estados: vacío con explicación y acción, carga con skeleton/activity indicator, errores con recuperación.\n- Permisos pedidos en contexto con explicación; nunca en el primer arranque sin motivo.\n- Accesibilidad: VoiceOver labels, contraste 4.5:1, Reduce Motion respetado."},
    {"id": "tpl-material3", "name": "Material Design 3 (Android)", "tags": "diseño,mobile", "description": "Componentes, tokens y patrones de navegación Material 3.",
     "body": "# Material 3 — lo esencial\n- Navigation bar (3-5 destinos), navigation drawer para más, top app bar con acciones; FAB para la acción principal.\n- Tokens: color roles (primary, on-primary, surface, surface-container, outline), type scale (Display/Headline/Title/Body/Label), shape (radios 4/8/12/16/28), elevation con tonal surfaces.\n- Tamaños de toque ≥ 48 dp; grilla 4 dp; márgenes 16 dp.\n- Estados de interacción: state layers (hover/focus/pressed) con opacidades 8/12/16 %.\n- Dynamic color opcional; modo oscuro obligatorio.\n- Componentes: cards, chips, lists, dialogs, snackbars, bottom sheets; nunca inventar un control si existe uno Material."},
    {"id": "tpl-wcag", "name": "Accesibilidad WCAG 2.2 AA", "tags": "diseño,frontend,qa", "description": "Checklist de accesibilidad verificable para web.",
     "body": "# WCAG 2.2 AA — checklist\n- Contraste texto 4.5:1 (3:1 para texto grande y componentes UI).\n- Todo operable con teclado; foco visible (outline ≥ 2 px, contraste 3:1); orden de tabulación lógico; sin trampas de foco.\n- Labels asociados a cada input; mensajes de error vinculados (aria-describedby); instrucciones no solo por color.\n- Imágenes con alt; iconos decorativos aria-hidden; botones con nombre accesible.\n- Estructura semántica: landmarks, un h1 por página, encabezados jerárquicos, listas reales.\n- Tamaño de objetivo ≥ 24×24 CSS px (2.5.8); arrastrar con alternativa (2.5.7).\n- Reduce Motion respetado; nada que parpadee > 3 veces/seg.\n- Zoom 200 % sin pérdida de contenido; reflow a 320 px.\n- Live regions para cambios dinámicos (toasts, validación)."},
    {"id": "tpl-stripe", "name": "Pagos con Stripe (checklist)", "tags": "backend,pagos", "description": "Cómo integrar Stripe sin agujeros: Checkout, webhooks, idempotencia, pruebas.",
     "body": "# Stripe — checklist de integración\n- Usar Checkout Sessions o Payment Element; nunca manejar números de tarjeta.\n- Webhooks: verificar firma (STRIPE_WEBHOOK_SECRET), responder 2xx rápido, procesar idempotente por event.id, reintentos tolerados.\n- Guardar customer_id y subscription_id; fuente de verdad del estado = webhooks (checkout.session.completed, invoice.paid, customer.subscription.updated/deleted).\n- Idempotency-Key en toda creación de PaymentIntent/Subscription.\n- Modo test con tarjetas 4242…; test de webhooks con `stripe listen`.\n- Precios y planes en Stripe (Prices), no hardcodeados; moneda y impuestos (Stripe Tax) decididos.\n- Portal de cliente para cancelar/cambiar plan; emails transaccionales de recibo.\n- Logs sin datos de tarjeta; claves por entorno."},
    {"id": "tpl-nextjs", "name": "Next.js App Router — convenciones", "tags": "frontend,backend", "description": "Estructura, data fetching, server actions, caching y errores en Next 14/15.",
     "body": "# Next.js App Router — convenciones\n- Estructura: app/(grupos)/ruta/page.tsx, layout.tsx, loading.tsx, error.tsx, not-found.tsx; componentes en components/, lógica en lib/.\n- Server Components por defecto; 'use client' solo donde hay estado/efectos/eventos.\n- Data: fetch en servidor con cache/revalidate explícitos; Server Actions para mutaciones con validación (zod) y revalidatePath/Tag.\n- Rutas API en app/api/*/route.ts con Response tipada y códigos HTTP correctos.\n- Env: NEXT_PUBLIC_ solo para lo público; validar env al arranque.\n- Metadata API para SEO; next/image y next/font; Suspense + streaming para listas pesadas.\n- Errores: error boundaries por segmento; nunca pantallas en blanco.\n- Tests: Vitest para lib, Playwright para flujos clave."},
    {"id": "tpl-seo", "name": "SEO técnico y landing que convierte", "tags": "growth,frontend", "description": "Lo mínimo para que una landing posicione y convierta.",
     "body": "# SEO + conversión\n- Un H1 con la promesa; title ≤ 60 caracteres, meta description ≤ 155; Open Graph y Twitter cards; canonical; sitemap.xml y robots.txt.\n- Core Web Vitals: LCP < 2.5 s (imagen hero optimizada, fuentes con display=swap), CLS < 0.1, INP < 200 ms.\n- Estructura de landing: promesa + subtítulo + CTA único above the fold; prueba social; cómo funciona en 3 pasos; objeciones/FAQ; CTA final.\n- Un solo CTA primario repetido; formularios cortos; microcopy de confianza (sin tarjeta, cancelá cuando quieras).\n- Eventos: view_landing, click_cta, signup_start, signup_complete, activation."},
    {"id": "tpl-security", "name": "Seguridad web — OWASP mínimo", "tags": "seguridad,backend", "description": "Controles obligatorios antes de salir a producción.",
     "body": "# OWASP mínimo viable\n- Auth: contraseñas con argon2/bcrypt, sesiones httpOnly+Secure+SameSite, expiración y rotación, rate limit en login, 2FA opcional.\n- Autorización en el servidor por recurso (ownership), no solo por rol; IDs no adivinables.\n- Validación de entrada (zod/pydantic) y salida escapada; consultas parametrizadas; nada de eval/exec.\n- Cabeceras: CSP, HSTS, X-Content-Type-Options, Referrer-Policy; CORS restringido.\n- Secretos en gestor/env; nunca en el repo; dependencias auditadas (npm audit / pip-audit) sin CVEs críticas.\n- Logs sin PII ni tokens; errores genéricos al usuario, detalle en servidor.\n- Backups cifrados y restauración probada; borrado de cuenta/datos disponible."},
]


def extract_text(filename: str, data: bytes) -> str:
    """Plain text from a document the user attaches to a role: Markdown/text/code as is, PDF via pypdf, DOCX from its XML."""
    low = filename.lower()
    if low.endswith(".pdf"):
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    if low.endswith(".docx"):
        import io
        import re as _re
        import zipfile
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            xml = z.read("word/document.xml").decode("utf-8", "ignore")
        xml = _re.sub(r"</w:p>", "\n", xml)
        xml = _re.sub(r"<w:tab/>", "\t", xml)
        return _re.sub(r"<[^>]+>", "", xml).replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1", "ignore")


def _row(r: sqlite3.Row) -> dict:
    return {"id": r["id"], "name": r["name"], "description": r["description"], "tags": r["tags"], "body": r["body"], "created": r["created"], "updated": r["updated"], "chars": len(r["body"])}


def list_skills(user_id: str) -> list[dict]:
    with _db() as c:
        return [_row(r) for r in c.execute("SELECT * FROM skills WHERE user_id=? ORDER BY updated DESC", (user_id,))]


def get_skill(user_id: str, skill_id: str) -> dict | None:
    with _db() as c:
        r = c.execute("SELECT * FROM skills WHERE user_id=? AND id=?", (user_id, skill_id)).fetchone()
    return _row(r) if r else None


def save_skill(user_id: str, name: str, body: str, description: str = "", tags: str = "", skill_id: str | None = None) -> dict:
    name, body = name.strip()[:120], body.strip()[:MAX_BODY]
    if not name or not body:
        raise ValueError("La skill necesita nombre y contenido")
    now = time.time()
    with _db() as c:
        if skill_id and c.execute("SELECT 1 FROM skills WHERE user_id=? AND id=?", (user_id, skill_id)).fetchone():
            c.execute("UPDATE skills SET name=?, description=?, body=?, tags=?, updated=? WHERE user_id=? AND id=?", (name, description.strip()[:300], body, tags.strip()[:200], now, user_id, skill_id))
            sid = skill_id
        else:
            sid = "sk-" + uuid.uuid4().hex[:10]
            c.execute("INSERT INTO skills (id, user_id, name, description, body, tags, created, updated) VALUES (?,?,?,?,?,?,?,?)", (sid, user_id, name, description.strip()[:300], body, tags.strip()[:200], now, now))
    return get_skill(user_id, sid)  # type: ignore[return-value]


def delete_skill(user_id: str, skill_id: str) -> bool:
    with _db() as c:
        return c.execute("DELETE FROM skills WHERE user_id=? AND id=?", (user_id, skill_id)).rowcount > 0


def resolve(user_id: str, ids: list[str] | None) -> list[dict]:
    """Skills by id for a role; templates (tpl-*) resolve without being saved."""
    from . import skills_catalog
    out = []
    for sid in ids or []:
        if sid.startswith("cat-"):
            c = skills_catalog.get(sid)
            b = skills_catalog.body(sid) if c else None
            if c and b:
                out.append({"id": sid, "name": c["name"], "description": c["description"], "body": b, "tags": c["category"]})
        elif sid.startswith("tpl-"):
            t = next((t for t in TEMPLATES if t["id"] == sid), None)
            if t:
                out.append(t)
        else:
            sk = get_skill(user_id, sid)
            if sk:
                out.append(sk)
    return out


def prompt_block(user_id: str, ids: list[str] | None) -> str:
    """The text a role gets in its system prompt for its attached skills (budgeted)."""
    sks = resolve(user_id, ids)
    if not sks:
        return ""
    parts, used = [], 0
    for sk in sks:
        body = sk["body"]
        room = MAX_PER_ROLE - used
        if room <= 200:
            break
        if len(body) > room:
            body = body[:room] + "\n…(recortado)"
        parts.append(f"### Skill: {sk['name']}\n{body}")
        used += len(body)
    return "SKILLS CARGADAS POR EL USUARIO PARA TU ROL (son tu conocimiento de referencia: aplicalas y citalas cuando decidas o revises):\n" + "\n\n".join(parts) + "\n"
