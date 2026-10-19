"""Outgoing email for account verification: Resend (RESEND_API_KEY) or SMTP (SMTP_HOST/PORT/USER/PASS); MAIL_FROM for both.
Without any transport configured, nothing is sent and the caller falls back to showing the code locally (dev mode)."""
from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage

import httpx

from .config import env

log = logging.getLogger("arena.mail")


def configured() -> bool:
    return bool(env("RESEND_API_KEY", "") or env("SMTP_HOST", ""))


def sender() -> str:
    return env("MAIL_FROM", "") or env("SMTP_FROM", "") or "Tably Team <onboarding@resend.dev>"


def send(to: str, subject: str, text: str, html: str | None = None) -> bool:
    """True when a transport accepted the message; False (never raises) otherwise."""
    try:
        if key := env("RESEND_API_KEY", ""):
            r = httpx.post("https://api.resend.com/emails", headers={"Authorization": f"Bearer {key}"},
                           json={"from": sender(), "to": [to], "subject": subject, "text": text, **({"html": html} if html else {})}, timeout=15)
            if r.status_code >= 300:
                log.warning("resend rejected the email: %s %s", r.status_code, r.text[:200])
                return False
            return True
        if host := env("SMTP_HOST", ""):
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = sender(), to, subject
            msg.set_content(text)
            if html:
                msg.add_alternative(html, subtype="html")
            port = int(env("SMTP_PORT", "587") or "587")
            user, pw = env("SMTP_USER", ""), env("SMTP_PASS", "")
            if port == 465:
                with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=20) as s:
                    if user:
                        s.login(user, pw or "")
                    s.send_message(msg)
            else:
                with smtplib.SMTP(host, port, timeout=20) as s:
                    s.starttls(context=ssl.create_default_context())
                    if user:
                        s.login(user, pw or "")
                    s.send_message(msg)
            return True
    except Exception as e:  # noqa: BLE001
        log.warning("email to %s failed: %s", to, str(e)[:200])
    return False


def verification_email(name: str, code: str) -> tuple[str, str, str]:
    subject = f"{code} es tu código de Tably Team"
    text = f"Hola {name},\n\nTu código para verificar el email es: {code}\n\nVence en 15 minutos. Si no creaste una cuenta en Tably Team, ignorá este mensaje."
    html = f"""<div style="font-family:Instrument Sans,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1E2622">
  <div style="font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#2F6B5D">Tably Team</div>
  <h1 style="font-family:Newsreader,Georgia,serif;font-weight:500;font-size:28px;margin:12px 0 4px">Verificá tu email</h1>
  <p style="color:#46514B;font-size:15px">Hola {name}, este es tu código. Vence en 15 minutos.</p>
  <div style="font-family:JetBrains Mono,ui-monospace,monospace;font-size:36px;letter-spacing:.35em;font-weight:700;background:#E2EDE8;color:#1D4A40;border-radius:14px;padding:18px 0;text-align:center;margin:20px 0">{code}</div>
  <p style="color:#717C76;font-size:12.5px">Si no creaste una cuenta en Tably Team, ignorá este mensaje.</p>
</div>"""
    return subject, text, html
