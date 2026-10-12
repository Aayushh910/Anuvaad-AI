
import pytest

from app.services.ranking import reciprocal_rank_fusion


def test_rrf_promotes_chunk_ranked_high_in_multiple_lists():
    first = [
        {"chunk_id": "a", "text": "A"},
        {"chunk_id": "b", "text": "B"},
    ]
    second = [
        {"chunk_id": "b", "text": "B"},
        {"chunk_id": "c", "text": "C"},
    ]

    results = reciprocal_rank_fusion(
        [first, second],
        limit=3,
    )

    assert results[0]["chunk_id"] == "b"


def test_rrf_removes_duplicate_chunks():
    results = reciprocal_rank_fusion(
        [[
            {"chunk_id": "a"},
            {"chunk_id": "a"},
        ]],
        limit=5,
    )

    assert [item["chunk_id"] for item in results] == ["a"]


def test_rrf_respects_limit():
    results = reciprocal_rank_fusion(
        [[{"chunk_id": "a"}, {"chunk_id": "b"}]],
        limit=1,
    )

    assert len(results) == 1


@pytest.mark.parametrize(
    ("k", "limit"),
    [(0, 5), (-1, 5), (60, 0), (60, -1)],
)
def test_rrf_rejects_invalid_arguments(k, limit):
    with pytest.raises(ValueError):
        reciprocal_rank_fusion([], k=k, limit=limit)
