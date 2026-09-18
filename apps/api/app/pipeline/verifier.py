"""Verifier. FOUNDATION-owned: code checks now, LLM auditor later (section 2.2, 4).

Wraps the reference implementation in `tools/validate_bundle.py` rather than
re-implementing the invariants (section 4 says "extend it rather than
rewriting it"). That script validates a *folder* of JSON files, so this module
writes a candidate bundle to a temp directory and calls it, then turns the
resulting errors/warnings into a `VerificationReport`.

The repair loop (generator -> verifier -> generator, up to 2 rounds) is a GEN
concern; this module only ever produces one report for whatever bundle it's
handed. It does not add an LLM-auditor pass yet -- only the code-check layer
from `tools/validate_bundle.py` runs today, so nothing here should ever
produce a `Check` with `layer: "auditor"`.
"""
from __future__ import annotations

import importlib.util
import json
import tempfile
from pathlib import Path
from typing import Optional

from app.models import Check, VerificationReport

_REPO_ROOT = Path(__file__).resolve().parents[4]
_VALIDATE_BUNDLE_PATH = _REPO_ROOT / "tools" / "validate_bundle.py"


def _load_validate_bundle():
    spec = importlib.util.spec_from_file_location("validate_bundle", _VALIDATE_BUNDLE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


_validate_bundle = _load_validate_bundle()


def verify_bundle(
    source: dict,
    claims: dict,
    summary: dict,
    flow: dict,
    animation: dict,
    preferences_regular: Optional[dict] = None,
    preferences_focus: Optional[dict] = None,
) -> VerificationReport:
    """Run the reference validator over one candidate bundle and report the result."""
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        (folder / "source.json").write_text(json.dumps(source), encoding="utf-8")
        (folder / "claims.json").write_text(json.dumps(claims), encoding="utf-8")
        (folder / "summary.json").write_text(json.dumps(summary), encoding="utf-8")
        (folder / "flow.json").write_text(json.dumps(flow), encoding="utf-8")
        (folder / "animation.json").write_text(json.dumps(animation), encoding="utf-8")
        if preferences_regular is not None:
            (folder / "preferences.regular.json").write_text(
                json.dumps(preferences_regular), encoding="utf-8"
            )
        if preferences_focus is not None:
            (folder / "preferences.focus.json").write_text(
                json.dumps(preferences_focus), encoding="utf-8"
            )
        rep = _validate_bundle.validate(str(folder))

    checks = [
        Check(name=msg, layer="code", status="fail", detail=msg) for msg in rep.errors
    ] + [
        Check(name=msg, layer="code", status="warn", detail=msg) for msg in rep.warnings
    ]
    if rep.errors:
        status = "failed"
    elif rep.warnings:
        status = "needs_human"
    else:
        status = "passed"
    return VerificationReport(status=status, checks=checks)
