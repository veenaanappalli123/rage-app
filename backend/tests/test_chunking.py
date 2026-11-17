
import pytest

from app.services.chunking import split_into_chunks


def test_empty_text_returns_no_chunks():
    assert split_into_chunks("") == []


def test_short_text_returns_one_chunk():
    assert split_into_chunks("Hello RAG") == ["Hello RAG"]


def test_chunks_respect_maximum_size():
    text = "A" * 250
    chunks = split_into_chunks(text, chunk_size=100, overlap=20)

    assert all(len(chunk) <= 100 for chunk in chunks)


def test_overlap_is_preserved():
    text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    chunks = split_into_chunks(text, chunk_size=10, overlap=3)

    assert chunks[0][-3:] == chunks[1][:3]


def test_invalid_overlap_is_rejected():
    with pytest.raises(ValueError):
        split_into_chunks("Some text", chunk_size=10, overlap=10)
