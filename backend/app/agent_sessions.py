"""Your Claude Code and Codex conversations, read from this machine, shown like the claude.ai web does.

Claude Code keeps one JSONL per session under ~/.claude/projects/<encoded cwd>/<session>.jsonl (records of type
user / assistant / summary / …, each `message` in the Anthropic API shape). Codex keeps rollouts under
~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl (session_meta + response_item records in the Responses API shape).
Both are read-only here: listing scans only the head and tail of each file (titles, dates); a conversation is parsed in
full when opened and cached by (path, mtime, size).
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from pathlib import Path

log = logging.getLogger("arena.agent_sessions")

CLAUDE_ROOT = Path(os.environ.get("CLAUDE_CONFIG_DIR", os.path.expanduser("~/.claude")))
CODEX_ROOT = Path(os.environ.get("CODEX_HOME", os.path.expanduser("~/.codex")))
HEAD_BYTES = 256 * 1024
TAIL_BYTES = 64 * 1024
MAX_TEXT = 12000  # per block, in the detail view
MAX_ITEMS = 2500

_detail_cache: dict[str, tuple[tuple[float, int], dict]] = {}
_NOISE_RE = re.compile(r"<system-reminder>[\s\S]*?</system-reminder>|<command-(?:name|message|args)>[\s\S]*?</command-(?:name|message|args)>|<local-command-stdout>[\s\S]*?</local-command-stdout>", re.I)


def _clean(text: str) -> str:
    return _NOISE_RE.sub("", text or "").strip()


def _title_from(text: str) -> str:
    t = _clean(text).replace("\n", " ").strip()
    t = re.sub(r"\s+", " ", t)
    return (t[:110] + "…") if len(t) > 110 else t


def _ts(s: str | None) -> float | None:
    if not s:
        return None
    try:
        from datetime import datetime

        return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()
    except Exception:  # noqa: BLE001
        return None


def _iter_lines(path: Path, head: int | None = None, tail: int | None = None):
    """Lines of a JSONL file: the whole file, or its first `head` bytes, or its last `tail` bytes."""
    size = path.stat().st_size
    with path.open("rb") as fh:
        if head is not None:
            data = fh.read(head)
            for line in data.split(b"\n")[:-1] if size > head else data.split(b"\n"):
                yield line
        elif tail is not None:
            fh.seek(max(0, size - tail))
            data = fh.read()
            for line in data.split(b"\n")[1:] if size > tail else data.split(b"\n"):
                yield line
        else:
            for line in fh:
                yield line.rstrip(b"\n")


def _loads(line: bytes) -> dict | None:
    if not line.strip():
        return None
    try:
        d = json.loads(line)
        return d if isinstance(d, dict) else None
    except Exception:  # noqa: BLE001
        return None


# ------------------------------------------------------------------------------------------------ Claude Code

def _claude_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")
    return ""


def _claude_user_is_prompt(d: dict) -> bool:
    """A user record that is a real prompt (not a tool result, not a sidechain, not injected context)."""
    if d.get("isSidechain"):
        return False
    m = d.get("message") or {}
    c = m.get("content")
    if isinstance(c, list) and c and all(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
        return False
    txt = _clean(_claude_text(c))
    return bool(txt) and not txt.startswith(("<local-command", "Caveat:", "[Request interrupted"))


def _claude_session_summary(path: Path) -> dict | None:
    st = path.stat()
    title, cwd, branch, first_ts, model, summary = None, None, None, None, None, None
    for line in _iter_lines(path, head=HEAD_BYTES):
        d = _loads(line)
        if not d:
            continue
        cwd = cwd or d.get("cwd")
        branch = branch or d.get("gitBranch")
        first_ts = first_ts or _ts(d.get("timestamp"))
        if d.get("type") == "summary" and not summary:
            summary = d.get("summary")
        if d.get("type") == "user" and not title and _claude_user_is_prompt(d):
            title = _title_from(_claude_text((d.get("message") or {}).get("content")))
        if d.get("type") == "assistant" and not model:
            model = (d.get("message") or {}).get("model")
        if title and cwd and model:
            break
    if not title and not summary:
        return None  # no prompt at all (queue/attachment-only file)
    last_ts = None
    for line in _iter_lines(path, tail=TAIL_BYTES):
        d = _loads(line)
        if d and d.get("timestamp"):
            last_ts = _ts(d["timestamp"]) or last_ts
    return {"id": path.stem, "engine": "claude", "title": summary or title or path.stem, "first_prompt": title, "cwd": cwd, "branch": branch, "model": model,
            "created": first_ts or st.st_mtime, "updated": last_ts or st.st_mtime, "size": st.st_size, "live": time.time() - st.st_mtime < 120}


def _claude_sessions() -> list[dict]:
    out = []
    root = CLAUDE_ROOT / "projects"
    if not root.exists():
        return out
    for proj in root.iterdir():
        if not proj.is_dir():
            continue
        for f in proj.glob("*.jsonl"):
            try:
                s = _claude_session_summary(f)
            except Exception as e:  # noqa: BLE001
                log.debug("claude session %s: %s", f, e)
                s = None
            if s:
                s["project_key"] = proj.name
                out.append(s)
    return out


def _tool_summary(name: str, inp: dict) -> str:
    if not isinstance(inp, dict):
        return ""
    for k in ("file_path", "path", "command", "pattern", "query", "url", "description", "prompt", "notebook_path"):
        if inp.get(k):
            v = str(inp[k])
            return v if len(v) <= 160 else v[:157] + "…"
    return ", ".join(f"{k}={str(v)[:40]}" for k, v in list(inp.items())[:3])


def _claude_detail(path: Path) -> dict:
    items: list[dict] = []
    meta = {"cwd": None, "branch": None, "model": None, "version": None}
    pending_tools: dict[str, dict] = {}
    usage = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    for line in _iter_lines(path):
        d = _loads(line)
        if not d:
            continue
        t = d.get("type")
        meta["cwd"] = meta["cwd"] or d.get("cwd")
        meta["branch"] = meta["branch"] or d.get("gitBranch")
        meta["version"] = meta["version"] or d.get("version")
        ts = _ts(d.get("timestamp"))
        if t == "user":
            m = d.get("message") or {}
            c = m.get("content")
            if isinstance(c, list) and c and all(isinstance(b, dict) and b.get("type") == "tool_result" for b in c):
                for b in c:
                    tool = pending_tools.pop(b.get("tool_use_id", ""), None)
                    res = b.get("content")
                    txt = res if isinstance(res, str) else _claude_text(res)
                    if tool is not None:
                        tool["result"] = (txt or "")[:2000]
                        tool["is_error"] = bool(b.get("is_error"))
                continue
            if d.get("isSidechain"):
                continue
            txt = _clean(_claude_text(c))
            if not txt or txt.startswith(("<local-command", "Caveat:")):
                continue
            items.append({"role": "user", "ts": ts, "parts": [{"type": "text", "text": txt[:MAX_TEXT]}]})
        elif t == "assistant":
            m = d.get("message") or {}
            meta["model"] = meta["model"] or m.get("model")
            u = m.get("usage") or {}
            usage["input"] += int(u.get("input_tokens") or 0)
            usage["output"] += int(u.get("output_tokens") or 0)
            usage["cache_read"] += int(u.get("cache_read_input_tokens") or 0)
            usage["cache_write"] += int(u.get("cache_creation_input_tokens") or 0)
            parts = []
            for b in m.get("content") or []:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text" and b.get("text", "").strip():
                    parts.append({"type": "text", "text": b["text"][:MAX_TEXT]})
                elif b.get("type") == "thinking" and (b.get("thinking") or "").strip():
                    parts.append({"type": "thinking", "text": b["thinking"][:4000]})
                elif b.get("type") == "tool_use":
                    tool = {"type": "tool", "name": b.get("name"), "summary": _tool_summary(b.get("name", ""), b.get("input") or {}), "input": json.dumps(b.get("input") or {}, ensure_ascii=False)[:3000], "result": None, "is_error": False}
                    pending_tools[b.get("id", "")] = tool
                    parts.append(tool)
            if not parts:
                continue
            # everything the assistant does between two prompts (text, thinking, tool calls) is one bubble, like the web
            if items and items[-1]["role"] == "assistant":
                items[-1]["parts"].extend(parts)
            else:
                items.append({"role": "assistant", "ts": ts, "parts": parts})
        if len(items) > MAX_ITEMS:
            break
    return {"items": items, "meta": meta, "usage": usage, "truncated": len(items) >= MAX_ITEMS}


# ------------------------------------------------------------------------------------------------ Codex

def _codex_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") in ("input_text", "output_text", "text"))
    return ""


def _codex_user_is_prompt(txt: str) -> bool:
    t = txt.strip()
    return bool(t) and not t.startswith(("# AGENTS.md", "<environment_context>", "<user_instructions>", "<permissions", "<skills_instructions>", "<app_context>"))


def _codex_session_summary(path: Path) -> dict | None:
    st = path.stat()
    sid, cwd, title, model, first_ts = None, None, None, None, None
    for line in _iter_lines(path, head=HEAD_BYTES):
        d = _loads(line)
        if not d:
            continue
        p = d.get("payload") or {}
        first_ts = first_ts or _ts(d.get("timestamp"))
        if d.get("type") == "session_meta":
            sid, cwd = p.get("id") or p.get("session_id"), p.get("cwd")
            model = model or p.get("model")
        elif d.get("type") == "turn_context":
            model = model or p.get("model")
            cwd = cwd or p.get("cwd")
        elif d.get("type") == "response_item" and p.get("type") == "message" and p.get("role") == "user" and not title:
            txt = _codex_text(p.get("content"))
            if _codex_user_is_prompt(txt):
                title = _title_from(txt)
        if sid and cwd and title and model:
            break
    if not title:
        return None
    last_ts = None
    for line in _iter_lines(path, tail=TAIL_BYTES):
        d = _loads(line)
        if d and d.get("timestamp"):
            last_ts = _ts(d["timestamp"]) or last_ts
    return {"id": sid or path.stem, "engine": "codex", "title": title, "first_prompt": title, "cwd": cwd, "branch": None, "model": model,
            "created": first_ts or st.st_mtime, "updated": last_ts or st.st_mtime, "size": st.st_size, "live": time.time() - st.st_mtime < 120, "path": str(path)}


def _codex_sessions() -> list[dict]:
    out = []
    root = CODEX_ROOT / "sessions"
    if not root.exists():
        return out
    for f in root.rglob("rollout-*.jsonl"):
        try:
            s = _codex_session_summary(f)
        except Exception as e:  # noqa: BLE001
            log.debug("codex session %s: %s", f, e)
            s = None
        if s:
            s["project_key"] = s.get("cwd") or "?"
            out.append(s)
    return out


def _codex_detail(path: Path) -> dict:
    items: list[dict] = []
    meta = {"cwd": None, "branch": None, "model": None, "version": None}
    calls: dict[str, dict] = {}
    usage = {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    for line in _iter_lines(path):
        d = _loads(line)
        if not d:
            continue
        p = d.get("payload") or {}
        t, pt = d.get("type"), p.get("type")
        ts = _ts(d.get("timestamp"))
        if t == "session_meta":
            meta["cwd"], meta["model"], meta["version"] = p.get("cwd"), p.get("model"), p.get("cli_version") or p.get("version")
        elif t == "turn_context":
            meta["model"] = meta["model"] or p.get("model")
        elif t == "event_msg" and pt == "token_count":
            tot = ((p.get("info") or {}).get("total_token_usage") or {})
            usage = {"input": int(tot.get("input_tokens") or 0), "output": int(tot.get("output_tokens") or 0), "cache_read": int(tot.get("cached_input_tokens") or 0), "cache_write": int(tot.get("cache_write_input_tokens") or 0)}
        elif t == "response_item":
            if pt == "message":
                txt = _codex_text(p.get("content"))
                if p.get("role") == "user":
                    if _codex_user_is_prompt(txt):
                        items.append({"role": "user", "ts": ts, "parts": [{"type": "text", "text": txt.strip()[:MAX_TEXT]}]})
                elif p.get("role") == "assistant" and txt.strip():
                    if items and items[-1]["role"] == "assistant":
                        items[-1]["parts"].append({"type": "text", "text": txt[:MAX_TEXT]})
                    else:
                        items.append({"role": "assistant", "ts": ts, "parts": [{"type": "text", "text": txt[:MAX_TEXT]}]})
            elif pt == "reasoning":
                summ = "\n".join(s.get("text", "") for s in (p.get("summary") or []) if isinstance(s, dict))
                if summ.strip():
                    part = {"type": "thinking", "text": summ[:4000]}
                    if items and items[-1]["role"] == "assistant":
                        items[-1]["parts"].append(part)
                    else:
                        items.append({"role": "assistant", "ts": ts, "parts": [part]})
            elif pt in ("function_call", "custom_tool_call", "local_shell_call"):
                name = p.get("name") or pt
                args = p.get("arguments") or p.get("input") or json.dumps(p.get("action") or {}, ensure_ascii=False)
                if isinstance(args, (dict, list)):
                    args = json.dumps(args, ensure_ascii=False)
                tool = {"type": "tool", "name": name, "summary": str(args)[:160], "input": str(args)[:3000], "result": None, "is_error": False}
                calls[p.get("call_id") or p.get("id") or ""] = tool
                if items and items[-1]["role"] == "assistant":
                    items[-1]["parts"].append(tool)
                else:
                    items.append({"role": "assistant", "ts": ts, "parts": [tool]})
            elif pt in ("function_call_output", "custom_tool_call_output", "local_shell_call_output"):
                tool = calls.pop(p.get("call_id") or "", None)
                if tool is not None:
                    out = p.get("output")
                    tool["result"] = (out if isinstance(out, str) else _codex_text(out))[:2000]
        if len(items) > MAX_ITEMS:
            break
    return {"items": items, "meta": meta, "usage": usage, "truncated": len(items) >= MAX_ITEMS}


# ------------------------------------------------------------------------------------------------ public API

def _project_name(cwd: str | None, key: str) -> str:
    if cwd:
        return Path(cwd).name or cwd
    return key.strip("-").split("-")[-1] or key


def list_sessions(engine: str) -> dict:
    sessions = _claude_sessions() if engine == "claude" else _codex_sessions()
    projects: dict[str, dict] = {}
    for s in sessions:
        key = s.get("cwd") or s["project_key"]
        pr = projects.setdefault(key, {"key": key, "name": _project_name(s.get("cwd"), s["project_key"]), "path": s.get("cwd"), "sessions": []})
        pr["sessions"].append({k: v for k, v in s.items() if k not in ("project_key", "path")})
    for pr in projects.values():
        pr["sessions"].sort(key=lambda x: -x["updated"])
        pr["updated"] = pr["sessions"][0]["updated"]
    out = sorted(projects.values(), key=lambda p: -p["updated"])
    return {"engine": engine, "available": (CLAUDE_ROOT / "projects").exists() if engine == "claude" else (CODEX_ROOT / "sessions").exists(), "projects": out, "count": len(sessions)}


def _find(engine: str, session_id: str) -> Path | None:
    if not re.fullmatch(r"[\w-]+", session_id):
        return None
    if engine == "claude":
        for f in (CLAUDE_ROOT / "projects").glob(f"*/{session_id}.jsonl"):
            return f
        return None
    for f in (CODEX_ROOT / "sessions").rglob(f"rollout-*{session_id}.jsonl"):
        return f
    return None


def get_session(engine: str, session_id: str) -> dict | None:
    path = _find(engine, session_id)
    if not path:
        return None
    st = path.stat()
    key = f"{engine}:{path}"
    cached = _detail_cache.get(key)
    if cached and cached[0] == (st.st_mtime, st.st_size):
        return cached[1]
    detail = _claude_detail(path) if engine == "claude" else _codex_detail(path)
    summary = (_claude_session_summary if engine == "claude" else _codex_session_summary)(path) or {}
    resume = f"claude --resume {session_id}" if engine == "claude" else f"codex resume {session_id}"
    result = {**{k: v for k, v in summary.items() if k not in ("project_key", "path")}, **detail, "resume": resume, "file": str(path)}
    if len(_detail_cache) > 40:
        _detail_cache.pop(next(iter(_detail_cache)))
    _detail_cache[key] = ((st.st_mtime, st.st_size), result)
    return result


# ------------------------------------------------------------------------------------------------ chat (resume the session)

async def chat(engine: str, session_id: str, text: str):
    """Continue the conversation with the real CLI (`claude --resume` / `codex resume`) in its own folder, streaming
    the engine's events as JSON lines: text_delta / text / thinking / activity / result / error."""
    from .local_engine import run_claude_code, run_codex
    from .tasks import spawn

    path = _find(engine, session_id)
    if not path:
        yield json.dumps({"kind": "error", "error": "Sesión no encontrada"}) + "\n"
        return
    summary = (_claude_session_summary if engine == "claude" else _codex_session_summary)(path) or {}
    cwd = Path(summary.get("cwd") or "")
    if not cwd.is_dir():
        yield json.dumps({"kind": "error", "error": f"La carpeta de la sesión ya no existe: {cwd}"}) + "\n"
        return
    q: asyncio.Queue = asyncio.Queue()

    async def on_event(kind: str, **d) -> None:
        await q.put({"kind": kind, **d})

    async def runner() -> None:
        try:
            if engine == "claude":
                res = await run_claude_code(text, cwd, resume_session=session_id, on_event=on_event)
            else:
                res = await run_codex(text, cwd, resume_session=session_id, on_event=on_event)
            await q.put({"kind": "result", "text": res.get("text", ""), "cost": res.get("cost", 0), "is_error": res.get("is_error", False), "error": res.get("error")})
        except Exception as e:  # noqa: BLE001
            log.exception("agent chat")
            await q.put({"kind": "error", "error": str(e)[:300]})
        await q.put(None)

    spawn(runner())
    _detail_cache.pop(f"{engine}:{path}", None)
    while True:
        ev = await q.get()
        if ev is None:
            break
        yield json.dumps(ev, ensure_ascii=False) + "\n"
    _detail_cache.pop(f"{engine}:{path}", None)
