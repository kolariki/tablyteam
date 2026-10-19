"""Accounts: email + password (scrypt), opaque bearer tokens, SQLite. No external deps.

Every arena session belongs to the user who started it; files live in DATA_DIR/<user_id>/.
Sessions recorded before accounts existed (files directly in DATA_DIR) are handed to the first
account that signs up.
"""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import sqlite3
import time
import uuid
from pathlib import Path

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .config import DATA_DIR, env

DB_PATH = Path(env("ARENA_DB", str(DATA_DIR.parent / "arena.db")))
TOKEN_TTL = int(env("ARENA_TOKEN_TTL_DAYS", "30")) * 86400
ALLOW_SIGNUP = (env("ARENA_ALLOW_SIGNUP", "true") or "true").lower() != "false"


def _db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


with _db() as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            pw_hash BLOB NOT NULL, salt BLOB NOT NULL, created REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS tokens (
            token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS email_codes (
            email TEXT PRIMARY KEY, code_hash TEXT NOT NULL, expires REAL NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, sent REAL NOT NULL);
        """
    )
    # accounts created before email verification existed count as verified
    if "verified" not in {r[1] for r in _c.execute("PRAGMA table_info(users)")}:
        _c.execute("ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 1")

VERIFY_EMAIL = (env("ARENA_VERIFY_EMAIL", "true") or "true").lower() != "false"
CODE_TTL = 15 * 60


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    name: str | None = Field(default=None, max_length=80)


class User(BaseModel):
    id: str
    email: str
    name: str


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _issue(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    with _db() as c:
        c.execute("DELETE FROM tokens WHERE expires < ?", (time.time(),))
        c.execute("INSERT INTO tokens VALUES (?, ?, ?)", (_token_hash(token), user_id, time.time() + TOKEN_TTL))
    return token


def user_dir(user_id: str) -> Path:
    d = DATA_DIR / user_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def register(cred: Credentials) -> tuple[str | None, User, str | None]:
    """Creates the account. With email verification on, no token is issued yet: a 6-digit code goes to the email
    (or comes back as `dev_code` when no mail transport is configured, so local setups still work)."""
    if not ALLOW_SIGNUP:
        raise HTTPException(403, "El registro está deshabilitado")
    email = cred.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "Email inválido")
    salt = secrets.token_bytes(16)
    user = User(id=uuid.uuid4().hex[:12], email=email, name=(cred.name or email.split("@")[0]).strip())
    try:
        with _db() as c:
            first = c.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0
            c.execute("INSERT INTO users (id, email, name, pw_hash, salt, created, verified) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      (user.id, user.email, user.name, _hash(cred.password, salt), salt, time.time(), 0 if VERIFY_EMAIL else 1))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ya existe una cuenta con ese email")
    if first:  # adopt sessions recorded before accounts existed
        for f in DATA_DIR.glob("*.json"):
            f.rename(user_dir(user.id) / f.name)
    if not VERIFY_EMAIL:
        return _issue(user.id), user, None
    return None, user, send_code(email)


def send_code(email: str) -> str | None:
    """Issues a fresh code for the email and sends it; returns the code itself only when no transport is configured."""
    from . import mailer

    with _db() as c:
        row = c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row:
            raise HTTPException(404, "No hay una cuenta con ese email")
        if row["verified"]:
            raise HTTPException(409, "Ese email ya está verificado")
        prev = c.execute("SELECT sent FROM email_codes WHERE email = ?", (email,)).fetchone()
        if prev and time.time() - prev["sent"] < 30:
            raise HTTPException(429, "Esperá medio minuto antes de pedir otro código")
        code = f"{secrets.randbelow(1_000_000):06d}"
        c.execute("INSERT OR REPLACE INTO email_codes VALUES (?, ?, ?, 0, ?)", (email, _token_hash(code), time.time() + CODE_TTL, time.time()))
        name = row["name"]
    if mailer.configured():
        subject, text, html = mailer.verification_email(name, code)
        if not mailer.send(email, subject, text, html):
            raise HTTPException(502, "No se pudo enviar el email de verificación; probá de nuevo en un momento")
        return None
    return code  # dev mode: no mail transport → the client shows it


def verify(email: str, code: str) -> tuple[str, User]:
    email = email.strip().lower()
    code = re.sub(r"\D", "", code or "")
    with _db() as c:
        row = c.execute("SELECT * FROM email_codes WHERE email = ?", (email,)).fetchone()
        if not row or row["expires"] < time.time():
            raise HTTPException(400, "El código venció: pedí uno nuevo")
        if row["attempts"] >= 6:
            raise HTTPException(429, "Demasiados intentos: pedí un código nuevo")
        if not hmac.compare_digest(_token_hash(code), row["code_hash"]):
            c.execute("UPDATE email_codes SET attempts = attempts + 1 WHERE email = ?", (email,))
            raise HTTPException(400, "Código incorrecto")
        c.execute("UPDATE users SET verified = 1 WHERE email = ?", (email,))
        c.execute("DELETE FROM email_codes WHERE email = ?", (email,))
        u = c.execute("SELECT id, email, name FROM users WHERE email = ?", (email,)).fetchone()
    return _issue(u["id"]), User(**dict(u))


def login(cred: Credentials) -> tuple[str, User]:
    with _db() as c:
        row = c.execute("SELECT * FROM users WHERE email = ?", (cred.email.strip().lower(),)).fetchone()
    if not row or not hmac.compare_digest(_hash(cred.password, row["salt"]), row["pw_hash"]):
        raise HTTPException(401, "Email o contraseña incorrectos")
    if not row["verified"]:
        raise HTTPException(403, "email_unverified")
    return _issue(row["id"]), User(id=row["id"], email=row["email"], name=row["name"])


def logout(token: str) -> None:
    with _db() as c:
        c.execute("DELETE FROM tokens WHERE token_hash = ?", (_token_hash(token),))


def user_from_token(token: str | None) -> User | None:
    if not token:
        return None
    with _db() as c:
        row = c.execute(
            "SELECT u.id, u.email, u.name FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.expires > ?",
            (_token_hash(token), time.time()),
        ).fetchone()
    return User(**dict(row)) if row else None


def bearer(request: Request) -> str | None:
    h = request.headers.get("authorization", "")
    return h[7:] if h.lower().startswith("bearer ") else None


def current_user(request: Request) -> User:
    user = user_from_token(bearer(request))
    if not user:
        raise HTTPException(401, "Iniciá sesión")
    return user


CurrentUser = Depends(current_user)
