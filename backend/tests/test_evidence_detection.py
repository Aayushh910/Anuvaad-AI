
import pytest

from app.services.answering import _has_insufficient_evidence


@pytest.mark.parametrize(
    "answer",
    [
        "The document does not contain enough evidence to answer.",
        "The provided document does not state the exact number of runs.",
        "The document does not provide the requested information.",
        "The provided text does not state the exact total.",
        "I cannot determine this from the supplied information.",
        "The provided document does not contain any information about dismissal types.",
        "The image does not contain the information needed to answer.",
    ],
)
def test_refusal_phrases_trigger_visual_fallback(answer):
    assert _has_insufficient_evidence(answer, max_source_index=1)


def test_supported_answer_does_not_trigger_visual_fallback():
    answer = "Mumbai Strikers scored 89 runs after 10 overs [S1]."
    assert not _has_insufficient_evidence(answer, max_source_index=1)
