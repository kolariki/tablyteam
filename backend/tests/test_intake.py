"""Intake: attachments → analyst (mock) → questions → answers → final Markdown prompt."""
import asyncio
import io
import zipfile

from app import intake as intakemod
from app.auth import User


def _user():
    return User(id="intaketest", email="i@t.test", name="i")


def test_attachments_and_digest():
    it = intakemod.create(_user())
    it.add_upload("docs/brief.md", "# Idea\nUna app de alertas sísmicas".encode())
    it.add_upload("logo.png", b"\x89PNG\r\n")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("proj/src/app.py", "print('hola')")
        z.writestr("proj/node_modules/x.js", "skip me")
        z.writestr("proj/README.md", "readme")
    it.add_upload("proj.zip", buf.getvalue())
    names = [a.name for a in it.attachments]
    assert "docs/brief.md" in names and "logo.png" in names and "proj/src/app.py" in names and "proj/README.md" in names
    assert not any("node_modules" in n for n in names)
    kinds = {a.name: a.kind for a in it.attachments}
    assert kinds["logo.png"] == "binary" and kinds["docs/brief.md"] == "text"
    d = it.digest()
    assert "alertas sísmicas" in d and "print('hola')" in d
    assert it.remove(it.attachments[0].id) and "docs/brief.md" not in [a.name for a in it.attachments]


def test_mock_run_questions_then_prompt():
    asyncio.run(_run_mock())


async def _run_mock():
    it = intakemod.create(_user())
    it.add_upload("notas.txt", b"Queremos datos del INPRES")
    q = it.subscribe()
    it.start("Una app de alertas de sismos para Argentina", "mock", "mock-1", None)
    types = []
    for _ in range(400):
        ev = await asyncio.wait_for(q.get(), 5)
        types.append(ev["type"])
        if ev["type"] == "questions":
            assert it.status == "waiting" and len(it.questions) == 2
            it.answer({it.questions[0].id: "Web", it.questions[1].id: "Reales"})
        if ev["type"] in ("done", "error"):
            break
    assert "reading" in types and "delta" in types and "questions" in types and "done" in types
    assert it.status == "done" and it.prompt_md.startswith("# ") and "Web" in it.prompt_md and "## Criterios de aceptación" in it.prompt_md
    snap = it.snapshot()
    assert snap["rounds"] == 1 and snap["context_chars"] > 0
