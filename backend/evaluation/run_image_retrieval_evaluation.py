
import json
from pathlib import Path

from app.services.image_retrieval import (
    get_document_images,
    rank_document_images,
)

BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "evaluation" / "image_retrieval_dataset.json"

DOCUMENT_ID = "35dda60c66aa4852bc4a97cf7feb8dba"
K = 3


def main():
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    images = get_document_images(DOCUMENT_ID)

    if not images:
        raise RuntimeError(f"No images found for document {DOCUMENT_ID}")

    hits = 0
    top1_hits = 0
    reciprocal_ranks = []

    print(f"Image Retrieval Evaluation | Recall@{K} | MRR")
    print("-" * 70)

    for item in dataset:
        question = item["question"]
        expected_filename = item["expected_filename"]

        ranked = rank_document_images(
            images,
            question=question,
            context="",
        )

        ranked_filenames = [
            image.get("filename") for image in ranked
        ]

        rank = (
            ranked_filenames.index(expected_filename) + 1
            if expected_filename in ranked_filenames
            else None
        )

        if rank is not None and rank <= K:
            hits += 1
        reciprocal_ranks.append(1 / rank if rank is not None else 0.0)

        if rank == 1:
            top1_hits += 1

        status = f"HIT (rank {rank})" if rank else "MISS"
        print(f"{status:15} | {question}")

    total = len(dataset)

    print("-" * 70)
    print(f"Questions evaluated: {total}")
    print(f"Recall@{K}:          {hits / total:.3f}")
    print(f"MRR:                 {sum(reciprocal_ranks) / total:.3f}")
    print(f"Top-1 accuracy:      {top1_hits / total:.3f}")


if __name__ == "__main__":
    main()
