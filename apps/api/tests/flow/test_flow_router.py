import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.generators.flow.router import router
from app.models import FlowGraph
from app.store import get_store


@pytest.fixture
def client():
    store = get_store()
    original = store.flows.get("iam-01")
    app = FastAPI()
    app.include_router(router)
    yield TestClient(app)
    store.flows["iam-01"] = original  # the store is a shared singleton; leave it as we found it


def test_generate_builds_from_the_txt_and_stores_it(client):
    res = client.post("/api/passages/iam-01/flow/generate")
    assert res.status_code == 200
    body = res.json()
    assert body["verification"]["status"] == "needs_human"
    assert get_store().flows["iam-01"] == body
    FlowGraph.model_validate(body)  # the API's own model accepts what we generate


def test_unknown_passage_is_404(client):
    assert client.post("/api/passages/nope/flow/generate").status_code == 404


def test_passage_without_a_summary_file_is_built_from_its_text(client, monkeypatch, tmp_path):
    monkeypatch.setenv("STUDYSHIFT_FLOW_SUMMARIES_DIR", str(tmp_path))  # an empty folder: no iam-01.txt
    res = client.post("/api/passages/iam-01/flow/generate")
    assert res.status_code == 200
    assert any(c["name"] == "built_from_text_rules" for c in res.json()["verification"]["checks"])


def test_a_bad_summary_returns_422_with_line_numbers(client, monkeypatch, tmp_path):
    (tmp_path / "iam-01.txt").write_text("a start: Begin | C1\nwhat is this\n", encoding="utf-8")
    monkeypatch.setenv("STUDYSHIFT_FLOW_SUMMARIES_DIR", str(tmp_path))
    res = client.post("/api/passages/iam-01/flow/generate")
    assert res.status_code == 422
    assert any("line 2" in p for p in res.json()["detail"]["problems"])


def test_bad_max_nodes_is_422(client):
    assert client.post("/api/passages/iam-01/flow/generate?max_nodes=1").status_code == 422
