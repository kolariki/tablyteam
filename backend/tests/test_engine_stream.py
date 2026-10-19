"""Claude Code stream-json → friendly events (activity / todos / thinking / text deltas / session id), without running the CLI."""
import asyncio
import json
from pathlib import Path

from app.local_engine import _claude_loop, describe_tool


class _Proc:
    def __init__(self, lines):
        self.stdout = self._gen(lines)

    async def _gen(self, lines):
        for l in lines:
            yield (json.dumps(l) + "\n").encode()


def _run(lines):
    evs = []

    async def on_event(kind, **d):
        evs.append((kind, d))

    res = {"text": "", "cost": 0.0, "turns": 0, "is_error": False, "error": None, "session_id": None}
    asyncio.run(_claude_loop(_Proc(lines), res, Path("/tmp/proj"), on_event))
    return evs, res


def test_tool_calls_become_activity_and_todos():
    lines = [
        {"type": "system", "session_id": "sess-1"},
        {"type": "assistant", "message": {"content": [
            {"type": "tool_use", "name": "Write", "input": {"file_path": "/tmp/proj/src/a.py"}},
            {"type": "tool_use", "name": "Bash", "input": {"command": "cd /tmp/proj && npm install"}},
            {"type": "tool_use", "name": "TodoWrite", "input": {"todos": [{"content": "Setup", "status": "completed"}, {"content": "API", "status": "in_progress"}]}},
        ]}},
        {"type": "result", "result": "listo", "total_cost_usd": 0.1, "num_turns": 3},
    ]
    evs, res = _run(lines)
    kinds = [k for k, _ in evs]
    assert kinds == ["activity", "file_hint", "activity", "activity", "todos"]
    assert evs[0][1] == {"act": "write", "label": "Escribiendo", "path": "src/a.py"}
    assert evs[2][1]["act"] == "install"
    assert evs[4][1]["todos"][1]["status"] == "in_progress"
    assert res["session_id"] == "sess-1" and res["text"] == "listo" and res["turns"] == 3


def test_partial_messages_stream_thinking_and_text_once():
    lines = [
        {"type": "stream_event", "event": {"type": "content_block_start", "content_block": {"type": "thinking"}}},
        {"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "thinking_delta", "thinking": "primero "}}},
        {"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": "Hola"}}},
        {"type": "stream_event", "event": {"type": "content_block_delta", "delta": {"type": "text_delta", "text": " mundo"}}},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "Hola mundo"}]}},
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "sin deltas"}]}},
    ]
    evs, _ = _run(lines)
    kinds = [k for k, _ in evs]
    # streamed text is NOT re-emitted as a full block (text_end instead); a block without deltas is emitted whole
    assert kinds == ["thinking", "thinking", "text_delta", "text_delta", "text_end", "text"]
    assert evs[-1][1]["text"] == "sin deltas"


def test_describe_tool_hides_internal_paths():
    cwd = Path("/tmp/proj")
    assert describe_tool("Read", {"file_path": "/etc/hosts"}, cwd)["path"] == "hosts"
    assert describe_tool("Bash", {"command": "uv run pytest -q"}, cwd)["kind"] == "test"
    assert describe_tool("Bash", {"command": "git init"}, cwd)["kind"] == "git"
    assert describe_tool("Bash", {"command": "ls -la && cat README.md"}, cwd)["label"] == "Revisando el entorno"
