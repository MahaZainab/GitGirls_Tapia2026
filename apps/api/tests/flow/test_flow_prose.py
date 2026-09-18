import jsonschema
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.generators.flow.prose import MAX_ITEMS, ProseError, derive_claims, flow_from_prose
from app.generators.flow.router import router
from app.generators.flow.textutil import utf16_slice
from app.models import FlowGraph
from app.pipeline.segmenter import segment
from app.store import get_store

TEXT = (
    "Check the request for an explicit deny. If any policy denies the request, the final decision is deny. "
    "Otherwise, look for an allow. If at least one policy allows it, the request is allowed. The result is logged."
)


def src(text=TEXT, pid="p1"):
    return segment(pid, "Demo", "en", text).model_dump(by_alias=True)


def labels(graph):
    return {n["id"]: n["label"] for n in graph["nodes"]}


def test_pasted_text_becomes_start_steps_decisions_and_end():
    graph, _ = flow_from_prose(src())
    kinds = [n["kind"] for n in graph["nodes"]]
    assert kinds[0] == "terminal_start" and kinds[-1] == "terminal_end"
    assert kinds.count("decision") == 2
    assert "Any policy denies the request?" in labels(graph).values()
    assert graph["title"] == "Demo"


def test_if_otherwise_gives_yes_and_no_branches_to_different_steps():
    graph, _ = flow_from_prose(src())
    names = labels(graph)
    decision = next(n for n in graph["nodes"] if n["label"] == "Any policy denies the request?")
    out = {e["label"]: names[e["to"]] for e in graph["edges"] if e["from"] == decision["id"]}
    assert out == {"yes": "The final decision is deny", "no": "Look for an allow"}


def test_if_without_otherwise_falls_through_on_no():
    graph, _ = flow_from_prose(src("Start the job. If the file is missing, stop here. Save the result."))
    names = labels(graph)
    decision = next(n for n in graph["nodes"] if n["kind"] == "decision")
    out = {e["label"]: names[e["to"]] for e in graph["edges"] if e["from"] == decision["id"]}
    assert out == {"yes": "Stop here", "no": "Save the result"}


def test_plain_prose_is_a_simple_sequence():
    graph, _ = flow_from_prose(src("Mix the flour. Add the eggs. Bake for 30 minutes."))
    assert [n["kind"] for n in graph["nodes"]] == ["terminal_start", "process", "process", "process", "terminal_end"]
    assert len(graph["edges"]) == 4


def test_verified_and_honestly_labelled():
    graph, _ = flow_from_prose(src())
    report = graph["verification"]
    assert report["status"] == "needs_human"  # never "passed": rules, not a model, built it
    assert not [c for c in report["checks"] if c["status"] == "fail"]
    assert any(c["name"] == "built_from_text_rules" for c in report["checks"])
    assert all(e["basis"] == "stated" or e.get("rationale") for e in graph["edges"])


def test_output_is_schema_valid_and_accepted_by_the_api_model(schema):
    graph, _ = flow_from_prose(src())
    jsonschema.Draft202012Validator({"$ref": "#/$defs/FlowGraph", "$defs": schema["$defs"]}).validate(graph)
    FlowGraph.model_validate(graph)


def test_anchors_are_verbatim_quotes_of_the_pasted_text():
    source = src()
    graph, _ = flow_from_prose(source)
    anchors = [n["anchor"] for n in graph["nodes"] if "anchor" in n]
    assert anchors
    for a in anchors:
        assert utf16_slice(source["text"], a["start"], a["end"]) == a["quote"]
    decision = next(n for n in graph["nodes"] if n["label"] == "Any policy denies the request?")
    assert decision["anchor"]["quote"] == "any policy denies the request"


def test_long_sentences_are_shortened_in_the_label_but_kept_in_detail():
    long = "Do " + " ".join(f"word{i}" for i in range(30)) + " now."
    graph, _ = flow_from_prose(src(f"Begin here. {long}"))
    step = graph["nodes"][2]
    assert len(step["label"].split()) <= 12 and step["label"].endswith("…")
    assert "word29" in step["detail"]


def test_numbers_are_kept_and_pass_the_number_rule():
    graph, _ = flow_from_prose(src("Wait 30 seconds. If the light is on, press 2 buttons."))
    assert graph["verification"]["status"] == "needs_human"
    assert any("30" in n["label"] for n in graph["nodes"])


def test_derived_claims_are_one_per_sentence_and_anchor_clean():
    source = src()
    claims = derive_claims(source)["claims"]
    assert len(claims) == len(source["sentences"])
    for c in claims:
        assert utf16_slice(source["text"], c["anchor"]["start"], c["anchor"]["end"]) == c["anchor"]["quote"]


def test_too_many_steps_is_a_clear_error():
    with pytest.raises(ProseError, match="shorter passage"):
        flow_from_prose(src(" ".join(f"Step number {i}." for i in range(MAX_ITEMS + 5))))


# ---- through the HTTP endpoint, the way Add material produces a passage ------------------------

@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(router)
    store = get_store()
    yield TestClient(app), store
    for d in (store.sources, store.claims, store.flows):
        for pid in [k for k in d if k.startswith("pasted-")]:
            del d[pid]


def test_pasted_passage_gets_a_flowchart_and_claims_the_ui_can_load(client):
    http, store = client
    pid, _ = store.create_passage("Pasted demo", TEXT)  # claim extraction needs a model, so this leaves no claims
    assert store.claims.get(pid) is None
    res = http.post(f"/api/passages/{pid}/flow/generate")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["passage_id"] == pid and body["title"] == "Pasted demo"
    assert any(n["label"] == "Look for an allow" for n in body["nodes"])
    assert store.flows[pid] == body
    assert store.claims[pid].claims[0].text.startswith("Check the request")


def test_unknown_passage_is_404(client):
    http, _ = client
    assert http.post("/api/passages/pasted-nope/flow/generate").status_code == 404
