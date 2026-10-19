"""User-saved experiments: the current setup saved as a card, with a generated animated scene (data/scenes/<id>.svg)."""
from __future__ import annotations

import json
import time
import uuid

from .auth import _db
from .config import DATA_DIR
from . import scenes

SCENES_DIR = DATA_DIR.parent / "scenes"
SCENES_DIR.mkdir(parents=True, exist_ok=True)

with _db() as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS user_presets (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '',
            config TEXT NOT NULL, created REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS user_presets_user ON user_presets (user_id, created);
        """
    )


def scene_path(preset_id: str):
    return SCENES_DIR / f"{scenes.safe_id(preset_id)}.svg"


def _row(r) -> dict:
    cfg = json.loads(r["config"])
    return {"id": r["id"], "title": r["title"], "emoji": r["emoji"], "custom": True, "created": r["created"], "scene_url": f"/api/scenes/{r['id']}.svg",
            **{k: cfg[k] for k in ("topic", "mode", "agents", "max_turns", "min_turns", "language", "final_vote", "closing_round", "pace_ms", "max_tokens") if k in cfg},
            "starter": cfg.get("starter"), "judge": cfg.get("judge")}


def list_presets(user_id: str) -> list[dict]:
    with _db() as c:
        return [_row(r) for r in c.execute("SELECT * FROM user_presets WHERE user_id=? ORDER BY created DESC", (user_id,))]


def create_preset(user_id: str, title: str, config: dict, emoji: str = "✨", motif: str | None = None) -> dict:
    pid = "exp-" + uuid.uuid4().hex[:10]
    config = dict(config, title=title)
    scene_path(pid).write_text(scenes.generate(title, config.get("topic", ""), motif))
    with _db() as c:
        c.execute("INSERT INTO user_presets (id, user_id, title, emoji, config, created) VALUES (?,?,?,?,?,?)", (pid, user_id, title, emoji, json.dumps(config, ensure_ascii=False), time.time()))
        r = c.execute("SELECT * FROM user_presets WHERE id=?", (pid,)).fetchone()
    return _row(r)


def delete_preset(user_id: str, preset_id: str) -> bool:
    with _db() as c:
        ok = c.execute("DELETE FROM user_presets WHERE user_id=? AND id=?", (user_id, preset_id)).rowcount > 0
    if ok:
        try:
            scene_path(preset_id).unlink()
        except FileNotFoundError:
            pass
    return ok
