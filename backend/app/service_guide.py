"""Step-by-step guide to obtain what one external service needs (account, key, URL…), written by a model.

The services panel lists each variable the built app needs. For each service the user can ask "how do I get this":
a model writes a short numbered walkthrough (where to sign up, which menu, what to copy, cost), the last step being
"paste it here". The guide is cached per build and service, in the user's folder, so it is written once.
"""
from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from .auth import User, user_dir
from .providers import PROVIDERS, CallResult, stream
from .scene_gen import _pick_model

log = logging.getLogger("arena.guide")

SYSTEM = {
    "es": """Sos un onboarding engineer. Explicás, paso a paso y sin dar nada por sabido, cómo conseguir lo que una app necesita de un servicio externo (crear cuenta, encontrar la sección correcta, generar la key, copiar el valor). Respondé SOLO con JSON válido con esta forma:
{"intro": "una frase: qué es el servicio y para qué lo usa esta app", "cost": "gratis / plan gratuito hasta X / desde $Y", "steps": [{"title": "título corto", "detail": "qué hacer exactamente, nombrando menús y botones tal como aparecen", "url": "https://… (solo si ese paso abre una página)"}]}
Reglas: entre 3 y 6 pasos. Cada variable que te pasan tiene que quedar explicada: en qué paso aparece su valor y cómo se ve (prefijo, largo). Si una variable no es de un servicio sino un valor propio (un secreto a generar, una URL de la app), decí cómo generarlo. NO incluyas un paso final de "pegalo acá": la app lo agrega sola. Español rioplatense, voseo, concreto.""",
    "en": """You are an onboarding engineer. You explain, step by step and assuming nothing, how to obtain what an app needs from an external service (create the account, find the right section, generate the key, copy the value). Answer ONLY with valid JSON shaped like:
{"intro": "one sentence: what the service is and what this app uses it for", "cost": "free / free tier up to X / from $Y", "steps": [{"title": "short title", "detail": "exactly what to do, naming menus and buttons as they appear", "url": "https://… (only when that step opens a page)"}]}
Rules: 3 to 6 steps. Every variable you are given must be covered: in which step its value appears and what it looks like (prefix, length). If a variable is not from a service but a value of your own (a secret to generate, the app's URL), say how to produce it. Do NOT add a final "paste it here" step: the app adds it. Be concrete.""",
}

USER = """SERVICIO: {service}
PARA QUÉ LO USA LA APP: {purpose}
PÁGINA CONOCIDA: {url}
PROYECTO: {title}
STACK: {stack}

VARIABLES QUE HAY QUE CONSEGUIR:
{vars}
"""


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:60] or "service"


def _cache(user: User, build_id: str) -> Path:
    return user_dir(user.id) / f"{build_id}.guides.json"


def _load(user: User, build_id: str) -> dict:
    try:
        return json.loads(_cache(user, build_id).read_text())
    except Exception:  # noqa: BLE001
        return {}


def fallback(group: dict, lang: str) -> dict:
    """No model key or the model failed: a generic but still useful walkthrough from the catalogue URL."""
    url = group.get("url") or ""
    web = url.startswith("http")
    names = ", ".join(v["var"] for v in group.get("vars", []))
    if lang == "en":
        steps = [
            {"title": "Open the service", "detail": f"Go to {group['service']}'s site and sign in or create an account." + ("" if web else f" Where: {url}" if url else ""), "url": url if web else None},
            {"title": "Find the keys section", "detail": "Look for “API keys”, “Credentials”, “Tokens” or “Settings → API” in the dashboard."},
            {"title": "Create and copy the value", "detail": f"Generate a new key/token, give it a name (for example the project's), and copy it: you need {names}."},
        ]
    else:
        steps = [
            {"title": "Entrá al servicio", "detail": f"Abrí el sitio de {group['service']} e iniciá sesión o creá una cuenta." + ("" if web else f" Dónde: {url}" if url else ""), "url": url if web else None},
            {"title": "Buscá la sección de keys", "detail": "En el panel buscá «API keys», «Credenciales», «Tokens» o «Configuración → API»."},
            {"title": "Generá y copiá el valor", "detail": f"Creá una key/token nueva, ponele un nombre (por ejemplo el del proyecto) y copiala: necesitás {names}."},
        ]
    return {"intro": group.get("purpose") or "", "cost": None, "steps": steps, "generated": False}


async def guide(user: User, build_id: str, group: dict, title: str, stack: list[str], lang: str, refresh: bool = False) -> dict:
    key = _slug(group["service"])
    cached = _load(user, build_id)
    if not refresh and key in cached and cached[key].get("lang") == lang:
        return cached[key]
    who = _pick_model(user, {"agents": []})
    out: dict | None = None
    if who:
        provider, model, cred = who
        vars_txt = "\n".join(f"- {v['var']}" + (f" · {v['note']}" if v.get("note") else "") + (f" · ejemplo: {v['example']}" if v.get("example") else "") for v in group.get("vars", []))
        prompt = USER.format(service=group["service"], purpose=group.get("purpose") or "—", url=group.get("url") or "—", title=title, stack=", ".join(stack) or "—", vars=vars_txt)
        result = CallResult()
        buf: list[str] = []
        try:
            async for kind, delta in stream(provider, model, SYSTEM.get(lang, SYSTEM["es"]), prompt, temperature=0.3, max_tokens=1800, result=result, cred=cred):
                if kind == "text":
                    buf.append(delta)
            raw = "".join(buf)
            m = re.search(r"\{.*\}", raw, re.S)
            data = json.loads(m.group(0)) if m else None
            if data and isinstance(data.get("steps"), list) and data["steps"]:
                steps = [{"title": str(s.get("title") or ""), "detail": str(s.get("detail") or ""), "url": s.get("url") if isinstance(s.get("url"), str) and s["url"].startswith("http") else None} for s in data["steps"][:8]]
                out = {"intro": str(data.get("intro") or ""), "cost": data.get("cost"), "steps": steps, "generated": True, "model": f"{PROVIDERS[provider].label} · {model}"}
        except Exception as e:  # noqa: BLE001
            log.warning("guide %s/%s failed: %s", build_id, key, str(e)[:200])
    if not out:
        out = fallback(group, lang)
    out["lang"] = lang
    cached[key] = out
    try:
        _cache(user, build_id).write_text(json.dumps(cached, ensure_ascii=False))
    except Exception:  # noqa: BLE001
        pass
    return out
