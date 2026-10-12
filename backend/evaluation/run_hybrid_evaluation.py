import json
import argparse
from pathlib import Path

from app.services.bm25_retrieval import search_documents_bm25
from app.services.evaluation import mean_reciprocal_rank, recall_at_k
from app.services.ranking import reciprocal_rank_fusion
from app.services.vector_store import search_documents


BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "evaluation" / "retrieval_dataset.json"


def get_chunk_ids(results: list[dict]) -> list[str]:
    return [
        result["chunk_id"]
        for result in results
        if result.get("chunk_id")
    ]


def evaluate_results(
    dataset: list[dict],
    retrieval_method,
    method_name: str,
) -> tuple[float, float]:
    result_lists = []
    relevant_id_sets = []
    recall_scores = []

    print(f"\n{'=' * 12} {method_name} {'=' * 12}")

    for case in dataset:
        query = case["query"]
        document_id = case["document_id"]
        relevant_ids = set(case["relevant_chunk_ids"])
        k = case.get("k", 5)

        results = retrieval_method(query, document_id, k)
        retrieved_ids = get_chunk_ids(results)

        recall = recall_at_k(retrieved_ids, relevant_ids, k)
        recall_scores.append(recall)
        result_lists.append(retrieved_ids)
        relevant_id_sets.append(relevant_ids)

        print(f"\nQuery: {query}")
        print(f"Retrieved: {retrieved_ids}")
        print(f"Relevant: {sorted(relevant_ids)}")
        print(f"Recall@{k}: {recall:.3f}")

    mean_recall = sum(recall_scores) / len(recall_scores)
    mrr = mean_reciprocal_rank(result_lists, relevant_id_sets)

    print(f"\nMean Recall@K: {mean_recall:.3f}")
    print(f"MRR: {mrr:.3f}")

    return mean_recall, mrr


def dense_retrieval(query: str, document_id: str, k: int) -> list[dict]:
    return search_documents(
        query=query,
        limit=k,
        document_id=document_id,
    )


def bm25_retrieval(query: str, document_id: str, k: int) -> list[dict]:
    return search_documents_bm25(
        query=query,
        limit=k,
        document_id=document_id,
    )


def hybrid_retrieval(query: str, document_id: str, k: int) -> list[dict]:
    dense_results = search_documents(
        query=query,
        limit=k,
        document_id=document_id,
    )

    bm25_results = search_documents_bm25(
        query=query,
        limit=k,
        document_id=document_id,
    )

    return reciprocal_rank_fusion(
        [dense_results, bm25_results],
        limit=k,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dataset",
        default="retrieval_dataset.json",
        help="Dataset filename inside the evaluation directory",
    )
    args = parser.parse_args()

    dataset_path = BASE_DIR / "evaluation" / args.dataset

    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Evaluation dataset not found: {dataset_path}"
        )

    dataset = json.loads(dataset_path.read_text(encoding="utf-8"))

    if not dataset:
        raise ValueError("Evaluation dataset is empty.")

    methods = [
        ("Dense", dense_retrieval),
        ("BM25", bm25_retrieval),
        ("Hybrid Dense + BM25 + RRF", hybrid_retrieval),
    ]

    summary = {}

    for name, method in methods:
        summary[name] = evaluate_results(dataset, method, name)

    print("\n========== COMPARISON ==========")
    print(f"{'Method':<28} {'Mean Recall@K':>14} {'MRR':>10}")

    for name, (mean_recall, mrr) in summary.items():
        print(f"{name:<28} {mean_recall:>14.3f} {mrr:>10.3f}")


if __name__ == "__main__":
    main()
