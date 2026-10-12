import pytest

from app.services.evaluation import (
    mean_reciprocal_rank,
    recall_at_k,
    reciprocal_rank,
)


def test_recall_at_k():
    assert recall_at_k(
        ["a", "b", "c"],
        {"a", "c", "d"},
        k=3,
    ) == pytest.approx(2 / 3)


def test_recall_at_k_returns_zero_when_no_relevant_items_are_retrieved():
    assert recall_at_k(["x", "y"], {"a", "b"}, k=2) == 0.0


def test_recall_at_k_rejects_non_positive_k():
    with pytest.raises(ValueError):
        recall_at_k(["a"], {"a"}, k=0)


def test_reciprocal_rank():
    assert reciprocal_rank(["x", "b", "a"], {"a", "b"}) == 0.5


def test_reciprocal_rank_returns_zero_when_no_relevant_item_is_found():
    assert reciprocal_rank(["x", "y"], {"a"}) == 0.0


def test_mean_reciprocal_rank():
    assert mean_reciprocal_rank(
        [["a", "b"], ["x", "b"], ["x", "y"]],
        [{"a"}, {"b"}, {"z"}],
    ) == pytest.approx(0.5)


def test_mean_reciprocal_rank_rejects_mismatched_inputs():
    with pytest.raises(ValueError):
        mean_reciprocal_rank([["a"]], [])


def test_mean_reciprocal_rank_returns_zero_for_no_queries():
    assert mean_reciprocal_rank([], []) == 0.0