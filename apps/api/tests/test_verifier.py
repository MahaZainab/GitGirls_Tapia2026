import json
from pathlib import Path

from app.pipeline.verifier import verify_bundle

FIXTURE_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "iam-01"


def _load(name: str) -> dict:
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


def test_iam01_fixture_needs_human_but_has_no_errors():
    report = verify_bundle(
        source=_load("source.json"),
        claims=_load("claims.json"),
        summary=_load("summary.json"),
        flow=_load("flow.json"),
        animation=_load("animation.json"),
        preferences_regular=_load("preferences.regular.json"),
        preferences_focus=_load("preferences.focus.json"),
    )
    assert report.status == "needs_human"  # fixture has one implied edge (E4)
    assert all(c.status != "fail" for c in report.checks)
    assert any(c.status == "warn" for c in report.checks)


def test_bad_anchor_is_reported_as_a_failure():
    source = _load("source.json")
    claims = _load("claims.json")
    claims["claims"][0]["anchor"]["quote"] = "this quote does not exist in the source"
    report = verify_bundle(
        source=source,
        claims=claims,
        summary=_load("summary.json"),
        flow=_load("flow.json"),
        animation=_load("animation.json"),
    )
    assert report.status == "failed"
    assert any("V-ANCH-01" in c.name for c in report.checks)
