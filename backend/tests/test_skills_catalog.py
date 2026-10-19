"""Skills catalog: index, search by text/category, suggestions for a task, and catalog ids resolving into prompts."""
import pytest

from app import skills as skillmod
from app import skills_catalog as c

SKILLS = {
    "anthropics--skills/skills/pdf/SKILL.md": "---\nname: pdf\ndescription: Read, merge and fill PDF documents and forms\n---\n# PDF\nUse pypdf to merge PDFs…\n",
    "anthropics--skills/skills/webapp-testing/SKILL.md": "---\nname: webapp-testing\ndescription: Test web apps end to end with Playwright\n---\n# Testing\nRun playwright…\n",
    "acme--seo/seo-audit/SKILL.md": "---\nname: seo-audit\ndescription: Audit a landing page for SEO and marketing copy\n---\n# SEO\nCheck titles…\n",
}


@pytest.fixture
def catalog(tmp_path, monkeypatch):
    src = tmp_path / "sources"
    for rel, text in SKILLS.items():
        f = src / rel
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(text)
    (src / "anthropics--skills/skills/pdf/scripts").mkdir()
    (src / "anthropics--skills/skills/pdf/scripts/merge.py").write_text("print('merge')")
    monkeypatch.setattr(c, "ROOT", tmp_path)
    monkeypatch.setattr(c, "SOURCES_DIR", src)
    monkeypatch.setattr(c, "INDEX_PATH", tmp_path / "index.json")
    monkeypatch.setattr(c, "_cache", None)
    return c.build_index()


def test_catalog_index_search_and_suggest(catalog):
    assert len(catalog) == 3
    assert all(s["id"].startswith("cat-") and s["category"] in c.CATEGORY_LABELS for s in catalog)
    by = {s["slug"]: s for s in catalog}
    assert by["pdf"]["category"] == "docs" and by["webapp-testing"]["category"] == "qa" and by["seo-audit"]["category"] == "growth"
    assert by["pdf"]["source"] == "Anthropic (oficial)" and by["seo-audit"]["source"] == "acme/seo"
    cats = c.categories()
    assert sum(x["count"] for x in cats) == 3
    assert [h["slug"] for h in c.search("pdf")] == ["pdf"]
    assert [h["slug"] for h in c.search("", category="qa")] == ["webapp-testing"]
    sug = c.suggest("Una app web con tests end to end con Playwright", k=2, role_group="qa")
    assert sug[0]["slug"] == "webapp-testing" and sug[0]["score"] > 0


def test_catalog_skill_resolves_into_prompt_block(catalog):
    sid = next(s["id"] for s in catalog if s["slug"] == "pdf")
    body = c.body(sid)
    assert body and "pypdf" in body and "scripts/merge.py" in body
    block = skillmod.prompt_block("nobody", [sid])
    assert "SKILLS CARGADAS" in block and "pypdf" in block
