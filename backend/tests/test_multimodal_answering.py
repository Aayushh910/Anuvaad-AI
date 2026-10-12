
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


def test_image_fallback_when_retrieved_page_has_no_images(monkeypatch):
    """Use a limited image fallback when retrieved pages have no images."""
    monkeypatch.setattr(
        answering,
        "search_documents",
        lambda **kwargs: [
            {
                "text": "The document discusses sales performance.",
                "document_id": "doc123",
                "chunk_id": "chunk1",
                "chunk_index": 0,
                "score": 0.9,
                "metadata": {"page_number": 1, "content_type": "text"},
            }
        ],
    )

    monkeypatch.setattr(
        answering,
        "get_document_images",
        lambda document_id: [
            {
                "document_id": document_id,
                "image_path": f"/fake/chart_{page}.png",
                "filename": f"chart_{page}.png",
                "page_number": page,
                "image_index": 1,
                "content_type": "image",
            }
            for page in range(2, 7)
        ],
        raising=False,
    )

    analyzed_pages = []

    def fake_analyze_image(image_path, question, page_number=None):
        analyzed_pages.append(page_number)
        return {
            "answer": f"Visual evidence from page {page_number}.",
            "model": "test-vision-model",
            "page": page_number,
            "image_filename": image_path.split("/")[-1],
        }

    monkeypatch.setattr(
        answering, "analyze_image", fake_analyze_image, raising=False
    )

    class FakeChatGroq:
        def __init__(self, **kwargs):
            pass

        def invoke(self, messages):
            return SimpleNamespace(content="Sales evidence found [S2].")

    monkeypatch.setattr(answering, "ChatGroq", FakeChatGroq)

    result = answering.generate_answer(
        question="What does the sales chart show?",
        document_id="doc123",
    )

    assert analyzed_pages  # Fallback should find images on other pages.
    assert len(analyzed_pages) <= 3  # Never analyze more than three images.
    assert all(page != 1 for page in analyzed_pages)
    assert any(source["content_type"] == "image" for source in result["sources"])


def test_image_fallback_is_not_used_without_document_id(monkeypatch):
    """Avoid searching images across documents for an unscoped question."""
    monkeypatch.setattr(
        answering,
        "search_documents",
        lambda **kwargs: [
            {
                "text": "Some retrieved text.",
                "document_id": "doc123",
                "chunk_id": "chunk1",
                "chunk_index": 0,
                "score": 0.9,
                "metadata": {"page_number": 1, "content_type": "text"},
            }
        ],
    )

    def unexpected_lookup(document_id):
        raise AssertionError("Image lookup requires a specific document ID")

    monkeypatch.setattr(
        answering, "get_document_images", unexpected_lookup, raising=False
    )

    class FakeChatGroq:
        def __init__(self, **kwargs):
            pass

        def invoke(self, messages):
            return SimpleNamespace(content="Answer based on text [S1].")

    monkeypatch.setattr(answering, "ChatGroq", FakeChatGroq)

    result = answering.generate_answer(
        question="Summarize the document."
    )

    assert result["answer"] == "Answer based on text [S1]."
    assert len(result["sources"]) == 1


def test_text_answerable_question_skips_image_analysis(monkeypatch):
    monkeypatch.setattr(
        answering,
        "search_documents",
        lambda **kwargs: [
            {
                "text": (
                    "The first official Test match was played at the "
                    "Melbourne Cricket Ground in March 1877, and Australia "
                    "won by 45 runs."
                ),
                "document_id": "doc123",
                "chunk_id": "chunk1",
                "chunk_index": 0,
                "score": 0.95,
                "metadata": {
                    "page_number": 2,
                    "content_type": "text",
                },
            }
        ],
    )

    def unexpected_image_lookup(document_id):
        raise AssertionError(
            "Images should not be retrieved when text is sufficient."
        )

    monkeypatch.setattr(
        answering,
        "get_document_images",
        unexpected_image_lookup,
    )

    class FakeChatGroq:
        def __init__(self, **kwargs):
            pass

        def invoke(self, messages):
            return SimpleNamespace(
                content=(
                    "Australia won by 45 runs at the Melbourne "
                    "Cricket Ground [S1]."
                )
            )

    monkeypatch.setattr(answering, "ChatGroq", FakeChatGroq)

    result = answering.generate_answer(
        question="Where was the first official Test match played, and who won?",
        document_id="doc123",
    )

    assert "Australia won by 45 runs" in result["answer"]
    assert len(result["sources"]) == 1
    assert result["sources"][0]["content_type"] == "text"



def test_scorecard_question_uses_vision_when_text_lacks_boundaries(
    monkeypatch,
):
    monkeypatch.setattr(
        answering,
        "search_documents",
        lambda **kwargs: [
            {
                "text": (
                    "A. Verma scored 62 runs off 38 balls. "
                    "The full scorecard is provided as an image."
                ),
                "document_id": "doc123",
                "chunk_id": "chunk1",
                "chunk_index": 0,
                "score": 0.9,
                "metadata": {"page_number": 9, "content_type": "text"},
            }
        ],
    )

    monkeypatch.setattr(
    answering,
    "get_document_images",
    lambda document_id: [
        {
            "document_id": document_id,
            "image_path": "/fake/line_chart.png",
            "filename": "page_9_image_1.png",
            "page_number": 9,
            "image_index": 1,
            "content_type": "image",
            "caption": "Line chart showing run progression",
        },
        {
            "document_id": document_id,
            "image_path": "/fake/scorecard.png",
            "filename": "page_9_image_2.png",
            "page_number": 9,
            "image_index": 2,
            "content_type": "image",
            "caption": "Scorecard showing runs, fours and sixes",
        },
    ],
)

    analyzed = []

    def fake_analyze_image(image_path, question, page_number=None):
        analyzed.append(image_path)
        return {
            "answer": (
                "A. Verma scored 62 runs, hit 6 fours and 3 sixes."
            ),
            "model": "test-vision-model",
            "page": page_number,
            "image_filename": image_path.split("/")[-1],
        }

    monkeypatch.setattr(answering, "analyze_image", fake_analyze_image)

    class FakeChatGroq:
        def __init__(self, **kwargs):
            pass

        def invoke(self, messages):
            prompt = str(messages)
            if "Visual analysis:" in prompt:
                return SimpleNamespace(
                    content=(
                        "A. Verma scored 62 runs, 6 fours and 3 sixes [S2]."
                    )
                )
            return SimpleNamespace(
                content=(
                    "A. Verma scored 62 runs, but the number of fours "
                    "and sixes is not available [S1]."
                )
            )

    monkeypatch.setattr(answering, "ChatGroq", FakeChatGroq)

    result = answering.generate_answer(
        question=(
            "According to the scorecard, how many runs did A. Verma score, "
            "and how many fours and sixes did he hit?"
        ),
        document_id="doc123",
    )

    assert analyzed == ["/fake/scorecard.png"]
    assert any("scorecard" in path for path in analyzed)
    assert "6 fours" in result["answer"]
    assert "3 sixes" in result["answer"]
