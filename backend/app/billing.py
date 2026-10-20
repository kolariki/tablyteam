"""Payments through Stripe Checkout: the developer packages and the per-use fees (deep analysis).

No card data ever touches this server: we create a hosted Checkout Session (one-off payment, USD), send the user to
Stripe, and confirm on return by reading the session back from Stripe's API (the webhook, if configured, confirms
too, so a closed tab does not lose a payment). Orders live in the app's SQLite database.

Configuration (.env): STRIPE_SECRET_KEY (sk_test_… / sk_live_…), optional STRIPE_WEBHOOK_SECRET (whsec_…) and
APP_URL (where to send the user back; defaults to the first CORS origin or http://localhost:5173).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
import uuid

import httpx

from .auth import _db
from .config import env

log = logging.getLogger("arena.billing")

API = "https://api.stripe.com/v1"

with _db() as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, build_id TEXT NOT NULL DEFAULT '',
            session_id TEXT NOT NULL DEFAULT '', name TEXT NOT NULL, amount_usd REAL NOT NULL, status TEXT NOT NULL,
            stripe_session TEXT NOT NULL DEFAULT '', created REAL NOT NULL, paid_at REAL);
        CREATE INDEX IF NOT EXISTS orders_user ON orders (user_id, created);
        CREATE INDEX IF NOT EXISTS orders_stripe ON orders (stripe_session);
        """
    )


def secret() -> str | None:
    return env("STRIPE_SECRET_KEY")


def enabled() -> bool:
    return bool(secret())


def mode() -> str:
    k = secret() or ""
    return "live" if k.startswith("sk_live_") else "test" if k else "off"


def app_url() -> str:
    return (env("APP_URL") or (env("CORS_ORIGINS") or "").split(",")[0].strip() or "http://localhost:5173").rstrip("/")


def status() -> dict:
    return {"enabled": enabled(), "mode": mode(), "webhook": bool(env("STRIPE_WEBHOOK_SECRET")), "app_url": app_url()}


def _row(r) -> dict:
    return dict(r)


def get_order(user_id: str | None, oid: str) -> dict | None:
    with _db() as c:
        r = c.execute("SELECT * FROM orders WHERE id=?" + (" AND user_id=?" if user_id else ""), (oid, user_id) if user_id else (oid,)).fetchone()
    return _row(r) if r else None


def list_orders(user_id: str, build_id: str | None = None) -> list[dict]:
    with _db() as c:
        if build_id:
            rows = c.execute("SELECT * FROM orders WHERE user_id=? AND build_id=? ORDER BY created DESC", (user_id, build_id))
        else:
            rows = c.execute("SELECT * FROM orders WHERE user_id=? ORDER BY created DESC", (user_id,))
        return [_row(r) for r in rows]


async def create_checkout(user_id: str, email: str, kind: str, ref: str, name: str, description: str, amount_usd: float, return_to: str, build_id: str = "", session_id: str = "") -> dict:
    """A hosted Checkout page for one amount. Returns the order with the URL to send the user to."""
    if not enabled():
        raise RuntimeError("Stripe no está configurado (STRIPE_SECRET_KEY)")
    oid = "ord-" + uuid.uuid4().hex[:10]
    base = app_url()
    success = f"{base}/?checkout={{CHECKOUT_SESSION_ID}}&order={oid}{return_to}"
    cancel = f"{base}/?checkout=cancel&order={oid}{return_to}"
    form = {
        "mode": "payment",
        "success_url": success,
        "cancel_url": cancel,
        "customer_email": email,
        "client_reference_id": oid,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": str(int(round(amount_usd * 100))),
        "line_items[0][price_data][product_data][name]": name[:120],
        "line_items[0][price_data][product_data][description]": description[:300] or name[:120],
        "metadata[order]": oid, "metadata[kind]": kind, "metadata[ref]": ref, "metadata[user]": user_id,
        "payment_intent_data[metadata][order]": oid,
    }
    async with httpx.AsyncClient(timeout=30) as cx:
        r = await cx.post(f"{API}/checkout/sessions", data=form, auth=(secret() or "", ""), headers={"Idempotency-Key": oid})
    if r.status_code >= 400:
        msg = (r.json().get("error") or {}).get("message") if r.headers.get("content-type", "").startswith("application/json") else r.text
        raise RuntimeError(f"Stripe: {msg or r.status_code}")
    s = r.json()
    now = time.time()
    with _db() as c:
        c.execute("INSERT INTO orders (id, user_id, kind, ref, build_id, session_id, name, amount_usd, status, stripe_session, created) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  (oid, user_id, kind, ref, build_id, session_id, name, float(amount_usd), "pending", s["id"], now))
    return get_order(user_id, oid) | {"url": s["url"]}  # type: ignore[operator]


async def retrieve(stripe_session: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as cx:
        r = await cx.get(f"{API}/checkout/sessions/{stripe_session}", auth=(secret() or "", ""))
    r.raise_for_status()
    return r.json()


def mark_paid(oid: str) -> dict | None:
    with _db() as c:
        c.execute("UPDATE orders SET status='paid', paid_at=COALESCE(paid_at, ?) WHERE id=?", (time.time(), oid))
    return get_order(None, oid)


def mark(oid: str, st: str) -> dict | None:
    with _db() as c:
        c.execute("UPDATE orders SET status=? WHERE id=? AND status!='paid'", (st, oid))
    return get_order(None, oid)


async def confirm(stripe_session: str) -> dict | None:
    """Reads the session back from Stripe; a paid one marks the order paid. Idempotent."""
    with _db() as c:
        r = c.execute("SELECT * FROM orders WHERE stripe_session=?", (stripe_session,)).fetchone()
    if not r:
        return None
    o = _row(r)
    if o["status"] == "paid":
        return o
    s = await retrieve(stripe_session)
    if s.get("payment_status") == "paid" or s.get("status") == "complete":
        return mark_paid(o["id"])
    if s.get("status") == "expired":
        return mark(o["id"], "expired")
    return o


def verify_webhook(payload: bytes, sig_header: str) -> dict | None:
    """Stripe-Signature: t=…,v1=… → HMAC-SHA256 of "t.payload" with the endpoint secret; 5 min tolerance."""
    whsec = env("STRIPE_WEBHOOK_SECRET")
    if not whsec:
        return None
    parts = dict(p.split("=", 1) for p in sig_header.split(",") if "=" in p)
    t, v1 = parts.get("t"), parts.get("v1")
    if not t or not v1 or abs(time.time() - int(t)) > 300:
        return None
    expected = hmac.new(whsec.encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, v1):
        return None
    return json.loads(payload)
