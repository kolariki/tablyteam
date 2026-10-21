"""
Run the built product locally, from inside Tably Team.

detect(root)  → the runnable services in the project (Next/Vite/Node, FastAPI/Flask/Django, docker compose)
start(...)    → installs what's missing, launches the dev server on a free port, streams logs, waits until it answers
stop(...)     → kills the whole process group

Nothing is deployed anywhere: the app runs on this machine, on 127.0.0.1, and the UI shows it in an iframe.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import signal
import socket
import time
from pathlib import Path
from typing import Awaitable, Callable

from .deploy import load_secrets, render_env
from .frameproxy import FrameProxy
from .local_engine import SKIP_DIRS

Log = Callable[[str], None | Awaitable[None]]

MAX_DEPTH = 3
READY_TIMEOUT = 150  # s: `next dev` first compile can be slow
INSTALL_TIMEOUT = 600


# ------------------------------------------------------------------ detection

def _rel(p: Path, root: Path) -> str:
    return str(p.relative_to(root)).replace("\\", "/")


def _skip(parts: tuple[str, ...]) -> bool:
    return any(x in SKIP_DIRS or x in ("node_modules", ".venv", "venv", "dist", "build", ".next", ".git") for x in parts)


def _pm(d: Path) -> str:
    if (d / "pnpm-lock.yaml").exists() and shutil.which("pnpm"):
        return "pnpm"
    if (d / "yarn.lock").exists() and shutil.which("yarn"):
        return "yarn"
    if (d / "bun.lockb").exists() and shutil.which("bun"):
        return "bun"
    return "npm"


def _py_app(d: Path) -> str | None:
    """`module:app` for uvicorn, found by grepping for FastAPI()/Flask() in the service folder."""
    for f in sorted(d.rglob("*.py")):
        if _skip(f.relative_to(d).parts) or f.stat().st_size > 200_000:
            continue
        try:
            txt = f.read_text(errors="replace")
        except Exception:
            continue
        m = re.search(r"^(\w+)\s*=\s*(?:FastAPI|Flask)\(", txt, re.M)
        if m:
            mod = ".".join(f.relative_to(d).with_suffix("").parts)
            return f"{mod}:{m.group(1)}"
    return None


def detect(root: Path) -> list[dict]:
    out: list[dict] = []
    if not root.exists():
        return out
    # --- node
    for pj in sorted(root.rglob("package.json")):
        rel = pj.relative_to(root)
        if _skip(rel.parts) or len(rel.parts) > MAX_DEPTH:
            continue
        try:
            d = json.loads(pj.read_text())
        except Exception:
            continue
        scripts = d.get("scripts") or {}
        script = next((s for s in ("dev", "start", "serve", "preview") if s in scripts), None)
        if not script:
            continue
        deps = {**(d.get("dependencies") or {}), **(d.get("devDependencies") or {})}
        kind = "next" if "next" in deps else "vite" if "vite" in deps else "nuxt" if "nuxt" in deps else "node"
        web = kind != "node" or any(k in deps for k in ("react", "vue", "svelte", "express", "fastify", "koa", "hono"))
        pm = _pm(pj.parent)
        run = f"{pm} run {script}" if pm != "npm" or script not in ("start",) else "npm start"
        if kind == "next":
            run += f" -- -p {{port}}" if pm == "npm" else f" -p {{port}}"
        elif kind == "vite":
            run += f" -- --port {{port}} --strictPort --host 127.0.0.1" if pm == "npm" else f" --port {{port}} --strictPort --host 127.0.0.1"
        out.append({
            "id": _rel(pj.parent, root) or ".", "dir": _rel(pj.parent, root) or ".", "label": f"{d.get('name') or rel.parent or 'app'} · {kind}",
            "kind": kind, "web": web, "install": f"{pm} install", "run": run, "needs_install": not (pj.parent / "node_modules").exists(),
        })
    # --- python
    for marker in ("pyproject.toml", "requirements.txt", "manage.py"):
        for f in sorted(root.rglob(marker)):
            rel = f.relative_to(root)
            if _skip(rel.parts) or len(rel.parts) > MAX_DEPTH:
                continue
            d = f.parent
            if any(s["dir"] == (_rel(d, root) or ".") and s["kind"].startswith("py") for s in out):
                continue
            try:
                txt = (d / "pyproject.toml").read_text() if (d / "pyproject.toml").exists() else ""
                txt += (d / "requirements.txt").read_text() if (d / "requirements.txt").exists() else ""
            except Exception:
                txt = ""
            low = txt.lower()
            uv = (d / "pyproject.toml").exists() and shutil.which("uv")
            py = "uv run" if uv else ".venv/bin/python -m"
            install = "uv sync" if uv else "python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
            if (d / "manage.py").exists():
                run = f"{py} python manage.py runserver 127.0.0.1:{{port}}" if uv else ".venv/bin/python manage.py runserver 127.0.0.1:{{port}}"
                kind, web = "py-django", True
            elif "fastapi" in low or "uvicorn" in low:
                app = _py_app(d) or "main:app"
                run = f"{py} uvicorn {app} --reload --port {{port}}" if uv else f".venv/bin/uvicorn {app} --reload --port {{port}}"
                kind, web = "py-fastapi", True
            elif "flask" in low:
                app = _py_app(d) or "app:app"
                run = f"FLASK_APP={app} {py} flask run --port {{port}}" if uv else f"FLASK_APP={app} .venv/bin/flask run --port {{port}}"
                kind, web = "py-flask", True
            else:
                continue
            out.append({"id": _rel(d, root) or ".", "dir": _rel(d, root) or ".", "label": f"{d.name or 'api'} · {kind[3:]}", "kind": kind, "web": web, "install": install, "run": run,
                        "needs_install": not ((d / ".venv").exists() or (uv and (d / ".venv").exists()))})
    # --- docker compose (only as an alternative; needs docker running)
    for name in ("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"):
        f = root / name
        if f.exists() and shutil.which("docker"):
            out.append({"id": "docker", "dir": ".", "label": "docker compose (todos los servicios)", "kind": "docker", "web": False, "install": "", "run": "docker compose up", "needs_install": False})
            break
    out.sort(key=lambda s: (not s["web"], s["kind"].startswith("py"), s["kind"] == "docker", s["id"]))  # UI first, then APIs, then docker
    return out


# ------------------------------------------------------------------ run

def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _port_open(port: int) -> bool:
    try:
        _, w = await asyncio.wait_for(asyncio.open_connection("127.0.0.1", port), 0.8)
        w.close()
        return True
    except Exception:
        return False


async def _serves_html(port: int) -> bool | None:
    """GET / and tell whether the answer looks like a web page (None: no answer at all)."""
    try:
        r, w = await asyncio.wait_for(asyncio.open_connection("127.0.0.1", port), 0.8)
        w.write(b"GET / HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n")
        await w.drain()
        head = await asyncio.wait_for(r.read(4096), 2.0)
        w.close()
    except Exception:
        return None
    h = head.decode("utf-8", "replace").lower()
    return "text/html" in h or "<!doctype html" in h or "<html" in h


async def pick_web_port(candidates: list[int]) -> int | None:
    """Several servers may come up from one `dev` script (vite + an API worker, next + a mock server…): the one to
    frame is the one that serves a page. First HTML answer wins; else the first port that answers at all."""
    first_open = None
    for port in candidates:
        kind = await _serves_html(port)
        if kind:
            return port
        if kind is False and first_open is None:
            first_open = port
    return first_open


class AppRun:
    """One running dev server for a build."""

    def __init__(self, root: Path, service: dict, user_id: str, build_id: str, files: dict[str, str], emit: Callable[[str, dict], None]) -> None:
        self.root, self.service, self.emit = root, service, emit
        self.user_id, self.build_id, self.files = user_id, build_id, files
        self.port = free_port()
        self.url: str | None = None
        self.embed_url: str | None = None  # same app through the frame proxy (framing headers stripped)
        self.proxy: FrameProxy | None = None
        self.status = "idle"
        self.error: str | None = None
        self.logs: list[str] = []
        self.proc: asyncio.subprocess.Process | None = None
        self.task: asyncio.Task | None = None
        self.started = time.time()

    def state(self) -> dict:
        return {"status": self.status, "service": self.service["id"], "label": self.service["label"], "url": self.url, "embed_url": self.embed_url, "port": self.port, "error": self.error,
                "logs": self.logs[-200:], "started": self.started}

    def _set(self, status: str, **extra) -> None:
        self.status = status
        for k, v in extra.items():
            setattr(self, k, v)
        self.emit("app.status", {"status": status, "service": self.service["id"], "label": self.service["label"], "url": self.url, "embed_url": self.embed_url, "port": self.port, "error": self.error})

    def _log(self, line: str) -> None:
        line = line[-400:]
        self.logs.append(line)
        self.logs = self.logs[-600:]
        self.emit("app.log", {"line": line})

    async def _stream(self, cmd: str, cwd: Path, env: dict, timeout: float) -> int:
        self.proc = await asyncio.create_subprocess_shell(cmd, cwd=str(cwd), env=env, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, stdin=asyncio.subprocess.DEVNULL, start_new_session=True, limit=8 * 1024 * 1024)
        assert self.proc.stdout

        async def pump():
            async for raw in self.proc.stdout:  # type: ignore[union-attr]
                self._log(raw.decode("utf-8", "replace").rstrip())

        try:
            await asyncio.wait_for(pump(), timeout=timeout)
        except asyncio.TimeoutError:
            self.kill()
            self._log("(timeout)")
            return 124
        return await self.proc.wait()

    def kill(self) -> None:
        p = self.proc
        if p and p.returncode is None:
            try:
                os.killpg(os.getpgid(p.pid), signal.SIGTERM)
            except Exception:
                try:
                    p.kill()
                except Exception:
                    pass

    async def run(self) -> None:
        s = self.service
        cwd = self.root / s["dir"]
        env = {**os.environ, "PORT": str(self.port), "HOST": "127.0.0.1", "BROWSER": "none", "CI": "1", "NO_COLOR": "1", "FORCE_COLOR": "0", "PYTHONUNBUFFERED": "1"}
        # the saved service values → .env (never overwrite one the agent/user already wrote)
        values = load_secrets(self.user_id, self.build_id)
        for d in {self.root, cwd}:
            if values and not (d / ".env").exists():
                try:
                    (d / ".env").write_text(render_env(values, self.files))
                    self._log(f"· .env escrito en {d.relative_to(self.root) or '.'} con {len(values)} variables")
                except Exception:
                    pass
        try:
            if s["install"] and s.get("needs_install"):
                self._set("installing")
                self._log(f"$ {s['install']}")
                code = await self._stream(s["install"], cwd, env, INSTALL_TIMEOUT)
                if code != 0:
                    self._set("error", error=f"La instalación de dependencias falló (código {code}).")
                    return
            self._set("starting")
            cmd = s["run"].replace("{port}", str(self.port))
            self._log(f"$ {cmd}")
            server = asyncio.create_task(self._stream(cmd, cwd, env, 24 * 3600))
            t0 = time.time()
            while time.time() - t0 < READY_TIMEOUT:
                if server.done():
                    code = server.result()
                    self._set("error", error=f"El servidor terminó antes de arrancar (código {code}). Revisá los logs." if code else "El servidor terminó sin levantar un puerto.")
                    return
                # servers that picked their own port say so in the logs; a dev script may start several (vite + an
                # API worker): frame the one that serves a page, not whichever URL was printed last
                seen: list[int] = [self.port]
                for line in self.logs[-60:]:
                    for m in re.finditer(r"https?://(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d+)", line):
                        pt = int(m.group(1))
                        if pt not in seen:
                            seen.append(pt)
                chosen = await pick_web_port(seen) if len(seen) > 1 else (self.port if await _port_open(self.port) else None)
                if chosen is not None and chosen != self.port:
                    self.port = chosen
                    self._log(f"· la app responde en el puerto {chosen}")
                if chosen is not None:
                    self.url = f"http://127.0.0.1:{self.port}"
                    try:  # the UI frames the proxy, not the app: production CSP/X-Frame-Options would blank the iframe
                        self.proxy = FrameProxy(self.port, free_port())
                        await self.proxy.start()
                        self.embed_url = self.proxy.url
                        self._log(f"· vista embebida en {self.embed_url} (sin cabeceras anti-iframe)")
                    except Exception as e:  # pragma: no cover
                        self._log(f"· no pude levantar el proxy de vista embebida: {e}")
                        self.proxy, self.embed_url = None, None
                    self._set("running")
                    code = await server
                    if self.status == "running":
                        self._set("stopped" if code in (0, -15, 143, None) else "error", error=None if code in (0, -15, 143, None) else f"El servidor se cerró (código {code}).")
                    return
                await asyncio.sleep(1)
            self.kill()
            self._set("error", error=f"No respondió en el puerto {self.port} después de {READY_TIMEOUT}s.")
        except asyncio.CancelledError:
            self.kill()
            self._set("stopped")
            raise
        except Exception as e:  # pragma: no cover
            self.kill()
            self._set("error", error=str(e)[:300])

    async def stop(self) -> None:
        if self.proxy:
            await self.proxy.stop()
            self.proxy = None
        self.kill()
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                await self.task
            except (asyncio.CancelledError, Exception):
                pass
        p = self.proc
        if p and p.returncode is None:  # SIGTERM was polite; make sure the port is actually free
            try:
                await asyncio.wait_for(p.wait(), 5)
            except asyncio.TimeoutError:
                try:
                    os.killpg(os.getpgid(p.pid), signal.SIGKILL)
                except Exception:
                    pass
                await p.wait()
        if self.status not in ("error", "stopped"):
            self._set("stopped")


RUNS: dict[str, AppRun] = {}


async def stop_all() -> None:
    for r in list(RUNS.values()):
        await r.stop()
