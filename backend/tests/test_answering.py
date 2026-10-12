
from unittest.mock import patch

from app.services.answering import generate_answer


def test_generate_answer_uses_retrieved_sources():
    fake_results = [
        {
            "score": 0.75,
            "document_id": "doc-123",
            "chunk_id": "chunk-1",
            "chunk_index": 0,
            "text": "Continuous arrival of readers can cause writer starvation.",
            "metadata": {},
        }
    ]

    class FakeResponse:
        content = "Reader preference can cause writer starvation. [S1]"

    with (
        patch(
            "app.services.answering.search_documents",
            return_value=fake_results,
        ),
        patch("app.services.answering.ChatGroq") as mock_llm,
    ):
        mock_llm.return_value.invoke.return_value = FakeResponse()

        result = generate_answer(
            question="Why can writer starvation occur?",
            document_id="doc-123",
        )

    assert "writer starvation" in result["answer"].lower()
    assert "[S1]" in result["answer"]
    assert len(result["sources"]) == 1
    assert result["sources"][0]["chunk_id"] == "chunk-1"



from app.services.answering import _has_insufficient_evidence


def test_detects_invalid_source_citation():
    answer = "The answer is 42. [S2]"

    assert _has_insufficient_evidence(
        answer,
        max_source_index=1,
    )


def test_detects_insufficient_evidence_response():
    answer = (
        "I don't have enough information "
        "to answer this question."
    )

    assert _has_insufficient_evidence(
        answer,
        max_source_index=1,
    )


def test_accepts_valid_source_number():
    answer = "Writer starvation can occur. [S1]"

    assert not _has_insufficient_evidence(
        answer,
        max_source_index=1,
    )


def test_invalid_citation_triggers_image_fallback():
    fake_results = [
        {
            "score": 0.75,
            "document_id": "doc-123",
            "chunk_id": "chunk-1",
            "chunk_index": 0,
            "text": "The document discusses synchronization.",
            "metadata": {},
        }
    ]

    class FakeResponse:
        content = "The answer is 42. [S2]"

    with (
        patch(
            "app.services.answering.search_documents",
            return_value=fake_results,
        ),
        patch("app.services.answering.ChatGroq") as mock_llm,
        patch(
            "app.services.answering.get_document_images",
            return_value=[],
        ) as mock_images,
    ):
        mock_llm.return_value.invoke.return_value = FakeResponse()

        result = generate_answer(
            question="What is the answer?",
            document_id="doc-123",
        )

    mock_images.assert_called_once_with("doc-123")
    assert result["answer"] != "The answer is 42. [S2]"
