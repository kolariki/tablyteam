"""Team memory: each role of a user's team learns from the user's decisions.

After a council round the user keeps some of the requested changes and drops others. One cheap call turns those decisions into
1-2 general lessons per role (never project details: names, files, URLs or secrets stay out, so a role can later travel to
another user). Lessons arrive as insights the user accepts, edits or dismisses; accepted ones become the role's memory and go
into that role's prompt in every later debate and review. Nothing is applied without the user.
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid

from .auth import _db
from .i18n_data import role_en
from .pricing import cost_usd
from .providers import PROVIDERS, CallResult, Cred, stream
from .roles import ROLE_BY_ID, role_of

log = logging.getLogger("arena.memory")

MAX_PENDING_PER_ROLE = 5
MAX_IN_PROMPT = 12

with _db() as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS role_insights (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, role TEXT NOT NULL, role_label TEXT NOT NULL, text TEXT NOT NULL,
            evidence TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, session_id TEXT NOT NULL DEFAULT '', created REAL NOT NULL, updated REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS role_insights_user ON role_insights (user_id, status, role);
        """
    )


def role_key(role: str | None, name: str | None) -> str:
    """A catalog role is its id (the memory follows the role across projects); a custom one is keyed by its name."""
    if role_of(role):
        return str(role)
    return "custom:" + (re.sub(r"[^a-z0-9]+", "-", (name or "custom").lower()).strip("-") or "custom")


def role_label(key: str, fallback: str = "") -> str:
    r = ROLE_BY_ID.get(key)
    return r["label"] if r else (fallback or key.removeprefix("custom:").replace("-", " ").title())


def _rows(user_id: str, status: str) -> list[dict]:
    with _db() as c:
        return [dict(r) for r in c.execute("SELECT * FROM role_insights WHERE user_id = ? AND status = ? ORDER BY created DESC", (user_id, status))]


def listing(user_id: str) -> dict:
    with_en = lambda r: r | {"role_label_en": role_en(ROLE_BY_ID[r["role"]])["label_en"] if r["role"] in ROLE_BY_ID else r["role_label"]}  # noqa: E731
    return {"insights": [with_en(r) for r in _rows(user_id, "pending")], "memory": [with_en(r) for r in _rows(user_id, "accepted")]}


def decide(user_id: str, iid: str, action: str, text: str | None = None) -> dict | None:
    status = {"accept": "accepted", "dismiss": "dismissed", "forget": "forgotten", "edit": None}.get(action, "")
    if status == "":
        raise ValueError("unknown action")
    with _db() as c:
        row = c.execute("SELECT * FROM role_insights WHERE id = ? AND user_id = ?", (iid, user_id)).fetchone()
        if not row:
            return None
        new_text = (text or "").strip()[:600] or row["text"]
        c.execute("UPDATE role_insights SET status = ?, text = ?, updated = ? WHERE id = ?", (status or row["status"], new_text, time.time(), iid))
        return dict(c.execute("SELECT * FROM role_insights WHERE id = ?", (iid,)).fetchone())


def prompt_block(user_id: str, role: str | None, name: str | None) -> str:
    """The accepted memory of this role, for its system prompt."""
    key = role_key(role, name)
    with _db() as c:
        rows = c.execute("SELECT text FROM role_insights WHERE user_id = ? AND role = ? AND status = 'accepted' ORDER BY updated DESC LIMIT ?", (user_id, key, MAX_IN_PROMPT)).fetchall()
    if not rows:
        return ""
    return ("MEMORIA DE TU ROL CON ESTE USUARIO (lecciones de sus decisiones anteriores, aprobadas por él; aplicalas salvo que este proyecto pida otra cosa):\n"
            + "\n".join(f"- {r['text']}" for r in rows) + "\n")


def _norm(t: str) -> str:
    return re.sub(r"\W+", " ", t.lower()).strip()[:70]


def _save_insights(user_id: str, session_id: str, items: list[dict]) -> int:
    added = 0
    with _db() as c:
        for it in items:
            key, text = it["role"], (it.get("text") or "").strip()[:600]
            if not text:
                continue
            existing = c.execute("SELECT text, status FROM role_insights WHERE user_id = ? AND role = ? AND status IN ('pending', 'accepted', 'dismissed')", (user_id, key)).fetchall()
            if any(_norm(r["text"]) == _norm(text) for r in existing):
                continue
            if sum(1 for r in existing if r["status"] == "pending") >= MAX_PENDING_PER_ROLE:
                continue
            now = time.time()
            c.execute("INSERT INTO role_insights VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
                      (uuid.uuid4().hex[:12], user_id, key, it.get("label") or role_label(key), text, (it.get("evidence") or "").strip()[:400], session_id, now, now))
            added += 1
    return added


# ------------------------------------------------------------------ learning from a council round

LEARN_SYSTEM = """Sos el analista de aprendizaje de TABLY TEAM. Un consejo de roles (CEO, CTO, QA…) revisó un producto y pidió cambios;
el usuario se quedó con algunos y descartó otros. Tu trabajo: sacar LECCIONES por rol sobre cómo trabajar mejor con ESTE usuario.

Reglas:
- Máximo 2 lecciones por rol, y solo si la señal es clara (p. ej. descartó varios pedidos del mismo tipo, o siempre se queda con cierto tipo).
- Cada lección es GENERAL y reutilizable en otros proyectos: nada de nombres del proyecto, archivos, URLs, claves ni datos del cliente.
- Escribila como instrucción al rol, en segunda persona, 1 frase (máx. 220 caracteres). Ej.: "No pidas tests end-to-end como bloqueante en un MVP: el usuario los deja para después."
- "evidence": 1 frase con qué decidió el usuario (podés citar el tipo de pedido, no el proyecto).
- Si no hay señal clara para un rol, no inventes: omitilo. Una lista vacía es válida.
- Idioma de las lecciones: {language}.
Respondé SOLO JSON: {{"insights": [{{"role": "<clave del rol tal como viene>", "lesson": "...", "evidence": "..."}}]}}"""


def _match_role(piece: str, agents: list[dict]) -> dict | None:
    p = piece.strip().lower()
    if not p or re.match(r"(nivel|level)\s*\d|usuario|user$", p):
        return None
    for a in agents:
        names = {a["label"].lower(), a["label_en"].lower(), (a.get("name") or "").lower()}
        if p in names or any(n and (p in n or n in p) for n in names if len(n) > 2):
            return a
    return None


def collect(config: dict, verdict_changes: list[dict], chosen: list[dict]) -> dict[str, dict]:
    """Per role key: what it asked, split into kept / dropped by the user."""
    agents = []
    for a in config.get("agents") or []:
        r = role_of(a.get("role"))
        agents.append(a | {"key": role_key(a.get("role"), a.get("name")), "label": r["label"] if r else (a.get("name") or ""),
                           "label_en": role_en(r)["label_en"] if r else (a.get("name") or "")})
    kept = {_norm(re.sub(r"^\[[^\]]*\]\s*", "", c.get("text") or "")) for c in chosen} | {_norm(c.get("text") or "") for c in chosen}
    out: dict[str, dict] = {}
    from .orchestrator import parse_changes

    for c in verdict_changes:
        if (c.get("role") or "").lower() in ("blocking", "blocker", "improvement", "critical"):  # saved before the English tags parsed
            c = (parse_changes(f"- [{c['role']}] {c.get('text') or ''}") or [c])[0]
        text = (c.get("text") or "").strip()
        if not text:
            continue
        seen: set[str] = set()
        for piece in re.split(r"[,/;]| y | and ", c.get("role") or ""):
            a = _match_role(piece, agents)
            if not a or a["key"] in seen:
                continue
            seen.add(a["key"])
            slot = out.setdefault(a["key"], {"label": a["label"], "kept": [], "dropped": []})
            (slot["kept"] if _norm(text) in kept else slot["dropped"]).append(f"[{c.get('severity', 'mejora')}] {text[:260]}")
    return out


def _heuristic(per_role: dict[str, dict], en: bool) -> list[dict]:
    """Without a model: the plain signal (the role asks for things the user drops). The lesson stays general; the example
    only goes in the evidence, which the user sees and the prompt never gets."""
    items = []
    for key, d in per_role.items():
        n, total = len(d["dropped"]), len(d["dropped"]) + len(d["kept"])
        if not n or n * 2 < total:
            continue
        ex = d["dropped"][0].split("] ", 1)[-1][:110]
        items.append({"role": key, "label": d["label"],
                      "text": ("The user drops most of your requests: raise as blocking only what breaks the product, and keep the rest as short improvements." if en
                               else "El usuario descarta la mayoría de tus pedidos: pedí como bloqueante solo lo que rompe el producto y dejá lo demás como mejoras cortas."),
                      "evidence": (f"Dropped {n} of {total} requests from this role, e.g. «{ex}»." if en
                                   else f"Descartó {n} de {total} pedidos de este rol, p. ej. «{ex}».")})
    return items


async def learn_from_council(user_id: str, session: dict, chosen: list[dict], provider: str, model: str, cred: Cred | None) -> int:
    """Turns one applied council round into pending insights. Returns how many were added."""
    config = session.get("config") or {}
    verdict = next((e for e in reversed(session.get("events") or []) if e.get("type") == "council.verdict"), None)
    if not verdict:
        return 0
    per_role = collect(config, verdict.get("changes") or [], chosen)
    per_role = {k: v for k, v in per_role.items() if v["kept"] or v["dropped"]}
    if not per_role:
        return 0
    language = config.get("language") or "español rioplatense"
    en = language.lower().startswith("english")
    items: list[dict] = []
    if PROVIDERS.get(provider) and PROVIDERS[provider].kind != "mock" and cred and cred.source != "none":
        prio = ((config.get("review_of") or {}).get("priorities") or "").strip()
        body = "\n\n".join(f"ROL {k} ({v['label']}):\nSE QUEDÓ CON:\n" + ("\n".join(f"- {x}" for x in v["kept"]) or "- (nada)")
                           + "\nDESCARTÓ:\n" + ("\n".join(f"- {x}" for x in v["dropped"]) or "- (nada)") for k, v in per_role.items())
        user = (f"PRIORIDADES QUE DIO EL USUARIO PARA LA RONDA:\n{prio[:1500]}\n\n" if prio else "") + body + "\n\nRespondé solo el JSON."
        try:
            result, chunks = CallResult(), []
            async for _k, delta in stream(provider, model, LEARN_SYSTEM.format(language=language), user, temperature=0.2, max_tokens=6000, result=result, cred=cred):
                chunks.append(delta)
            log.info("memory: learned for %s (%.4f USD)", user_id, cost_usd(model, result.input_tokens, result.output_tokens))
            m = re.search(r"\{.*\}", "".join(chunks), re.S)
            data = json.loads(m.group(0)) if m else {}
            for it in data.get("insights") or []:
                key = str(it.get("role") or "")
                if key in per_role and str(it.get("lesson") or "").strip():
                    items.append({"role": key, "label": per_role[key]["label"], "text": str(it["lesson"]), "evidence": str(it.get("evidence") or "")})
        except Exception as e:
            log.warning("memory: learning call failed, using the plain signal: %s", e)
            items = _heuristic(per_role, en)
    else:
        items = _heuristic(per_role, en)
    return _save_insights(user_id, session.get("id") or "", items)
