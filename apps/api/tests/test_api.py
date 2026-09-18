from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_seeded_fixture_source():
    resp = client.get("/api/passages/iam-01/source")
    assert resp.status_code == 200
    assert resp.json()["passage_id"] == "iam-01"


def test_get_seeded_fixture_summary_flow_animation():
    for path in ("summary", "flow", "animation", "claims"):
        resp = client.get(f"/api/passages/iam-01/{path}")
        assert resp.status_code == 200, path


def test_unknown_passage_404s():
    resp = client.get("/api/passages/does-not-exist/source")
    assert resp.status_code == 404


def test_create_passage_segments_then_fails_at_claims_without_an_llm_key():
    resp = client.post("/api/passages", json={"title": "A test", "text": "One sentence. Two sentences."})
    assert resp.status_code == 202
    body = resp.json()
    assert "passage_id" in body and "job_id" in body

    job = client.get(f"/api/jobs/{body['job_id']}").json()
    assert job["status"] == "failed"
    assert job["stage"] == "claims"
    assert "LLM_API_KEY" in job["error"]

    # Segmenting itself succeeded even though the pipeline stalls at claims.
    source_resp = client.get(f"/api/passages/{body['passage_id']}/source")
    assert source_resp.status_code == 200


def test_preferences_round_trip_and_validation():
    prefs = client.get("/api/me/preferences").json()
    assert prefs["mode"] == "regular"

    prefs["mode"] = "focus"
    put_resp = client.put("/api/me/preferences", json=prefs)
    assert put_resp.status_code == 200
    assert put_resp.json()["mode"] == "focus"

    get_resp = client.get("/api/me/preferences")
    assert get_resp.json()["mode"] == "focus"

    bad = dict(prefs)
    bad["display"]["text_scale"] = 99  # out of [0.9, 1.6]
    bad_resp = client.put("/api/me/preferences", json=bad)
    assert bad_resp.status_code == 422
