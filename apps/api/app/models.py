"""Pydantic models mirroring `schemas/studyshift.schema.json`.

This module is FOUNDATION-owned (read-only for feature agents, see spec A-02).
Field names, requiredness and constraints must stay in lockstep with the JSON
Schema. If you need a field that isn't here, file a CONTRACT_CHANGE_REQUEST
(spec section 7.2) instead of editing this file from a feature branch.
"""
from __future__ import annotations

from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, Field, StringConstraints

SentenceId = Annotated[str, StringConstraints(pattern=r"^S[0-9]+$")]
ClaimId = Annotated[str, StringConstraints(pattern=r"^C[0-9]+$")]
SummaryId = Annotated[str, StringConstraints(pattern=r"^M[0-9]+$")]
PointerId = Annotated[str, StringConstraints(pattern=r"^P[0-9]+$")]
ExampleId = Annotated[str, StringConstraints(pattern=r"^X[0-9]+$")]
NodeId = Annotated[str, StringConstraints(pattern=r"^N[0-9]+$")]
EdgeId = Annotated[str, StringConstraints(pattern=r"^E[0-9]+$")]
StepId = Annotated[str, StringConstraints(pattern=r"^A[0-9]+$")]


class Model(BaseModel):
    model_config = {"extra": "forbid"}


class Anchor(Model):
    sentence_id: SentenceId
    start: int = Field(ge=0)
    end: int = Field(ge=1)
    quote: str = Field(min_length=1, max_length=400)


class Sentence(Model):
    id: SentenceId
    start: int = Field(ge=0)
    end: int = Field(ge=1)
    text: str = Field(min_length=1)


class Source(Model):
    schema_version: Literal["1.0"] = "1.0"
    passage_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    language: Annotated[str, StringConstraints(pattern=r"^[a-z]{2}(-[A-Z]{2})?$")]
    text: str = Field(min_length=1)
    sentences: List[Sentence] = Field(min_length=1)


class Claim(Model):
    id: ClaimId
    text: str = Field(min_length=1)
    sentence_ids: List[SentenceId] = Field(min_length=1)
    anchor: Anchor
    must_keep: List[str]


class ClaimList(Model):
    schema_version: Literal["1.0"] = "1.0"
    passage_id: str = Field(min_length=1)
    claims: List[Claim] = Field(min_length=1)


class Check(Model):
    name: str
    layer: Literal["code", "auditor", "human"]
    status: Literal["pass", "warn", "fail"]
    detail: str


class VerificationReport(Model):
    status: Literal["passed", "failed", "needs_human"]
    checks: List[Check] = []


class SummarySentence(Model):
    id: SummaryId
    text: str = Field(min_length=1)
    claim_ids: List[ClaimId] = Field(min_length=1)
    pointer_ids: List[PointerId] = []


class Pointer(Model):
    id: PointerId
    order: int = Field(ge=1)
    title: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=400)
    anchor: Anchor
    claim_ids: List[ClaimId] = Field(min_length=1)


class Example(Model):
    id: ExampleId
    kind: Literal["analogy", "worked_example", "scenario"]
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=600)
    related_pointer_ids: List[PointerId] = []
    claim_ids: List[ClaimId] = Field(min_length=1)
    is_source_content: Literal[False] = False
    derived_numbers: List[str] = []


class SummaryBundle(Model):
    schema_version: Literal["1.0"] = "1.0"
    passage_id: str = Field(min_length=1)
    summary: List[SummarySentence] = Field(min_length=1)
    pointers: List[Pointer] = Field(min_length=1)
    examples: List[Example] = []
    verification: VerificationReport


class FlowNode(Model):
    id: NodeId
    kind: Literal["terminal_start", "terminal_end", "process", "decision", "note"]
    label: str = Field(min_length=1, max_length=100)
    detail: Optional[str] = Field(default=None, max_length=300)
    tone: Literal["neutral", "positive", "negative"]
    claim_ids: List[ClaimId] = Field(min_length=1)
    anchor: Optional[Anchor] = None


class FlowEdge(Model):
    id: EdgeId
    from_: NodeId = Field(alias="from")
    to: NodeId
    label: Optional[str] = Field(default=None, max_length=40)
    claim_ids: List[ClaimId] = Field(min_length=1)
    basis: Literal["stated", "implied"]
    rationale: Optional[str] = Field(default=None, max_length=300)

    model_config = {"extra": "forbid", "populate_by_name": True}


class FlowGraph(Model):
    schema_version: Literal["1.0"] = "1.0"
    passage_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    nodes: List[FlowNode] = Field(min_length=2)
    edges: List[FlowEdge] = Field(min_length=1)
    verification: VerificationReport


class AnimationStep(Model):
    id: StepId
    order: int = Field(ge=1)
    focus_node_ids: List[NodeId] = []
    focus_edge_ids: List[EdgeId] = []
    caption: str = Field(min_length=1, max_length=200)
    claim_ids: List[ClaimId] = Field(min_length=1)
    anchor: Optional[Anchor] = None
    suggested_duration_ms: int = Field(ge=800, le=10000)
    hypothetical: bool


class AnimationScript(Model):
    schema_version: Literal["1.0"] = "1.0"
    passage_id: str = Field(min_length=1)
    kind: Literal["walkthrough", "scenario"]
    title: str = Field(min_length=1)
    scenario_premise: Optional[str] = Field(default=None, max_length=300)
    path_edge_ids: List[EdgeId] = []
    steps: List[AnimationStep] = Field(min_length=1)
    verification: VerificationReport


class Supports(Model):
    adhd: bool
    dyslexia: bool


class Display(Model):
    text_scale: float = Field(ge=0.9, le=1.6)
    motion: Literal["full", "reduced", "off"]
    line_focus: bool
    dyslexia_typography: bool


class Pomodoro(Model):
    enabled: bool
    visible: bool
    allow_peek: bool
    work_minutes: int = Field(ge=5, le=90)
    break_minutes: int = Field(ge=1, le=30)
    nudge: Literal["chime", "visual", "both", "none"]


class Rain(Model):
    enabled: bool
    volume: float = Field(ge=0, le=1)
    during_break: Literal["continue", "pause"]


class Dnd(Model):
    enabled: bool
    hold_in_app_notifications: bool
    digest_on_end: bool


class Focus(Model):
    pomodoro: Pomodoro
    rain: Rain
    dnd: Dnd


class Storage(Model):
    sync: Literal["account", "device_only"]


class UserPreferences(Model):
    schema_version: Literal["1.0"] = "1.0"
    mode: Literal["regular", "focus"]
    supports: Supports
    display: Display
    focus: Focus
    storage: Storage
    updated_at: str


DEFAULT_PREFERENCES: dict = {
    "schema_version": "1.0",
    "mode": "regular",
    "supports": {"adhd": False, "dyslexia": False},
    "display": {
        "text_scale": 1.0,
        "motion": "full",
        "line_focus": False,
        "dyslexia_typography": False,
    },
    "focus": {
        "pomodoro": {
            "enabled": True,
            "visible": False,
            "allow_peek": True,
            "work_minutes": 25,
            "break_minutes": 5,
            "nudge": "both",
        },
        "rain": {"enabled": True, "volume": 0.4, "during_break": "continue"},
        "dnd": {"enabled": True, "hold_in_app_notifications": True, "digest_on_end": True},
    },
    "storage": {"sync": "account"},
    "updated_at": "1970-01-01T00:00:00Z",
}
