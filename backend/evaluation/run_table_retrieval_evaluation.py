
import json
from pathlib import Path

from app.services.vector_store import search_documents

BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "evaluation" / "table_retrieval_dataset.json"

DOCUMENT_ID = "35dda60c66aa4852bc4a97cf7feb8dba"
K = 5


def main():
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))

    hits = 0
    reciprocal_ranks = []
    evaluated = 0

    print(f"Table Retrieval Evaluation | Recall@{K} | MRR")
    print("-" * 65)

    for item in dataset:
        question = item["question"]
        expected_table_id = str(item["table_id"])

        results = search_documents(
            question,
            limit=K,
            document_id=DOCUMENT_ID,
        )

        # Evaluate only actual table results.
        table_results = [
            result
            for result in results
            if result.get("metadata", {}).get("content_type") == "table"
        ]

        rank = next(
            (
                index
                for index, result in enumerate(table_results, start=1)
                if str(
                    result.get("metadata", {}).get("table_id", "")
                ) == expected_table_id
            ),
            None,
        )

        evaluated += 1

        if rank is not None:
            hits += 1
            reciprocal_ranks.append(1 / rank)
            status = f"HIT (rank {rank})"
        else:
            reciprocal_ranks.append(0.0)
            status = "MISS"

        print(f"{status:15} | {question}")

    recall_at_k = hits / evaluated if evaluated else 0.0
    mrr = sum(reciprocal_ranks) / evaluated if evaluated else 0.0

    print("-" * 65)
    print(f"Questions evaluated: {evaluated}")
    print(f"Recall@{K}:          {recall_at_k:.3f}")
    print(f"MRR:                 {mrr:.3f}")


if __name__ == "__main__":
    main()
