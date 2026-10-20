"""Reference research: before designing, the team looks at public apps that solve the same problem.

Level 1 ("Investigar apps de referencia"): a headless Chrome visits each reference URL, takes a desktop and a mobile
screenshot and dumps the DOM; a vision-capable model describes what it sees (screens, flows, patterns, copy, what to
emulate, what to avoid) and the notes are merged into research/REFERENCES.md, which the designer and the builder read.
Nothing is decompiled or copied: it is the same observation a product team does by using a competitor's app.

Level 2 ("Análisis profundo e ingeniería inversa"): paid per use; it hands the builder engine the REA MCP tools
(https://github.com/morluto/rea) so it can inspect JS bundles, routes, API calls and app structure of the targets the
user supplies. Only available when REA is installed on this machine.
"""
from __future__ import annotations

import asyncio
import html
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path

from .config import env

log = logging.getLogger("arena.research")

CHROME_CANDIDATES = [
    env("ARENA_CHROME", ""),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
]
MAX_REFERENCES = 6
SHOT_TIMEOUT = 45
DEEP_ANALYSIS_FEE_USD = float(env("DEEP_ANALYSIS_FEE_USD", "9"))


def chrome_path() -> str | None:
    for c in CHROME_CANDIDATES:
        if not c:
            continue
        if os.path.isabs(c) and os.path.exists(c):
            return c
        w = shutil.which(c)
        if w:
            return w
    return None


def rea_binary() -> Path | None:
    """The `rea` CLI: on PATH, or in an nvm Node install (REA needs Node 22.19+/24.11+; the backend's own Node may be older)."""
    cands: list[Path] = []
    if env("ARENA_REA", ""):
        cands.append(Path(env("ARENA_REA", "")))
    w = shutil.which("rea")
    if w:
        cands.append(Path(w))
    cands += sorted((Path.home() / ".nvm" / "versions" / "node").glob("v2[2-9]*/bin/rea"), reverse=True)
    cands += sorted((Path.home() / ".nvm" / "versions" / "node").glob("v[3-9]*/bin/rea"), reverse=True)
    for c in cands:
        if c.exists():
            return c
    return None


def rea_mcp_config() -> dict | None:
    """MCP registration for the builder engine: run REA with the Node that sits next to it, whatever PATH the backend has."""
    rea = rea_binary()
    if not rea:
        return None
    node = rea.parent / "node"
    command, args = (str(node), [str(rea), "mcp"]) if node.exists() else (str(rea), ["mcp"])
    return {"mcpServers": {"rea": {"command": command, "args": args}}, "path_dir": str(rea.parent)}


def rea_available() -> dict:
    """Is the REA MCP usable by the local engine? Installed (`rea`) and/or registered for Claude Code."""
    rea = rea_binary()
    registered = False
    try:
        cfg = json.loads((Path.home() / ".claude.json").read_text())
        registered = "rea" in {k.lower() for k in (cfg.get("mcpServers") or {})}
    except Exception:  # noqa: BLE001
        pass
    return {"ok": bool(rea), "cli": str(rea) if rea else None, "registered": registered, "fee_usd": DEEP_ANALYSIS_FEE_USD}


def status() -> dict:
    return {"chrome": chrome_path(), "rea": rea_available(), "deep_fee_usd": DEEP_ANALYSIS_FEE_USD, "max_references": MAX_REFERENCES}


_URL_RE = re.compile(r"https?://[^\s<>\"')\]]+", re.I)


def normalize_reference(ref: str) -> str | None:
    """'apple.com/weather' → 'https://apple.com/weather'; names without a dot are not URLs (the model proposes those)."""
    r = (ref or "").strip().strip("<>\"'")
    if not r:
        return None
    if _URL_RE.match(r):
        return r
    if "." in r and " " not in r:
        return "https://" + r.lstrip("/")
    return None


@dataclass
class Capture:
    url: str
    ok: bool = False
    error: str = ""
    desktop: bytes = b""
    mobile: bytes = b""
    title: str = ""
    text: str = ""
    headings: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    buttons: list[str] = field(default_factory=list)
    inputs: list[str] = field(default_factory=list)


def _run(cmd: list[str], timeout: int) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout
    except subprocess.TimeoutExpired:
        return 124, ""


def _dom_summary(cap: Capture, dom: str) -> None:
    def strip(t: str) -> str:
        return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t))).strip()

    m = re.search(r"<title[^>]*>(.*?)</title>", dom, re.S | re.I)
    cap.title = strip(m.group(1))[:160] if m else ""
    cap.headings = [strip(h)[:120] for h in re.findall(r"<h[1-3][^>]*>(.*?)</h[1-3]>", dom, re.S | re.I) if strip(h)][:40]
    cap.links = [strip(a)[:60] for a in re.findall(r"<a[^>]*>(.*?)</a>", dom, re.S | re.I) if 1 < len(strip(a)) < 60][:80]
    cap.buttons = [strip(b)[:60] for b in re.findall(r"<button[^>]*>(.*?)</button>", dom, re.S | re.I) if strip(b)][:40]
    cap.inputs = [strip(l)[:60] for l in re.findall(r"(?:placeholder|aria-label)=\"([^\"]{2,80})\"", dom, re.I)][:30]
    body = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", dom, flags=re.S | re.I)
    cap.text = strip(body)[:6000]


def capture(url: str) -> Capture:
    """Desktop + mobile screenshots and a DOM summary with headless Chrome (no extension, no profile, no login)."""
    cap = Capture(url=url)
    chrome = chrome_path()
    if not chrome:
        cap.error = "No se encontró Chrome/Chromium para sacar capturas (instalá Google Chrome o definí ARENA_CHROME)."
        return cap
    with tempfile.TemporaryDirectory(prefix="arena-ref-") as tmp:
        # software WebGL (SwiftShader) instead of --disable-gpu: map/canvas apps such as Windy refuse to render without
        # WebGL and show an error banner, which is all the vision model would see. A real desktop UA and no automation
        # flag keep bot walls quieter; a longer virtual-time budget lets heavy front-ends finish their first paint.
        base = [chrome, "--headless=new", "--no-sandbox", "--hide-scrollbars", "--no-first-run", "--disable-extensions",
                "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl",
                "--disable-blink-features=AutomationControlled",
                "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                f"--user-data-dir={tmp}/profile", "--virtual-time-budget=15000", "--timeout=30000", "--lang=es"]
        d = Path(tmp) / "desktop.png"
        m = Path(tmp) / "mobile.png"
        code, _ = _run(base + ["--window-size=1440,1100", f"--screenshot={d}", url], SHOT_TIMEOUT)
        if d.exists():
            cap.desktop = d.read_bytes()
        _run(base + ["--window-size=430,932", "--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", f"--screenshot={m}", url], SHOT_TIMEOUT)
        if m.exists():
            cap.mobile = m.read_bytes()
        _, dom = _run(base + ["--window-size=1440,1100", "--dump-dom", url], SHOT_TIMEOUT)
        if dom:
            _dom_summary(cap, dom)
        cap.ok = bool(cap.desktop or cap.text)
        if not cap.ok:
            cap.error = f"Chrome no pudo abrir {url} (código {code})."
    return cap


async def capture_async(url: str) -> Capture:
    return await asyncio.to_thread(capture, url)


# ------------------------------------------------------------------------------------------------------------ prompts

PROPOSE_SYSTEM = """Sos un analista de producto. Dado el brief de un producto, proponé las apps o sitios públicos de referencia que un equipo
serio miraría antes de diseñar: los líderes de la categoría y 1-2 alternativas con un enfoque distinto. Solo productos reales con una
URL pública que se pueda abrir sin cuenta (home o landing del producto). Respondé SOLO con JSON: una lista de objetos {"name", "url", "why"}."""

ANALYZE_SYSTEM = """Sos un Product Designer senior haciendo benchmark de un producto de referencia para un equipo que va a construir algo parecido.
Mirás capturas (desktop y móvil) y un resumen del DOM. NO copiás nada: observás y explicás. Describí con precisión y en español:
1. Qué es y para quién (una frase).
2. Pantallas y flujo principal: qué ve el usuario primero, qué acción manda, cómo llega al valor.
3. Patrones de interfaz que funcionan (navegación, jerarquía, cards, estados vacíos, onboarding, microcopy, densidad, color, tipografía).
4. Decisiones de producto notables (qué resuelven muy bien, qué dejan afuera).
5. Qué EMULAR en nuestro producto y qué EVITAR (y por qué).
Sé concreto y visual (nombrá componentes, posiciones, textos reales). Máximo 500 palabras. Markdown con esos 5 títulos."""

SYNTH_SYSTEM = """Sos el Product Designer del equipo. Con las notas de benchmark de varias apps de referencia, escribí research/REFERENCES.md:
un brief de referentes para el diseñador y el constructor. Secciones (Markdown):
# Referentes
Tabla: app · qué hace mejor · qué le falta.
# Patrones a emular (con el referente de donde sale cada uno)
# Patrones a evitar
# Flujo recomendado para nuestro producto (paso a paso, pantalla por pantalla, inspirado en lo observado pero ajustado a NUESTRO brief)
# Copy y tono
# Checklist de calidad "nivel referente" (10 ítems verificables)
Concreto, accionable, sin relleno. Máximo 900 palabras."""


def build_user_prompt_for_analysis(cap: Capture, brief_head: str) -> str:
    parts = [f"REFERENTE: {cap.url}", f"Título de la página: {cap.title or '(sin título)'}"]
    if cap.headings:
        parts.append("Encabezados: " + " | ".join(cap.headings[:25]))
    if cap.links:
        parts.append("Navegación / links: " + " | ".join(dict.fromkeys(cap.links))[:1200])
    if cap.buttons:
        parts.append("Botones: " + " | ".join(dict.fromkeys(cap.buttons))[:600])
    if cap.inputs:
        parts.append("Campos: " + " | ".join(dict.fromkeys(cap.inputs))[:400])
    if cap.text:
        parts.append("Texto visible (recorte): " + cap.text[:2500])
    parts.append("\nNUESTRO PRODUCTO (resumen del brief, para saber qué mirar):\n" + brief_head[:2500])
    parts.append("\nAdjunto: captura desktop" + (" y captura móvil." if cap.mobile else "."))
    return "\n".join(parts)


def parse_proposals(text: str) -> list[dict]:
    m = re.search(r"\[.*\]", text, re.S)
    if not m:
        return []
    try:
        items = json.loads(m.group(0))
    except Exception:  # noqa: BLE001
        return []
    out = []
    for it in items if isinstance(items, list) else []:
        if not isinstance(it, dict):
            continue
        url = normalize_reference(str(it.get("url") or ""))
        if url:
            out.append({"name": str(it.get("name") or url)[:60], "url": url, "why": str(it.get("why") or "")[:200]})
    return out[:MAX_REFERENCES]


def shots_dir(workdir: Path | None) -> Path | None:
    if not workdir:
        return None
    d = workdir / "research" / "shots"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_shots(workdir: Path | None, i: int, cap: Capture) -> list[str]:
    d = shots_dir(workdir)
    if not d:
        return []
    out = []
    for kind, data in (("desktop", cap.desktop), ("mobile", cap.mobile)):
        if data:
            p = d / f"{i:02d}-{kind}.png"
            p.write_bytes(data)
            out.append(f"research/shots/{p.name}")
    return out


def stamp() -> str:
    return time.strftime("%Y-%m-%d %H:%M")
