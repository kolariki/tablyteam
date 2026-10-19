from app.builder import _parse_review
from app.deploy import classify, parse_env_example, services_for
from app.orchestrator import parse_tags


def test_parse_tags_accepts_reflexion_and_thinking():
    p = parse_tags("<reflexion>veo</reflexion><message>hola</message><stance>agree</stance><confidence>80</confidence><next>b</next>")
    assert p["thinking"] == "veo" and p["message"] == "hola" and p["next"] == "b"
    assert parse_tags("<thinking>x</thinking><message>y</message>")["thinking"] == "x"


def test_parse_tags_without_tags_falls_back_to_plain_text():
    assert parse_tags("sin etiquetas")["message"] == "sin etiquetas"


def test_parse_review_modes():
    r = _parse_review("<verdict>changes</verdict><findings>- [bloqueante] x</findings><requests>1. hacé y</requests>", "review")
    assert r["verdict"] == "changes" and r["requests"].startswith("1.")
    assert _parse_review("<verdict>changes</verdict><requests></requests>", "review")["verdict"] == "approve"
    a = _parse_review("<score>7,5</score><strengths>ok</strengths><findings>f</findings><requests>p</requests>", "audit")
    assert a["score"] == 7.5 and a["verdict"] == "changes" and a["strengths"] == "ok"


def test_env_example_parsing_and_catalogue():
    env = parse_env_example("# db\nDATABASE_URL=postgres://x # conexión\nSTRIPE_SECRET_KEY=\nexport PORT=3000\n")
    assert [e["var"] for e in env] == ["DATABASE_URL", "STRIPE_SECRET_KEY", "PORT"]
    assert "conexión" in env[0]["note"]
    assert classify("STRIPE_SECRET_KEY")["service"] == "Stripe"
    assert classify("NEXT_PUBLIC_SUPABASE_URL")["service"] == "Supabase"


def test_services_for_merges_brief_and_marks_missing():
    files = {".env.example": "DATABASE_URL=\nPORT=3000\n", "package.json": '{"dependencies":{"next":"15"}}'}
    brief = "### 6.1 Cuentas\n| Servicio | Para qué | Dónde | Variable | Costo |\n|---|---|---|---|---|\n| Sentry | errores | https://sentry.io | SENTRY_DSN | Free |\n### 6.2\n"
    d = services_for(files, brief, {"DATABASE_URL"})
    assert "SENTRY_DSN" in [i["var"] for i in d["items"]]
    assert d["missing"] == ["SENTRY_DSN"] and d["recommended_target"] == "vercel"
