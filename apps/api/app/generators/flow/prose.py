"""Pasted text to flowchart, with no model.

Plain rules over the wording of the text, one sentence at a time:

    "If X, then Y."      -> a decision "X?" with a yes arrow to a step "Y"
    "Otherwise, Z."      -> right after an if-sentence: the no arrow goes to a step "Z"
    any other sentence   -> a step

Steps follow the order of the sentences. Text that is not written as steps or if/then rules still
gets a flowchart, but only a plain sequence, and every arrow that only comes from sentence order is
marked `implied`, so the banner tells the learner to check it against the original.
"""
from __future__ import annotations

import re

from .generator import Findings, _build_report
from .textutil import to_utf16
from .verify import verify_flow

MAX_ITEMS = 55  # keeps the finished graph under ~60 boxes (F2-R11)
MAX_WORDS = 12  # V-F2-07
TRAILING = " \t\n.!?;:,"

COND = re.compile(r"^(?:if|when|whenever|once)\s+(?P<cond>.+?)\s*,\s*(?:then\s+)?(?P<then>.+)$", re.I | re.S)
COND_THEN = re.compile(r"^(?:if|when|whenever|once)\s+(?P<cond>.+?)\s+then\s+(?P<then>.+)$", re.I | re.S)
OTHERWISE = re.compile(r"^(?:otherwise|else|if not|if no|if none)\b[\s,:-]*(?P<then>.*)$", re.I | re.S)


class ProseError(ValueError):
    pass


def derive_claims(source: dict) -> dict:
    """One claim per sentence. Stands in for claim extraction when none exists (the extractor needs a model)."""
    claims = []
    for i, s in enumerate(source["sentences"], start=1):
        quote = s["text"][:400]
        claims.append({
            "id": f"C{i}", "text": s["text"], "sentence_ids": [s["id"]], "must_keep": [],
            "anchor": {"sentence_id": s["id"], "start": s["start"], "end": s["start"] + to_utf16(quote, len(quote)),
                       "quote": quote},
        })
    return {"schema_version": "1.0", "passage_id": source["passage_id"], "claims": claims}


def _span(text: str, start: int, end: int) -> tuple[int, int]:
    while end > start and text[end - 1] in TRAILING:
        end -= 1
    while start < end and text[start].isspace():
        start += 1
    return start, end


def _label(text: str, question: bool = False) -> str:
    words = text.split()
    cut = len(words) > MAX_WORDS
    label = " ".join(words[:MAX_WORDS])
    if len(label) > 96:
        label, cut = label[:96].rsplit(" ", 1)[0], True
    label = (label[:1].upper() + label[1:]) if label else label
    return label + ("…" if cut else "") + ("?" if question else "")


class _Builder:
    def __init__(self, source: dict, claims_by_sentence: dict[str, list[str]]):
        self.source, self.claims_by_sentence = source, claims_by_sentence
        self.nodes: list[dict] = []
        self.edges: list[dict] = []
        self.pending: list[tuple[str, str | None]] = []  # (node id, edge label) waiting for the next box

    def _anchor(self, sentence: dict, a: int, b: int) -> dict | None:
        a, b = _span(sentence["text"], a, b)
        quote = sentence["text"][a:b]
        if not quote or len(quote) > 400:
            quote = sentence["text"][:400].rstrip(TRAILING)
            a, b = 0, len(quote)
            if not quote:
                return None
        start = sentence["start"] + to_utf16(sentence["text"], a)
        return {"sentence_id": sentence["id"], "start": start, "end": start + to_utf16(quote, len(quote)), "quote": quote}

    def node(self, kind: str, label: str, sentence: dict, span: tuple[int, int] | None = None, tone: str = "neutral") -> str:
        nid = f"N{len(self.nodes) + 1}"
        node: dict = {"id": nid, "kind": kind, "label": label, "tone": tone,
                      "claim_ids": self.claims_by_sentence[sentence["id"]]}
        if kind not in ("terminal_start", "terminal_end"):
            detail = sentence["text"] if len(sentence["text"]) <= 300 else sentence["text"][:299].rstrip() + "…"
            if detail != label:
                node["detail"] = detail
            anchor = self._anchor(sentence, *(span or (0, len(sentence["text"]))))
            if anchor:
                node["anchor"] = anchor
        self.nodes.append(node)
        return nid

    def edge(self, a: str, b: str, claims: list[str], label: str | None = None, why: str | None = None) -> None:
        edge: dict = {"id": f"E{len(self.edges) + 1}", "from": a, "to": b, "claim_ids": claims,
                      "basis": "implied" if why else "stated"}
        if label:
            edge["label"] = label
        if why:
            edge["rationale"] = why
        self.edges.append(edge)

    def arrive(self, nid: str, claims: list[str]) -> None:
        """Connect everything waiting to the new box. Plain sequence links are implied (order of the text)."""
        for src, label in self.pending:
            if label:  # a "no" branch that fell through to here
                self.edge(src, nid, claims, label=label, why="No 'otherwise' was written, so this branch continues with the next sentence.")
            else:
                self.edge(src, nid, claims, why="Follows the order of the sentences in the text.")
        self.pending = []


def _items(sentences: list[dict]) -> list[dict]:
    items: list[dict] = []
    for s in sentences:
        text = s["text"]
        prev = items[-1] if items else None
        if (m := OTHERWISE.match(text)) and prev and prev["type"] == "cond" and "else" not in prev:
            a, b = _span(text, m.start("then"), len(text))
            if b > a:
                prev["else"] = (s, a, b)
                continue
        if m := COND.match(text) or COND_THEN.match(text):
            ca, cb = _span(text, m.start("cond"), m.end("cond"))
            ta, tb = _span(text, m.start("then"), len(text))
            if cb > ca and tb > ta:
                items.append({"type": "cond", "s": s, "cond": (ca, cb), "then": (ta, tb)})
                continue
        items.append({"type": "step", "s": s})
    return items


def flow_from_prose(source: dict, claim_list: dict | None = None) -> tuple[dict, dict]:
    """Return (FlowGraph, claims used). Claims are derived per sentence when none are given."""
    claims = claim_list or derive_claims(source)
    by_sentence: dict[str, list[str]] = {}
    for c in claims["claims"]:
        for sid in c["sentence_ids"]:
            by_sentence.setdefault(sid, []).append(c["id"])
    sentences = [s for s in source["sentences"] if s["id"] in by_sentence]
    if not sentences:
        raise ProseError("There are no sentences to build a flowchart from.")
    items = _items(sentences)
    if len(items) > MAX_ITEMS:
        raise ProseError(f"This text has {len(items)} steps; a flowchart stays readable up to about {MAX_ITEMS}. Paste a shorter passage.")

    b = _Builder(source, by_sentence)
    first, last = sentences[0], sentences[-1]
    start = b.node("terminal_start", "Start", first)
    b.pending = [(start, None)]

    for item in items:
        s = item["s"]
        claim_ids = by_sentence[s["id"]]
        text = s["text"]
        if item["type"] == "step":
            nid = b.node("process", _label(text.rstrip(TRAILING)), s)
            b.arrive(nid, claim_ids)
            b.pending = [(nid, None)]
            continue
        (ca, cb), (ta, tb) = item["cond"], item["then"]
        decision = b.node("decision", _label(text[ca:cb], question=True), s, (ca, cb))
        b.arrive(decision, claim_ids)
        yes = b.node("process", _label(text[ta:tb]), s, (ta, tb))
        b.edge(decision, yes, claim_ids, label="yes")
        b.pending = [(yes, None)]
        if "else" in item:
            es, ea, eb = item["else"]
            no = b.node("process", _label(es["text"][ea:eb]), es, (ea, eb))
            b.edge(decision, no, by_sentence[es["id"]], label="no")
            b.pending.append((no, None))
        else:
            b.pending.append((decision, "no"))

    end = b.node("terminal_end", "End", last)
    b.arrive(end, by_sentence[last["id"]])

    graph = {"schema_version": "1.0", "passage_id": source["passage_id"], "title": source["title"],
             "nodes": b.nodes, "edges": b.edges}
    findings: Findings = verify_flow(graph, source, claims["claims"])
    implied = sum(1 for e in graph["edges"] if e["basis"] == "implied")
    graph["verification"] = _build_report(
        findings,
        extra_warnings=[
            ("built_from_text_rules", "Built by simple rules from the wording of the text (no AI). "
                                      "Check it against the original before relying on it."),
            ("V-F2-06", f"{implied} arrow(s) only follow the order of the sentences and are marked implied."),
        ],
        skip_codes=frozenset({"V-F2-06"}),
    )
    return graph, claims
