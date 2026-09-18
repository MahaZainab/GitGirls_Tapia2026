"""Small text helpers. numbers_in / words mirror tools/validate_bundle.py so both agree on V-F2-09."""
import re

NUMWORDS = {w: str(i) for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve".split())}
NUMWORDS.pop("one")  # ambiguous pronoun
NUM_RE = re.compile(r"(?<![A-Za-z0-9.])(\d[\d,]*(?:\.\d+)?)(?![A-Za-z0-9])")


def numbers_in(text: str | None) -> set[str]:
    t = (text or "").lower()
    found = {m.group(1).replace(",", "").rstrip(".") for m in NUM_RE.finditer(t)}
    found |= {NUMWORDS[w] for w in re.findall(r"[a-z]+", t) if w in NUMWORDS}
    found.discard("1")
    return found


def word_count(text: str | None) -> int:
    return len((text or "").split())


# Offsets in the contract are UTF-16 code units (spec X-08); Python strings index by code point.
def to_utf16(text: str, index: int) -> int:
    return len(text[:index].encode("utf-16-le")) // 2


def utf16_slice(text: str, start: int, end: int) -> str:
    raw = text.encode("utf-16-le")
    return raw[2 * start : 2 * end].decode("utf-16-le", errors="replace")
