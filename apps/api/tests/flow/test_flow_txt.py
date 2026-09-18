import json
from pathlib import Path

import jsonschema
import pytest

from app.generators.flow import FlowTxtError, flow_from_txt
from app.generators.flow.router import summaries_dir
from app.generators.flow.textutil import utf16_slice

IAM_TXT = (summaries_dir() / "iam-01.txt").read_text(encoding="utf-8")


def build(source, claim_list, text=IAM_TXT, **kw):
    return flow_from_txt(text, source, claim_list, **kw)


def problems_of(source, claim_list, text):
    with pytest.raises(FlowTxtError) as exc:
        build(source, claim_list, text)
    return "\n".join(exc.value.problems)


def test_sample_summary_matches_the_reference_fixture_exactly(source, claim_list, fixture_flow):
    flow = build(source, claim_list)
    assert flow["nodes"] == fixture_flow["nodes"]
    assert flow["edges"] == fixture_flow["edges"]
    assert flow["title"] == fixture_flow["title"]


def test_output_is_schema_valid(source, claim_list, schema):
    jsonschema.Draft202012Validator({"$ref": "#/$defs/FlowGraph", "$defs": schema["$defs"]}).validate(build(source, claim_list))


def test_anchors_are_verbatim_utf16_quotes(source, claim_list):
    for node in build(source, claim_list)["nodes"]:
        if "anchor" in node:
            a = node["anchor"]
            assert utf16_slice(source["text"], a["start"], a["end"]) == a["quote"]


def test_needs_human_because_of_the_implied_edge_and_no_auditor(source, claim_list):
    report = build(source, claim_list)["verification"]
    assert report["status"] == "needs_human"
    assert any(c["status"] == "warn" and "E4" in c["detail"] for c in report["checks"])
    assert any(c["name"] == "auditor_entailment" and c["status"] == "warn" for c in report["checks"])


def test_no_model_code_is_present():
    package = Path(__file__).resolve().parents[2] / "app" / "generators" / "flow"
    for name in ("llm.py", "prompt.py"):
        assert not (package / name).exists()
    code = "".join(p.read_text() for p in package.glob("*.py"))
    assert "urllib" not in code and "LLM_API_KEY" not in code


def test_comments_blank_lines_and_crlf_are_fine(source, claim_list, fixture_flow):
    text = "\r\n\r\n".join(IAM_TXT.splitlines()).replace("\r\n\r\n", "\r\n")
    assert build(source, claim_list, text)["edges"] == fixture_flow["edges"]


def test_utf16_offsets_with_astral_characters(source, claim_list):
    shifted = json.loads(json.dumps(source))
    shifted["text"] = "😀" + source["text"]
    for s in shifted["sentences"]:
        s["start"] += 2
        s["end"] += 2
    flow = build(shifted, claim_list)
    n4 = next(n for n in flow["nodes"] if n["id"] == "N4")
    assert utf16_slice(shifted["text"], n4["anchor"]["start"], n4["anchor"]["end"]) == n4["anchor"]["quote"]


# ---- authoring mistakes give line numbers, not tracebacks -------------------------------------

def test_reports_every_problem_with_its_line(source, claim_list):
    text = "a start: Begin | C1\nb end: Done\na -> c | C1\nnonsense here\n"
    found = problems_of(source, claim_list, text)
    assert "line 2" in found and "must cite at least one claim" in found
    assert "line 3" in found and "'c' is not a box" in found
    assert "line 4" in found and "not a box or an arrow" in found


def test_quote_must_be_verbatim(source, claim_list):
    text = IAM_TXT.replace("it must also fall inside each guardrail that applies", "guardrails are optional")
    assert "not an exact phrase" in problems_of(source, claim_list, text)


def test_duplicate_names_and_wrong_passage(source, claim_list):
    text = IAM_TXT.replace("passage: iam-01", "passage: other").replace("denied   end", "request  end", 1)
    found = problems_of(source, claim_list, text)
    assert "not 'iam-01'" in found and "used twice" in found


def test_too_long_label_and_missing_boxes(source, claim_list):
    assert "limit is 100" in problems_of(source, claim_list, "a start: " + "x" * 101 + " | C1\nb end: Done | C1\na -> b | C1")
    assert "at least 2 boxes" in problems_of(source, claim_list, "a start: Only | C1")


# ---- structural rules still bite (they come from verify_flow) ---------------------------------

def test_rule_violations_return_a_failed_graph(source, claim_list):
    text = IAM_TXT.replace("deny? -no-> allow?", "deny? -yes-> allow?")  # duplicate decision label
    flow = build(source, claim_list, text)
    assert flow["verification"]["status"] == "failed"
    assert any(c["name"] == "V-F2-03" for c in flow["verification"]["checks"])


def test_unknown_claim_is_caught(source, claim_list):
    flow = build(source, claim_list, IAM_TXT.replace("| C6", "| C999"))
    assert flow["verification"]["status"] == "failed"


def test_max_nodes(source, claim_list):
    assert build(source, claim_list, max_nodes=5)["verification"]["status"] == "failed"
