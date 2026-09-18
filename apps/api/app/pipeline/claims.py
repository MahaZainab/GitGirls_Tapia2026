"""Claim extractor. FOUNDATION-owned, backend + LLM (spec section 2.2).

Turns a `Source` into a `ClaimList`: atomic statements, each anchored to a
verbatim quote (V-ANCH-01/02 in section 4). The real implementation calls an
OpenAI-compatible endpoint configured via `LLM_BASE_URL` / `LLM_API_KEY` /
`LLM_MODEL` (spec section 2.4) and MUST verify its own anchors before
returning, since the generators and verifier downstream assume claims are
already anchor-clean.

No LLM is wired up yet -- feature agents are not expected to exercise this
path (spec A-04: work against `fixtures/iam-01` with no LLM key). Calling
`extract_claims` without `LLM_API_KEY` set raises `ClaimExtractionUnavailable`
so callers fail loudly instead of silently returning bad data.
"""
from __future__ import annotations

import os

from app.models import ClaimList, Source


class ClaimExtractionUnavailable(RuntimeError):
    """Raised when claim extraction is requested but no LLM is configured."""


def extract_claims(source: Source) -> ClaimList:
    if not os.environ.get("LLM_API_KEY"):
        raise ClaimExtractionUnavailable(
            "Claim extraction requires LLM_BASE_URL/LLM_API_KEY/LLM_MODEL to be "
            "set. Develop against the fixtures/iam-01 bundle instead (see "
            "agent-documents/StudyShift_Agent_Spec.md, rule A-04)."
        )
    raise NotImplementedError(
        "LLM-backed claim extraction is not implemented yet. Wire a call to "
        "LLM_BASE_URL here, then verify every returned anchor with "
        "app.pipeline.verifier before returning."
    )
