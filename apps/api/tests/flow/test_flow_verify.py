import subprocess
import sys

import pytest

from app.generators.flow.verify import verify_flow
from tests.flow.conftest import FIXTURES, REPO


def codes(findings):
    return {code for code, _ in findings.errors}


def run(flow, source, claim_list, **kw):
    return verify_flow(flow, source, claim_list["claims"], **kw)


def test_fixture_has_no_errors_and_flags_the_implied_edge(flow, source, claim_list):
    result = run(flow, source, claim_list)
    assert result.errors == []
    assert [c for c, m in result.warnings] == ["V-F2-06"]
    assert "E4" in result.warnings[0][1]


def test_agrees_with_the_reference_validator():
    proc = subprocess.run(
        [sys.executable, str(REPO / "tools" / "validate_bundle.py"), str(FIXTURES)],
        capture_output=True, text=True,
    )
    # The reference tool needs jsonschema, which the venv has; it must accept the same fixture.
    assert proc.returncode == 0, proc.stdout + proc.stderr


def node(flow, nid):
    return next(n for n in flow["nodes"] if n["id"] == nid)


def edge(flow, eid):
    return next(e for e in flow["edges"] if e["id"] == eid)


def test_v_f2_01_needs_one_start_and_an_end(flow, source, claim_list):
    node(flow, "N5")["kind"] = "process"
    node(flow, "N6")["kind"] = "process"
    assert "V-F2-01" in codes(run(flow, source, claim_list))
    flow2 = {**flow, "nodes": [dict(n) for n in flow["nodes"]]}
    node(flow2, "N2")["kind"] = "terminal_start"
    assert "V-F2-01" in codes(run(flow2, source, claim_list))


def test_v_f2_02_unreachable_node(flow, source, claim_list):
    flow["edges"] = [e for e in flow["edges"] if e["id"] != "E1"]
    assert "V-F2-02" in codes(run(flow, source, claim_list))


def test_v_f2_03_decision_needs_unique_labels(flow, source, claim_list):
    edge(flow, "E2")["label"] = "no"
    assert "V-F2-03" in codes(run(flow, source, claim_list))


def test_v_f2_04_process_needs_one_outgoing_edge(flow, source, claim_list):
    node(flow, "N2")["kind"] = "process"
    assert "V-F2-04" in codes(run(flow, source, claim_list))


def test_v_f2_05_missing_target_and_self_loop(flow, source, claim_list):
    edge(flow, "E1")["to"] = "N99"
    assert "V-F2-05" in codes(run(flow, source, claim_list))
    flow["edges"][0]["to"] = flow["edges"][0]["from"]
    assert "V-F2-05" in codes(run(flow, source, claim_list))


def test_v_f2_06_implied_edge_needs_rationale(flow, source, claim_list):
    del edge(flow, "E4")["rationale"]
    assert "V-F2-06" in codes(run(flow, source, claim_list))


def test_v_f2_07_label_length(flow, source, claim_list):
    node(flow, "N2")["label"] = "one two three four five six seven eight nine ten eleven twelve thirteen"
    assert "V-F2-07" in codes(run(flow, source, claim_list))


def test_v_f2_08_cycles(flow, source, claim_list):
    flow["edges"].append({"id": "E8", "from": "N4", "to": "N2", "label": "retry", "claim_ids": ["C13"], "basis": "stated"})
    node(flow, "N4")  # N4 is a decision so the extra labelled edge is otherwise legal
    assert "V-F2-08" in codes(run(flow, source, claim_list))


def test_v_f2_09_numbers_must_come_from_claims(flow, source, claim_list):
    node(flow, "N2")["label"] = "Checked in 7 policies?"
    assert "V-F2-09" in codes(run(flow, source, claim_list))


def test_anchor_rules(flow, source, claim_list):
    node(flow, "N4")["anchor"]["quote"] = "not in the source"
    assert "V-ANCH-01" in codes(run(flow, source, claim_list))


def test_anchor_outside_sentence(flow, source, claim_list):
    # A real phrase, but attributed to the wrong sentence.
    node(flow, "N4")["anchor"]["sentence_id"] = "S1"
    assert "V-ANCH-02" in codes(run(flow, source, claim_list))


def test_unknown_claim_and_duplicate_ids(flow, source, claim_list):
    edge(flow, "E1")["claim_ids"] = ["C999"]
    flow["nodes"].append(dict(node(flow, "N5")))
    assert {"V-REF-01", "V-ID-01"} <= codes(run(flow, source, claim_list))


@pytest.mark.parametrize("limit,expect", [(7, False), (6, True)])
def test_max_nodes(flow, source, claim_list, limit, expect):
    assert ("V-F2-MAX" in codes(run(flow, source, claim_list, max_nodes=limit))) is expect
