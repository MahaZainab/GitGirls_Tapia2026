"""Code-layer verification for FlowGraph (rules V-F2-01..09 plus the shared anchor and id rules).

Mirrors the F2 section of tools/validate_bundle.py, working on in-memory dicts so the generator
can run it on a summary before storing it. Keep the two in step; test_flow_verify.py checks the fixture passes both.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from .textutil import numbers_in, utf16_slice, word_count


@dataclass
class Findings:
    errors: list[tuple[str, str]] = field(default_factory=list)
    warnings: list[tuple[str, str]] = field(default_factory=list)

    def err(self, code: str, msg: str) -> None:
        self.errors.append((code, msg))

    def warn(self, code: str, msg: str) -> None:
        self.warnings.append((code, msg))

    def error_lines(self) -> list[str]:
        return [f"[{c}] {m}" for c, m in self.errors]


def _check_anchor(anchor: dict, source: dict, sentences: dict, out: Findings, where: str) -> None:
    if utf16_slice(source["text"], anchor["start"], anchor["end"]) != anchor["quote"]:
        out.err("V-ANCH-01", f"{where}: quote does not equal source.text[{anchor['start']}:{anchor['end']}]")
        return
    sentence = sentences.get(anchor["sentence_id"])
    if sentence is None:
        out.err("V-REF-01", f"{where}: unknown sentence {anchor['sentence_id']}")
    elif not (sentence["start"] <= anchor["start"] and anchor["end"] <= sentence["end"]):
        out.err("V-ANCH-02", f"{where}: anchor is outside sentence {anchor['sentence_id']}")


def _has_cycle(start: str, out_edges: dict[str, list[dict]]) -> tuple[str, str] | None:
    state: dict[str, int] = {}
    stack = [(start, iter(out_edges.get(start, [])))]
    state[start] = 1
    while stack:
        node, edges = stack[-1]
        for edge in edges:
            nxt = edge["to"]
            if state.get(nxt) == 1:
                return node, nxt
            if nxt not in state:
                state[nxt] = 1
                stack.append((nxt, iter(out_edges.get(nxt, []))))
                break
        else:
            state[node] = 2
            stack.pop()
    return None


def verify_flow(flow: dict, source: dict, claims: list[dict], max_nodes: int | None = None) -> Findings:
    out = Findings()
    sentences = {s["id"]: s for s in source["sentences"]}
    claim_by_id = {c["id"]: c for c in claims}

    def claim_numbers(ids: list[str]) -> set[str]:
        found: set[str] = set()
        for cid in ids:
            if cid in claim_by_id:
                found |= numbers_in(claim_by_id[cid]["text"]) | numbers_in(claim_by_id[cid]["anchor"]["quote"])
        return found

    def known_claims(ids: list[str], where: str) -> None:
        for cid in ids:
            if cid not in claim_by_id:
                out.err("V-REF-01", f"{where}: unknown claim {cid}")

    nodes = {n["id"]: n for n in flow["nodes"]}
    if len(nodes) != len(flow["nodes"]):
        out.err("V-ID-01", "nodes: duplicate ids")
    if len({e["id"] for e in flow["edges"]}) != len(flow["edges"]):
        out.err("V-ID-01", "edges: duplicate ids")
    if max_nodes is not None and len(flow["nodes"]) > max_nodes:
        out.err("V-F2-MAX", f"graph has {len(flow['nodes'])} nodes but max_nodes is {max_nodes}")

    out_edges: dict[str, list[dict]] = defaultdict(list)
    in_edges: dict[str, int] = defaultdict(int)
    for edge in flow["edges"]:
        where = f"edge {edge['id']}"
        if edge["from"] not in nodes or edge["to"] not in nodes:
            out.err("V-F2-05", f"{where}: references a missing node")
            continue
        if edge["from"] == edge["to"]:
            out.err("V-F2-05", f"{where}: self loop")
        known_claims(edge["claim_ids"], where)
        if edge["basis"] == "implied":
            if not edge.get("rationale"):
                out.err("V-F2-06", f"{where}: implied edge needs a rationale")
            else:
                out.warn("V-F2-06", f"{where}: implied edge, route to human review")
        out_edges[edge["from"]].append(edge)
        in_edges[edge["to"]] += 1

    starts = [n for n in flow["nodes"] if n["kind"] == "terminal_start"]
    ends = [n for n in flow["nodes"] if n["kind"] == "terminal_end"]
    if len(starts) != 1:
        out.err("V-F2-01", "exactly one terminal_start is required")
    if not ends:
        out.err("V-F2-01", "at least one terminal_end is required")

    for node in flow["nodes"]:
        where = f"node {node['id']}"
        known_claims(node["claim_ids"], where)
        if node.get("anchor"):
            _check_anchor(node["anchor"], source, sentences, out, where)
        if word_count(node["label"]) > 12:
            out.err("V-F2-07", f"{where}: label over 12 words")
        if not numbers_in(node["label"] + " " + node.get("detail", "")) <= claim_numbers(node["claim_ids"]):
            out.err("V-F2-09", f"{where}: number not in cited claims")
        outs = out_edges.get(node["id"], [])
        kind = node["kind"]
        if kind == "decision":
            labels = [e.get("label", "") for e in outs]
            if len(outs) < 2 or any(not label for label in labels) or len(set(labels)) != len(labels):
                out.err("V-F2-03", f"{where}: decision needs 2+ outgoing edges with unique non-empty labels")
        elif kind in ("process", "terminal_start"):
            if len(outs) != 1:
                out.err("V-F2-04", f"{where}: {kind} needs exactly one outgoing edge")
        elif kind == "terminal_end" and outs:
            out.err("V-F2-04", f"{where}: terminal_end cannot have outgoing edges")
        elif kind == "note" and (outs or in_edges.get(node["id"])):
            out.err("V-F2-04", f"{where}: note nodes cannot have edges")

    if len(starts) == 1:
        seen: set[str] = set()
        stack = [starts[0]["id"]]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            stack += [e["to"] for e in out_edges.get(current, []) if e["to"] in nodes]
        for node in flow["nodes"]:
            if node["kind"] != "note" and node["id"] not in seen:
                out.err("V-F2-02", f"node {node['id']} is not reachable from the start")
        loop = _has_cycle(starts[0]["id"], out_edges)
        if loop:
            out.err("V-F2-08", f"cycle through {loop[0]} to {loop[1]} (cycles are not supported in v1)")
    return out
