"""HTTP + WebSocket API.

REST
    POST /api/auth/register|login|logout, GET /api/auth/me   (Bearer token)
    GET  /api/health
    GET  /api/providers                 which vendors have keys, default model, brand color
    GET  /api/providers/{id}/models     live model list from the vendor
    GET  /api/presets?fallback=true     experiments; unconfigured providers swapped for "mock"
    POST /api/sessions                  start a run → {id}
    POST /api/sessions/{id}/stop
    GET  /api/sessions                  live + saved runs
    GET  /api/sessions/{id}             full event log (for replay)
    GET  /api/sessions/{id}/transcript.md   debate as Markdown
    POST /api/sessions/{id}/brief       streamed build brief + prompt for the builder agent
WS
    /ws/sessions/{id}?token=...         backlog + live events, closes when the run ends
All session endpoints are scoped to the signed-in user.
"""
from __future__ import annotations

import asyncio
from pathlib import Path
import copy
import json
import time
import hashlib
import logging
import re

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, Response, StreamingResponse
from pydantic import BaseModel

from . import auth, keystore
from . import observability as obs
from .tasks import spawn
from . import research
from . import scene_gen
from .auth import CurrentUser, Credentials, User
from . import builder as buildermod
from .builder import BUILDS, Build, BuildRequest, list_builds, load_build, rehydrate, start_build
from .local_engine import ENGINES, engine_status, is_engine, snapshot_dir
from . import deploy as deploymod
from . import service_guide
from . import billing
from . import research_jobs
from . import providers as provmod
from . import runner as runmod
from . import skills as skillmod
from . import cloud as cloudmod
from . import gitserver
from . import agent_sessions
from . import skills_catalog as catalog
from .i18n_data import GROUPS_EN, preset_en, role_en, template_en
from . import fde as fdemod
from . import scenes as scenemod
from . import intake as intakemod
from .user_presets import create_preset, delete_preset, list_presets, scene_path
from .exporter import TARGETS, BriefRequest, session_path, stream_brief, transcript_markdown
from .config import CORS_ORIGINS, env
from .orchestrator import SESSIONS, start_session
from .presets import PRESETS
from .roles import ROLE_GROUPS, ROLES
from .providers import PROVIDERS, Cred, available_models, list_models
from .schemas import SessionConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("arena.api")

app = FastAPI(title="Tably Team", version="1.0.0", docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

MAX_CONCURRENT_JOBS = int(env("ARENA_MAX_JOBS_PER_USER", "3"))
_auth_hits: dict[str, list[float]] = {}


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
        resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        resp.headers.setdefault("Cache-Control", "no-store")
        return resp


app.add_middleware(SecurityHeaders)


def _rate_limit(request: Request, bucket: str, limit: int = 10, window: float = 60) -> None:
    """Simple per-IP limiter for auth endpoints (brute-force protection)."""
    import time as _t

    key = f"{bucket}:{request.client.host if request.client else 'x'}"
    now = _t.time()
    hits = [t for t in _auth_hits.get(key, []) if now - t < window]
    if len(hits) >= limit:
        raise HTTPException(429, "Demasiados intentos; esperá un minuto")
    hits.append(now)
    _auth_hits[key] = hits


def _active_jobs(user_id: str) -> int:
    running = sum(1 for s in SESSIONS.values() if s.owner.id == user_id and s.status in ("running", "paused"))
    running += sum(1 for b in BUILDS.values() if b.user.id == user_id and b.status in ("running", "reviewing"))
    return running


def _check_capacity(user_id: str) -> None:
    if _active_jobs(user_id) >= MAX_CONCURRENT_JOBS:
        raise HTTPException(429, f"Ya tenés {MAX_CONCURRENT_JOBS} trabajos en curso; esperá a que terminen")


@app.get("/api/health")
def health():
    return {"ok": True, "langfuse": obs.ENABLED, "langfuse_host": (env("LANGFUSE_BASE_URL") or env("LANGFUSE_HOST")) if obs.ENABLED else None, "stripe": billing.status()}


@app.post("/api/auth/register")
def register(cred: Credentials, request: Request):
    _rate_limit(request, "register", limit=5)
    token, user, dev_code = auth.register(cred)
    if token:
        return {"token": token, "user": user}
    return {"pending": True, "email": user.email, "user": user, **({"dev_code": dev_code} if dev_code else {})}


class VerifyBody(BaseModel):
    email: str
    code: str = ""


@app.post("/api/auth/verify")
def verify_email(body: VerifyBody, request: Request):
    _rate_limit(request, "verify", limit=20)
    token, user = auth.verify(body.email, body.code)
    return {"token": token, "user": user}


@app.post("/api/auth/resend")
def resend_code(body: VerifyBody, request: Request):
    """A new code for an unverified account (after login said email_unverified, or the first one never arrived)."""
    _rate_limit(request, "resend", limit=6)
    dev_code = auth.send_code(body.email.strip().lower())
    return {"ok": True, **({"dev_code": dev_code} if dev_code else {})}


@app.post("/api/auth/login")
def login(cred: Credentials, request: Request):
    _rate_limit(request, "login", limit=10)
    token, user = auth.login(cred)
    return {"token": token, "user": user}


@app.post("/api/auth/logout")
def logout(request: Request):
    if token := auth.bearer(request):
        auth.logout(token)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: User = CurrentUser):
    return {"user": user}


@app.get("/api/auth/config")
def auth_config():
    return {"allow_signup": auth.ALLOW_SIGNUP}


@app.get("/api/providers")
def providers(user: User = CurrentUser):
    eff = keystore.creds(user.id)
    return [
        {"id": p.id, "label": p.label, "color": p.color, "configured": eff[p.id].source != "none", "default_model": eff[p.id].model, "source": eff[p.id].source}
        for p in PROVIDERS.values()
    ]


@app.get("/api/providers/{provider_id}/models")
async def provider_models(provider_id: str, user: User = CurrentUser):
    if provider_id not in PROVIDERS:
        raise HTTPException(404, "unknown provider")
    try:
        return {"models": await list_models(provider_id, keystore.creds(user.id)[provider_id])}
    except Exception as e:
        return {"models": [], "error": str(e)[:300]}


# ---------------------------------------------------------------------------- settings (per user)
class ProviderSettings(BaseModel):
    api_key: str | None = None
    clear_key: bool = False
    default_model: str | None = None
    base_url: str | None = None


class KeyTest(BaseModel):
    api_key: str | None = None
    base_url: str | None = None


@app.get("/api/settings/providers")
def settings_providers(user: User = CurrentUser):
    return {"providers": keystore.public_settings(user.id), "share_server_keys": keystore.SHARE_SERVER_KEYS}


@app.put("/api/settings/providers/{provider_id}")
def settings_save(provider_id: str, body: ProviderSettings, user: User = CurrentUser):
    if provider_id not in PROVIDERS or PROVIDERS[provider_id].kind == "mock":
        raise HTTPException(404, "unknown provider")
    keystore.save(user.id, provider_id, api_key=body.api_key, clear_key=body.clear_key, default_model=body.default_model, base_url=body.base_url)
    return next(p for p in keystore.public_settings(user.id) if p["id"] == provider_id)


@app.post("/api/settings/providers/{provider_id}/test")
async def settings_test(provider_id: str, body: KeyTest, user: User = CurrentUser):
    """Checks a key (the typed one, or the saved/effective one) by listing the provider's models."""
    if provider_id not in PROVIDERS:
        raise HTTPException(404, "unknown provider")
    eff = keystore.creds(user.id)[provider_id]
    cred = Cred(body.api_key.strip(), body.base_url or eff.base_url, eff.model, "test") if body.api_key else Cred(eff.api_key, body.base_url or eff.base_url, eff.model, eff.source)
    if not cred.api_key and provider_id != "ollama":
        return {"ok": False, "error": "No hay key para probar"}
    try:
        models = await asyncio.wait_for(list_models(provider_id, cred), timeout=20)
        return {"ok": True, "models": models}
    except Exception as e:
        msg = str(e)
        if "401" in msg or "invalid" in msg.lower() or "auth" in msg.lower():
            msg = "La key fue rechazada por el proveedor (401). Revisá que esté completa y activa."
        return {"ok": False, "error": msg[:300]}


@app.get("/api/roles")
def roles():
    return {"groups": ROLE_GROUPS, "groups_en": [GROUPS_EN.get(g, g) for g in ROLE_GROUPS], "roles": [role_en(r) for r in ROLES]}


@app.get("/api/presets")
async def presets(fallback: bool = True, user: User = CurrentUser):
    """Built-in experiments + the user's saved ones (each with its animated scene)."""
    eff = keystore.creds(user.id)
    out = []
    for preset in copy.deepcopy(PRESETS) + list_presets(user.id):
        for a in preset["agents"]:
            pid = a["provider"]
            if pid not in PROVIDERS:
                pid = a["provider"] = "mock"
            if fallback and eff[pid].source == "none":
                a["wanted_provider"] = pid
                pid = a["provider"] = "mock"
            a.setdefault("model", eff[pid].model)
        preset.setdefault("scene_url", f"/scenes/{preset['id']}.svg")
        if preset.get("custom"):
            # the saved experiment wears the same model-drawn scene as its project (drawn once if there is none yet)
            sp = scene_path(preset["id"])
            scene_gen.ensure_preset(user, preset["id"], preset.get("title") or "", preset, sp)
            preset["scene_url"] = f"/api/scenes/{preset['id']}.svg?v={int(sp.stat().st_mtime) if sp.exists() else 0}"
        out.append(preset_en(preset))
    return out


@app.post("/api/presets")
def preset_save(body: dict, user: User = CurrentUser):
    """Save the current setup as an experiment card; its looping scene is generated from the title/topic right away."""
    try:
        cfg = SessionConfig(**{k: v for k, v in body.items() if k in SessionConfig.model_fields})
    except Exception as e:
        raise HTTPException(400, f"configuración inválida: {str(e)[:200]}")
    title = (body.get("title") or cfg.title or cfg.topic or "").strip()[:80]
    if not title:
        raise HTTPException(400, "el experimento necesita un título")
    return create_preset(user.id, title, cfg.model_dump(), str(body.get("emoji") or "✨"), body.get("motif"))


@app.delete("/api/presets/{preset_id}")
def preset_delete(preset_id: str, user: User = CurrentUser):
    if not delete_preset(user.id, preset_id):
        raise HTTPException(404)
    return {"ok": True}


# ------------------------------------------------------------------ intake: idea + attachments → prompt-engineered brief

class IntakeRun(BaseModel):
    text: str
    provider: str = "mock"
    model: str = "mock-1"
    extra: str = ""  # "add this too" after a prompt was generated


class IntakeAnswers(BaseModel):
    answers: dict[str, str]


class IntakePath(BaseModel):
    path: str


def _intake(user: User, intake_id: str) -> intakemod.Intake:
    it = intakemod.get(user, intake_id)
    if not it:
        raise HTTPException(404, "intake not found")
    return it


@app.post("/api/intake")
async def intake_create(user: User = CurrentUser):
    return intakemod.create(user).snapshot()


@app.get("/api/intake/{intake_id}")
async def intake_get(intake_id: str, user: User = CurrentUser):
    return _intake(user, intake_id).snapshot()


@app.post("/api/intake/{intake_id}/files")
async def intake_files(intake_id: str, files: list[UploadFile] = File(...), paths: str = Form("[]"), user: User = CurrentUser):
    """Attach documents / a folder (the browser sends each file with its relative path in `paths`) / a .zip."""
    it = _intake(user, intake_id)
    rels = json.loads(paths or "[]")
    added = []
    for i, f in enumerate(files):
        data = await f.read()
        if len(data) > 60_000_000:
            raise HTTPException(413, f"{f.filename}: supera 60 MB")
        name = rels[i] if i < len(rels) and rels[i] else (f.filename or f"archivo-{i}")
        try:
            added += it.add_upload(name, data)
        except (ValueError, zipfile.BadZipFile) as e:
            raise HTTPException(400, str(e))
    return {"added": len(added), **it.snapshot()}


@app.post("/api/intake/{intake_id}/path")
async def intake_path(intake_id: str, body: IntakePath, user: User = CurrentUser):
    """Attach a folder or file that lives on this machine (the backend runs locally)."""
    it = _intake(user, intake_id)
    try:
        added = it.add_path(body.path)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"added": len(added), **it.snapshot()}


class IntakePick(BaseModel):
    kind: str = "folder"  # folder | files


@app.post("/api/intake/{intake_id}/pick")
async def intake_pick(intake_id: str, body: IntakePick, user: User = CurrentUser):
    """Open the native Finder chooser on this Mac (the backend runs locally) and attach what the user picks."""
    import platform
    import subprocess

    it = _intake(user, intake_id)
    if platform.system() != "Darwin":
        raise HTTPException(400, "El selector nativo solo está disponible en macOS; usá «carpeta» o «documentos»")
    script = ('set xs to choose file with prompt "Elegí documentos para el proyecto" with multiple selections allowed\n'
              'set out to ""\nrepeat with x in xs\nset out to out & POSIX path of x & linefeed\nend repeat\nreturn out'
              if body.kind == "files" else
              'set xs to choose folder with prompt "Elegí una carpeta o proyecto" with multiple selections allowed\n'
              'set out to ""\nrepeat with x in xs\nset out to out & POSIX path of x & linefeed\nend repeat\nreturn out')
    try:
        loop = asyncio.get_running_loop()
        r = await loop.run_in_executor(None, lambda: subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=600))
    except subprocess.TimeoutExpired:
        raise HTTPException(408, "Se cerró el selector por tiempo")
    if r.returncode != 0:
        if "-128" in r.stderr:  # user cancelled
            return {"added": 0, "cancelled": True, **it.snapshot()}
        raise HTTPException(500, f"No se pudo abrir el Finder: {r.stderr.strip()[:200]}")
    added = 0
    errors = []
    for path in [p for p in r.stdout.splitlines() if p.strip()]:
        try:
            added += len(it.add_path(path.strip()))
        except ValueError as e:
            errors.append(f"{path}: {e}")
    if not added and errors:
        raise HTTPException(400, "; ".join(errors)[:300])
    return {"added": added, "cancelled": False, "errors": errors, **it.snapshot()}


@app.delete("/api/intake/{intake_id}/files/{att_id}")
async def intake_remove(intake_id: str, att_id: str, user: User = CurrentUser):
    it = _intake(user, intake_id)
    it.remove(att_id)
    return it.snapshot()


class RolePromptsBody(BaseModel):
    agents: list[dict]  # [{id, name, role, label, mandate, persona}]
    provider: str = "mock"
    model: str = "mock-1"


@app.post("/api/intake/{intake_id}/role-prompts")
async def intake_role_prompts(intake_id: str, body: RolePromptsBody, user: User = CurrentUser):
    """Tailored personality prompt per role, from the generated brief. The user applies them (they replace the current ones)."""
    it = _intake(user, intake_id)
    if body.provider not in PROVIDERS:
        raise HTTPException(400, "Proveedor desconocido")
    eff = keystore.creds(user.id)
    if PROVIDERS[body.provider].kind != "mock" and body.provider not in eff:
        raise HTTPException(400, f"{PROVIDERS[body.provider].label}: sin API key")
    try:
        prompts = await it.role_prompts(body.agents[:8], body.provider, body.model, eff.get(body.provider))
    except (ValueError, json.JSONDecodeError) as e:
        raise HTTPException(400, str(e))
    return {"prompts": prompts, "cost_usd": round(it.cost_usd, 4)}


@app.post("/api/intake/{intake_id}/run")
async def intake_run(intake_id: str, body: IntakeRun, user: User = CurrentUser):
    it = _intake(user, intake_id)
    if not body.text.strip():
        raise HTTPException(400, "Escribí qué querés construir")
    if body.provider not in PROVIDERS:
        raise HTTPException(400, "Proveedor desconocido")
    eff = keystore.creds(user.id)
    if PROVIDERS[body.provider].kind != "mock" and body.provider not in eff:
        raise HTTPException(400, f"{PROVIDERS[body.provider].label}: sin API key")
    try:
        it.start(body.text, body.provider, body.model, eff.get(body.provider), extra=body.extra)
    except ValueError as e:
        raise HTTPException(409, str(e))
    return it.snapshot()


@app.post("/api/intake/{intake_id}/answer")
async def intake_answer(intake_id: str, body: IntakeAnswers, user: User = CurrentUser):
    it = _intake(user, intake_id)
    try:
        it.answer(body.answers)
    except ValueError as e:
        raise HTTPException(409, str(e))
    return it.snapshot()


@app.post("/api/intake/{intake_id}/cancel")
async def intake_cancel(intake_id: str, user: User = CurrentUser):
    it = _intake(user, intake_id)
    it.cancel()
    return it.snapshot()


@app.websocket("/ws/intake/{intake_id}")
async def ws_intake(ws: WebSocket, intake_id: str):
    await ws.accept()
    user = auth.user_from_token(ws.query_params.get("token"))
    it = intakemod.get(user, intake_id) if user else None
    if not it:
        await ws.send_json({"type": "error", "error": "intake not found"})
        await ws.close()
        return
    q = it.subscribe()
    try:
        await ws.send_json({"type": "snapshot", **it.snapshot()})
        while True:
            ev = await q.get()
            await ws.send_json(ev)
    except WebSocketDisconnect:
        pass
    finally:
        it.unsubscribe(q)


def _session_config(user: User, session_id: str) -> dict:
    live = SESSIONS.get(session_id)
    if live and live.owner.id == user.id:
        return live.config.model_dump()
    return _saved(user, session_id).get("config") or {}


@app.get("/api/sessions/{session_id}/scene.svg")
def session_scene(session_id: str, token: str = ""):
    """The project's own animated scene (drawn by a model from its brief) or, until it exists, the procedural one.
    <img> tags cannot send headers, so the token travels as a query param (same as the WebSockets)."""
    user = auth.user_from_token(token)
    if not user:
        raise HTTPException(401)
    try:
        p = scene_gen.scene_path(user, session_id)
    except FileNotFoundError:
        raise HTTPException(404)
    if p.exists():
        return FileResponse(p, media_type="image/svg+xml", headers={"Cache-Control": "private, max-age=86400"})
    cfg = _session_config(user, session_id)
    svg = scenemod.generate(cfg.get("title") or (cfg.get("topic") or "")[:80], (cfg.get("topic") or "")[:400])
    return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})


@app.get("/api/sessions/{session_id}/scene/status")
async def session_scene_status(session_id: str, user: User = CurrentUser):
    """Is the project's own scene ready? If not (and there is an API key), drawing starts in the background."""
    cfg = _session_config(user, session_id)
    return scene_gen.ensure(user, session_id, cfg)


@app.post("/api/sessions/{session_id}/scene/regenerate")
async def session_scene_regenerate(session_id: str, user: User = CurrentUser):
    cfg = _session_config(user, session_id)
    await scene_gen.regenerate(user, session_id, cfg)
    return scene_gen.status(user, session_id)


@app.get("/api/scenes/topic.svg")
def topic_scene(t: str = ""):
    """Animated mini scene for any title/topic (project rows): generated from the query text only, no stored data."""
    svg = scenemod.generate(t[:200])
    return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/scenes/{preset_id}.svg")
def preset_scene(preset_id: str):
    """Animated background of a saved experiment (ids are unguessable; the scene holds no personal data)."""
    p = scene_path(preset_id)
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, media_type="image/svg+xml", headers={"Cache-Control": "public, max-age=86400"})


@app.post("/api/sessions")
async def create_session(config: SessionConfig, user: User = CurrentUser):
    ids = [a.id for a in config.agents]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "agent ids must be unique")
    eff = keystore.creds(user.id)
    if config.auto_skills:
        from .orchestrator import auto_pick_skills
        await asyncio.to_thread(auto_pick_skills, config)
    for a in config.agents:
        spec = PROVIDERS.get(a.provider)
        if not spec:
            raise HTTPException(400, f"unknown provider {a.provider}")
        if eff[a.provider].source == "none":
            raise HTTPException(400, f"{spec.label}: falta la API key. Cargala en Configuración.")
    # preflight: every model must exist for this account, otherwise the agent would fail on every turn
    problems = []
    for a in config.agents:
        if PROVIDERS[a.provider].kind == "mock":
            continue
        models = await available_models(a.provider, eff[a.provider])
        if models and a.model not in models:
            problems.append(f"{a.name}: el modelo «{a.model}» no está disponible en tu cuenta de {PROVIDERS[a.provider].label}. Elegí otro del desplegable.")
    if problems:
        raise HTTPException(400, " · ".join(problems))
    _check_capacity(user.id)
    s = start_session(config, user, eff, auto_pick=False)
    return {"id": s.id}


@app.post("/api/sessions/{session_id}/council/redo")
async def council_redo(session_id: str, user: User = CurrentUser):
    """Re-runs only the chairman over a finished council (cheap): rebuilds the change list from the saved debate + role verdicts."""
    from .orchestrator import Session

    data = _saved(user, session_id)
    cfg = SessionConfig(**data["config"])
    if cfg.mode != "review":
        raise HTTPException(400, "Esta sesión no es un consejo de revisión")
    s = SESSIONS.get(session_id)
    if s and s.status == "running":
        raise HTTPException(409, "El consejo todavía está debatiendo")
    if not s:
        s = Session(cfg, user, keystore.creds(user.id))
        s.id, s.events, s.status = session_id, data["events"], data["status"]
        s.transcript = [{k: e.get(k) for k in ("turn", "phase", "agent_id", "message", "stance", "confidence", "thinking", "next", "reason", "metrics", "responding_to")} for e in data["events"] if e["type"] == "turn.completed"]
        SESSIONS[session_id] = s
    ro = cfg.review_of or {}
    if ro.get("build_id"):
        try:
            _build(user, ro["build_id"], ro.get("session_id"))  # so the version gets re-scored
        except HTTPException:
            pass
    await s._council()
    s._save()
    return s.verdict.get("council") or {}


@app.post("/api/sessions/{session_id}/resume")
def session_resume(session_id: str, body: dict, user: User = CurrentUser):
    """After a provider outage pause: retry (optionally after switching the role's model)."""
    s = SESSIONS.get(session_id)
    if not s or s.owner.id != user.id:
        raise HTTPException(404)
    s.resume(body.get("action") or "retry")
    return {"ok": True}


@app.patch("/api/sessions/{session_id}/agents/{agent_id}")
async def session_update_agent(session_id: str, agent_id: str, body: dict, user: User = CurrentUser):
    """Switch a role to another provider/model during the run (promote or demote). Applies from its next call."""
    s = SESSIONS.get(session_id)
    if not s or s.owner.id != user.id:
        raise HTTPException(404)
    if agent_id not in s.agents:
        raise HTTPException(404, "agente no encontrado")
    provider, model = body.get("provider") or "", (body.get("model") or "").strip()
    if provider not in PROVIDERS or not model:
        raise HTTPException(400, "proveedor o modelo inválido")
    eff = keystore.creds(user.id)
    if eff[provider].source == "none":
        raise HTTPException(400, f"{PROVIDERS[provider].label}: falta la API key. Cargala en Configuración.")
    if PROVIDERS[provider].kind != "mock":
        models = await available_models(provider, eff[provider])
        if models and model not in models:
            raise HTTPException(400, f"El modelo «{model}» no está disponible en tu cuenta de {PROVIDERS[provider].label}.")
    s.update_agent(agent_id, provider, model, eff[provider])
    if s.pause and s.pause["agent_id"] == agent_id:
        s.resume("switched")
    return {"ok": True, "agent": {"id": agent_id, "provider": provider, "model": model}}


@app.post("/api/sessions/estimate")
def estimate(config: SessionConfig, _: User = CurrentUser):
    from .orchestrator import estimate_cost

    return estimate_cost(config)


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, user: User = CurrentUser):
    """Deletes a session with its exports, builds and secrets. Running jobs are stopped first."""
    import shutil

    s = SESSIONS.get(session_id)
    if s and s.owner.id == user.id:
        s.stop()
        SESSIONS.pop(session_id, None)
    for b in [b for b in BUILDS.values() if b.user.id == user.id and b.req.session_id == session_id]:
        b.stop()
        BUILDS.pop(b.id, None)
        if b.workdir and b.workdir.exists():
            shutil.rmtree(b.workdir, ignore_errors=True)
    folder = auth.user_dir(user.id)
    removed = 0
    for p in folder.glob(f"{session_id}*"):
        if p.resolve().parent == folder.resolve():
            p.unlink()
            removed += 1
    if not removed:
        raise HTTPException(404)
    return {"ok": True, "removed": removed}


@app.patch("/api/sessions/{session_id}")
def rename_session(session_id: str, body: dict, user: User = CurrentUser):
    title = (body.get("title") or "").strip()[:120]
    if not title:
        raise HTTPException(400, "título vacío")
    s = SESSIONS.get(session_id)
    if s and s.owner.id == user.id:
        s.config.title = title
    path = session_path(user, session_id)
    if not path.exists():
        raise HTTPException(404)
    data = json.loads(path.read_text())
    data["config"]["title"] = title
    path.write_text(json.dumps(data, ensure_ascii=False))
    return {"ok": True}


def _api_build_cost(builds: list[dict]) -> float:
    """Spend that actually hits an API key: builds run by a local engine (Claude Code / Codex by subscription) are not
    billed per token, so their list-price equivalent is shown on the build but never added to the spend."""
    return sum((float(b.get("cost_usd") or 0) if not is_engine(b.get("provider") or "") else 0.0) + float(b.get("fees_usd") or 0) for b in builds)


@app.get("/api/dashboard")
def dashboard(user: User = CurrentUser):
    """Everything the user owns, with status and spend, for the home dashboard."""
    all_sessions = list_sessions(user)
    # council rounds live inside their project row, not as projects of their own
    councils: dict[str, list[dict]] = {}
    sessions = []
    for s in all_sessions:
        ro = s.get("review_of") if s.get("mode") == "review" else None
        if ro and ro.get("session_id"):
            councils.setdefault(ro["session_id"], []).append({"id": s["id"], "round": ro.get("round"), "version": ro.get("version"), "build_id": ro.get("build_id"), "status": s["status"], "cost_usd": s.get("cost_usd", 0), "created": s["created"], "live": s.get("live", False)})
        else:
            sessions.append(s)
    builds_by_session: dict[str, list[dict]] = {}
    total_cost = 0.0
    for s in sessions:
        bl = session_builds(s["id"], user)
        builds_by_session[s["id"]] = bl
        s["councils"] = sorted(councils.get(s["id"], []), key=lambda c: c["created"])
        s["council_cost_usd"] = round(sum(float(c.get("cost_usd") or 0) for c in s["councils"]), 4)
        total_cost += float(s.get("cost_usd") or 0) + s["council_cost_usd"] + _api_build_cost(bl)
    import time as _t

    month = _t.strftime("%Y-%m")
    month_cost = sum(
        float(s.get("cost_usd") or 0) + float(s.get("council_cost_usd") or 0) + _api_build_cost(builds_by_session[s["id"]])
        for s in sessions if _t.strftime("%Y-%m", _t.localtime(s["created"])) == month
    )
    eff = keystore.creds(user.id)
    return {
        "sessions": [s | {"builds": builds_by_session[s["id"]]} for s in sessions],
        "spend": {"total_usd": round(total_cost, 3), "month_usd": round(month_cost, 3), "month": month},
        "active_jobs": _active_jobs(user.id), "max_jobs": MAX_CONCURRENT_JOBS,
        "setup": {
            "api_keys": sum(1 for c in eff.values() if c.source == "user"),
            "engines": [e for e in engine_status(user.id) if e["ok"]],
            "langfuse": obs.ENABLED, "sessions": len(all_sessions),
        },
    }


@app.post("/api/sessions/{session_id}/stop")
def stop_session(session_id: str, user: User = CurrentUser):
    s = SESSIONS.get(session_id)
    if not s or s.owner.id != user.id:
        raise HTTPException(404)
    s.stop()
    return {"ok": True}


@app.get("/api/sessions")
def list_sessions(user: User = CurrentUser):
    items = {sid: s.summary() for sid, s in SESSIONS.items() if s.owner.id == user.id}
    for path in sorted(auth.user_dir(user.id).glob("*.json"), reverse=True)[:200]:
        if path.stem in items:
            continue
        try:
            data = json.loads(path.read_text())
            cfg = data["config"]
            done = next((e for e in reversed(data["events"]) if e["type"] == "session.completed"), {})
            items[path.stem] = {
                "id": data["id"], "status": data["status"], "topic": cfg["topic"], "title": cfg.get("title"), "mode": cfg["mode"], "review_of": cfg.get("review_of"),
                "agents": [{"name": a["name"], "provider": a["provider"], "model": a["model"]} for a in cfg["agents"]],
                "created": data["events"][0]["ts"] if data["events"] else path.stat().st_mtime, "live": False,
                "cost_usd": (done.get("stats") or {}).get("total_cost_usd", 0), "turns": (done.get("stats") or {}).get("turns", 0),
                "has_brief": any(path.parent.glob(f"{path.stem}.brief.*.md")),
            }
        except Exception:
            continue
    return sorted(items.values(), key=lambda x: x["created"], reverse=True)


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, user: User = CurrentUser):
    s = SESSIONS.get(session_id)
    if s and s.owner.id == user.id:
        return {"id": s.id, "status": s.status, "config": s.config.model_dump(), "events": s.events}
    folder = auth.user_dir(user.id)
    path = folder / f"{session_id}.json"
    if not path.exists() or path.resolve().parent != folder.resolve():
        raise HTTPException(404)
    return json.loads(path.read_text())


class TeamBody(BaseModel):
    agents: list[dict]


@app.put("/api/sessions/{session_id}/team")
def update_team(session_id: str, body: TeamBody, user: User = CurrentUser):
    """Edit a saved project's team (roles, models, personas, skills). Applies to the saved config and to the project's
    builds, so the next council round / build / review uses it. Not allowed while the debate itself is running."""
    from .roles import ROLES as _ROLES
    from .schemas import AgentConfig

    live = SESSIONS.get(session_id)
    if live and live.owner.id == user.id and live.status in ("running", "paused"):
        raise HTTPException(409, "El debate está corriendo: cambiá modelos desde el panel Equipo o esperá a que termine.")
    try:
        agents = [AgentConfig(**{k: v for k, v in a.items() if k in AgentConfig.model_fields}) for a in body.agents]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Equipo inválido: {e}")
    if not 2 <= len(agents) <= 8:
        raise HTTPException(400, "El equipo tiene que tener entre 2 y 8 roles")
    ids = [a.id for a in agents]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "Los ids de agentes deben ser únicos")
    valid_roles = {r["id"] for r in _ROLES}
    for a in agents:
        if a.provider not in PROVIDERS:
            raise HTTPException(400, f"Proveedor desconocido: {a.provider}")
        if a.role and a.role not in valid_roles:
            a.role = None
    dumped = [a.model_dump() for a in agents]
    path = session_path(user, session_id)
    if not path.exists():
        raise HTTPException(404)
    d = json.loads(path.read_text())
    d.setdefault("config", {})["agents"] = dumped
    path.write_text(json.dumps(d, ensure_ascii=False))
    if live and live.owner.id == user.id:
        live.config.agents = agents
    for b in BUILDS.values():
        if b.user.id == user.id and b.req.session_id == session_id:
            b.team = [dict(a) for a in dumped if a.get("role")]
            b.emit("build.team", team=b.snapshot()["team"])
            b._save()
    return {"agents": dumped}


def _saved(user: User, session_id: str) -> dict:
    try:
        path = session_path(user, session_id)
    except FileNotFoundError:
        raise HTTPException(404)
    if not path.exists():
        raise HTTPException(409 if session_id in SESSIONS else 404, "La sesión todavía no terminó")
    return json.loads(path.read_text())


@app.get("/api/export/targets")
def export_targets():
    return [{"id": k, "label": v["label"]} for k, v in TARGETS.items()]


@app.get("/api/sessions/{session_id}/transcript.md")
def session_transcript(session_id: str, user: User = CurrentUser):
    return PlainTextResponse(transcript_markdown(_saved(user, session_id)), media_type="text/markdown; charset=utf-8")


@app.post("/api/sessions/{session_id}/brief")
async def session_brief(session_id: str, req: BriefRequest, user: User = CurrentUser):
    """Streams a build brief (Markdown) written by the chosen model; cached per target."""
    _saved(user, session_id)
    cred = keystore.creds(user.id).get(req.provider)
    if req.provider not in PROVIDERS or not cred or cred.source == "none":
        raise HTTPException(400, f"Proveedor sin configurar: {req.provider}")
    return StreamingResponse(stream_brief(user, session_id, req), media_type="text/markdown; charset=utf-8")


@app.post("/api/direct-builds")
async def create_direct_build(body: dict, user: User = CurrentUser):
    """The fast lane: one (prompt-engineered) request → brief written by a model → builder, no council. Returns the session
    and the build; the build runs in the background like any other."""
    import time as _t

    from .auth import user_dir
    from .exporter import BriefRequest, stream_brief

    topic = (body.get("topic") or "").strip()
    if not topic:
        raise HTTPException(400, "Contá qué querés construir")
    title = (body.get("title") or "").strip() or topic[:60]
    provider, model, target = body.get("provider") or "mock", body.get("model") or "", body.get("target") or "claude-code"
    if target not in TARGETS:
        target = "claude-code"
    refs = [r.strip() for r in body.get("references", []) if isinstance(r, str) and r.strip()] if isinstance(body.get("references"), list) else []
    # who writes the brief: the builder's own API model, else the first configured API provider, else mock
    eff = keystore.creds(user.id)
    bp, bm = (provider, model) if (not is_engine(provider) and eff.get(provider) and eff[provider].source != "none") else (None, None)
    if not bp:
        for pid in ("anthropic", "meta", "openai", "gemini", "deepseek", "xai", "groq", "mistral", "openrouter", "kimi", "ollama"):
            c = eff.get(pid)
            if c and c.source != "none":
                bp, bm = pid, c.model or PROVIDERS[pid].default_model
                break
    if not bp:
        bp, bm = "mock", "mock-1"
    sid = _t.strftime("%Y%m%d-%H%M%S-") + __import__("uuid").uuid4().hex[:6]
    agents = [a for a in (body.get("agents") or []) if isinstance(a, dict) and a.get("role")]
    config = {"topic": topic, "title": title, "mode": "direct", "agents": agents, "max_turns": 0, "min_turns": 0, "language": body.get("language") or "español rioplatense",
              "final_vote": False, "closing_round": False, "max_tokens": 0, "pace_ms": 0, "platform": body.get("platform") or "web", "references": refs,
              "deep_analysis": bool(body.get("deep_analysis")), "context": body.get("context") or None}
    (user_dir(user.id) / f"{sid}.json").write_text(json.dumps({"id": sid, "owner": user.id, "status": "direct", "config": config, "events": [
        {"type": "session.started", "seq": 0, "ts": _t.time(), "session_id": sid, "config": config, "providers": {}, "langfuse_url": None},
        {"type": "session.completed", "seq": 1, "ts": _t.time(), "status": "direct", "stats": {"agents": {}, "turns": 0, "total_cost_usd": 0, "total_tokens": 0, "disagreement_rate": 0, "verdict": None}},
    ]}, ensure_ascii=False))
    # the brief, written now (it is what the builder follows); cached next to the session like any brief
    parts: list[str] = []
    try:
        async for chunk in stream_brief(user, sid, BriefRequest(provider=bp, model=bm, target=target, include_transcript=False, regenerate=True)):
            parts.append(chunk)
    except ValueError as e:
        raise HTTPException(400, str(e))
    brief = "".join(parts)
    if is_engine(provider):
        st = next(e for e in engine_status(user.id) if e["id"] == provider)
        if not st["ok"]:
            raise HTTPException(400, f"{st['label']}: {st['hint'] or 'no disponible'}")
        cred = Cred("local", None, model or "default", "local")
    else:
        cred = eff.get(provider)
        if not cred or cred.source == "none":
            raise HTTPException(400, f"Falta la API key de {provider}")
    req = BuildRequest(session_id=sid, provider=provider, model=model or (cred.model or ""), target=target, review_rounds=0, council=True, design=bool(body.get("design", True)),
                       design_review=False, research=bool(refs), references=refs, deep_analysis=bool(body.get("deep_analysis")), platform=config["platform"])
    b = start_build(user, req, cred, brief, title, agents, eff)
    b.chat.insert(0, {"role": "system", "text": "Vía rápida: brief escrito desde tu pedido (sin consejo) y construcción directa.", "ts": _t.time()})
    return {"session_id": sid, "id": b.id, "brief_by": f"{bp} · {bm}"}


# ---------------------------------------------------------------------------- in-app builder
def _brief_for(user: User, session_id: str, target: str) -> str:
    path = session_path(user, session_id).with_suffix(f".brief.{target}.md")
    if not path.exists():
        raise HTTPException(409, "Primero generá el brief de construcción para esta sesión.")
    return path.read_text()


@app.post("/api/research/jobs")
async def research_job_start(body: dict, user: User = CurrentUser):
    """Benchmark the reference apps before a debate; poll the job for the reverse-engineering screen."""
    refs = [r.strip() for r in body.get("references", []) if isinstance(r, str) and r.strip()] if isinstance(body.get("references"), list) else []
    if not refs:
        raise HTTPException(400, "Sin referencias")
    return research_jobs.start(user, refs, str(body.get("brief") or ""), bool(body.get("deep_analysis")))


@app.get("/api/research/jobs/{jid}")
def research_job_get(jid: str, user: User = CurrentUser):
    j = research_jobs.get(user, jid)
    if not j:
        raise HTTPException(404)
    return j


@app.get("/api/research/status")
def research_status(_: User = CurrentUser):
    """Reference research (level 1: headless Chrome + vision model) and deep analysis (level 2: REA, paid per use) availability."""
    return research.status()


@app.get("/api/engines")
def engines(user: User = CurrentUser):
    """Local CLI agents (Claude Code / Codex) usable as builder + review council without API billing."""
    return engine_status(user.id)


@app.put("/api/settings/claude-token")
def settings_claude_token(body: dict, user: User = CurrentUser):
    """The user's own Claude Code subscription token (`claude setup-token` on their computer): with it, builds and the
    sessions chat run on this server as them, PC off or not."""
    tok = (body.get("token") or "").strip()
    if body.get("clear"):
        keystore.save(user.id, "claude-code", clear_key=True)
    elif tok:
        if not tok.startswith("sk-ant-oat"):
            raise HTTPException(400, "Ese no parece un token de `claude setup-token` (empieza con sk-ant-oat…).")
        keystore.save(user.id, "claude-code", api_key=tok)
    return {"status": keystore.key_status(user.id, "claude-code"), "engines": engine_status(user.id)}


@app.post("/api/builds")
async def create_build(req: BuildRequest, user: User = CurrentUser):
    data = _saved(user, req.session_id)
    if is_engine(req.provider):
        st = next(e for e in engine_status(user.id) if e["id"] == req.provider)
        if not st["ok"]:
            raise HTTPException(400, f"{st['label']}: {st['hint'] or 'no disponible'}")
        cred = Cred("local", None, req.model, "local")
    else:
        cred = keystore.creds(user.id).get(req.provider)
        if req.provider not in PROVIDERS or not cred or cred.source == "none":
            raise HTTPException(400, f"Proveedor sin configurar: {req.provider}")
    if not is_engine(req.provider) and PROVIDERS[req.provider].kind != "mock":
        models = await available_models(req.provider, cred)
        if models and req.model not in models:
            raise HTTPException(400, f"El modelo «{req.model}» no está disponible en tu cuenta de {PROVIDERS[req.provider].label}.")
    _check_capacity(user.id)
    if req.deep_analysis:
        if not is_engine(req.provider):
            raise HTTPException(400, "El análisis profundo (REA) corre con un motor local (Claude Code / Codex) como constructor.")
        if not research.rea_available()["ok"]:
            raise HTTPException(400, "REA no está instalado en esta máquina: corré `npx rea-agents setup` y reiniciá el motor.")
    if not req.references:
        req.references = [r for r in (data["config"].get("references") or []) if isinstance(r, str) and r.strip()]
    brief = _brief_for(user, req.session_id, req.target)
    title = data["config"].get("title") or data["config"]["topic"][:60]
    if req.platform == "web":  # the request rarely says it: the session config decides (web / mobile / both)
        req.platform = data["config"].get("platform") or "web"
    b = start_build(user, req, cred, brief, title, data["config"].get("agents", []), keystore.creds(user.id))
    return {"id": b.id}


# ---------------------------------------------------------------------------- project audit (upload → team review → report → improvements)
AUDIT_SKIP = {"node_modules", ".git", ".next", "dist", "dist-lhci", "dist-preview", "build", "out", ".venv", "venv", "__pycache__", ".pytest_cache", ".turbo", ".cache", ".wrangler", "coverage", "test-results", "playwright-report", ".lighthouseci", ".perf", "tmp", ".idea", ".vscode", "target", ".expo", "vendor"}
AUDIT_MAX_FILES, AUDIT_MAX_TOTAL, AUDIT_MAX_FILE = 2500, 25_000_000, 400_000


def _extract_zip(data: bytes) -> dict[str, str]:
    import io
    import re as _re
    import zipfile

    out: dict[str, str] = {}
    total = 0
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [n for n in z.namelist() if not n.endswith("/")]
        # strip a single common top-level folder (what `zip -r folder` produces)
        roots = {n.split("/")[0] for n in names}
        strip = (next(iter(roots)) + "/") if len(roots) == 1 and all("/" in n for n in names) else ""
        for n in names:
            rel = n[len(strip):] if n.startswith(strip) else n
            parts = rel.split("/")
            if not rel or rel.startswith("__MACOSX") or any(p in AUDIT_SKIP or p.startswith(".DS_Store") for p in parts) or ".." in parts:
                continue
            info = z.getinfo(n)
            if info.file_size > AUDIT_MAX_FILE or _re.search(r"\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|otf|mp[34]|mov|bin|lock|map)$", rel, _re.I):
                continue
            try:
                txt = z.read(n).decode("utf-8")
            except UnicodeDecodeError:
                continue
            total += len(txt)
            if total > AUDIT_MAX_TOTAL or len(out) >= AUDIT_MAX_FILES:
                break
            out[rel] = txt
    return out


@app.post("/api/audits")
async def create_audit(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    team: str = Form("[]"),
    provider: str = Form("mock"),
    model: str = Form("mock-1"),
    auto_skills: str = Form("false"),
    user: User = CurrentUser,
):
    """Upload a project (.zip) and have the team audit it. Creates a lightweight session + an audit build."""
    import time as _t

    from .auth import user_dir

    data = await file.read()
    if len(data) > 120_000_000:
        raise HTTPException(413, "El zip supera 120 MB")
    try:
        files = _extract_zip(data)
    except Exception:
        raise HTTPException(400, "No pude leer el .zip")
    if not files:
        raise HTTPException(400, "El zip no contiene archivos de texto/código legibles")
    try:
        agents = json.loads(team)
    except json.JSONDecodeError:
        raise HTTPException(400, "team inválido")
    agents = [a for a in agents if a.get("role")]
    if len(agents) < 1:
        raise HTTPException(400, "Elegí al menos un rol auditor")
    if is_engine(provider):
        st = next(e for e in engine_status(user.id) if e["id"] == provider)
        if not st["ok"]:
            raise HTTPException(400, f"{st['label']}: {st['hint'] or 'no disponible'}")
        cred = Cred("local", None, model, "local")
    else:
        cred = keystore.creds(user.id).get(provider)
        if provider not in PROVIDERS or not cred or cred.source == "none":
            raise HTTPException(400, f"Proveedor sin configurar: {provider}")
    for a in agents:  # reviewers by API need a configured provider; otherwise they fall back to the audit model
        if not is_engine(provider) and keystore.creds(user.id).get(a.get("provider", ""), Cred(None)).source == "none":
            a["provider"], a["model"] = provider, model
    title = name.strip()[:80] or "Proyecto"
    if auto_skills.lower() in ("1", "true", "yes"):
        # the team picks catalog skills for each auditor from the project description and its role (added, never replaced)
        from .roles import ROLES as _ROLES
        groups = {"Dirección": "ceo", "Producto": "product", "Ingeniería": "backend", "Diseño": "design", "Datos e IA": "data", "Negocio": "growth", "Calidad y seguridad": "qa"}
        for a in agents:
            role = next((r for r in _ROLES if r["id"] == a.get("role")), None)
            text = f"{title}\n{description}\n{role['mandate'] if role else ''}"
            sug = [x["id"] for x in catalog.suggest(text, k=2, role_group=groups.get(role["group"]) if role else None) if x.get("score", 0) >= 15]
            a["skills"] = list(dict.fromkeys([*(a.get("skills") or []), *sug]))[:12]
    # a session record so the audit lives next to normal sessions (history, builds folder, exports)
    sid = _t.strftime("%Y%m%d-%H%M%S-") + __import__("uuid").uuid4().hex[:6]
    config = {"topic": f"Auditoría de «{title}»: {description.strip()[:500]}", "title": f"Auditoría · {title}", "mode": "audit", "agents": agents,
              "max_turns": 0, "min_turns": 0, "language": "español", "final_vote": False, "closing_round": False, "max_tokens": 0, "pace_ms": 0}
    (user_dir(user.id) / f"{sid}.json").write_text(json.dumps({"id": sid, "owner": user.id, "status": "audit", "config": config, "events": [
        {"type": "session.started", "seq": 0, "ts": _t.time(), "session_id": sid, "config": config, "providers": {}, "langfuse_url": None},
        {"type": "session.completed", "seq": 1, "ts": _t.time(), "status": "audit", "stats": {"agents": {}, "turns": 0, "total_cost_usd": 0, "total_tokens": 0, "disagreement_rate": 0, "verdict": None}},
    ]}, ensure_ascii=False))
    tree = "\n".join(f"- {p} ({c.count(chr(10)) + 1} líneas)" for p, c in sorted(files.items()))
    brief = f"# Auditoría de {title}\n\n{description.strip() or '(sin descripción)'}\n\n## Árbol del proyecto ({len(files)} archivos)\n{tree}\n"
    b = Build(user, BuildRequest(session_id=sid, provider=provider, model=model), cred, brief, title, agents, keystore.creds(user.id))
    b.context = description.strip()
    b.files = files
    if b.workdir:  # local engine: materialise the project on disk so the CLI can read it
        for rel, content in files.items():
            dest = b.workdir / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(content)
    b.status = "completed"
    b.chat.append({"role": "system", "text": f"Proyecto «{title}» cargado: {len(files)} archivos. El equipo empieza la auditoría.", "ts": _t.time()})
    BUILDS[b.id] = b
    # the audit is a council round in the arena (live debate → verdict → change list → «construir con estos cambios»);
    # the silent parallel review stays as fallback when no role can speak via API
    b.review_plan = {"max_rounds": 6}
    council = b.start_council(priorities=description.strip()[:2000], focus="production", audit=True)
    if not council:
        b.start_audit()
    else:
        b._save()
    return {"id": b.id, "session_id": sid, "files": len(files), "council": council}


@app.post("/api/builds/{build_id}/apply")
async def build_apply(build_id: str, body: dict, user: User = CurrentUser):
    """After an audit: apply the selected proposals with the builder, then the council reviews until approved."""
    b = _build(user, build_id, body.get("session_id"))
    reqs = [r for r in (body.get("requests") or []) if isinstance(r, dict) and (r.get("text") or "").strip()]
    if not reqs:
        raise HTTPException(400, "No hay propuestas seleccionadas")
    b.apply_improvements(reqs, int(body.get("max_rounds") or 2))
    return {"ok": True}


@app.get("/api/sessions/{session_id}/builds/{build_id}/report.md")
def build_report(session_id: str, build_id: str, user: User = CurrentUser):
    b = BUILDS.get(build_id)
    report = b.audit_report if (b and b.user.id == user.id) else (load_build(user, session_id, build_id) or {}).get("audit_report")
    if not report:
        raise HTTPException(404, "Esta construcción no tiene informe de auditoría")
    return PlainTextResponse(report, media_type="text/markdown; charset=utf-8")


# ---------------------------------------------------------------------------- external services + deploy
def _build_any(user: User, session_id: str, build_id: str):
    """Live build or rehydrated saved one (needed for deploy/services on finished builds)."""
    return _build(user, build_id, session_id)


@app.get("/api/sessions/{session_id}/builds/{build_id}/services")
def build_services(session_id: str, build_id: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    saved = set(deploymod.load_secrets(user.id, build_id))
    data = deploymod.services_for(b.files, b.brief, saved)
    data["deploy_targets"] = deploymod.deploy_status(user.id)
    data["deploys"] = b.deploys
    return data


@app.get("/api/sessions/{session_id}/builds/{build_id}/services/guide")
async def build_service_guide(session_id: str, build_id: str, service: str, lang: str = "es", refresh: bool = False, user: User = CurrentUser):
    """How to obtain what one service needs: a model-written walkthrough (cached), or a generic one without keys."""
    b = _build_any(user, session_id, build_id)
    data = deploymod.services_for(b.files, b.brief, set(deploymod.load_secrets(user.id, build_id)))
    group = next((g for g in data["groups"] if g["service"] == service), None)
    if not group:
        raise HTTPException(404, "service not found")
    return await service_guide.guide(user, build_id, group, b.title, data.get("stack") or [], "en" if lang == "en" else "es", refresh=refresh)


@app.put("/api/sessions/{session_id}/builds/{build_id}/services")
def build_services_save(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    _build_any(user, session_id, build_id)
    values = {k: v for k, v in (body.get("values") or {}).items() if isinstance(k, str)}
    deploymod.save_secrets(user.id, build_id, {k: (str(v) if v is not None else "") for k, v in values.items()})
    return {"ok": True, "configured": sorted(deploymod.load_secrets(user.id, build_id))}


@app.get("/api/sessions/{session_id}/builds/{build_id}/env")
def build_env(session_id: str, build_id: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    return PlainTextResponse(deploymod.render_env(deploymod.load_secrets(user.id, build_id), b.files), media_type="text/plain; charset=utf-8", headers={"Content-Disposition": 'attachment; filename=".env"'})


@app.post("/api/sessions/{session_id}/builds/{build_id}/deploy")
async def build_deploy(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    target = body.get("target") or "vercel"
    if target not in deploymod.TARGETS:
        raise HTTPException(400, "destino inválido")
    st = next(t for t in deploymod.deploy_status(user.id) if t["id"] == target)
    if not st["ok"]:
        raise HTTPException(400, f"{st['label']}: {st['hint']}")
    if getattr(b, "deploying", False):
        raise HTTPException(409, "Ya hay un deploy en curso")
    values = deploymod.load_secrets(user.id, build_id)
    cwd = deploymod.materialize(user.id, build_id, b.files, b.workdir)
    rec = {"target": target, "ts": __import__("time").time(), "ok": None, "url": None, "error": None, "log": []}
    b.deploys.append(rec)
    b.deploying = True
    b.emit("deploy.started", target=target)

    async def run():
        def log(line: str):
            rec["log"].append(line[-500:])
            b.emit("deploy.log", target=target, line=line[-500:])

        try:
            res = await deploymod.deploy(target, user.id, build_id, b.title, cwd, values, log)
        except Exception as e:
            res = {"ok": False, "url": None, "error": str(e)[:300]}
        rec.update(ok=res["ok"], url=res["url"], error=res["error"])
        rec["log"] = rec["log"][-200:]
        b.deploying = False
        b._save()
        b.emit("deploy.completed", target=target, ok=res["ok"], url=res["url"], error=res["error"])

    spawn(run())
    return {"ok": True}


@app.get("/api/settings/deploy")
def settings_deploy(user: User = CurrentUser):
    return {t: keystore.key_status(user.id, t) for t in deploymod.TARGETS} | {"status": deploymod.deploy_status(user.id)}


@app.put("/api/settings/deploy/{target}")
def settings_deploy_save(target: str, body: dict, user: User = CurrentUser):
    if target not in deploymod.TARGETS:
        raise HTTPException(404)
    keystore.save(user.id, target, api_key=body.get("token"), clear_key=bool(body.get("clear")))
    return keystore.key_status(user.id, target)


@app.get("/api/sessions/{session_id}/builds")
def session_builds(session_id: str, user: User = CurrentUser):
    live = [b.snapshot() | {"files": len(b.files), "stages": len(b.stages), "version": len(b.versions), "readiness": (b.versions[-1]["readiness"] if b.versions else None)} for b in BUILDS.values() if b.user.id == user.id and b.req.session_id == session_id]
    saved = [x for x in list_builds(user, session_id) if x["id"] not in {b["id"] for b in live}]
    return [{k: b.get(k) for k in ("id", "provider", "model", "status", "turns", "cost_usd", "files", "stages", "engine_session", "workdir", "version", "readiness", "pending_council", "build_seconds")} for b in live] + saved


def _build(user: User, build_id: str, session_id: str | None = None):
    b = BUILDS.get(build_id)
    if b and b.user.id == user.id:
        return b
    if session_id:  # finished build saved on disk: bring it back so it can be resumed
        d = load_build(user, session_id, build_id)
        if d:
            cred = Cred("local", None, d["model"], "local") if is_engine(d["provider"]) else keystore.creds(user.id).get(d["provider"])
            if not cred or cred.source == "none":
                raise HTTPException(400, f"Falta la API key de {d['provider']} para reanudar esta construcción.")
            sess = _saved(user, session_id)
            b = rehydrate(user, session_id, build_id, cred, sess["config"].get("agents", []), keystore.creds(user.id))
            if b:
                return b
    raise HTTPException(404)


@app.get("/api/sessions/{session_id}/builds/{build_id}")
def get_build(session_id: str, build_id: str, user: User = CurrentUser):
    b = BUILDS.get(build_id)
    if b and b.user.id == user.id:
        return b.snapshot() | {"file_contents": b.files}
    d = load_build(user, session_id, build_id)
    if not d:
        raise HTTPException(404)
    return d


@app.put("/api/sessions/{session_id}/builds/{build_id}/files")
def build_file_save(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    """The user edited a file in the editor: it replaces the build's copy (and the working folder on disk, when the
    build has one), so the next turn, the zip, the preview and the deploy all see the edit."""
    b = _build(user, build_id, session_id)
    path, content = str(body.get("path") or ""), body.get("content")
    if not isinstance(content, str) or not buildermod._safe_path(path):
        raise HTTPException(400, "path o contenido inválidos")
    if len(content) > buildermod.MAX_FILE_BYTES:
        raise HTTPException(413, "archivo demasiado grande")
    b._write(path, content)
    if b.workdir:
        dest = Path(b.workdir) / path
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(b.files[path])
        except OSError as e:
            raise HTTPException(500, f"no pude escribir en disco: {e}")
    b._save()
    return {"ok": True, "path": path, "lines": b.files[path].count("\n"), "size": len(b.files[path])}


@app.post("/api/builds/{build_id}/message")
async def build_message(build_id: str, body: dict, user: User = CurrentUser):
    text = (body.get("text") or "").strip()
    if not text:
        raise HTTPException(400, "mensaje vacío")
    b = _build(user, build_id, body.get("session_id"))
    # "pulido visual" / "polish" in the chat → the full visual-polish checklist (the builder does not know the phrase)
    if re.match(r"^\s*(aplic[aá]\s+el\s+)?(pulido\s+visual|visual\s+polish|polish)\b", text, re.I):
        from .design import POLISH_PROMPT
        extra = re.sub(r"^\s*(aplic[aá]\s+el\s+)?(pulido\s+visual|visual\s+polish|polish)\b[:.,\s-]*", "", text, flags=re.I).strip()
        text = POLISH_PROMPT + (f"\n\nADEMÁS, pedido del usuario: {extra}" if extra else "")
    if b.status == "running":
        b.say(text[:6000])
        return {"ok": True, "resumed": False}
    b.chat.append({"role": "user", "text": text[:6000], "ts": __import__("time").time()})
    b.resume(text[:6000])
    return {"ok": True, "resumed": True}


@app.post("/api/builds/{build_id}/review")
async def build_review(build_id: str, body: dict, user: User = CurrentUser):
    """Sends the finished project to the session's team for a pre-production review loop."""
    b = _build(user, build_id, body.get("session_id"))
    if b.status in ("running", "reviewing"):
        raise HTTPException(409, "La construcción todavía está en curso")
    if not b.team:
        raise HTTPException(400, "La sesión no tiene agentes con rol: no hay equipo que pueda revisar")
    b.start_review(int(body.get("max_rounds") or 3))
    return {"ok": True}


@app.get("/api/sessions/{session_id}/builds/{build_id}/versions")
def build_versions(session_id: str, build_id: str, user: User = CurrentUser):
    """v1, v2, …: what was requested, what changed, the council's verdict and the readiness % of each."""
    b = _build_any(user, session_id, build_id)
    return {"versions": b.versions, "current": len(b.versions), "status": b.status}


@app.get("/api/sessions/{session_id}/builds/{build_id}/versions/{n}/diff")
def build_version_diff(session_id: str, build_id: str, n: int, path: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    if n < 1 or n > max(1, len(b.versions)):
        raise HTTPException(404, "versión inexistente")
    return PlainTextResponse(b.version_diff(n, path), media_type="text/plain; charset=utf-8")


@app.post("/api/builds/{build_id}/council")
async def build_council(build_id: str, body: dict, user: User = CurrentUser):
    """Pre-production review as a live arena debate of the team (mode "review"). Returns the arena session to watch."""
    b = _build(user, build_id, body.get("session_id"))
    if b.status in ("running", "reviewing"):
        raise HTTPException(409, "La construcción todavía está en curso")
    if len(b.council_agents()) < 2:
        raise HTTPException(400, "Hacen falta al menos 2 roles con API key para que el consejo debata")
    _check_capacity(user.id)
    b.review_plan = b.review_plan or {"max_rounds": min(3, max(1, int(body.get("max_rounds") or 1)))}
    refs = [r.strip() for r in body.get("references", []) if isinstance(r, str) and r.strip()] if isinstance(body.get("references"), list) else []
    b.add_references(refs, bool(body.get("deep_analysis")))
    focus = "design" if body.get("focus") == "design" else "production"
    if refs:  # whatever the user listed this time is benchmarked first (fresh), then the council opens by itself
        b._save()
        spawn(b.research_then_council(str(body.get("priorities") or ""), refs, focus))
        return {"ok": True, "session_id": None, "researching": len(refs)}
    sid = b.start_council(priorities=str(body.get("priorities") or ""), focus=focus)
    return {"ok": True, "session_id": sid}


@app.post("/api/builds/{build_id}/council/apply")
async def build_council_apply(build_id: str, body: dict, user: User = CurrentUser):
    """The user accepted (a subset of) the council's change list → the builder applies it."""
    b = _build(user, build_id, body.get("session_id"))
    changes = [c for c in (body.get("changes") or []) if isinstance(c, dict) and (c.get("text") or "").strip()]
    if not changes:
        raise HTTPException(400, "No hay cambios seleccionados")
    if b.status in ("running", "reviewing"):
        raise HTTPException(409, "La construcción ya está en curso")
    if body.get("provider"):  # the user picked who builds this list (Claude Code / Codex / an API model)
        try:
            b.set_builder(str(body["provider"]), str(body.get("model") or "") or None)
        except ValueError as e:
            raise HTTPException(400, str(e))
    rounds = int(body.get("max_rounds") or 0)
    b.review_plan = {"max_rounds": len(b.council_sessions) + rounds} if rounds > 0 else None
    b.council_priorities = str(body.get("priorities") or "")
    refs = [r.strip() for r in body.get("references", []) if isinstance(r, str) and r.strip()] if isinstance(body.get("references"), list) else []
    b.add_references(refs, bool(body.get("deep_analysis")))
    if refs:  # benchmark first (the research screen shows it), then the builder applies the list against that bar
        b._save()
        spawn(b.research_then_apply(changes, body.get("council_session") or "", refs))
        return {"ok": True, "researching": len(refs)}
    b.apply_council(changes, body.get("council_session") or "")
    return {"ok": True}


@app.post("/api/builds/{build_id}/resume")
async def build_resume(build_id: str, body: dict, user: User = CurrentUser):
    """Continues an interrupted (error/stopped) build from where it left off, same chat, same context."""
    from .builder import CONTINUE

    b = _build(user, build_id, body.get("session_id"))
    if b.status in ("running", "reviewing"):
        raise HTTPException(409, "La construcción ya está en curso")
    if b.workdir:  # the brief may have been regenerated/completed since: give the agent the latest one
        from .exporter import session_path

        briefs = sorted(session_path(user, b.req.session_id).parent.glob(f"{b.req.session_id}.brief.*.md"), key=lambda p: p.stat().st_mtime)
        if briefs:
            latest = briefs[-1].read_text()
            if latest and latest != b.brief:
                b.brief = latest
                (b.workdir / "BRIEF.md").write_text(latest)
                b.chat.append({"role": "system", "text": "BRIEF.md actualizado con la última versión del brief.", "ts": __import__("time").time()})
    b.chat.append({"role": "system", "text": "Construcción reanudada desde donde quedó.", "ts": __import__("time").time()})
    b.resume(CONTINUE)
    return {"ok": True}


@app.post("/api/builds/{build_id}/design/approve")
async def build_design_approve(build_id: str, body: dict | None = None, user: User = CurrentUser):
    """The user approved the mockup: the build goes on to write code."""
    b = _build(user, build_id, (body or {}).get("session_id"))
    if b.status != "design_review":
        raise HTTPException(409, "Esta construcción no está esperando aprobación del diseño")
    b.approve_design()
    return {"ok": True}


@app.post("/api/builds/{build_id}/design/redo")
async def build_design_redo(build_id: str, body: dict, user: User = CurrentUser):
    """The user asked for changes: the designer does another round with that feedback, then waits again."""
    b = _build(user, build_id, body.get("session_id"))
    if b.status != "design_review":
        raise HTTPException(409, "Esta construcción no está esperando aprobación del diseño")
    fb = (body.get("feedback") or "").strip()
    if not fb:
        raise HTTPException(400, "Contá qué cambiar del diseño")
    b.redo_design(fb)
    return {"ok": True}


DESIGN_SUMMARY_SYSTEM = {
    "es": "Sos un/a Product Designer que le explica el diseño de una app a alguien sin formación técnica. Escribí en español rioplatense, claro y concreto, en Markdown corto: un párrafo de 2-3 líneas con la idea general (estilo, sensación, a qué se parece), y después secciones breves con viñetas: **Colores** (cuáles y para qué), **Tipografía**, **Pantallas** (qué hay en cada una y qué puede hacer la persona), **Componentes** (botones, tarjetas, listas… cómo se ven), **Detalles** (animaciones, estados vacíos, errores, modo oscuro, accesibilidad). Sin jerga: nada de tokens, px, hex, nombres de clases ni archivos. Máximo 300 palabras.",
    "en": "You are a Product Designer explaining an app's design to someone non-technical. Write clear, concrete, short Markdown: a 2-3 line paragraph with the overall idea (style, feel, what it resembles), then brief bulleted sections: **Colors** (which and what for), **Typography**, **Screens** (what is on each and what the person can do), **Components** (buttons, cards, lists… how they look), **Details** (animations, empty states, errors, dark mode, accessibility). No jargon: no tokens, px, hex, class or file names. 300 words max.",
}


@app.get("/api/sessions/{session_id}/builds/{build_id}/design/summary")
async def build_design_summary(session_id: str, build_id: str, lang: str = "es", refresh: bool = False, user: User = CurrentUser):
    """What the current design is, in plain language, written by a model from design/DESIGN.md + the mockup.
    Cached next to the build and keyed by the design's content, so it is rewritten only when the design changes."""
    b = _build_any(user, session_id, build_id)
    md = b.files.get("design/DESIGN.md") or ""
    html = b.files.get(buildermod.DESIGN_MOCKUP) or b.design_html or ""
    if not md and not html:
        return {"text": None, "reason": "no_design"}
    key = hashlib.sha1((md + html[:20000] + lang).encode()).hexdigest()[:16]
    cache = auth.user_dir(user.id) / f"{session_id}.build.{build_id}.design-summary.json"
    try:
        d = json.loads(cache.read_text())
        if not refresh and d.get("key") == key:
            return d
    except Exception:  # noqa: BLE001
        pass
    who = scene_gen._pick_model(user, {"agents": []})
    if not who:
        return {"text": None, "reason": "no_key"}
    provider, model, cred = who
    text_html = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S | re.I)
    text_html = re.sub(r"<[^>]+>", " ", text_html)
    text_html = " ".join(text_html.split())[:3000]
    prompt = f"PROYECTO: {b.title}\n\nDESIGN.md (lo que escribió el diseñador):\n{md[:9000]}\n\nTEXTO VISIBLE DE LA MAQUETA:\n{text_html}"
    result = provmod.CallResult()
    buf: list[str] = []
    async for kind, delta in provmod.stream(provider, model, DESIGN_SUMMARY_SYSTEM["en" if lang == "en" else "es"], prompt, temperature=0.3, max_tokens=1200, result=result, cred=cred):
        if kind == "text":
            buf.append(delta)
    out = {"key": key, "text": "".join(buf).strip(), "model": f"{provmod.PROVIDERS[provider].label} · {model}", "lang": lang, "ts": time.time()}
    try:
        cache.write_text(json.dumps(out, ensure_ascii=False))
    except Exception:  # noqa: BLE001
        pass
    return out


@app.post("/api/builds/{build_id}/design/request")
async def build_design_request(build_id: str, body: dict, user: User = CurrentUser):
    """A specific design change, in the user's words, at any moment: during the design gate it is another designer
    round; while building it goes to the builder's inbox; on a finished build it resumes the build with the change."""
    b = _build(user, build_id, body.get("session_id"))
    text = (body.get("text") or "").strip()[:4000]
    if not text:
        raise HTTPException(400, "Contá qué cambiar del diseño")
    if b.status == "design_review":
        b.redo_design(text)
        return {"ok": True, "mode": "redo"}
    ask = (
        "CAMBIO DE DISEÑO pedido por el usuario (prioridad): " + text
        + "\n\nActuá como Product Designer + frontend: actualizá design/mockup.html y design/DESIGN.md para reflejar el cambio y aplicalo en la UI real, "
        "archivo por archivo, sin romper funcionalidad ni tests. Mantené coherencia con el resto del sistema visual. Al terminar, en <say>, resumí en lenguaje simple qué cambió visualmente."
    )
    if b.status == "running":
        b.say(ask)
        return {"ok": True, "mode": "queued"}
    b.chat.append({"role": "user", "text": f"🎨 {text}", "ts": time.time()})
    b.resume(ask)
    return {"ok": True, "mode": "resumed"}


@app.post("/api/builds/{build_id}/stop")
async def build_stop(build_id: str, user: User = CurrentUser):
    _build(user, build_id).stop()
    return {"ok": True}


@app.get("/api/sessions/{session_id}/builds/{build_id}/zip")
def build_zip(session_id: str, build_id: str, user: User = CurrentUser):
    import io
    import re as _re
    import zipfile

    b = BUILDS.get(build_id)
    if b and b.user.id == user.id:
        data, title = b.zip_bytes(), b.title
    else:
        d = load_build(user, session_id, build_id)
        if not d:
            raise HTTPException(404)
        title = d["title"]
        root = _re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "proyecto"
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            for p, c in d.get("file_contents", {}).items():
                z.writestr(f"{root}/{p}", c)
        data = buf.getvalue()
    name = _re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40] or "proyecto"
    return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}.zip"'})


@app.websocket("/ws/builds/{build_id}")
async def ws_build(ws: WebSocket, build_id: str):
    await ws.accept()
    user = auth.user_from_token(ws.query_params.get("token"))
    b = BUILDS.get(build_id)
    if (not b or b.user.id != user.id) and user and ws.query_params.get("session"):
        # the server restarted while the page was open: bring the saved build back so the UI shows its real state
        try:
            b = _build(user, build_id, ws.query_params.get("session"))
        except HTTPException:
            b = None
    if not b or not user or b.user.id != user.id:
        await ws.send_json({"type": "error", "error": "build not found"})
        await ws.close()
        return
    q = b.subscribe()
    try:
        app_live = b.app_run is not None and b.app_run.status in ("installing", "starting", "running")
        if b.status not in ("running", "reviewing", "design_review") and not app_live:
            q.put_nowait(None)
        while True:
            ev = await q.get()
            if ev is None:
                break
            await ws.send_json(ev)
        await ws.close()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        b.unsubscribe(q)


@app.websocket("/ws/sessions/{session_id}")
async def ws_session(ws: WebSocket, session_id: str):
    await ws.accept()
    user = auth.user_from_token(ws.query_params.get("token"))
    s = SESSIONS.get(session_id)
    if not s or not user or s.owner.id != user.id:
        await ws.send_json({"type": "error", "error": "session not found"})
        await ws.close()
        return
    q = s.subscribe()
    try:
        if s.status in ("completed", "stopped", "error"):
            q.put_nowait(None)
        while True:
            ev = await q.get()
            if ev is None:
                break
            await ws.send_json(ev)
        await ws.close()
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        s.unsubscribe(q)


# --------------------------------------------------------------------------- run the built app locally

def _run_root(b) -> "Path":
    return deploymod.materialize(b.user.id, b.id, b.files, b.workdir)


@app.get("/api/sessions/{session_id}/builds/{build_id}/run")
def app_run_state(session_id: str, build_id: str, user: User = CurrentUser):
    """Runnable services detected in the project + the current run (if any)."""
    b = _build_any(user, session_id, build_id)
    r = runmod.RUNS.get(build_id)
    return {"services": runmod.detect(_run_root(b)), "run": r.state() if r else None}


@app.post("/api/sessions/{session_id}/builds/{build_id}/run")
async def app_run_start(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    _check_capacity(user.id)
    root = _run_root(b)
    services = runmod.detect(root)
    svc = next((s for s in services if s["id"] == body.get("service")), services[0] if services else None)
    if not svc:
        raise HTTPException(400, "No hay nada que se pueda correr en este proyecto")
    old = runmod.RUNS.get(build_id)
    if old and old.status in ("installing", "starting", "running"):
        raise HTTPException(409, "La app ya está corriendo")
    r = runmod.AppRun(root, svc, user.id, build_id, b.files, lambda t, d: b.emit(t, **d))
    runmod.RUNS[build_id] = r
    b.app_run = r
    from .tasks import spawn

    r.task = spawn(r.run())
    return {"ok": True, "port": r.port}


@app.delete("/api/sessions/{session_id}/builds/{build_id}/run")
async def app_run_stop(session_id: str, build_id: str, user: User = CurrentUser):
    _build_any(user, session_id, build_id)
    r = runmod.RUNS.get(build_id)
    if r:
        await r.stop()
    return {"ok": True}


# --------------------------------------------------------------------------- skills (knowledge attached to roles)

@app.get("/api/skills")
def skills_list(user: User = CurrentUser):
    return {"skills": skillmod.list_skills(user.id), "templates": [template_en({k: t[k] for k in ("id", "name", "description", "tags")} | {"chars": len(t["body"])}) for t in skillmod.TEMPLATES]}


class SuggestBody(BaseModel):
    text: str
    roles: list[dict] = []  # [{id, label, group}]
    k: int = 4


ROLE_GROUP_TO_CATALOG = {"Dirección": "ceo", "Producto": "product", "Ingeniería": "backend", "Diseño": "design", "Datos e IA": "data", "Negocio": "growth", "Calidad y seguridad": "qa", "Otros": None}


@app.get("/api/skills/catalog")
def skills_catalog_search(q: str = "", category: str = "", limit: int = 80, user: User = CurrentUser):
    """Public skills catalog (downloaded repos), searchable and grouped by category."""
    return {"skills": catalog.search(q, category, limit), "categories": catalog.categories(), "total": len(catalog.index()), "sync": catalog.SYNC}


@app.get("/api/skills/catalog/sync")
def skills_catalog_sync_status(user: User = CurrentUser):
    return catalog.SYNC | {"total_skills": len(catalog.index())}


@app.post("/api/skills/catalog/sync")
def skills_catalog_sync(user: User = CurrentUser):
    """Download/update every source and rebuild the index (background)."""
    started = catalog.sync_in_background()
    return {"started": started, **catalog.SYNC}


class TranslateBody(BaseModel):
    provider: str
    model: str


@app.post("/api/skills/catalog/translate")
async def skills_catalog_translate(body: TranslateBody, user: User = CurrentUser):
    """Translate the catalog's names/descriptions to Spanish with one of the user's models (background, cached)."""
    eff = keystore.creds(user.id)
    if body.provider not in PROVIDERS or (PROVIDERS[body.provider].kind != "mock" and body.provider not in eff):
        raise HTTPException(400, "Proveedor sin API key")
    if not catalog.TRANSLATE["running"]:
        spawn(catalog.translate_missing(body.provider, body.model, eff.get(body.provider)))
    return catalog.TRANSLATE | {"translated": len(catalog.translations()), "total_skills": len(catalog.index())}


@app.get("/api/skills/catalog/translate")
def skills_catalog_translate_status(user: User = CurrentUser):
    return catalog.TRANSLATE | {"translated": len(catalog.translations()), "total_skills": len(catalog.index())}


@app.post("/api/skills/suggest")
def skills_suggest(body: SuggestBody, user: User = CurrentUser):
    """Catalog skills a task needs, per role: {role_id: [skill…]} plus a general list."""
    per_role = {}
    for r in body.roles:
        grp = ROLE_GROUP_TO_CATALOG.get(r.get("group") or "", None)
        per_role[r.get("id")] = catalog.suggest(f"{body.text}\n{r.get('mandate', '')}", k=body.k, role_group=grp)  # the mandate says what the role needs; its title only adds noise
    return {"general": catalog.suggest(body.text, k=body.k * 2), "per_role": per_role}


@app.get("/api/skills/{skill_id}")
def skills_get(skill_id: str, user: User = CurrentUser):
    if skill_id.startswith("cat-"):
        c = catalog.get(skill_id)
        if not c:
            raise HTTPException(404)
        return catalog.localized(c) | {"body": catalog.body(skill_id) or ""}
    sk = next((t for t in skillmod.TEMPLATES if t["id"] == skill_id), None) if skill_id.startswith("tpl-") else skillmod.get_skill(user.id, skill_id)
    if not sk:
        raise HTTPException(404)
    return sk


@app.post("/api/skills")
def skills_create(body: dict, user: User = CurrentUser):
    try:
        return skillmod.save_skill(user.id, str(body.get("name") or ""), str(body.get("body") or ""), str(body.get("description") or ""), str(body.get("tags") or ""), body.get("id") or None)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/documents/text")
async def document_text(file: UploadFile = File(...), user: User = CurrentUser):
    """Plain text of a document (md, txt, pdf, docx, code…) — used to replace a role's prompt with a full brief."""
    data = await file.read()
    if len(data) > 25_000_000:
        raise HTTPException(413, "El documento supera 25 MB")
    try:
        text = skillmod.extract_text(file.filename or "documento", data).strip()
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"No pude leer el documento: {e}")
    if not text:
        raise HTTPException(400, "El documento no tiene texto legible (¿es un PDF escaneado?)")
    cap = 60_000
    return {"text": text[:cap], "chars": len(text), "truncated": len(text) > cap, "filename": file.filename}


@app.post("/api/skills/upload")
async def skills_upload(file: UploadFile = File(...), name: str = Form(""), user: User = CurrentUser):
    """A document (md, txt, pdf, docx, code…) becomes a skill in the user's library: the role's memory / full brief."""
    data = await file.read()
    if len(data) > 25_000_000:
        raise HTTPException(413, "El documento supera 25 MB")
    try:
        text = skillmod.extract_text(file.filename or "documento", data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"No pude leer el documento: {e}")
    text = text.strip()
    if not text:
        raise HTTPException(400, "El documento no tiene texto legible (¿es un PDF escaneado?)")
    cut = len(text) > skillmod.MAX_BODY
    title = (name.strip() or re.sub(r"\.[A-Za-z0-9]+$", "", file.filename or "Documento")).strip()[:120]
    try:
        sk = skillmod.save_skill(user.id, title, text, description=f"Documento adjunto: {file.filename} ({len(text):,} caracteres{' · recortado' if cut else ''})", tags="documento")
    except ValueError as e:
        raise HTTPException(400, str(e))
    return sk | {"truncated": cut, "chars_total": len(text)}


@app.delete("/api/skills/{skill_id}")
def skills_delete(skill_id: str, user: User = CurrentUser):
    if not skillmod.delete_skill(user.id, skill_id):
        raise HTTPException(404)
    return {"ok": True}


@app.patch("/api/sessions/{session_id}/agents/{agent_id}/skills")
def session_agent_skills(session_id: str, agent_id: str, body: dict, user: User = CurrentUser):
    """Attach skills to a role mid-session (debate or council); applies from its next turn."""
    s = SESSIONS.get(session_id)
    if not s or s.owner.id != user.id:
        raise HTTPException(404)
    if agent_id not in s.agents:
        raise HTTPException(404, "agente no encontrado")
    ids = [str(x) for x in (body.get("skills") or []) if isinstance(x, str)]
    s.update_agent_skills(agent_id, ids)
    return {"ok": True, "skills": s.agents[agent_id].skills}


@app.patch("/api/builds/{build_id}/team/{agent_id}/skills")
def build_team_skills(build_id: str, agent_id: str, body: dict, user: User = CurrentUser):
    """Skills for a role of the build's team: the next council round, review or design phase uses them."""
    b = _build(user, build_id, body.get("session_id"))
    ids = [str(x) for x in (body.get("skills") or []) if isinstance(x, str)]
    if not b.set_team_skills(agent_id, ids):
        raise HTTPException(404, "rol no encontrado en el equipo")
    return {"ok": True}


@app.put("/api/builds/{build_id}/team")
def build_team_set(build_id: str, body: dict, user: User = CurrentUser):
    """The council itself: which roles sit at the table and with which company/model. Used before sending to review."""
    b = _build(user, build_id, body.get("session_id"))
    team = body.get("team")
    if not isinstance(team, list) or len([a for a in team if isinstance(a, dict)]) < 2:
        raise HTTPException(400, "El consejo necesita al menos 2 roles")
    return {"ok": True, "team": b.set_team(team)}


# --------------------------------------------------------------------------- FDE: "pedir un developer" (fixed-price packages)

@app.get("/api/fde/packages")
def fde_packages(_: User = CurrentUser):
    return {"packages": [p | fdemod.links(p["id"]) for p in fdemod.PACKAGES], "booking_url": fdemod.links("x")["booking_url"], "stripe": billing.status()}


@app.post("/api/fde/requests")
def fde_create(body: dict, user: User = CurrentUser):
    """Creates the request with a ticket built from the project's real state (version, blockers, missing services, stack)."""
    pkg = fdemod.package(str(body.get("package") or ""))
    if not pkg:
        raise HTTPException(400, "paquete inválido")
    session_id, build_id = str(body.get("session_id") or ""), str(body.get("build_id") or "")
    b = _build_any(user, session_id, build_id)
    services = deploymod.services_for(b.files, b.brief, set(deploymod.load_secrets(user.id, build_id)))
    try:
        stack = runmod.detect(deploymod.materialize(user.id, build_id, b.files, b.workdir))
    except Exception:
        stack = []
    ticket = fdemod.build_ticket(b, services, stack, pkg, str(body.get("notes") or ""), str(body.get("contact") or user.email))
    req = fdemod.create_request(user.id, session_id, build_id, pkg, ticket, str(body.get("notes") or ""), str(body.get("contact") or user.email))
    b.chat.append({"role": "system", "text": f"Pedido de developer creado: {pkg['name']} ({req['id']}).", "ts": __import__("time").time()})
    b._save()
    return req | fdemod.links(pkg["id"])


# --------------------------------------------------------------------------- billing (Stripe Checkout)

def _fees_due(b) -> list[dict]:
    return [f for f in b.fees if not f.get("paid")]


@app.post("/api/billing/checkout")
async def billing_checkout(body: dict, user: User = CurrentUser):
    """Starts a Stripe Checkout for a developer request (kind=fde, ref=request id) or for a build's unpaid per-use
    fees (kind=fees, build_id + session_id). Returns the hosted page URL."""
    if not billing.enabled():
        raise HTTPException(503, "Pagos no configurados: falta STRIPE_SECRET_KEY en el .env del backend")
    kind = str(body.get("kind") or "")
    session_id, build_id = str(body.get("session_id") or ""), str(body.get("build_id") or "")
    back = f"#live={session_id}" if session_id else ""
    if kind == "fde":
        r = fdemod.get_request(user.id, str(body.get("ref") or ""))
        if not r:
            raise HTTPException(404, "pedido no encontrado")
        pkg = fdemod.package(r["package"]) or {}
        hours = max(4, int(body.get("hours") or 4)) if r["package"] == "hours" else 1
        amount = float(pkg.get("price_usd", 0)) * hours
        name = f"Tably Team · {pkg.get('name', r['package'])}" + (f" × {hours} h" if hours > 1 else "")
        try:
            o = await billing.create_checkout(user.id, user.email, "fde", r["id"], name, f"Pedido {r['id']} · {r['ticket'].get('project', {}).get('title', '')}", amount, back, r["build_id"], r["session_id"])
        except RuntimeError as e:
            raise HTTPException(502, str(e))
        return o
    if kind == "fees":
        b = _build_any(user, session_id, build_id)
        due = _fees_due(b)
        total = round(sum(float(f.get("usd") or 0) for f in due), 2)
        if total <= 0:
            raise HTTPException(400, "no hay cargos pendientes")
        try:
            o = await billing.create_checkout(user.id, user.email, "fees", build_id, "Tably Team · cargos por uso", " · ".join(f.get("label", "") for f in due)[:300], total, back, build_id, session_id)
        except RuntimeError as e:
            raise HTTPException(502, str(e))
        return o
    raise HTTPException(400, "kind inválido")


async def _settle(o: dict) -> None:
    """A paid order takes effect: the request moves to 'paid'; the build's fees are marked paid."""
    if o.get("status") != "paid":
        return
    if o["kind"] == "fde":
        fdemod.update_request(o["user_id"], o["ref"], status="paid")
    elif o["kind"] == "fees":
        b = BUILDS.get(o["build_id"])
        if b is not None:
            for f in b.fees:
                f["paid"] = True
            b._save()
        else:  # finished build only on disk: flip the flags in its saved file
            p = auth.user_dir(o["user_id"]) / f"{o['session_id']}.build.{o['build_id']}.json"
            try:
                d = json.loads(p.read_text())
                for f in d.get("fees", []):
                    f["paid"] = True
                p.write_text(json.dumps(d, ensure_ascii=False))
            except Exception as e:  # noqa: BLE001
                log.warning("could not settle fees on %s: %s", p, e)


@app.post("/api/billing/confirm")
async def billing_confirm(body: dict, user: User = CurrentUser):
    """Back from Stripe: read the session and settle. Safe to call many times."""
    o = await billing.confirm(str(body.get("checkout") or ""))
    if not o or o["user_id"] != user.id:
        raise HTTPException(404, "orden no encontrada")
    await _settle(o)
    return o


@app.get("/api/billing/orders")
def billing_orders(build_id: str | None = None, user: User = CurrentUser):
    return billing.list_orders(user.id, build_id)


@app.post("/api/billing/webhook")
async def billing_webhook(request: Request):
    payload = await request.body()
    ev = billing.verify_webhook(payload, request.headers.get("stripe-signature", ""))
    if ev is None:
        raise HTTPException(400, "firma inválida o webhook no configurado")
    if ev.get("type") in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        o = await billing.confirm(ev["data"]["object"]["id"])
        if o:
            await _settle(o)
    return {"ok": True}


@app.get("/api/fde/requests")
def fde_list(session_id: str | None = None, user: User = CurrentUser):
    return [r | fdemod.links(r["package"]) for r in fdemod.list_requests(user.id, session_id)]


@app.get("/api/fde/requests/{rid}/ticket.md")
def fde_ticket(rid: str, user: User = CurrentUser):
    r = fdemod.get_request(user.id, rid)
    if not r:
        raise HTTPException(404)
    return PlainTextResponse(fdemod.ticket_markdown(r["ticket"]), media_type="text/markdown; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="pedido-{rid}.md"'})


@app.patch("/api/fde/requests/{rid}")
def fde_update(rid: str, body: dict, user: User = CurrentUser):
    status = body.get("status")
    if status and status not in ("cancelled",):  # the user can only cancel; the rest is the engineer's side
        raise HTTPException(400, "estado inválido")
    r = fdemod.update_request(user.id, rid, status=status, notes=body.get("notes"))
    if not r:
        raise HTTPException(404)
    return r


@app.on_event("startup")
async def _startup():
    from .tasks import start_runner

    start_runner()


# ================================================================================================ Tably Cloud · git propio, publicar, base de datos, migrar


@app.get("/api/cloud/status")
def cloud_status(user: User = CurrentUser):
    return {**cloudmod.status(), "github": keystore.key_status(user.id, "github"), "apps": [cloudmod.public(a) for a in cloudmod.list_apps(user.id)]}


@app.put("/api/settings/github")
def settings_github(body: dict, user: User = CurrentUser):
    keystore.save(user.id, "github", api_key=body.get("token"), clear_key=bool(body.get("clear")))
    return keystore.key_status(user.id, "github")


def _cloud_root(user: User, b) -> Path:
    """The project folder to build/publish/commit: the engine's workdir when it really holds the project; otherwise
    (API builds, or a workdir that is empty because the build was restored elsewhere) a folder written from the saved files."""
    def has_project(d: Path) -> bool:
        for p in d.iterdir():
            if p.name in (".git", ".gitignore"):
                continue
            if p.is_dir() or p.stat().st_size > 0:
                return True
        return False

    wd = b.workdir if b.workdir and b.workdir.exists() and has_project(b.workdir) else None
    return deploymod.materialize(user.id, b.id, b.files, wd)


@app.get("/api/sessions/{session_id}/builds/{build_id}/cloud")
def build_cloud(session_id: str, build_id: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    return {
        "app": cloudmod.public(cloudmod.get_app(user.id, build_id)),
        "git": gitserver.info(user.id, build_id, cloudmod.public_url()),
        "migration": cloudmod.migration_kit(user.id, build_id),
        "status": cloudmod.status(),
        "github": keystore.key_status(user.id, "github"),
        "publishing": bool(getattr(b, "publishing", False)),
        "version": len(b.versions),
    }


@app.post("/api/sessions/{session_id}/builds/{build_id}/cloud/publish")
async def build_cloud_publish(session_id: str, build_id: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    if getattr(b, "publishing", False):
        raise HTTPException(409, "Ya hay una publicación en curso")
    if b.status in ("running", "reviewing"):
        raise HTTPException(409, "Esperá a que el constructor termine")
    _check_capacity(user.id)
    root = _cloud_root(user, b)
    b.publishing = True
    b.emit("cloud.started", build=build_id)

    async def run():
        def logf(line: str):
            b.emit("cloud.log", line=line[-500:])

        try:
            app_ = await cloudmod.publish(user.id, build_id, b.title, root, b.files, len(b.versions), logf)
            gitserver.sync(user.id, build_id, root, f"publicación v{len(b.versions)}")
        except Exception as e:  # noqa: BLE001
            log.exception("cloud publish")
            app_ = {"status": "error", "error": str(e)[:300], "url": None, "slug": None, "provider": None}
        b.publishing = False
        b.emit("cloud.status", app=cloudmod.public(app_) if app_.get("slug") else app_)

    spawn(run())
    return {"ok": True}


@app.delete("/api/sessions/{session_id}/builds/{build_id}/cloud/publish")
async def build_cloud_unpublish(session_id: str, build_id: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    app_ = await cloudmod.unpublish(user.id, build_id)
    b.emit("cloud.status", app=cloudmod.public(app_))
    return {"ok": True, "app": cloudmod.public(app_)}


@app.post("/api/sessions/{session_id}/builds/{build_id}/cloud/db")
async def build_cloud_db(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    provider = body.get("provider")

    def logf(line: str):
        b.emit("cloud.log", line=line[-500:])

    if provider == "neon":
        res = await cloudmod.provision_neon(user.id, build_id, b.title, logf)
    elif provider == "supabase":
        res = await cloudmod.provision_supabase(user.id, build_id, b.title, logf)
    else:
        raise HTTPException(400, "proveedor inválido")
    if not res.get("ok"):
        raise HTTPException(400, res.get("error") or "no se pudo provisionar")
    b.emit("cloud.status", app=cloudmod.public(cloudmod.get_app(user.id, build_id)))
    return res


@app.post("/api/sessions/{session_id}/builds/{build_id}/cloud/git/sync")
def build_git_sync(session_id: str, build_id: str, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    res = gitserver.sync(user.id, build_id, _cloud_root(user, b), f"sync manual · v{len(b.versions)}")
    if not res.get("ok"):
        raise HTTPException(400, res.get("error") or "no se pudo sincronizar")
    return {**res, "git": gitserver.info(user.id, build_id, cloudmod.public_url())}


@app.post("/api/sessions/{session_id}/builds/{build_id}/cloud/git/github")
def build_git_github(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    b = _build_any(user, session_id, build_id)
    token = keystore.get_key(user.id, "github")
    if not token:
        raise HTTPException(400, "Cargá un token de GitHub (permiso «repo») en Configuración → Tably Cloud.")
    res = gitserver.push_github(user.id, build_id, token, body.get("name") or b.title or build_id, private=body.get("private", True), root=_cloud_root(user, b))
    if not res.get("ok"):
        raise HTTPException(400, res.get("error") or "no se pudo mover a GitHub")
    b.emit("cloud.github", url=res["url"])
    return res


@app.api_route("/git/{user_id}/{repo}/{path:path}", methods=["GET", "POST"])
async def git_http(user_id: str, repo: str, path: str, request: Request):
    """Smart HTTP for `git clone/fetch/push`: the account token goes as the Basic password (any username)."""
    tok = gitserver.parse_basic_auth(request.headers.get("authorization"))
    u = auth.user_from_token(tok) if tok else None
    if not u or u.id != user_id:
        return Response(status_code=401, headers={"WWW-Authenticate": 'Basic realm="Tably Git"'}, content="token requerido")
    body = await request.body()
    status, headers, payload = gitserver.http_backend(user_id, repo, path, request.method, request.url.query, request.headers.get("content-type"), body)
    return Response(status_code=status, headers={k: v for k, v in headers}, content=payload)


@app.get("/api/agents/sessions")
def agent_sessions_list(engine: str = "claude", user: User = CurrentUser):
    """Your Claude Code / Codex conversations on this machine, grouped by project (read-only)."""
    if engine not in ("claude", "codex"):
        raise HTTPException(400, "engine: claude | codex")
    return agent_sessions.list_sessions(engine, user.id)


@app.get("/api/agents/sessions/{engine}/{session_id}")
def agent_session_get(engine: str, session_id: str, user: User = CurrentUser):
    if engine not in ("claude", "codex"):
        raise HTTPException(400, "engine: claude | codex")
    d = agent_sessions.get_session(engine, session_id, user.id)
    if not d:
        raise HTTPException(404, "Sesión no encontrada")
    return d


@app.post("/api/agents/sessions/{engine}/{session_id}/message")
async def agent_session_message(engine: str, session_id: str, body: dict, user: User = CurrentUser):
    """Chat from the sessions screen: resumes the real CLI session and streams its events as JSON lines."""
    if engine not in ("claude", "codex"):
        raise HTTPException(400, "engine: claude | codex")
    text = (body.get("text") or "").strip()[:20000]
    if not text:
        raise HTTPException(400, "Escribí un mensaje")
    _check_capacity(user.id)
    return StreamingResponse(agent_sessions.chat(engine, session_id, text, user.id), media_type="application/x-ndjson", headers={"cache-control": "no-store", "x-accel-buffering": "no"})


@app.get("/api/devices")
def devices_status(user: User = CurrentUser):
    """What this machine can run for mobile apps (iOS Simulator, Android emulator)."""
    return runmod.devices()


@app.get("/api/sessions/{session_id}/builds/{build_id}/run/screen")
def app_run_screen(session_id: str, build_id: str, request: Request, target: str = "ios", token: str | None = None):
    """The device screen as PNG. Auth by bearer or by `token` query, because the panel loads it in an <img>."""
    bearer = (request.headers.get("authorization") or "").removeprefix("Bearer ").strip()
    user = auth.user_from_token(token or bearer or None)
    if not user:
        raise HTTPException(401)
    _build_any(user, session_id, build_id)
    png = runmod.screenshot(target if target in ("ios", "android") else "ios")
    if not png:
        raise HTTPException(404, "No hay un dispositivo encendido para capturar")
    return Response(content=png, media_type="image/png", headers={"cache-control": "no-store"})


@app.post("/api/sessions/{session_id}/builds/{build_id}/run/tap")
def app_run_tap(session_id: str, build_id: str, body: dict, user: User = CurrentUser):
    _build_any(user, session_id, build_id)
    ok = runmod.tap(str(body.get("target") or "android"), int(body.get("x") or 0), int(body.get("y") or 0))
    return {"ok": ok}


@app.get("/apps/{slug}/{path:path}")
def cloud_app_file(slug: str, path: str = ""):
    p = cloudmod.local_file(slug, path)
    if not p:
        raise HTTPException(404)
    return FileResponse(p)


@app.get("/apps/{slug}")
def cloud_app_root(slug: str):
    p = cloudmod.local_file(slug, "")
    if not p:
        raise HTTPException(404)
    return FileResponse(p)


# ------------------------------------------------------------------ public content: blog, FAQ and the machine-readable files (SEO / answer engines)
from . import content as contentmod
from fastapi.responses import HTMLResponse


@app.get("/api/content/blog")
def content_blog_list(lang: str = "es"):
    return [p.meta() for p in contentmod.posts("en" if lang == "en" else "es")]


@app.get("/api/content/blog/{slug}")
def content_blog_post(slug: str, lang: str = "es"):
    p = contentmod.post(slug, "en" if lang == "en" else "es")
    if not p:
        raise HTTPException(404, "No existe ese artículo")
    return {**p.meta(), "html": p.body_html, "toc": p.toc_html, "keywords": p.keywords}


@app.get("/api/content/faq")
def content_faq(lang: str = "es"):
    return [{"question": i.question, "html": i.answer_html, "text": i.answer_text, "slug": i.slug} for i in contentmod.faq("en" if lang == "en" else "es")]


def _lang_of(prefix: str) -> str:
    return "en" if prefix == "en" else "es"


@app.get("/blog", response_class=HTMLResponse, include_in_schema=False)
@app.get("/{prefix}/blog", response_class=HTMLResponse, include_in_schema=False)
def page_blog(tag: str | None = None, prefix: str = ""):
    if prefix not in ("", "en"):
        raise HTTPException(404)
    return HTMLResponse(contentmod.blog_index_html(tag, _lang_of(prefix)))


@app.get("/blog/feed.xml", include_in_schema=False)
@app.get("/{prefix}/blog/feed.xml", include_in_schema=False)
def page_blog_feed(prefix: str = ""):
    if prefix not in ("", "en"):
        raise HTTPException(404)
    return Response(contentmod.rss_xml(_lang_of(prefix)), media_type="application/rss+xml")


@app.get("/blog/{slug}", response_class=HTMLResponse, include_in_schema=False)
@app.get("/{prefix}/blog/{slug}", response_class=HTMLResponse, include_in_schema=False)
def page_blog_post(slug: str, prefix: str = ""):
    if prefix not in ("", "en"):
        raise HTTPException(404)
    p = contentmod.post(slug, _lang_of(prefix))
    if not p:
        raise HTTPException(404, "No existe ese artículo")
    return HTMLResponse(contentmod.post_html(p))


@app.get("/faq", response_class=HTMLResponse, include_in_schema=False)
@app.get("/{prefix}/faq", response_class=HTMLResponse, include_in_schema=False)
def page_faq(prefix: str = ""):
    if prefix not in ("", "en"):
        raise HTTPException(404)
    return HTMLResponse(contentmod.faq_html(_lang_of(prefix)))


@app.get("/sitemap.xml", include_in_schema=False)
def page_sitemap():
    return Response(contentmod.sitemap_xml(), media_type="application/xml")


@app.get("/robots.txt", include_in_schema=False)
def page_robots():
    return PlainTextResponse(contentmod.robots_txt())


@app.get("/llms.txt", include_in_schema=False)
def page_llms():
    return PlainTextResponse(contentmod.llms_txt(), media_type="text/plain; charset=utf-8")


@app.get("/llms-full.txt", include_in_schema=False)
def page_llms_full():
    return PlainTextResponse(contentmod.llms_full_txt(), media_type="text/plain; charset=utf-8")


# ------------------------------------------------------------------ single-service deploy: the built frontend is served by the API
_STATIC = Path(env("ARENA_STATIC_DIR", str(Path(__file__).resolve().parents[2] / "frontend" / "dist")))
if _STATIC.is_dir() and (_STATIC / "index.html").exists():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=str(_STATIC), html=True), name="frontend")


@app.on_event("shutdown")
async def _shutdown():
    from .tasks import stop_runner

    for s in SESSIONS.values():
        s.stop()
    for b in BUILDS.values():
        b.stop()
    await runmod.stop_all()
    await asyncio.sleep(0.1)
    await stop_runner()
    obs.flush()
