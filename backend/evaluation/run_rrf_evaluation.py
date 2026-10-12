
import json
from pathlib import Path

from app.services.evaluation import mean_reciprocal_rank, recall_at_k
from app.services.ranking import reciprocal_rank_fusion
from app.services.vector_store import search_documents


BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "evaluation" / "retrieval_dataset.json"

# These formulations are generic; no topic-specific rules are used.
def generate_query_variants(query: str) -> list[str]:
    return [
        query,
        f"Relevant facts and evidence about: {query}",
        f"Find the passage that directly answers: {query}",
    ]


def main() -> None:
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))

    if not dataset:
        raise ValueError("Evaluation dataset is empty.")

    result_lists = []
    relevant_id_sets = []
    recall_scores = []

    for case in dataset:
        query = case["query"]
        document_id = case["document_id"]
        relevant_ids = set(case["relevant_chunk_ids"])
        k = case.get("k", 5)

        variants = generate_query_variants(query)
        candidate_lists = [
            search_documents(
                query=variant,
                limit=k,
                document_id=document_id,
            )
            for variant in variants
        ]

        results = reciprocal_rank_fusion(
            candidate_lists,
            limit=k,
        )

        retrieved_ids = [
            result["chunk_id"]
            for result in results
            if result.get("chunk_id")
        ]

        recall = recall_at_k(retrieved_ids, relevant_ids, k)
        recall_scores.append(recall)
        result_lists.append(retrieved_ids)
        relevant_id_sets.append(relevant_ids)

        print(f"\nQuery: {query}")
        print(f"Retrieved chunks: {retrieved_ids}")
        print(f"Relevant chunks: {sorted(relevant_ids)}")
        print(f"Recall@{k}: {recall:.3f}")

    mean_recall = sum(recall_scores) / len(recall_scores)
    mrr = mean_reciprocal_rank(result_lists, relevant_id_sets)

    print("\n--- RRF Evaluation Summary ---")
    print(f"Queries evaluated: {len(dataset)}")
    print(f"Mean Recall@K: {mean_recall:.3f}")
    print(f"MRR: {mrr:.3f}")


if __name__ == "__main__":
    main()
