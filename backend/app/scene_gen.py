"""One animated scene per project, drawn by a model from the project's own brief.

The procedural scenes (scenes.py) pick a motif from keywords, so two weather apps look alike. Here a model reads the
title + brief and writes a small looping SVG (SMIL animations, no scripts, no external references) that depicts THIS
product. It is generated once per session, in the background, cached next to the session file, and served by
/api/sessions/{id}/scene.svg; until it exists (or if no API key / the model fails) the procedural scene is used.
"""
from __future__ import annotations

import json
import logging
import re
import time
import xml.dom.minidom
from pathlib import Path

from . import keystore
from .auth import User, user_dir
from .providers import PROVIDERS, CallResult, Cred, stream
from .tasks import spawn

log = logging.getLogger("arena.scene")

W, H = 400, 260
RETRY_AFTER = 6 * 3600  # a failed generation is retried after this many seconds, not on every page load
_running: set[str] = set()

SYSTEM = """Sos un ilustrador de motion design. Dibujás una miniatura ANIMADA en SVG para la tarjeta de un proyecto de software.
Reglas estrictas:
- Un solo <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice"> … </svg>. Nada fuera de él, sin ```.
- Solo formas vectoriales (rect, circle, ellipse, path, line, polygon, g) y animaciones SMIL (<animate>, <animateTransform>, <animateMotion>) en loop (repeatCount="indefinite"), suaves (2-12 s).
- PROHIBIDO: <script>, <foreignObject>, <image>, <use> con href externo, <style>, eventos on*, URLs, texto largo. Como máximo UNA palabra o número corto en <text> (ej. "23°", "OK").
- Fondo: un rect completo con degradé suave pastel (defs/linearGradient) acorde al tema. Paleta armónica de 4-6 colores pastel + un acento; trazos redondeados; look ilustración plana, elegante, tipo app moderna.
- Representá LITERALMENTE de qué trata el producto: sus objetos, su escena, su acción principal (si es una app de clima para decidir si llevar paraguas: nubes, lluvia que cae, un paraguas abriéndose, el sol asomando; si es un e-commerce de zapatillas: zapatillas, carrito, etiqueta de precio…). Que alguien que vea la miniatura adivine el producto.
- Composición limpia con 3-6 elementos grandes, con al menos 3 animaciones distintas (movimiento, aparición, rotación, pulso).
- Máximo 6000 caracteres."""

USER = """PROYECTO: {title}

QUÉ ES (brief, recorte):
{brief}

Dibujá la miniatura animada de ESTE proyecto. Respondé solo con el SVG."""


def scene_path(user: User, session_id: str) -> Path:
    folder = user_dir(user.id)
    p = folder / f"{session_id}.scene.svg"
    if p.resolve().parent != folder.resolve():
        raise FileNotFoundError(session_id)
    return p


def _fail_path(user: User, session_id: str) -> Path:
    return scene_path(user, session_id).with_suffix(".failed")


def status(user: User, session_id: str) -> dict:
    p = scene_path(user, session_id)
    key = f"{user.id}:{session_id}"
    failed = _fail_path(user, session_id)
    return {
        "ready": p.exists(),
        "pending": key in _running,
        "failed_recently": failed.exists() and (time.time() - failed.stat().st_mtime) < RETRY_AFTER,
    }


_BAD = re.compile(r"<\s*(script|foreignObject|image|style|iframe|object|embed)\b|\son(click|load|error|mouse\w*|key\w*|focus|blur|begin|end|repeat|animation\w*|touch\w*|pointer\w*)\s*=|javascript:|(?:href|src)\s*=\s*[\"']\s*(?!#)|url\(\s*[\"']?\s*https?:", re.I)


def sanitize(svg: str) -> str | None:
    """Keep only a plain vector SVG: one root, no scripts/externals, well-formed XML, right viewBox."""
    m = re.search(r"<svg\b.*?</svg>", svg, re.S | re.I)
    if not m:
        return None
    out = m.group(0)
    if _BAD.search(out):
        return None
    if "xmlns=" not in out[:300]:
        out = out.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    if "viewBox" not in out[:400]:
        out = out.replace("<svg", f'<svg viewBox="0 0 {W} {H}"', 1)
    if "preserveAspectRatio" not in out[:400]:
        out = out.replace("<svg", '<svg preserveAspectRatio="xMidYMid slice"', 1)
    try:
        xml.dom.minidom.parseString(out)
    except Exception:  # noqa: BLE001
        return None
    return out if 200 < len(out) < 40000 else None


def _pick_model(user: User, config: dict) -> tuple[str, str, Cred] | None:
    """A real API key to draw with: a company from the project's own team first, then any configured one."""
    eff = keystore.creds(user.id)
    order = [a.get("provider") for a in config.get("agents", [])] + ["anthropic", "openai", "meta", "gemini", "xai", "deepseek", "openrouter", "mistral", "kimi", "groq"]
    seen: set[str] = set()
    for pid in order:
        if not pid or pid in seen or pid not in PROVIDERS or PROVIDERS[pid].kind == "mock":
            continue
        seen.add(pid)
        c = eff.get(pid)
        if c and c.source != "none":
            return pid, c.model or PROVIDERS[pid].default_model, c
    return None


async def _draw(user: User, config: dict) -> str | None:
    """Ask the model for the scene; None when there is no key or the answer is not a clean SVG."""
    who = _pick_model(user, config)
    if not who:
        return None
    provider, model, cred = who
    title = (config.get("title") or config.get("topic") or "")[:120]
    brief = (config.get("topic") or "")[:3500]
    result = CallResult()
    buf: list[str] = []
    async for kind, delta in stream(provider, model, SYSTEM, USER.format(title=title, brief=brief), temperature=0.8, max_tokens=4000, result=result, cred=cred):
        if kind == "text":
            buf.append(delta)
    return sanitize("".join(buf))


async def _generate_into(key: str, target: Path, failed: Path, user: User, config: dict, own_marker: Path | None = None) -> None:
    try:
        svg = await _draw(user, config)
        if not svg:
            log.warning("scene %s: no key or model output rejected", key)
            failed.write_text(str(time.time()))
            return
        target.write_text(svg)
        if own_marker:
            own_marker.write_text(str(time.time()))
        try:
            failed.unlink()
        except FileNotFoundError:
            pass
    except Exception as e:  # noqa: BLE001
        log.warning("scene %s failed: %s", key, str(e)[:200])
        try:
            failed.write_text(str(time.time()))
        except Exception:  # noqa: BLE001
            pass
    finally:
        _running.discard(key)


async def _generate(user: User, session_id: str, config: dict) -> None:
    await _generate_into(f"{user.id}:{session_id}", scene_path(user, session_id), _fail_path(user, session_id), user, config)


def _norm(t: str) -> str:
    return " ".join((t or "").lower().split())


def session_scene_for_title(user: User, title: str) -> Path | None:
    """A model-drawn scene of one of the user's projects with the same title (the saved experiment reuses it)."""
    want = _norm(title)
    if not want:
        return None
    for p in sorted(user_dir(user.id).glob("*.scene.svg"), reverse=True):
        meta = p.with_name(p.name.replace(".scene.svg", ".json"))
        try:
            cfg = json.loads(meta.read_text()).get("config") or {}
        except Exception:  # noqa: BLE001
            continue
        if _norm(cfg.get("title") or "") == want:
            return p
    return None


def ensure_preset(user: User, preset_id: str, title: str, config: dict, target: Path) -> dict:
    """The saved experiment's card gets the same model-drawn scene as the project: copied from a project with the same
    title when one exists, drawn from the brief otherwise (once, in the background). Until then the procedural scene stays."""
    own = target.with_suffix(".own")
    failed = target.with_suffix(".failed")
    key = f"preset:{preset_id}"
    if own.exists():
        return {"ready": True, "pending": False}
    if key in _running:
        return {"ready": False, "pending": True}
    src = session_scene_for_title(user, title)
    if src:
        target.write_text(src.read_text())
        own.write_text(str(time.time()))
        return {"ready": True, "pending": False}
    if failed.exists() and (time.time() - failed.stat().st_mtime) < RETRY_AFTER:
        return {"ready": False, "pending": False, "failed_recently": True}
    if not _pick_model(user, {**config, "title": title}):
        return {"ready": False, "pending": False, "no_key": True}
    _running.add(key)
    spawn(_generate_into(key, target, failed, user, {**config, "title": title}, own_marker=own))
    return {"ready": False, "pending": True}


def ensure(user: User, session_id: str, config: dict) -> dict:
    """Serve what exists; otherwise start drawing in the background (once) and report pending."""
    st = status(user, session_id)
    if st["ready"] or st["pending"] or st["failed_recently"]:
        return st
    if not _pick_model(user, config):
        return {**st, "no_key": True}  # nothing to draw with: the procedural scene stays (no retry spam)
    key = f"{user.id}:{session_id}"
    _running.add(key)
    spawn(_generate(user, session_id, config))
    return {**st, "pending": True}


def forget(user: User, session_id: str) -> None:
    for p in (scene_path(user, session_id), _fail_path(user, session_id)):
        try:
            p.unlink()
        except FileNotFoundError:
            pass


async def regenerate(user: User, session_id: str, config: dict) -> None:
    forget(user, session_id)
    await _generate(user, session_id, config)

