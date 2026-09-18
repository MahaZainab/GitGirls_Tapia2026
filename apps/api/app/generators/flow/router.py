"""POST /api/passages/{id}/flow/generate: build the flow for a passage. No model is called.

If the passage has a hand-written summary it is used; otherwise the flow is built from the passage
text itself (prose.py), which is what happens for text pasted into Add material. Summaries live in `summaries/<passage_id>.txt` (or the folder named by
STUDYSHIFT_FLOW_SUMMARIES_DIR). `GET /api/passages/{id}/flow` already lives in app.main and serves
`store.flows`, so this only writes there. app.main mounts it with one line:
    from app.generators.flow.router import router as flow_router; app.include_router(flow_router)
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from app.store import get_store

from app.models import ClaimList

from .generator import FlowTxtError, flow_from_txt
from .prose import ProseError, flow_from_prose

router = APIRouter(prefix="/api/passages", tags=["flow"])

PASSAGE_ID = re.compile(r"^[\w-]+$")


def summaries_dir() -> Path:
    return Path(os.environ.get("STUDYSHIFT_FLOW_SUMMARIES_DIR", Path(__file__).parent / "summaries"))


@router.post("/{passage_id}/flow/generate")
def generate(passage_id: str, max_nodes: int | None = Query(default=None, ge=2, le=60)) -> dict:
    """Build the flow for a passage: from its hand-written summary if there is one, else from the text itself."""
    store = get_store()
    source = store.sources.get(passage_id)
    if source is None:
        raise HTTPException(404, "Unknown passage.")
    claims = store.claims.get(passage_id)
    path = summaries_dir() / f"{passage_id}.txt"
    src = source.model_dump(by_alias=True)
    try:
        if claims is not None and PASSAGE_ID.match(passage_id) and path.is_file():
            flow = flow_from_txt(path.read_text(encoding="utf-8"), src, claims.model_dump(by_alias=True), max_nodes=max_nodes)
        else:
            flow, used = flow_from_prose(src, claims.model_dump(by_alias=True) if claims else None)
            if claims is None:
                # Claim extraction needs a model, so it has not run. Keep the per-sentence claims the flow cites
                # so GET /claims and the flowchart's detail panel can show them.
                store.claims[passage_id] = ClaimList.model_validate(used)
    except FlowTxtError as exc:
        raise HTTPException(422, {"message": f"{path.name} has problems to fix.", "problems": exc.problems}) from exc
    except ProseError as exc:
        raise HTTPException(422, {"message": str(exc), "problems": []}) from exc
    if flow["verification"]["status"] == "failed":
        problems = [c["detail"] for c in flow["verification"]["checks"] if c["status"] == "fail"]
        raise HTTPException(422, {"message": "The flowchart did not pass the flowchart rules.", "problems": problems})
    store.flows[passage_id] = flow
    return flow
