"""Per-user provider settings: API keys (encrypted at rest with Fernet), default model, base URL.

Keys never leave the server once saved: the API only ever returns the last 4 characters.
Each user must load their own keys; the server .env keys are only used if ARENA_SHARE_SERVER_KEYS=true
The encryption secret comes from ARENA_SECRET_KEY or is generated once into data/.secret.
"""
from __future__ import annotations

import os
import time

from cryptography.fernet import Fernet, InvalidToken

from .auth import _db
from .config import DATA_DIR, env
from . import trial
from .providers import PROVIDERS, Cred, server_cred

SHARE_SERVER_KEYS = (env("ARENA_SHARE_SERVER_KEYS", "false") or "false").lower() == "true"


def _secret() -> bytes:
    if s := env("ARENA_SECRET_KEY"):
        return s.encode()
    path = DATA_DIR.parent / ".secret"
    if not path.exists():
        path.write_bytes(Fernet.generate_key())
        os.chmod(path, 0o600)
    return path.read_bytes().strip()


_fernet = Fernet(_secret())

with _db() as _c:
    _c.execute(
        """CREATE TABLE IF NOT EXISTS user_providers (
            user_id TEXT NOT NULL, provider TEXT NOT NULL, enc_key BLOB, last4 TEXT,
            default_model TEXT, base_url TEXT, updated REAL NOT NULL,
            PRIMARY KEY (user_id, provider))"""
    )


def _rows(user_id: str) -> dict[str, dict]:
    with _db() as c:
        return {r["provider"]: dict(r) for r in c.execute("SELECT * FROM user_providers WHERE user_id = ?", (user_id,))}


def save(user_id: str, provider: str, *, api_key: str | None = None, clear_key: bool = False, default_model: str | None = None, base_url: str | None = None) -> None:
    row = _rows(user_id).get(provider, {})
    enc, last4 = row.get("enc_key"), row.get("last4")
    if clear_key:
        enc, last4 = None, None
    elif api_key:
        api_key = api_key.strip()
        enc, last4 = _fernet.encrypt(api_key.encode()), api_key[-4:]
    model = row.get("default_model") if default_model is None else (default_model.strip() or None)
    base = row.get("base_url") if base_url is None else (base_url.strip() or None)
    with _db() as c:
        c.execute(
            "INSERT OR REPLACE INTO user_providers VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, provider, enc, last4, model, base, time.time()),
        )


def creds(user_id: str) -> dict[str, Cred]:
    """Effective credentials for every provider, as used by sessions and exports."""
    rows = _rows(user_id)
    out: dict[str, Cred] = {}
    for pid, spec in PROVIDERS.items():
        server = server_cred(pid)
        row = rows.get(pid, {})
        key, source = None, "none"
        if row.get("enc_key"):
            try:
                key, source = _fernet.decrypt(row["enc_key"]).decode(), "user"
            except InvalidToken:  # secret rotated: treat as missing
                key = None
        if not key and SHARE_SERVER_KEYS and server.api_key:
            key, source = server.api_key, "server"
        if not key and pid == trial.PROVIDER and server.api_key and trial.left(user_id) > 0:
            key, source = server.api_key, "trial"
        if spec.kind == "mock":
            key, source = "mock", "server"
        if pid == "ollama" and (row.get("base_url") or server.api_key):
            key, source = "ollama", "user" if row.get("base_url") else "server"
        out[pid] = Cred(key, row.get("base_url") or server.base_url, row.get("default_model") or spec.model, source if key else "none")
    return out


def public_settings(user_id: str) -> list[dict]:
    rows = _rows(user_id)
    eff = creds(user_id)
    return [
        {
            "id": pid,
            "label": spec.label,
            "color": spec.color,
            "kind": spec.kind,
            "key_env": spec.key_env,
            "source": eff[pid].source,
            "user_key_last4": rows.get(pid, {}).get("last4"),
            "server_key": bool(server_cred(pid).api_key) and SHARE_SERVER_KEYS,
            "default_model": eff[pid].model,
            "base_url": rows.get(pid, {}).get("base_url"),
            "configured": eff[pid].source != "none",
        }
        for pid, spec in PROVIDERS.items()
    ]



def get_key(user_id: str, name: str) -> str | None:
    """A user secret by name (e.g. deploy tokens 'vercel' / 'railway'), decrypted; None if unset."""
    row = _rows(user_id).get(name)
    if not row or not row.get("enc_key"):
        return None
    try:
        return _fernet.decrypt(row["enc_key"]).decode()
    except InvalidToken:
        return None


def key_status(user_id: str, name: str) -> dict:
    row = _rows(user_id).get(name, {})
    return {"set": bool(row.get("enc_key")), "last4": row.get("last4")}
