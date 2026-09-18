from app.pipeline.segmenter import segment, to_utf16_offset, utf16_len


def test_segment_produces_sentences_with_matching_offsets():
    text = "First sentence here. Second one follows.\n\nA new paragraph starts."
    source = segment("t1", "Title", "en", text)
    assert len(source.sentences) == 3
    for s in source.sentences:
        assert source.text[s.start : s.end] == s.text


def test_segment_ids_are_sequential():
    source = segment("t1", "Title", "en", "One. Two. Three.")
    assert [s.id for s in source.sentences] == ["S1", "S2", "S3"]


def test_utf16_len_counts_astral_characters_as_two_units():
    # U+1F600 (an emoji) lies outside the BMP and needs a UTF-16 surrogate pair.
    assert utf16_len("a") == 1
    assert utf16_len("\U0001F600") == 2
    assert utf16_len("a\U0001F600b") == 4


def test_to_utf16_offset_matches_code_point_offset_for_bmp_text():
    text = "plain ascii text"
    for i in range(len(text) + 1):
        assert to_utf16_offset(text, i) == i


def test_segment_normalizes_line_endings():
    source = segment("t1", "Title", "en", "Line one.\r\nLine two.")
    assert "\r" not in source.text
