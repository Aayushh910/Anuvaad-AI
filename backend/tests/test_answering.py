
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
