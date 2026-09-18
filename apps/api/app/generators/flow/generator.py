"""Flow generator (F2 GEN): a hand-written .txt summary in, a verified FlowGraph out.

No model is involved anywhere. A person writes the summary in the small line format documented at
the top of `summaries/iam-01.txt`; this module parses it, attaches verbatim anchors, and runs the
same code checks (V-F2-*) the rest of the product uses.

    <passage>.txt --parse--> draft graph --verify_flow--> VerificationReport --> FlowGraph
"""
from __future__ import annotations

import re

from .textutil import to_utf16
from .verify import Findings, verify_flow

KINDS = {
    "start": "terminal_start",
    "end": "terminal_end",
    "step": "process",
    "decision": "decision",
    "note": "note",
}
KEY = r"[A-Za-z][\w?!.-]*"
NODE_LINE = re.compile(
    rf"^(?P<key>{KEY})\s+(?P<kind>start|end|step|decision|note)"
    r"(?:\s*\((?P<tone>positive|negative|neutral)\))?\s*:\s*(?P<rest>.+)$"
)
EDGE_LINE = re.compile(rf"^(?P<a>{KEY})\s*(?:-(?P<label>[^>|]*?)->|->)\s*(?P<b>{KEY})\s*(?P<rest>\|.*)?$")
CLAIM_LIST = re.compile(r"^C\d+(\s*,\s*C\d+)*$")
FIELDS = {"detail", "quote", "implied"}

# Same limits as the JSON Schema, checked here so authors get a line number instead of a schema error.
LIMITS = {"label": 100, "detail": 300, "edge label": 40, "rationale": 300, "quote": 400}


class FlowTxtError(ValueError):
    """The .txt could not be turned into a graph. `problems` lists every issue, each with its line number."""

    def __init__(self, problems: list[str]):
        super().__init__("; ".join(problems))
        self.problems = problems


def _fields(rest: str, line_no: int, problems: list[str]) -> tuple[str, list[str], dict[str, str]]:
    """Split 'label | C1, C2 | quote: ...' into (label, claim ids, keyed fields)."""
    head, *parts = [p.strip() for p in rest.split("|")]
    claims: list[str] = []
    keyed: dict[str, str] = {}
    for part in parts:
        if CLAIM_LIST.match(part):
            claims += [c.strip() for c in part.split(",")]
            continue
        name, sep, value = part.partition(":")
        if sep and name.strip() in FIELDS and value.strip():
            keyed[name.strip()] = value.strip()
        elif part:
            problems.append(f"line {line_no}: don't understand '{part[:40]}'. Use claim ids like C5, or detail:/quote:/implied:")
    return head, claims, keyed


def _too_long(value: str, what: str, line_no: int, problems: list[str]) -> None:
    if len(value) > LIMITS[what]:
        problems.append(f"line {line_no}: {what} is {len(value)} characters; the limit is {LIMITS[what]}")


def _locate_anchor(quote: str, claim_ids: list[str], source: dict, claims: dict[str, dict]) -> dict | None:
    """Find `quote` verbatim inside one of the cited claims' sentences (offsets are UTF-16, spec X-08)."""
    sentences = {s["id"]: s for s in source["sentences"]}
    for cid in claim_ids:
        for sid in claims.get(cid, {}).get("sentence_ids", []):
            sentence = sentences.get(sid)
            at = sentence["text"].find(quote) if sentence else -1
            if at != -1:
                start = sentence["start"] + to_utf16(sentence["text"], at)
                return {"sentence_id": sid, "start": start, "end": start + to_utf16(quote, len(quote)), "quote": quote}
    return None


def parse_flow_txt(text: str, source: dict, claim_list: list[dict]) -> tuple[dict, list[str]]:
    """Turn the txt into a contract-shaped FlowGraph without verification. Returns (graph, notes)."""
    problems: list[str] = []
    notes: list[str] = []
    claims = {c["id"]: c for c in claim_list}
    title = source["title"]
    nodes: list[dict] = []
    edges: list[dict] = []
    ids: dict[str, str] = {}  # author's name -> N#
    pending_edges: list[tuple[int, dict, str, str]] = []

    for line_no, raw in enumerate(text.splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        header = re.match(r"^(title|passage)\s*:\s*(.+)$", line)
        if header:
            if header.group(1) == "title":
                title = header.group(2).strip()
            elif header.group(2).strip() != source["passage_id"]:
                problems.append(f"line {line_no}: this file is for passage '{header.group(2).strip()}', not '{source['passage_id']}'")
            continue

        if m := NODE_LINE.match(line):
            label, claim_ids, keyed = _fields(m["rest"], line_no, problems)
            if m["key"] in ids:
                problems.append(f"line {line_no}: the name '{m['key']}' is used twice")
            if not label:
                problems.append(f"line {line_no}: box '{m['key']}' needs a label")
            if not claim_ids:
                problems.append(f"line {line_no}: box '{m['key']}' must cite at least one claim (for example | C5)")
            _too_long(label, "label", line_no, problems)
            node: dict = {"id": f"N{len(nodes) + 1}", "kind": KINDS[m["kind"]], "label": label,
                          "tone": m["tone"] or "neutral", "claim_ids": claim_ids}
            if "detail" in keyed:
                _too_long(keyed["detail"], "detail", line_no, problems)
                node["detail"] = keyed["detail"]
            if "quote" in keyed:
                _too_long(keyed["quote"], "quote", line_no, problems)
                anchor = _locate_anchor(keyed["quote"], claim_ids, source, claims)
                if anchor:
                    node["anchor"] = anchor
                else:
                    problems.append(f"line {line_no}: the quote is not an exact phrase from the sentences of {', '.join(claim_ids) or 'its claims'}")
            ids[m["key"]] = node["id"]
            nodes.append(node)
        elif m := EDGE_LINE.match(line):
            label = (m["label"] or "").strip()
            _, claim_ids, keyed = _fields("x " + (m["rest"] or ""), line_no, problems)
            if not claim_ids:
                problems.append(f"line {line_no}: arrow {m['a']} -> {m['b']} must cite at least one claim (for example | C5)")
            _too_long(label, "edge label", line_no, problems)
            edge: dict = {"id": f"E{len(edges) + 1}", "claim_ids": claim_ids,
                          "basis": "implied" if "implied" in keyed else "stated"}
            if label:
                edge["label"] = label
            if "implied" in keyed:
                _too_long(keyed["implied"], "rationale", line_no, problems)
                edge["rationale"] = keyed["implied"]
            for extra in ("detail", "quote"):
                if extra in keyed:
                    problems.append(f"line {line_no}: '{extra}:' only applies to boxes, not arrows")
            pending_edges.append((line_no, edge, m["a"], m["b"]))
            edges.append(edge)
        else:
            problems.append(f"line {line_no}: not a box or an arrow: '{line[:50]}'")

    for line_no, edge, a, b in pending_edges:
        for name in (a, b):
            if name not in ids:
                problems.append(f"line {line_no}: '{name}' is not a box defined in this file")
        edge["from"], edge["to"] = ids.get(a, ""), ids.get(b, "")

    if len(nodes) < 2:
        problems.append("need at least 2 boxes")
    if not edges:
        problems.append("need at least 1 arrow")
    if problems:
        raise FlowTxtError(problems)

    graph = {"schema_version": "1.0", "passage_id": source["passage_id"], "title": title,
             "nodes": nodes, "edges": edges}
    return graph, notes


def _build_report(findings: Findings, extra_warnings: list[tuple[str, str]] | None = None,
                  skip_codes: frozenset[str] = frozenset()) -> dict:
    checks: list[dict] = [{"name": code, "layer": "code", "status": "fail", "detail": msg} for code, msg in findings.errors]
    checks += [{"name": code, "layer": "code", "status": "warn", "detail": msg}
               for code, msg in findings.warnings if code not in skip_codes]
    checks += [{"name": code, "layer": "code", "status": "warn", "detail": msg} for code, msg in extra_warnings or []]
    if not findings.errors:
        checks.insert(0, {"name": "graph_invariants", "layer": "code", "status": "pass",
                          "detail": "V-F2 rules and anchors hold"})
    # Honest labelling (principle P5): code can check structure, not whether a claim really supports an arrow.
    checks.append({"name": "auditor_entailment", "layer": "auditor", "status": "warn",
                   "detail": "No auditor ran, so whether each arrow follows from its cited claims was not machine-checked."})
    statuses = {c["status"] for c in checks}
    status = "failed" if "fail" in statuses else "needs_human" if "warn" in statuses else "passed"
    return {"status": status, "checks": checks}


def flow_from_txt(text: str, source: dict, claim_list: dict, *, max_nodes: int | None = None) -> dict:
    """Return a FlowGraph dict with a `verification` block. Raises FlowTxtError if the txt is malformed."""
    graph, _ = parse_flow_txt(text, source, claim_list["claims"])
    graph["verification"] = _build_report(verify_flow(graph, source, claim_list["claims"], max_nodes))
    return graph
