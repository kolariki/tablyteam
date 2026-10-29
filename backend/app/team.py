"""The user's own team: the roles they work with are saved as employees, each with its own knowledge base.

- Every role used in a session is saved (once) as an employee of the user, in the database, so it never gets lost and can be
  reused in the next project. Its memory (memory.py) and score (scores.py) follow it by its role key.
- Each employee can be fed: notes, documents (md, txt, pdf, docx…) and web pages. That is a small RAG: the text is cut into
  chunks indexed with SQLite FTS5; when the role speaks, the chunks most relevant to the topic go into its prompt (all of it
  when the knowledge is small; short notes always, as standing facts). No embeddings provider needed and no extra cost per call.
"""
from __future__ import annotations

import html
import ipaddress
import json
import re
import socket
import time
import uuid
from urllib.parse import urlparse

import httpx

from .auth import _db, user_dir
from .i18n_data import role_en
from .memory import role_key
from .roles import role_of

CHUNK = 900
SMALL_KB = 6000  # below this the whole knowledge goes in the prompt
MAX_IN_PROMPT = 6500
MAX_DOC = 400_000

with _db() as _c:
    _c.executescript(
        """
        CREATE TABLE IF NOT EXISTS employees (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, key TEXT NOT NULL, role TEXT, name TEXT NOT NULL, persona TEXT NOT NULL DEFAULT '',
            provider TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', skills TEXT NOT NULL DEFAULT '[]',
            created REAL NOT NULL, updated REAL NOT NULL, last_used REAL NOT NULL, projects INTEGER NOT NULL DEFAULT 0,
            UNIQUE (user_id, key));
        CREATE TABLE IF NOT EXISTS employee_docs (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL, key TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, source TEXT NOT NULL DEFAULT '',
            chars INTEGER NOT NULL, preview TEXT NOT NULL DEFAULT '', created REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS employee_docs_user ON employee_docs (user_id, key);
        CREATE TABLE IF NOT EXISTS team_backfill (user_id TEXT PRIMARY KEY, ts REAL NOT NULL);
        CREATE VIRTUAL TABLE IF NOT EXISTS employee_chunks USING fts5(text, title UNINDEXED, user_id UNINDEXED, key UNINDEXED, doc_id UNINDEXED, seq UNINDEXED);
        """
    )


def _row(r) -> dict:
    d = dict(r)
    d["skills"] = json.loads(d.get("skills") or "[]")
    return d


def _backfill(user_id: str) -> None:
    """Once per user: the roles of the projects made before employees existed join the team (newest prompt wins)."""
    with _db() as c:
        if c.execute("SELECT 1 FROM team_backfill WHERE user_id = ?", (user_id,)).fetchone():
            return
        c.execute("INSERT INTO team_backfill VALUES (?, ?)", (user_id, time.time()))
    files = sorted((p for p in user_dir(user_id).glob("*.json") if ".build." not in p.name), key=lambda p: p.stat().st_mtime, reverse=True)[:60]
    for p in files:
        try:
            cfg = json.loads(p.read_text()).get("config") or {}
        except Exception:
            continue
        if cfg.get("agents") and cfg.get("mode") != "review":
            save_from_agents(user_id, cfg["agents"])


def listing(user_id: str) -> list[dict]:
    _backfill(user_id)
    with _db() as c:
        rows = [_row(r) for r in c.execute("SELECT * FROM employees WHERE user_id = ? ORDER BY last_used DESC", (user_id,))]
        docs = {r["key"]: (r["n"], r["chars"]) for r in c.execute("SELECT key, COUNT(*) n, SUM(chars) chars FROM employee_docs WHERE user_id = ? GROUP BY key", (user_id,))}
        lessons = {r[0]: r[1] for r in c.execute("SELECT role, COUNT(*) FROM role_insights WHERE user_id = ? AND status = 'accepted' GROUP BY role", (user_id,))}
    for e in rows:
        r = role_of(e["role"])
        e["role_label"] = r["label"] if r else e["name"]
        e["role_label_en"] = role_en(r)["label_en"] if r else e["name"]
        e["docs"], e["knowledge_chars"] = docs.get(e["key"], (0, 0))
        e["lessons"] = lessons.get(e["key"], 0)
    return rows


def get(user_id: str, eid: str) -> dict | None:
    with _db() as c:
        r = c.execute("SELECT * FROM employees WHERE id = ? AND user_id = ?", (eid, user_id)).fetchone()
    return _row(r) if r else None


def save_from_agents(user_id: str, agents: list) -> None:
    """Every catalog role of a new session becomes (or stays) an employee. Existing ones keep their prompt: that one is edited in «Mi
    equipo», never overwritten by a project's tailored persona; only the model they run on and when they were used change."""
    now = time.time()
    with _db() as c:
        for a in agents:
            g = (lambda k, d="": (a.get(k) if isinstance(a, dict) else getattr(a, k, d)) or d)
            if (g("provider") == "mock" and not g("wanted_provider")) or not role_of(g("role") or None):
                continue  # only catalog roles join by themselves (an experiment's characters would be noise); own roles are added in «Mi equipo»
            key = role_key(g("role") or None, g("name"))
            prov = g("wanted_provider") or g("provider")
            model = g("model") if not g("wanted_provider") else ""
            hit = c.execute("SELECT id FROM employees WHERE user_id = ? AND key = ?", (user_id, key)).fetchone()
            if hit:
                c.execute("UPDATE employees SET provider = ?, model = CASE WHEN ? = '' THEN model ELSE ? END, last_used = ?, projects = projects + 1 WHERE id = ?",
                          (prov, model, model, now, hit["id"]))
            else:
                c.execute("INSERT INTO employees (id, user_id, key, role, name, persona, provider, model, skills, created, updated, last_used, projects) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
                          (uuid.uuid4().hex[:12], user_id, key, g("role") or None, g("name") or "Rol", g("persona"), prov, model, json.dumps(list(g("skills", []) or [])), now, now, now))


def create(user_id: str, body: dict) -> dict:
    role = str(body.get("role") or "") or None
    name = (str(body.get("name") or "").strip() or (role_of(role) or {}).get("label") or "Rol")[:80]
    key = role_key(role, name)
    now = time.time()
    with _db() as c:
        if c.execute("SELECT 1 FROM employees WHERE user_id = ? AND key = ?", (user_id, key)).fetchone():
            raise ValueError("Ya tenés ese rol en tu equipo")
        eid = uuid.uuid4().hex[:12]
        c.execute("INSERT INTO employees (id, user_id, key, role, name, persona, provider, model, skills, created, updated, last_used, projects) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, 0)",
                  (eid, user_id, key, role if role_of(role) else None, name, str(body.get("persona") or "")[:20000], str(body.get("provider") or ""), str(body.get("model") or ""), now, now, now))
    return get(user_id, eid) or {}


def update(user_id: str, eid: str, body: dict) -> dict | None:
    e = get(user_id, eid)
    if not e:
        return None
    fields = {k: body[k] for k in ("name", "persona", "provider", "model") if isinstance(body.get(k), str)}
    if isinstance(body.get("skills"), list):
        fields["skills"] = json.dumps([str(s) for s in body["skills"]][:20])
    if "name" in fields:
        fields["name"] = fields["name"].strip()[:80] or e["name"]
        new_key = role_key(e["role"], fields["name"])
        if new_key != e["key"]:  # an own role is keyed by its name: its knowledge and memory move with the new one
            with _db() as c:
                if c.execute("SELECT 1 FROM employees WHERE user_id = ? AND key = ?", (user_id, new_key)).fetchone():
                    raise ValueError("Ya tenés un rol con ese nombre")
                for sql in ("UPDATE employee_docs SET key = ? WHERE user_id = ? AND key = ?", "UPDATE employee_chunks SET key = ? WHERE user_id = ? AND key = ?",
                            "UPDATE role_insights SET role = ? WHERE user_id = ? AND role = ?"):
                    c.execute(sql, (new_key, user_id, e["key"]))
            fields["key"] = new_key
    if "persona" in fields:
        fields["persona"] = fields["persona"][:20000]
    if fields:
        with _db() as c:
            c.execute(f"UPDATE employees SET {', '.join(f'{k} = ?' for k in fields)}, updated = ? WHERE id = ?", (*fields.values(), time.time(), eid))
    return get(user_id, eid)


def delete(user_id: str, eid: str) -> bool:
    e = get(user_id, eid)
    if not e:
        return False
    with _db() as c:
        c.execute("DELETE FROM employees WHERE id = ?", (eid,))
        c.execute("DELETE FROM employee_docs WHERE user_id = ? AND key = ?", (user_id, e["key"]))
        c.execute("DELETE FROM employee_chunks WHERE user_id = ? AND key = ?", (user_id, e["key"]))
    return True


# ---------------------------------------------------------------------------------------------- knowledge (mini RAG)
def _chunks(text: str) -> list[str]:
    """Paragraph-aware pieces of ~CHUNK chars (a long paragraph is cut by sentences, then hard)."""
    out, cur = [], ""
    for para in re.split(r"\n\s*\n", text):
        para = para.strip()
        if not para:
            continue
        pieces = [para] if len(para) <= CHUNK else re.split(r"(?<=[.!?])\s+", para)
        for p in pieces:
            while len(p) > CHUNK:
                out.append(p[:CHUNK])
                p = p[CHUNK:]
            if len(cur) + len(p) + 2 > CHUNK and cur:
                out.append(cur)
                cur = ""
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        out.append(cur)
    return out


def docs(user_id: str, eid: str) -> list[dict] | None:
    e = get(user_id, eid)
    if not e:
        return None
    with _db() as c:
        return [dict(r) for r in c.execute("SELECT id, title, kind, source, chars, preview, created FROM employee_docs WHERE user_id = ? AND key = ? ORDER BY created DESC", (user_id, e["key"]))]


def add_doc(user_id: str, eid: str, title: str, text: str, kind: str, source: str = "") -> dict | None:
    e = get(user_id, eid)
    if not e:
        return None
    text = re.sub(r"[ \t]+\n", "\n", text or "").strip()[:MAX_DOC]
    if not text:
        raise ValueError("No hay texto para guardar")
    did = uuid.uuid4().hex[:12]
    title = (title or "").strip()[:140] or text.split("\n", 1)[0][:80]
    with _db() as c:
        c.execute("INSERT INTO employee_docs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (did, user_id, e["key"], title, kind, source[:500], len(text), text[:240], time.time()))
        c.executemany("INSERT INTO employee_chunks (text, title, user_id, key, doc_id, seq) VALUES (?, ?, ?, ?, ?, ?)",
                      [(ch, title, user_id, e["key"], did, i) for i, ch in enumerate(_chunks(text))])
    return {"id": did, "title": title, "kind": kind, "source": source, "chars": len(text), "preview": text[:240]}


def delete_doc(user_id: str, eid: str, did: str) -> bool:
    e = get(user_id, eid)
    if not e:
        return False
    with _db() as c:
        n = c.execute("DELETE FROM employee_docs WHERE id = ? AND user_id = ? AND key = ?", (did, user_id, e["key"])).rowcount
        c.execute("DELETE FROM employee_chunks WHERE doc_id = ? AND user_id = ?", (did, user_id))
    return bool(n)


def _public_url(url: str) -> bool:
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        return False
    try:
        for info in socket.getaddrinfo(u.hostname, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
                return False
    except (socket.gaierror, ValueError):
        return False
    return True


async def page_text(url: str) -> tuple[str, str]:
    """(title, readable text) of a public web page."""
    if not _public_url(url):
        raise ValueError("Esa dirección no es una página pública")
    async with httpx.AsyncClient(timeout=20, follow_redirects=False, headers={"user-agent": "Mozilla/5.0 (TablyTeam knowledge)"}) as client:
        r = await client.get(url)
        hops = 0
        while r.is_redirect and hops < 4:
            nxt = str(r.next_request.url) if r.next_request else ""
            if not _public_url(nxt):
                raise ValueError("La página redirige a una dirección no pública")
            r, hops = await client.get(nxt), hops + 1
        r.raise_for_status()
    raw = r.text[:2_000_000]
    title = html.unescape((re.search(r"<title[^>]*>(.*?)</title>", raw, re.S | re.I) or [None, url])[1]).strip()[:140]
    body = re.sub(r"(?is)<(script|style|noscript|svg|nav|footer|header)[^>]*>.*?</\1>", " ", raw)
    body = re.sub(r"(?i)<br\s*/?>|</(p|div|li|h[1-6]|tr|section|article)>", "\n", body)
    body = html.unescape(re.sub(r"<[^>]+>", " ", body))
    body = re.sub(r"[ \t\r\f\v]+", " ", body)
    body = re.sub(r"\n\s*\n+", "\n\n", body).strip()
    return title, body


def _terms(query: str) -> str:
    words = [w for w in re.findall(r"[\wáéíóúñü]{4,}", (query or "").lower())][:400]
    seen: list[str] = []
    for w in words:
        if w not in seen:
            seen.append(w)
    return " OR ".join(f'"{w}"' for w in seen[:40])


def knowledge_block(user_id: str, role: str | None, name: str | None, query: str) -> str:
    """What this role knows that matters for the topic (all of it when it is small), for its system prompt."""
    key = role_key(role, name)
    with _db() as c:
        total = c.execute("SELECT COALESCE(SUM(chars), 0) FROM employee_docs WHERE user_id = ? AND key = ?", (user_id, key)).fetchone()[0]
        if not total:
            return ""
        if total <= SMALL_KB:
            rows = c.execute("SELECT title, text FROM employee_chunks WHERE user_id = ? AND key = ? ORDER BY doc_id, CAST(seq AS INTEGER)", (user_id, key)).fetchall()
        else:
            rows, q = [], _terms(query)
            if q:
                try:
                    rows = c.execute("SELECT title, text FROM employee_chunks WHERE employee_chunks MATCH ? AND user_id = ? AND key = ? ORDER BY bm25(employee_chunks) LIMIT 7", (q, user_id, key)).fetchall()
                except Exception:
                    rows = []
            if not rows:  # nothing matched the topic: the start of each document (usually what it is about)
                rows = c.execute("SELECT title, text FROM employee_chunks WHERE user_id = ? AND key = ? AND CAST(seq AS INTEGER) = 0 LIMIT 7", (user_id, key)).fetchall()
            # short notes are standing facts (stack, tone, prices…): they go in whatever the topic, after the matches
            notes = c.execute("SELECT c.title, c.text FROM employee_chunks c JOIN employee_docs d ON d.id = c.doc_id WHERE c.user_id = ? AND c.key = ? AND d.kind = 'note' AND d.chars <= 1500",
                              (user_id, key)).fetchall()
            have = {r["text"] for r in rows}
            rows = list(rows) + [n for n in notes if n["text"] not in have]
    out, used = [], 0
    for r in rows:
        piece = f"[{r['title']}]\n{r['text']}"
        if used + len(piece) > MAX_IN_PROMPT:
            break
        out.append(piece)
        used += len(piece)
    if not out:
        return ""
    return ("CONOCIMIENTO DE TU ROL (lo que el usuario te cargó: datos de su empresa, contexto, documentos; usalo como fuente de verdad "
            "y citá de acá cuando aplique, sin inventar lo que no está):\n" + "\n---\n".join(out) + "\n")
