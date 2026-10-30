"""Keys left in the code of an app, found before it is published (betterleaks + the user's own saved secrets).

Nothing with a key in its code goes out: the value is saved as one of the app's secrets, the builder moves it to an
environment variable and the app is published again by itself. A key that still works gets a card for the user
(it was in the code: it is better to change it)."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import shutil
import tempfile
from pathlib import Path

log = logging.getLogger(__name__)

MARK = "CLAVE EN EL CÓDIGO"  # in the logs of a stopped publish: lessons.py groups these failures by it
SKIP = re.compile(r"(^|/)(node_modules|\.git|\.tably|dist|build|\.next|\.venv|venv|__pycache__)/|(^|/)\.env(\.[\w.-]+)?$")
SKIP_EXAMPLE = re.compile(r"(^|/)\.env\.(example|sample|template)$")
CONFIG = """[extend]
useDefault = true
[allowlist]
paths = ['''(^|/)(node_modules|\\.git|\\.tably|dist|build|\\.next|\\.venv|venv|__pycache__)/''', '''(^|/)\\.env(\\.[\\w-]+)?$''']
"""
TEXT_EXT = re.compile(r"\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|py|rb|go|java|kt|php|json|ya?ml|toml|ini|cfg|html|md|txt|sh|sql|prisma|env\.example)$|(^|/)(Dockerfile|Procfile)$", re.I)

# who the key is from, in words, and where to change it (one click from the card)
SERVICES: list[tuple[str, str, str]] = [
    (r"^stripe", "Stripe", "https://dashboard.stripe.com/apikeys"),
    (r"^railway", "Railway", "https://railway.com/account/tokens"),
    (r"^github", "GitHub", "https://github.com/settings/tokens"),
    (r"^gitlab", "GitLab", "https://gitlab.com/-/user_settings/personal_access_tokens"),
    (r"^aws", "AWS", "https://console.aws.amazon.com/iam/home#/security_credentials"),
    (r"^(gcp|google)", "Google", "https://console.cloud.google.com/apis/credentials"),
    (r"^openai", "OpenAI", "https://platform.openai.com/api-keys"),
    (r"^anthropic", "Anthropic", "https://console.anthropic.com/settings/keys"),
    (r"^slack", "Slack", "https://api.slack.com/apps"),
    (r"^twilio", "Twilio", "https://console.twilio.com/"),
    (r"^sendgrid", "SendGrid", "https://app.sendgrid.com/settings/api_keys"),
    (r"^mailgun", "Mailgun", "https://app.mailgun.com/settings/api_security"),
    (r"^(mercadopago|mercado)", "Mercado Pago", "https://www.mercadopago.com.ar/developers/panel/app"),
    (r"^(facebook|meta)", "Meta", "https://developers.facebook.com/apps/"),
    (r"^supabase", "Supabase", "https://supabase.com/dashboard/project/_/settings/api"),
    (r"^(postgres|mysql|mongodb|database|jdbc)", "la base de datos", ""),
    (r"^(private-key|pkcs)", "una clave privada", ""),
]


def available() -> bool:
    return bool(shutil.which("betterleaks"))


def service(rule: str) -> tuple[str, str]:
    for rx, name, url in SERVICES:
        if re.search(rx, rule, re.I):
            return name, url
    return "un servicio externo", ""


def env_name(rule: str, taken: dict[str, str], value: str) -> str:
    """The variable the key moves to: from the rule (stripe-access-token → STRIPE_ACCESS_TOKEN), never clashing with another value."""
    base = re.sub(r"[^A-Z0-9]+", "_", rule.upper()).strip("_") or "API_KEY"
    base = re.sub(r"^GENERIC_API_KEY$", "API_KEY", base)
    name, n = base, 2
    while name in taken and taken[name] != value:
        name, n = f"{base}_{n}", n + 1
    return name


async def _betterleaks(root: Path, validate: bool) -> list[dict]:
    with tempfile.NamedTemporaryFile("w", suffix=".toml", delete=False) as cfg:
        cfg.write(CONFIG)
    args = ["betterleaks", "dir", str(root), "-c", cfg.name, "--no-banner", "--no-color", "-f", "json", "-r", "-", "--exit-code", "0", "--log-level", "error",
            "--max-target-megabytes", "2"]
    if validate:
        args += ["--validation", "--validation-timeout", "8s"]
    try:
        p = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        out, err = await asyncio.wait_for(p.communicate(), timeout=180)
        return json.loads(out or b"[]") or []
    except Exception as e:  # noqa: BLE001  a scanner that fails never blocks publishing
        log.warning("betterleaks failed: %s", e)
        return []
    finally:
        Path(cfg.name).unlink(missing_ok=True)


def _own_values(root: Path, values: dict[str, str]) -> list[dict]:
    """The user's own saved secrets (Railway, Meta, the database…) written literally in a file of the code."""
    vals = {k: v for k, v in values.items() if isinstance(v, str) and len(v) >= 12 and not re.fullmatch(r"(true|false|\d+|https?://[^:@/]+/?)", v, re.I)}
    if not vals:
        return []
    hits = []
    for f in root.rglob("*"):
        rel = f.relative_to(root).as_posix()
        if not f.is_file() or SKIP.search(rel) or not TEXT_EXT.search(rel) or f.stat().st_size > 2_000_000:
            continue
        try:
            text = f.read_text(errors="ignore")
        except OSError:
            continue
        for k, v in vals.items():
            i = text.find(v)
            if i >= 0:
                hits.append({"RuleID": k.lower().replace("_", "-"), "File": rel, "StartLine": text.count("\n", 0, i) + 1, "Secret": v, "env": k, "ValidationStatus": "", "own": True})
    return hits


async def scan(root: Path, values: dict[str, str] | None = None, validate: bool = True) -> list[dict]:
    """Keys in the code of `root`: [{rule, service, url, file, line, secret, env, live, preview}] (one per key, all the places it appears in `files`)."""
    found = _own_values(root, values or {})
    if available():
        base = str(root.resolve()).rstrip("/") + "/"
        for f in await _betterleaks(root, validate):
            rel = f.get("File") or ""
            rel = rel[len(base):] if rel.startswith(base) else rel[len(str(root)) + 1:] if rel.startswith(str(root) + "/") else rel
            if not SKIP.search(rel) and not SKIP_EXAMPLE.search(rel):
                found.append({**f, "File": rel})
    keys: dict[str, dict] = {}
    taken = {k: v for k, v in (values or {}).items() if isinstance(v, str)}
    for f in found:
        secret = (f.get("Secret") or "").strip()
        if len(secret) < 8:
            continue
        rel = f.get("File") or ""
        k = keys.get(secret)
        if k:
            k["files"] = sorted({*k["files"], f"{rel}:{f.get('StartLine')}"})
            continue
        rule = f.get("RuleID") or "secret"
        env = f.get("env") or next((n for n, v in taken.items() if v == secret), "") or env_name(rule, taken, secret)
        taken[env] = secret
        name, url = service(rule)
        keys[secret] = {"rule": rule, "service": name, "url": url, "file": rel, "line": f.get("StartLine"), "files": [f"{rel}:{f.get('StartLine')}"],
                        "secret": secret, "env": env, "live": f.get("ValidationStatus") == "valid", "own": bool(f.get("own")), "preview": secret[:6] + "…"}
    return list(keys.values())


def report(keys: list[dict]) -> str:
    """For the publish log and the builder (never the whole key)."""
    return "\n".join(f"· {MARK}: {k['service']} ({k['rule']}, {k['preview']}) en {', '.join(k['files'][:6])} → leela de la variable de entorno {k['env']}" for k in keys)
