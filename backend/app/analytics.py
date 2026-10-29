"""Tably Analytics, the detailed view: who visits a published app, from where, on what, and what they do there.

Privacy by design: no cookies, no IP stored or looked up. The visitor id is a random string kept in the browser; the country
comes from the browser's time zone (or the region of its language); clicks record the label of what was tapped, never what
was typed. Names and emails only exist when the app itself identifies its signed-in user with `tably.identify({...})`.
"""
from __future__ import annotations

import json
import re
import time
from urllib.parse import urlparse

from .auth import _db

with _db() as _c:
    cols = [r[1] for r in _c.execute("PRAGMA table_info(analytics_hits)")]
    for col in ("vid", "country", "device", "os", "browser", "lang", "tz", "screen", "props"):
        if col not in cols:
            _c.execute(f"ALTER TABLE analytics_hits ADD COLUMN {col} TEXT")
    _c.execute("CREATE INDEX IF NOT EXISTS analytics_hits_vid ON analytics_hits (site, vid)")
    _c.execute(
        """CREATE TABLE IF NOT EXISTS analytics_people (
            site TEXT NOT NULL, vid TEXT NOT NULL, email TEXT, name TEXT, ext_id TEXT, props TEXT,
            first_seen REAL NOT NULL, last_seen REAL NOT NULL, PRIMARY KEY (site, vid))"""
    )

# time zone → country (the common ones; anything else falls back to the language's region)
TZ_COUNTRY = {
    "America/Argentina": "AR", "America/Buenos_Aires": "AR", "America/Cordoba": "AR", "America/Mendoza": "AR",
    "America/Montevideo": "UY", "America/Santiago": "CL", "America/Asuncion": "PY", "America/La_Paz": "BO", "America/Lima": "PE",
    "America/Bogota": "CO", "America/Caracas": "VE", "America/Guayaquil": "EC", "America/Sao_Paulo": "BR", "America/Fortaleza": "BR",
    "America/Recife": "BR", "America/Bahia": "BR", "America/Manaus": "BR", "America/Belem": "BR", "America/Mexico_City": "MX",
    "America/Monterrey": "MX", "America/Tijuana": "MX", "America/Cancun": "MX", "America/Merida": "MX", "America/Chihuahua": "MX",
    "America/Guatemala": "GT", "America/El_Salvador": "SV", "America/Tegucigalpa": "HN", "America/Managua": "NI", "America/Costa_Rica": "CR",
    "America/Panama": "PA", "America/Havana": "CU", "America/Santo_Domingo": "DO", "America/Puerto_Rico": "PR",
    "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US", "America/Phoenix": "US",
    "America/Anchorage": "US", "America/Detroit": "US", "America/Indiana": "US", "America/Kentucky": "US", "Pacific/Honolulu": "US",
    "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
    "America/St_Johns": "CA", "America/Regina": "CA", "Europe/Madrid": "ES", "Atlantic/Canary": "ES", "Europe/Lisbon": "PT",
    "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Rome": "IT", "Europe/Amsterdam": "NL",
    "Europe/Brussels": "BE", "Europe/Zurich": "CH", "Europe/Vienna": "AT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO",
    "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
    "Europe/Athens": "GR", "Europe/Bucharest": "RO", "Europe/Kiev": "UA", "Europe/Kyiv": "UA", "Europe/Istanbul": "TR",
    "Europe/Moscow": "RU", "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW",
    "Asia/Singapore": "SG", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE", "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL",
    "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Kuala_Lumpur": "MY",
    "Asia/Karachi": "PK", "Asia/Riyadh": "SA", "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
    "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ", "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG",
    "Africa/Cairo": "EG", "Africa/Nairobi": "KE", "Africa/Casablanca": "MA",
}


def country_of(tz: str | None, lang: str | None) -> str | None:
    if tz:
        if tz in TZ_COUNTRY:
            return TZ_COUNTRY[tz]
        for prefix, cc in TZ_COUNTRY.items():
            if tz.startswith(prefix + "/"):
                return cc
    m = re.match(r"^[a-z]{2,3}[-_]([A-Za-z]{2})\b", lang or "")
    return m.group(1).upper() if m else None


def parse_ua(ua: str, screen_w: int | None = None) -> tuple[str, str, str]:
    """(device, os, browser) from the user agent; good enough for a dashboard, no fingerprinting."""
    u = ua or ""
    if re.search(r"bot|crawl|spider|slurp|preview|headless", u, re.I):
        device = "bot"
    elif re.search(r"iPad|Tablet|Nexus 7|Nexus 10|SM-T|Kindle|Silk", u) or (re.search(r"Android", u) and not re.search(r"Mobile", u)):
        device = "tablet"
    elif re.search(r"Mobi|iPhone|iPod|Android.*Mobile|Windows Phone", u):
        device = "mobile"
    else:
        device = "desktop" if not screen_w or screen_w >= 900 else "mobile" if screen_w < 600 else "tablet"
    os_ = ("iOS" if re.search(r"iPhone|iPad|iPod", u) else "Android" if "Android" in u else "Windows" if "Windows" in u
           else "macOS" if "Mac OS X" in u or "Macintosh" in u else "ChromeOS" if "CrOS" in u else "Linux" if "Linux" in u else "Otro")
    br = ("Edge" if "Edg/" in u else "Opera" if "OPR/" in u or "Opera" in u else "Samsung Internet" if "SamsungBrowser" in u
          else "Chrome" if "Chrome/" in u or "CriOS" in u else "Firefox" if "Firefox/" in u or "FxiOS" in u
          else "Safari" if "Safari/" in u else "Otro")
    return device, os_, br


def enrich(body: dict, ua: str | None) -> dict:
    """The extra columns of one hit."""
    try:
        w = int(str(body.get("w") or "0").split("x")[0] or 0)
    except ValueError:
        w = 0
    device, os_, br = parse_ua(ua or "", w or None)
    tz, lang = (str(body.get("tz") or "")[:60] or None), (str(body.get("l") or "")[:20] or None)
    props = body.get("props") if isinstance(body.get("props"), dict) else None
    return {"vid": str(body.get("v") or "")[:16] or None, "country": country_of(tz, lang), "device": device, "os": os_, "browser": br,
            "lang": lang, "tz": tz, "screen": str(body.get("w") or "")[:12] or None,
            "props": json.dumps({k: str(v)[:120] for k, v in list(props.items())[:12]}) if props else None}


def identify(site: str, vid: str | None, props: dict | None) -> None:
    if not vid or not isinstance(props, dict):
        return
    email = str(props.get("email") or "")[:160] or None
    name = str(props.get("name") or "")[:120] or None
    ext = str(props.get("id") or "")[:80] or None
    extra = {k: str(v)[:120] for k, v in list(props.items())[:12] if k not in ("email", "name", "id")}
    now = time.time()
    with _db() as c:
        c.execute("""INSERT INTO analytics_people (site, vid, email, name, ext_id, props, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(site, vid) DO UPDATE SET email = COALESCE(excluded.email, email), name = COALESCE(excluded.name, name),
                     ext_id = COALESCE(excluded.ext_id, ext_id), props = COALESCE(excluded.props, props), last_seen = excluded.last_seen""",
                  (site, vid, email, name, ext, json.dumps(extra) if extra else None, now, now))


def _top(c, sql: str, args: tuple, limit: int = 8) -> list[dict]:
    return [{"key": k if k not in (None, "") else "—", "n": n} for k, n in c.execute(sql + f" LIMIT {limit}", args)]


def detail(site: str, days: int = 30, own_host: str | None = None) -> dict:
    """Everything the detail page shows for one app over the last `days` days."""
    now = time.time()
    since = now - days * 86400
    who = "COALESCE(vid, sid, ua)"
    with _db() as c:
        k = c.execute(f"""SELECT COUNT(DISTINCT CASE WHEN kind = 'pageview' THEN {who} END), COUNT(DISTINCT CASE WHEN kind = 'pageview' THEN sid END),
                          SUM(kind = 'pageview'), SUM(kind = 'event'), SUM(kind = 'click'), SUM(kind = 'error')
                          FROM analytics_hits WHERE site = ? AND ts >= ?""", (site, since)).fetchone()
        visitors, sessions, pageviews, events, clicks, errors = [x or 0 for x in k]
        days_rows = c.execute(f"""SELECT date(ts, 'unixepoch') d, COUNT(DISTINCT {who}), COUNT(*), COUNT(DISTINCT sid)
                                  FROM analytics_hits WHERE site = ? AND kind = 'pageview' AND ts >= ? GROUP BY d ORDER BY d""", (site, since)).fetchall()
        base = "FROM analytics_hits WHERE site = ? AND ts >= ?"
        pv = f"{base} AND kind = 'pageview'"
        countries = _top(c, f"SELECT country, COUNT(DISTINCT {who}) n {pv} GROUP BY country ORDER BY n DESC", (site, since), 12)
        devices = _top(c, f"SELECT device, COUNT(DISTINCT {who}) n {pv} GROUP BY device ORDER BY n DESC", (site, since))
        oses = _top(c, f"SELECT os, COUNT(DISTINCT {who}) n {pv} GROUP BY os ORDER BY n DESC", (site, since))
        browsers = _top(c, f"SELECT browser, COUNT(DISTINCT {who}) n {pv} GROUP BY browser ORDER BY n DESC", (site, since))
        pages = _top(c, f"SELECT path, COUNT(*) n {pv} GROUP BY path ORDER BY n DESC", (site, since), 10)
        clicks_top = _top(c, f"SELECT name, COUNT(*) n {base} AND kind = 'click' GROUP BY name ORDER BY n DESC", (site, since), 12)
        events_top = _top(c, f"SELECT name, COUNT(*) n {base} AND kind = 'event' GROUP BY name ORDER BY n DESC", (site, since), 12)
        errors_top = _top(c, f"SELECT name, COUNT(*) n {base} AND kind = 'error' GROUP BY name ORDER BY n DESC", (site, since), 8)
        refs: dict[str, int] = {}
        for ref, n in c.execute(f"SELECT ref, COUNT(*) {pv} GROUP BY ref", (site, since)):
            host = (urlparse(ref).hostname or "") if ref else ""
            host = host.removeprefix("www.")
            key = "Directo" if not host or (own_host and host == own_host.removeprefix("www.")) else host
            refs[key] = refs.get(key, 0) + n
        referrers = [{"key": key, "n": n} for key, n in sorted(refs.items(), key=lambda x: -x[1])[:10]]
        # people: identified users first, then the most recent anonymous visitors
        people = []
        rows = c.execute(f"""SELECT {who} w, MIN(ts), MAX(ts), SUM(kind = 'pageview'), SUM(kind IN ('event', 'click')), MAX(country), MAX(device), MAX(os), MAX(browser), COUNT(DISTINCT sid)
                            FROM analytics_hits WHERE site = ? AND ts >= ? AND kind != 'ping' GROUP BY w ORDER BY MAX(ts) DESC LIMIT 200""", (site, since)).fetchall()
        named = {r["vid"]: dict(r) for r in c.execute("SELECT * FROM analytics_people WHERE site = ?", (site,))}
        for w, first, last, pvs, acts, cc, dev, os_, br, sess in rows:
            p = named.get(w) or {}
            people.append({"id": w, "email": p.get("email"), "name": p.get("name"), "first_seen": first, "last_seen": last, "pageviews": pvs or 0,
                           "actions": acts or 0, "sessions": sess or 0, "country": cc, "device": dev, "os": os_, "browser": br})
        people.sort(key=lambda x: (not (x["email"] or x["name"]), -x["last_seen"]))
        identified = sum(1 for p in people if p["email"] or p["name"])
        live = [{"path": path, "country": cc, "device": dev, "ts": ts} for _s, path, ts, cc, dev in c.execute(
            "SELECT sid, path, MAX(ts), country, device FROM analytics_hits WHERE site = ? AND sid IS NOT NULL AND ts >= ? GROUP BY sid ORDER BY MAX(ts) DESC LIMIT 20", (site, now - 120))]
    by_day = {d: {"visitors": v, "pageviews": p, "sessions": s} for d, v, p, s in days_rows}
    series = []
    for i in range(days - 1, -1, -1):
        d = time.strftime("%Y-%m-%d", time.gmtime(now - i * 86400))
        series.append({"day": d, **by_day.get(d, {"visitors": 0, "pageviews": 0, "sessions": 0})})
    return {
        "site": site, "days": days,
        "kpis": {"visitors": visitors, "sessions": sessions, "pageviews": pageviews, "pages_per_session": round(pageviews / sessions, 1) if sessions else 0,
                 "events": events, "clicks": clicks, "errors": errors, "identified": identified, "live": len(live)},
        "series": series, "countries": countries, "devices": devices, "os": oses, "browsers": browsers, "referrers": referrers,
        "pages": pages, "clicks": clicks_top, "events": events_top, "errors": errors_top, "people": people[:100], "live": live,
    }
