#!/usr/bin/env python3
"""Reference validator for StudyShift bundles.

Usage:  python tools/validate_bundle.py fixtures/iam-01
Checks JSON Schema conformance, then the deterministic invariants listed in the spec
(section 5). Exit code 0 means no errors. Warnings do not change the exit code.

Expected files in the fixture folder:
  source.json claims.json summary.json flow.json animation.json
  preferences.regular.json preferences.focus.json   (the two preference files are optional)
"""
import json
import os
import re
import sys
from collections import defaultdict

from jsonschema import Draft202012Validator

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(HERE, "..", "schemas", "studyshift.schema.json")

NUMWORDS = {w: str(i) for i, w in enumerate(
    "zero one two three four five six seven eight nine ten eleven twelve".split())}
NUMWORDS.pop("one")  # ambiguous pronoun
NUM_RE = re.compile(r"(?<![A-Za-z0-9.])(\d[\d,]*(?:\.\d+)?)(?![A-Za-z0-9])")


def numbers_in(text):
    t = (text or "").lower()
    found = {m.group(1).replace(",", "").rstrip(".") for m in NUM_RE.finditer(t)}
    found |= {NUMWORDS[w] for w in re.findall(r"[a-z]+", t) if w in NUMWORDS}
    found.discard("1")
    return found


def words(text):
    return len((text or "").split())


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, code, msg):
        self.errors.append(f"[{code}] {msg}")

    def warn(self, code, msg):
        self.warnings.append(f"[{code}] {msg}")


def load(folder, name, required=True):
    path = os.path.join(folder, name)
    if not os.path.exists(path):
        if required:
            raise SystemExit(f"missing file: {path}")
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def schema_check(schema, name, data, rep, label):
    v = Draft202012Validator({"$ref": f"#/$defs/{name}", "$defs": schema["$defs"]})
    for e in sorted(v.iter_errors(data), key=lambda e: list(e.path)):
        loc = "/".join(str(p) for p in e.path) or "(root)"
        rep.err("SCHEMA", f"{label}: {loc}: {e.message[:160]}")


def check_anchor(a, source, sentences, rep, where):
    text = source["text"]
    if text[a["start"]:a["end"]] != a["quote"]:
        rep.err("V-ANCH-01", f"{where}: quote does not equal source.text[{a['start']}:{a['end']}]")
        return False
    s = sentences.get(a["sentence_id"])
    if not s:
        rep.err("V-REF-01", f"{where}: unknown sentence {a['sentence_id']}")
        return False
    if not (s["start"] <= a["start"] and a["end"] <= s["end"]):
        rep.err("V-ANCH-02", f"{where}: anchor is outside sentence {a['sentence_id']}")
        return False
    return True


def unique(items, rep, label):
    ids = [i["id"] for i in items]
    if len(ids) != len(set(ids)):
        rep.err("V-ID-01", f"{label}: duplicate ids")


def validate(folder):
    schema = load(HERE, os.path.join("..", "schemas", "studyshift.schema.json"))
    rep = Report()
    source = load(folder, "source.json")
    claims_doc = load(folder, "claims.json")
    summary = load(folder, "summary.json")
    flow = load(folder, "flow.json")
    anim = load(folder, "animation.json")
    prefs = [(n, load(folder, n, False)) for n in ("preferences.regular.json", "preferences.focus.json")]

    schema_check(schema, "Source", source, rep, "source")
    schema_check(schema, "ClaimList", claims_doc, rep, "claims")
    schema_check(schema, "SummaryBundle", summary, rep, "summary")
    schema_check(schema, "FlowGraph", flow, rep, "flow")
    schema_check(schema, "AnimationScript", anim, rep, "animation")
    for n, p in prefs:
        if p is not None:
            schema_check(schema, "UserPreferences", p, rep, n)
    if rep.errors:
        return rep  # structural problems make invariant checks meaningless

    sentences = {s["id"]: s for s in source["sentences"]}
    for s in source["sentences"]:
        if source["text"][s["start"]:s["end"]] != s["text"]:
            rep.err("V-ANCH-01", f"sentence {s['id']}: text does not match its offsets")
    claims = {c["id"]: c for c in claims_doc["claims"]}
    unique(claims_doc["claims"], rep, "claims")
    for c in claims_doc["claims"]:
        check_anchor(c["anchor"], source, sentences, rep, f"claim {c['id']}")
        for sid in c["sentence_ids"]:
            if sid not in sentences:
                rep.err("V-REF-01", f"claim {c['id']}: unknown sentence {sid}")

    def claim_numbers(ids):
        out = set()
        for cid in ids:
            out |= numbers_in(claims[cid]["text"]) | numbers_in(claims[cid]["anchor"]["quote"])
        return out

    def need_claims(ids, where):
        ok = True
        for cid in ids:
            if cid not in claims:
                rep.err("V-REF-01", f"{where}: unknown claim {cid}")
                ok = False
        return ok

    # ---------------------------------------------------------------- F1
    unique(summary["pointers"], rep, "pointers")
    unique(summary["summary"], rep, "summary sentences")
    unique(summary["examples"], rep, "examples")
    pids = {p["id"] for p in summary["pointers"]}
    spans = []
    for p in summary["pointers"]:
        w = f"pointer {p['id']}"
        if need_claims(p["claim_ids"], w):
            if not numbers_in(p["summary"]) <= claim_numbers(p["claim_ids"]):
                rep.err("V-F1-04", f"{w}: summary contains a number not in its cited claims")
        check_anchor(p["anchor"], source, sentences, rep, w)
        spans.append((p["anchor"]["start"], p["anchor"]["end"], p["id"]))
        if words(p["title"]) > 8:
            rep.err("V-F1-02", f"{w}: title over 8 words")
        if words(p["summary"]) > 40:
            rep.err("V-F1-02", f"{w}: summary over 40 words")
        if not 3 <= words(p["anchor"]["quote"]) <= 30:
            rep.warn("V-F1-02", f"{w}: anchor phrase should be 3 to 30 words")
    spans.sort()
    for (s1, e1, a), (s2, e2, b) in zip(spans, spans[1:]):
        if s2 < e1:
            rep.err("V-F1-01", f"pointers {a} and {b} have overlapping anchors")
    if not 3 <= len(summary["pointers"]) <= 12:
        rep.warn("V-F1-06", "pointer count should be between 3 and 12")
    for m in summary["summary"]:
        w = f"summary {m['id']}"
        if need_claims(m["claim_ids"], w) and not numbers_in(m["text"]) <= claim_numbers(m["claim_ids"]):
            rep.err("V-F1-04", f"{w}: contains a number not in its cited claims")
        if words(m["text"]) > 30:
            rep.err("V-F1-03", f"{w}: over 30 words")
        for pid in m["pointer_ids"]:
            if pid not in pids:
                rep.err("V-REF-01", f"{w}: unknown pointer {pid}")
    for x in summary["examples"]:
        w = f"example {x['id']}"
        if need_claims(x["claim_ids"], w):
            extra = numbers_in(x["body"]) - claim_numbers(x["claim_ids"])
            missing = extra - set(x["derived_numbers"])
            if missing:
                rep.err("V-F1-05", f"{w}: numbers {sorted(missing)} are not in cited claims and not listed in derived_numbers")
        for pid in x["related_pointer_ids"]:
            if pid not in pids:
                rep.err("V-REF-01", f"{w}: unknown pointer {pid}")

    # ---------------------------------------------------------------- F2
    nodes = {n["id"]: n for n in flow["nodes"]}
    unique(flow["nodes"], rep, "nodes")
    unique(flow["edges"], rep, "edges")
    out_edges = defaultdict(list)
    for e in flow["edges"]:
        w = f"edge {e['id']}"
        if e["from"] not in nodes or e["to"] not in nodes:
            rep.err("V-F2-05", f"{w}: references a missing node")
            continue
        if e["from"] == e["to"]:
            rep.err("V-F2-05", f"{w}: self loop")
        need_claims(e["claim_ids"], w)
        if e["basis"] == "implied":
            if not e.get("rationale"):
                rep.err("V-F2-06", f"{w}: implied edge needs a rationale")
            else:
                rep.warn("V-F2-06", f"{w}: implied edge, route to human review")
        out_edges[e["from"]].append(e)
    starts = [n for n in flow["nodes"] if n["kind"] == "terminal_start"]
    ends = [n for n in flow["nodes"] if n["kind"] == "terminal_end"]
    if len(starts) != 1:
        rep.err("V-F2-01", "exactly one terminal_start is required")
    if not ends:
        rep.err("V-F2-01", "at least one terminal_end is required")
    for n in flow["nodes"]:
        w = f"node {n['id']}"
        need_claims(n["claim_ids"], w)
        if "anchor" in n:
            check_anchor(n["anchor"], source, sentences, rep, w)
        if words(n["label"]) > 12:
            rep.err("V-F2-07", f"{w}: label over 12 words")
        if not numbers_in(n["label"] + " " + n.get("detail", "")) <= claim_numbers(n["claim_ids"]):
            rep.err("V-F2-09", f"{w}: number not in cited claims")
        outs = out_edges.get(n["id"], [])
        k = n["kind"]
        if k == "decision":
            labels = [e.get("label", "") for e in outs]
            if len(outs) < 2 or any(not l for l in labels) or len(set(labels)) != len(labels):
                rep.err("V-F2-03", f"{w}: decision needs 2+ outgoing edges with unique non-empty labels")
        elif k in ("process", "terminal_start"):
            if len(outs) != 1:
                rep.err("V-F2-04", f"{w}: {k} needs exactly one outgoing edge")
        elif k == "terminal_end" and outs:
            rep.err("V-F2-04", f"{w}: terminal_end cannot have outgoing edges")
        elif k == "note" and (outs or any(e["to"] == n["id"] for e in flow["edges"])):
            rep.err("V-F2-04", f"{w}: note nodes cannot have edges")
    if len(starts) == 1:
        seen, stack = set(), [starts[0]["id"]]
        while stack:
            cur = stack.pop()
            if cur in seen:
                continue
            seen.add(cur)
            stack += [e["to"] for e in out_edges.get(cur, []) if e["to"] in nodes]
        for n in flow["nodes"]:
            if n["kind"] != "note" and n["id"] not in seen:
                rep.err("V-F2-02", f"node {n['id']} is not reachable from the start")
        # cycle check (v1 forbids cycles)
        state = {}

        def dfs(u):
            state[u] = 1
            for e in out_edges.get(u, []):
                v = e["to"]
                if state.get(v) == 1:
                    rep.err("V-F2-08", f"cycle through {u} to {v} (cycles are not supported in v1)")
                elif v not in state:
                    dfs(v)
            state[u] = 2
        dfs(starts[0]["id"])

    # ---------------------------------------------------------------- F3
    edges = {e["id"]: e for e in flow["edges"]}
    unique(anim["steps"], rep, "steps")
    path = anim["path_edge_ids"]
    for eid in path:
        if eid not in edges:
            rep.err("V-F3-01", f"path edge {eid} does not exist")
    if all(eid in edges for eid in path) and path:
        if nodes[edges[path[0]]["from"]]["kind"] != "terminal_start":
            rep.err("V-F3-01", "path must begin at the terminal_start node")
        for a, b in zip(path, path[1:]):
            if edges[a]["to"] != edges[b]["from"]:
                rep.err("V-F3-01", f"path is not contiguous between {a} and {b}")
        if nodes[edges[path[-1]]["to"]]["kind"] != "terminal_end":
            rep.err("V-F3-01", "path must finish at a terminal_end node")
    elif not path:
        rep.err("V-F3-01", "path_edge_ids must not be empty")
    if [s["order"] for s in anim["steps"]] != list(range(1, len(anim["steps"]) + 1)):
        rep.err("V-F3-03", "step orders must be 1..n with no gaps")
    if len(anim["steps"]) > 12:
        rep.err("V-F3-05", "more than 12 steps")
    last_idx = -1
    for s in anim["steps"]:
        w = f"step {s['id']}"
        if words(s["caption"]) > 25:
            rep.err("V-F3-04", f"{w}: caption over 25 words")
        for nid in s["focus_node_ids"]:
            if nid not in nodes:
                rep.err("V-F3-02", f"{w}: unknown node {nid}")
        for eid in s["focus_edge_ids"]:
            if eid not in edges:
                rep.err("V-F3-02", f"{w}: unknown edge {eid}")
            elif eid not in path:
                rep.err("V-F3-02", f"{w}: edge {eid} is not on the scenario path")
            else:
                idx = path.index(eid)
                if idx < last_idx:
                    rep.err("V-F3-03", f"{w}: steps move backward along the path")
                last_idx = max(last_idx, idx)
        if need_claims(s["claim_ids"], w) and not numbers_in(s["caption"]) <= claim_numbers(s["claim_ids"]):
            rep.err("V-F3-06", f"{w}: caption contains a number not in its cited claims")
        if "anchor" in s:
            check_anchor(s["anchor"], source, sentences, rep, w)
    if anim["kind"] == "scenario":
        if not anim.get("scenario_premise"):
            rep.err("V-F3-07", "scenario scripts need a scenario_premise")
        if not any(s["hypothetical"] for s in anim["steps"]):
            rep.err("V-F3-07", "scenario scripts need at least one step marked hypothetical")
    return rep


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    rep = validate(sys.argv[1])
    for w in rep.warnings:
        print("WARN ", w)
    for e in rep.errors:
        print("ERROR", e)
    print(f"{len(rep.errors)} error(s), {len(rep.warnings)} warning(s)")
    sys.exit(1 if rep.errors else 0)


if __name__ == "__main__":
    main()
