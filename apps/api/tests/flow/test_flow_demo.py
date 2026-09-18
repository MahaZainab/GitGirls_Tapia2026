"""The fixed Chain Rule flowchart shown by default must stay verified and in step with its .txt summary."""
import json

import pytest

from app.generators.flow import flow_from_txt, verify_flow
from app.generators.flow.router import summaries_dir
from app.generators.flow.textutil import utf16_slice
from tests.flow.conftest import REPO

DEMO = json.loads((REPO / "apps/web/src/features/flowchart/demo/chainRule.json").read_text(encoding="utf-8"))
SOURCE, CLAIMS, FLOW = DEMO["source"], DEMO["claims"], DEMO["flow"]


def test_demo_passes_every_flow_rule():
    found = verify_flow(FLOW, SOURCE, CLAIMS["claims"])
    assert found.errors == []
    assert {c for c, _ in found.warnings} == {"V-F2-06"}  # only the three implied arrows


def test_demo_matches_its_txt_summary():
    text = (summaries_dir() / "chain-rule.txt").read_text(encoding="utf-8")
    assert flow_from_txt(text, SOURCE, CLAIMS) == FLOW, "re-run the generator: chainRule.json is out of date"


def test_every_anchor_is_a_verbatim_quote_of_the_excerpt():
    anchors = [n["anchor"] for n in FLOW["nodes"] if "anchor" in n]
    assert len(anchors) >= 6
    for a in anchors:
        assert utf16_slice(SOURCE["text"], a["start"], a["end"]) == a["quote"]


def test_it_is_the_chain_rule_page():
    assert "OpenStax" in SOURCE["title"]
    labels = {n["label"] for n in FLOW["nodes"]}
    assert "Find g′(x)" in labels and "Is h(x) of the form (g(x))^n?" in labels


@pytest.mark.parametrize("edge_id", ["E2", "E3", "E5"])
def test_only_the_unstated_arrows_are_marked_implied(edge_id):
    edge = next(e for e in FLOW["edges"] if e["id"] == edge_id)
    assert edge["basis"] == "implied" and edge["rationale"]
