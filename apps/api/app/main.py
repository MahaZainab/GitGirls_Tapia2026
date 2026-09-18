"""StudyShift Content and Preferences API. FOUNDATION-owned (spec section 2.2/2.6).

Implements the API surface from spec section 3.2. `/summary`, `/flow` and
`/animation` are backed by generator packages that are still stubs (F1/F2/F3
GEN track, see `app/generators/*`) -- until those are implemented, this serves
the `fixtures/iam-01` bundle for `passage_id == "iam-01"` and 404s for
anything else, which is enough for feature UI agents to integration-test
against a real backend if they want one (the primary dev path is still the
frontend mock API client, per A-04).
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.materials import fetch_url_text, extract_pdf_text
from app.models import AnimationScript, ClaimList, FlowGraph, Source, SummaryBundle, UserPreferences
from app.preferences import get_store as get_preferences_store
from app.store import get_store

# Auth is stubbed for every feature (assumption A3): one fixed user.
STUB_USER_ID = "demo-user"

app = FastAPI(title="StudyShift Content and Preferences API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreatePassageRequest(BaseModel):
    title: str = Field(min_length=1)
    text: str = Field(min_length=1)


@app.post("/api/passages", status_code=202)
def create_passage(body: CreatePassageRequest) -> dict:
    passage_id, job_id = get_store().create_passage(body.title, body.text)
    return {"passage_id": passage_id, "job_id": job_id}


@app.post("/api/materials", status_code=202)
async def ingest_material(
    title: str = Form(..., min_length=1),
    text: Optional[str] = Form(default=None),
    url: Optional[str] = Form(default=None),
    file: Optional[UploadFile] = File(default=None),
) -> dict:
    """Add material by pasting text, giving a link, or uploading a PDF (spec
    section 6, G5). Extracts raw text, then runs it through the same
    segmenter/claims pipeline as `POST /api/passages`. Not in spec section
    3.2 -- see `app/materials.py` docstring.
    """
    provided = [name for name, value in (("text", text), ("url", url), ("file", file)) if value]
    if len(provided) != 1:
        raise HTTPException(status_code=422, detail="provide exactly one of: text, url, file")

    if text is not None:
        raw_text = text
    elif url is not None:
        raw_text = fetch_url_text(url)
    else:
        assert file is not None
        raw_text = extract_pdf_text(await file.read())

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="no text could be extracted from the given material")

    store = get_store()
    passage_id, job_id = store.create_passage(title, raw_text)
    return {"passage_id": passage_id, "job_id": job_id, "job": store.get_job(job_id)}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = get_store().get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="unknown job_id")
    return job


@app.get("/api/passages/{passage_id}/source", response_model=Source)
def get_source(passage_id: str) -> Source:
    source = get_store().sources.get(passage_id)
    if source is None:
        raise HTTPException(status_code=404, detail="unknown passage_id")
    return source


@app.get("/api/passages/{passage_id}/claims", response_model=ClaimList)
def get_claims(passage_id: str) -> ClaimList:
    claim_list = get_store().claims.get(passage_id)
    if claim_list is None:
        raise HTTPException(
            status_code=404,
            detail="claims not available for this passage (claim extraction needs an LLM; see app/pipeline/claims.py)",
        )
    return claim_list


@app.get("/api/passages/{passage_id}/summary", response_model=SummaryBundle)
def get_summary(passage_id: str) -> SummaryBundle:
    raw = get_store().summaries.get(passage_id)
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail="summary not available (F1 GEN generator not implemented yet; see app/generators/summary)",
        )
    return SummaryBundle.model_validate(raw)


@app.get("/api/passages/{passage_id}/flow", response_model=FlowGraph)
def get_flow(passage_id: str) -> FlowGraph:
    raw = get_store().flows.get(passage_id)
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail="flow not available (F2 GEN generator not implemented yet; see app/generators/flow)",
        )
    return FlowGraph.model_validate(raw)


@app.get("/api/passages/{passage_id}/animation", response_model=AnimationScript)
def get_animation(passage_id: str) -> AnimationScript:
    raw = get_store().animations.get(passage_id)
    if raw is None:
        raise HTTPException(
            status_code=404,
            detail="animation not available (F3 GEN generator not implemented yet; see app/generators/animation)",
        )
    return AnimationScript.model_validate(raw)


@app.get("/api/me/preferences", response_model=UserPreferences)
def get_preferences() -> UserPreferences:
    return get_preferences_store().get(STUB_USER_ID)


@app.put("/api/me/preferences", response_model=UserPreferences)
def put_preferences(body: UserPreferences) -> UserPreferences:
    return get_preferences_store().put(STUB_USER_ID, body)
