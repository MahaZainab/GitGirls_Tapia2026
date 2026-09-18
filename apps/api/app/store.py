"""In-memory content store + job bookkeeping. FOUNDATION-owned.

Not persistent, single-process. Good enough for local dev and for feature
agents that need a real backend to hit (most don't -- see A-04, the frontend
mock API client is the primary dev harness). Seeded at startup with the
`fixtures/iam-01` bundle so `GET /api/passages/iam-01/*` always works.
"""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from threading import Lock
from typing import Dict, Optional, TypedDict

from app.models import ClaimList, Source
from app.pipeline import claims as claims_pipeline
from app.pipeline.segmenter import segment

_REPO_ROOT = Path(__file__).resolve().parents[3]
_FIXTURE_DIR = _REPO_ROOT / "fixtures" / "iam-01"


class JobStatus(TypedDict):
    status: str  # queued | running | done | failed
    stage: str
    error: Optional[str]
    passage_id: str


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "passage"


class Store:
    def __init__(self) -> None:
        self._lock = Lock()
        self.sources: Dict[str, Source] = {}
        self.claims: Dict[str, ClaimList] = {}
        # Raw JSON for artifacts FOUNDATION doesn't generate itself (GEN-owned).
        self.summaries: Dict[str, dict] = {}
        self.flows: Dict[str, dict] = {}
        self.animations: Dict[str, dict] = {}
        self.jobs: Dict[str, JobStatus] = {}
        self._seed_fixture()

    def _seed_fixture(self) -> None:
        passage_id = "iam-01"
        self.sources[passage_id] = Source.model_validate(_read_json("source.json"))
        self.claims[passage_id] = ClaimList.model_validate(_read_json("claims.json"))
        self.summaries[passage_id] = _read_json("summary.json")
        self.flows[passage_id] = _read_json("flow.json")
        self.animations[passage_id] = _read_json("animation.json")

    def create_passage(self, title: str, text: str) -> tuple[str, str]:
        with self._lock:
            passage_id = f"{_slugify(title)}-{uuid.uuid4().hex[:8]}"
            job_id = uuid.uuid4().hex
            self.jobs[job_id] = {
                "status": "running",
                "stage": "segment",
                "error": None,
                "passage_id": passage_id,
            }
        source = segment(passage_id=passage_id, title=title, language="en", raw_text=text)
        with self._lock:
            self.sources[passage_id] = source
            self.jobs[job_id]["stage"] = "claims"
        try:
            claim_list = claims_pipeline.extract_claims(source)
        except Exception as exc:  # segmenter succeeded; claims need an LLM (see pipeline/claims.py)
            with self._lock:
                self.jobs[job_id].update(status="failed", error=str(exc))
            return passage_id, job_id
        with self._lock:
            self.claims[passage_id] = claim_list
            self.jobs[job_id].update(status="done", stage="claims")
        return passage_id, job_id

    def get_job(self, job_id: str) -> Optional[JobStatus]:
        return self.jobs.get(job_id)


def _read_json(name: str) -> dict:
    return json.loads((_FIXTURE_DIR / name).read_text(encoding="utf-8"))


_store: Optional[Store] = None


def get_store() -> Store:
    global _store
    if _store is None:
        _store = Store()
    return _store
