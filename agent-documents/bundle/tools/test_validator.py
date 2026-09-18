#!/usr/bin/env python3
"""Negative tests: each mutation of the good fixture must trigger the expected code.
Run:  python tools/test_validator.py
"""
import copy
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from validate_bundle import validate  # noqa: E402

GOOD = os.path.join(HERE, "..", "fixtures", "iam-01")
FILES = ["source", "claims", "summary", "flow", "animation"]


def run(mutate):
    tmp = tempfile.mkdtemp()
    try:
        data = {}
        for n in FILES:
            with open(os.path.join(GOOD, n + ".json"), encoding="utf-8") as f:
                data[n] = json.load(f)
        mutate(data)
        for n, d in data.items():
            with open(os.path.join(tmp, n + ".json"), "w", encoding="utf-8") as f:
                json.dump(d, f)
        rep = validate(tmp)
        return {e.split("]")[0].strip("[") for e in rep.errors}
    finally:
        shutil.rmtree(tmp)


def expect(name, mutate, code):
    got = run(mutate)
    ok = code in got
    print(("PASS " if ok else "FAIL ") + f"{name} -> {code}" + ("" if ok else f"   got {sorted(got)}"))
    return ok


def m_quote(d): d["summary"]["pointers"][0]["anchor"]["quote"] = "By default every request is denied."
def m_offset(d): d["summary"]["pointers"][0]["anchor"]["start"] += 3; d["summary"]["pointers"][0]["anchor"]["end"] += 3
def m_overlap(d):
    p = d["summary"]["pointers"]
    p[1]["anchor"] = copy.deepcopy(p[0]["anchor"])
def m_number_summary(d): d["summary"]["summary"][0]["text"] += " It takes 3 steps."
def m_derived(d): d["summary"]["examples"][0]["body"] += " Alex has 5 policies."
def m_badclaim(d): d["summary"]["pointers"][0]["claim_ids"] = ["C99"]
def m_two_starts(d): d["flow"]["nodes"][1]["kind"] = "terminal_start"
def m_unlabeled(d): del d["flow"]["edges"][1]["label"]
def m_unreachable(d):
    d["flow"]["nodes"].append({"id": "N8", "kind": "terminal_end", "label": "Orphan", "tone": "neutral", "claim_ids": ["C1"]})
def m_cycle(d):
    d["flow"]["nodes"][4]["kind"] = "process"
    d["flow"]["edges"].append({"id": "E8", "from": "N5", "to": "N2", "claim_ids": ["C1"], "basis": "stated"})
def m_implied_no_rationale(d): del d["flow"]["edges"][3]["rationale"]
def m_path_gap(d): d["animation"]["path_edge_ids"] = ["E1", "E6"]
def m_caption_number(d): d["animation"]["steps"][0]["caption"] = "Step 4 of the request."
def m_backward(d): d["animation"]["steps"][2]["focus_edge_ids"] = ["E1"]; d["animation"]["steps"][1]["focus_edge_ids"] = ["E2"]
def m_no_premise(d): del d["animation"]["scenario_premise"]
def m_schema(d): d["flow"]["nodes"][0]["kind"] = "banana"
def m_long_caption(d): d["animation"]["steps"][0]["caption"] = " ".join(["word"] * 30)


TESTS = [
    ("wrong quote text", m_quote, "V-ANCH-01"),
    ("shifted offsets", m_offset, "V-ANCH-01"),
    ("overlapping pointer anchors", m_overlap, "V-F1-01"),
    ("unsupported number in summary", m_number_summary, "V-F1-04"),
    ("unlisted derived number in example", m_derived, "V-F1-05"),
    ("unknown claim id", m_badclaim, "V-REF-01"),
    ("two start nodes", m_two_starts, "V-F2-01"),
    ("unlabeled decision edge", m_unlabeled, "V-F2-03"),
    ("unreachable node", m_unreachable, "V-F2-02"),
    ("cycle in graph", m_cycle, "V-F2-08"),
    ("implied edge without rationale", m_implied_no_rationale, "V-F2-06"),
    ("non-contiguous animation path", m_path_gap, "V-F3-01"),
    ("number in caption not in claims", m_caption_number, "V-F3-06"),
    ("steps move backward on path", m_backward, "V-F3-03"),
    ("scenario without premise", m_no_premise, "V-F3-07"),
    ("schema violation", m_schema, "SCHEMA"),
    ("caption over 25 words", m_long_caption, "V-F3-04"),
]

if __name__ == "__main__":
    good = run(lambda d: None)
    print(("PASS " if not good else "FAIL ") + "good fixture has no errors", sorted(good))
    results = [expect(*t) for t in TESTS]
    print(f"{sum(results)}/{len(results)} negative tests caught")
    sys.exit(0 if not good and all(results) else 1)
