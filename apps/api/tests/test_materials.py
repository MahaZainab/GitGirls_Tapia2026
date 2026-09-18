import io

import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.materials import html_to_text
from app.main import app

client = TestClient(app)


def test_html_to_text_strips_tags_scripts_and_entities():
    html = "<html><body><script>evil()</script><p>Hello &amp; welcome</p></body></html>"
    assert html_to_text(html) == "Hello & welcome"


def test_ingest_via_pasted_text():
    resp = client.post("/api/materials", data={"title": "Pasted", "text": "One sentence. Two sentences."})
    assert resp.status_code == 202
    body = resp.json()
    assert "passage_id" in body and "job_id" in body
    assert body["job"]["stage"] == "claims"  # segmented fine, stalls without an LLM key


def test_ingest_requires_exactly_one_source():
    resp = client.post("/api/materials", data={"title": "Nothing given"})
    assert resp.status_code == 422

    resp2 = client.post("/api/materials", data={"title": "Two given", "text": "a", "url": "http://example.com"})
    assert resp2.status_code == 422


def test_ingest_via_url_uses_fetch_url_text(monkeypatch):
    monkeypatch.setattr(main, "fetch_url_text", lambda url: "Fetched sentence from a link.")
    resp = client.post("/api/materials", data={"title": "From a link", "url": "https://example.com/article"})
    assert resp.status_code == 202


def test_ingest_via_malformed_pdf_returns_422():
    fake_pdf = io.BytesIO(b"not actually a pdf")
    resp = client.post(
        "/api/materials",
        data={"title": "Bad PDF"},
        files={"file": ("bad.pdf", fake_pdf, "application/pdf")},
    )
    assert resp.status_code == 422
