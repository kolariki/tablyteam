"""Role score: how well each role of a user's team works for that user, from what actually happened.

Read straight from the build history (nothing new to record, so past rounds count too):
- acceptance: of the changes a role asked in a council, how many the user kept when applying the list (blocking ones weigh double);
- blocking precision: of the role's blocking requests, how many the user kept (a blocker the user drops was not one);
- rounds to approval: in the builds the role reviewed and the council approved, how many council rounds it took (a build still
  open after 2+ rounds counts as one round more than it has, so a council that never converges is not a perfect score).
The score (0-100) mixes them; the trend compares the role's acceptance in its recent rounds against the earlier ones.
"""
from __future__ import annotations

import json
from pathlib import Path

from .auth import _db, user_dir
from .i18n_data import role_en
from .memory import collect, role_key, role_label
from .roles import ROLE_BY_ID, role_of

MIN_ASKED = 4  # below this the score is shown as provisional

_cache: dict[str, tuple[float, dict]] = {}  # session file → (mtime, {config, changes})


def _council(folder: Path, sid: str) -> dict | None:
    """Agents + final change list of a council session (cached by mtime: session files carry the whole debate)."""
    path = folder / f"{sid}.json"
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return None
    hit = _cache.get(str(path))
    if hit and hit[0] == mtime:
        return hit[1]
    try:
        data = json.loads(path.read_text())
    except Exception:
        return None
    verdict = next((e for e in reversed(data.get("events") or []) if e.get("type") == "council.verdict"), None)
    out = {"config": {"agents": (data.get("config") or {}).get("agents") or []}, "changes": (verdict or {}).get("changes") or []}
    _cache[str(path)] = (mtime, out)
    return out


def _slot(roles: dict, key: str, label: str) -> dict:
    return roles.setdefault(key, {"role": key, "label": label, "kept": 0, "dropped": 0, "kept_blocking": 0, "dropped_blocking": 0,
                                  "rounds": 0, "approvals": [], "open": [], "history": []})


def compute(user_id: str) -> list[dict]:
    folder = user_dir(user_id)
    roles: dict[str, dict] = {}
    for path in sorted(folder.glob("*.build.*.json"), key=lambda p: p.stat().st_mtime):
        try:
            build = json.loads(path.read_text())
        except Exception:
            continue
        rounds, seq_roles = 0, set()
        for v in build.get("versions") or []:
            if v.get("trigger") == "council" and v.get("from_council"):  # the user applied this council's list (a subset of it)
                c = _council(folder, v["from_council"])
                if c and c["changes"]:
                    for key, d in collect(c["config"], c["changes"], v.get("requested") or []).items():
                        s = _slot(roles, key, d["label"])
                        kb = sum(1 for x in d["kept"] if x.startswith("[bloqueante]"))
                        db = sum(1 for x in d["dropped"] if x.startswith("[bloqueante]"))
                        s["kept"] += len(d["kept"])
                        s["dropped"] += len(d["dropped"])
                        s["kept_blocking"] += kb
                        s["dropped_blocking"] += db
                        if d["kept"] or d["dropped"]:
                            s["history"].append(len(d["kept"]) / (len(d["kept"]) + len(d["dropped"])))
            if v.get("council_session"):  # a council reviewed this version
                rounds += 1
                c = _council(folder, v["council_session"])
                for a in (c or {}).get("config", {}).get("agents", []):
                    r = role_of(a.get("role"))
                    key = role_key(a.get("role"), a.get("name"))
                    _slot(roles, key, r["label"] if r else (a.get("name") or ""))["rounds"] += 1
                    seq_roles.add(key)
                if (v.get("verdict") or {}).get("approved"):
                    for key in seq_roles:
                        roles[key]["approvals"].append(rounds)
                    rounds, seq_roles = 0, set()  # a later council on the same build starts a new count
        if rounds >= 2:  # still not approved after several rounds: counts as at least one more round than it took so far
            for key in seq_roles:
                roles[key]["open"].append(rounds + 1)
    with _db() as conn:
        lessons = dict(conn.execute("SELECT role, COUNT(*) FROM role_insights WHERE user_id = ? AND status = 'accepted' GROUP BY role", (user_id,)).fetchall())
    return sorted((_score(s, lessons.get(s["role"], 0)) for s in roles.values()), key=lambda r: (r["score"] is None, -(r["score"] or 0), -r["asked"]))


def _score(s: dict, lessons: int) -> dict:
    asked = s["kept"] + s["dropped"]
    blocking = s["kept_blocking"] + s["dropped_blocking"]
    acceptance = s["kept"] / asked if asked else None
    weighted = (s["kept"] + s["kept_blocking"]) / (asked + blocking) if asked else None
    precision = s["kept_blocking"] / blocking if blocking else None
    avg_rounds = sum(s["approvals"]) / len(s["approvals"]) if s["approvals"] else None
    seqs = s["approvals"] + s["open"]
    speed = max(0.0, 1 - (sum(seqs) / len(seqs) - 1) * 0.2) if seqs else None  # 1 round → 1.0, 3 → 0.6, 6+ → 0
    if weighted is None:
        score = None
    else:
        score = round(100 * (0.7 * weighted + 0.3 * speed) if speed is not None else 100 * weighted)
    h = s["history"]
    trend = None
    if len(h) >= 4:
        half = len(h) // 2
        early, late = sum(h[:half]) / half, sum(h[half:]) / (len(h) - half)
        trend = "up" if late - early >= 0.1 else "down" if early - late >= 0.1 else "flat"
    return {
        "role": s["role"], "role_label": role_label(s["role"], s["label"]),
        "role_label_en": role_en(ROLE_BY_ID[s["role"]])["label_en"] if s["role"] in ROLE_BY_ID else s["label"],
        "score": score, "provisional": asked < MIN_ASKED, "asked": asked, "kept": s["kept"],
        "acceptance": round(acceptance, 3) if acceptance is not None else None,
        "blocking": blocking, "blocking_precision": round(precision, 3) if precision is not None else None,
        "rounds_reviewed": s["rounds"], "approvals": len(s["approvals"]), "open_builds": len(s["open"]),
        "convergence": round(speed, 3) if speed is not None else None,
        "avg_rounds_to_approval": round(avg_rounds, 1) if avg_rounds is not None else None,
        "trend": trend, "lessons": lessons,
    }
