def recall_at_k(retrieved_ids: list[str], relevant_ids: set[str], k: int) -> float:
    """Fraction of relevant items retrieved in the top k results."""
    if k <= 0:
        raise ValueError("k must be greater than zero")

    if not relevant_ids:
        return 0.0

    retrieved_top_k = set(retrieved_ids[:k])
    return len(retrieved_top_k & relevant_ids) / len(relevant_ids)


def reciprocal_rank(retrieved_ids: list[str], relevant_ids: set[str]) -> float:
    """Reciprocal rank of the first relevant result."""
    if not relevant_ids:
        return 0.0

    for rank, item_id in enumerate(retrieved_ids, start=1):
        if item_id in relevant_ids:
            return 1.0 / rank

    return 0.0


def mean_reciprocal_rank(
    result_lists: list[list[str]],
    relevant_id_sets: list[set[str]],
) -> float:
    """Mean reciprocal rank across multiple queries."""
    if len(result_lists) != len(relevant_id_sets):
        raise ValueError(
            "result_lists and relevant_id_sets must have equal lengths"
        )

    if not result_lists:
        return 0.0

    scores = [
        reciprocal_rank(results, relevant)
        for results, relevant in zip(result_lists, relevant_id_sets)
    ]

    return sum(scores) / len(scores)