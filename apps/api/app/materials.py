"""Material ingestion: turn pasted text, a link, or an uploaded PDF into raw
text for the segmenter (spec section 6, G5 "Add material"). G5 is listed as
context-only ("do not build") for the F1-F4 feature agents, but something has
to produce a `Source` for those features to have anything to render, so
FOUNDATION provides this minimal version: no OCR, no JS-rendered pages, no
paywall handling -- just enough to get real text into the existing
segmenter/claims pipeline (`app/store.py: create_passage`).

Not a spec contract (section 3.2 only documents `POST /api/passages` with a
`{title, text}` body) -- this is an addition, wired up at `POST /api/materials`
in `app/main.py`.
"""
from __future__ import annotations

import io
from html import unescape
from html.parser import HTMLParser

import httpx
from fastapi import HTTPException
from pypdf import PdfReader


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in ("script", "style"):
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style") and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0 and data.strip():
            self.chunks.append(data.strip())


def html_to_text(raw_html: str) -> str:
    """Best-effort visible-text extraction. Not a full readability pass --
    it keeps nav/footer text too. Good enough for "paste a link" in v1."""
    parser = _TextExtractor()
    parser.feed(raw_html)
    return unescape(" ".join(parser.chunks))


def extract_pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"could not read PDF: {exc}") from exc
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    text = "\n\n".join(p for p in pages if p)
    if not text:
        raise HTTPException(status_code=422, detail="no extractable text found in PDF (is it scanned/image-only?)")
    return text


def fetch_url_text(url: str) -> str:
    try:
        resp = httpx.get(url, timeout=10, follow_redirects=True, headers={"User-Agent": "StudyShift/1.0"})
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=422, detail=f"could not fetch url: {exc}") from exc

    content_type = resp.headers.get("content-type", "")
    if "pdf" in content_type or url.lower().endswith(".pdf"):
        return extract_pdf_text(resp.content)
    return html_to_text(resp.text)
