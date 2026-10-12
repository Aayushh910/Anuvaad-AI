
from collections import defaultdict


def reciprocal_rank_fusion(
    result_lists: list[list[dict]],
    k: int = 60,
    limit: int = 5,
) -> list[dict]:
    """Merge ranked retrieval results using Reciprocal Rank Fusion."""

    if k <= 0:
        raise ValueError("k must be greater than zero.")

    if limit <= 0:
        raise ValueError("limit must be greater than zero.")

    scores = defaultdict(float)
    results_by_id = {}

    for results in result_lists:
        seen_in_list = set()

        for rank, result in enumerate(results, start=1):
            chunk_id = result.get("chunk_id")

            if not chunk_id or chunk_id in seen_in_list:
                continue

            seen_in_list.add(chunk_id)
            scores[chunk_id] += 1.0 / (k + rank)
            results_by_id[chunk_id] = result

    ranked_ids = sorted(
        scores,
        key=lambda chunk_id: (-scores[chunk_id], chunk_id),
    )

    merged = []

    for chunk_id in ranked_ids[:limit]:
        result = dict(results_by_id[chunk_id])
        result["rrf_score"] = scores[chunk_id]
        merged.append(result)

    return merged
