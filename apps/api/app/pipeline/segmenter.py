"""Deterministic sentence segmenter. FOUNDATION-owned (spec section 2.2, 2.6).

Splits ingested text into `Sentence` records with ids and offsets. Offsets are
defined by the contract (X-08) as UTF-16 code units, matching JavaScript
`String.slice`. `utf16_len`/`to_utf16_offset` do that conversion; for text made
only of BMP characters (the common case, and true of every shipped fixture)
UTF-16 offsets and Python code-point offsets coincide, which is why the
reference validator (`tools/validate_bundle.py`) can slice `Source.text`
directly without converting.
"""
from __future__ import annotations

import re
import unicodedata
from typing import List

from app.models import Sentence, Source

_SENTENCE_RE = re.compile(r"[^.!?]+(?:[.!?]+(?=\s|$)|\Z)", re.S)


def utf16_len(text: str) -> int:
    """Length of `text` in UTF-16 code units (astral chars count as 2)."""
    return sum(2 if ord(ch) > 0xFFFF else 1 for ch in text)


def to_utf16_offset(text: str, code_point_index: int) -> int:
    """Convert a Python (code point) index into `text` into a UTF-16 offset."""
    return utf16_len(text[:code_point_index])


def normalize_text(raw: str) -> str:
    """NFC-normalize and force `\\n` line endings, per X-08."""
    text = unicodedata.normalize("NFC", raw)
    return text.replace("\r\n", "\n").replace("\r", "\n")


def segment(passage_id: str, title: str, language: str, raw_text: str) -> Source:
    text = normalize_text(raw_text)
    sentences: List[Sentence] = []
    sid = 1
    for para in text.split("\n\n"):
        if not para.strip():
            continue
        para_start = text.index(para)
        for match in _SENTENCE_RE.finditer(para):
            chunk = match.group(0)
            stripped = chunk.strip()
            if not stripped:
                continue
            local_start = match.start() + chunk.index(stripped)
            start_cp = para_start + local_start
            end_cp = start_cp + len(stripped)
            sentences.append(
                Sentence(
                    id=f"S{sid}",
                    start=to_utf16_offset(text, start_cp),
                    end=to_utf16_offset(text, end_cp),
                    text=stripped,
                )
            )
            sid += 1
    if not sentences:
        raise ValueError("segment() produced no sentences from the given text")
    return Source(
        schema_version="1.0",
        passage_id=passage_id,
        title=title,
        language=language,
        text=text,
        sentences=sentences,
    )
