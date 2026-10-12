
from types import SimpleNamespace

from app.services import answering


def test_generate_answer_includes_relevant_image_evidence(monkeypatch):
    monkeypatch.setattr(
        answering,
        "search_documents",
        lambda **kwargs: [
            {
                "text": "Figure 1 shows annual sales.",
                "document_id": "doc123",
                "chunk_id": "chunk1",
                "chunk_index": 0,
                "score": 0.9,
                "metadata": {"page_number": 2, "content_type": "text"},
            }
        ],
    )

    monkeypatch.setattr(
        answering,
        "get_document_images",
        lambda document_id: [
            {
                "document_id": document_id,
                "image_path": "/fake/chart.png",
                "filename": "chart.png",
                "page_number": 2,
                "image_index": 1,
                "content_type": "image",
            }
        ],
        raising=False,
    )

    monkeypatch.setattr(
        answering,
        "analyze_image",
        lambda image_path, question, page_number=None: {
            "answer": "The chart shows sales increasing from 100 to 200.",
            "model": "test-vision-model",
            "page": page_number,
            "image_filename": "chart.png",
        },
        raising=False,
    )

    captured = {}

    class FakeChatGroq:
        def __init__(self, **kwargs):
            captured["model"] = kwargs["model"]

        def invoke(self, messages):
            captured["messages"] = messages
            return SimpleNamespace(
                content="Sales increased from 100 to 200 [S2]."
            )

    monkeypatch.setattr(answering, "ChatGroq", FakeChatGroq)

    result = answering.generate_answer(
        question="What trend does the sales chart show?",
        document_id="doc123",
    )

    assert "increased from 100 to 200" in result["answer"]
    assert len(result["sources"]) == 2
    assert result["sources"][1]["content_type"] == "image"
    assert result["sources"][1]["page"] == 2
    assert "100 to 200" in str(captured["messages"])


def test_generate_answer_keeps_text_only_behavior(monkeypatch):
    monkeypatch.setattr(
        answering,
        "search_documents",
        lambda **kwargs: [
            {
                "text": "The report was published in 2025.",
                "document_id": "doc123",
                "chunk_id": "chunk1",
                "chunk_index": 0,
                "score": 0.9,
                "metadata": {"page_number": 1, "content_type": "text"},
            }
        ],
    )

    # No document ID means image analysis should not run.
    def unexpected_image_lookup(document_id):
        raise AssertionError("Image lookup should not run without a document ID")

    monkeypatch.setattr(
        answering,
        "get_document_images",
        unexpected_image_lookup,
        raising=False,
    )

    class FakeChatGroq:
        def __init__(self, **kwargs):
            pass

        def invoke(self, messages):
            return SimpleNamespace(content="Published in 2025 [S1].")

    monkeypatch.setattr(answering, "ChatGroq", FakeChatGroq)

    result = answering.generate_answer(
        question="When was the report published?"
    )

    assert result["answer"] == "Published in 2025 [S1]."
    assert len(result["sources"]) == 1
    assert result["sources"][0]["content_type"] == "text"
