
import json
import re
import unicodedata
from pathlib import Path

from app.services.image_retrieval import (
    get_document_images,
    rank_document_images,
)
from app.services.vision import analyze_image

BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "evaluation" / "image_retrieval_dataset.json"

DOCUMENT_ID = "35dda60c66aa4852bc4a97cf7feb8dba"
K = 3


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).lower()
    return " ".join(re.sub(r"[^\w\s.%]", " ", text).split())


def fact_matches(question: str, answer: str) -> bool:
    text = normalize(answer)

    checks = {
        "What is the length and width of a cricket pitch?":
            ["22 yards", "10 ft"],
        "Which fielding positions are on the leg side?":
            ["long on", "deep midwicket", "square leg"],
        "Which country has won the most Men's Cricket World Cup titles?":
            ["australia", "6"],
        "How many cumulative runs had Mumbai Strikers scored after 15 overs?":
            ["138"],
        "Who was Player of the Match in the Mumbai Strikers versus Delhi Titans match?":
            ["a verma"],
        "In which fielding region did A. Verma score the most runs?":
            ["midwicket", "18"],
        "What percentage of dismissals were caught?":
            ["55", "caught"],
    }

    required = checks.get(question)
    return bool(required) and all(term in text for term in required)


def main():
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))
    images = get_document_images(DOCUMENT_ID)

    if not dataset:
        raise RuntimeError("Image evaluation dataset is empty.")
    if not images:
        raise RuntimeError(f"No images found for document {DOCUMENT_ID}")

    rank_hits = 0
    vision_matches = 0
    attribution_matches = 0
    errors = 0

    print("DocuMind AI — Image-Required Evaluation")
    print("=" * 75)

    for index, item in enumerate(dataset, start=1):
        question = item["question"]
        expected_filename = item["expected_filename"]

        print(f"\n[{index}/{len(dataset)}] {question}")

        try:
            ranked = rank_document_images(
                images,
                question=question,
                context="",
            )

            top_images = ranked[:K]
            top_filenames = [
                image.get("filename") for image in top_images
            ]

            rank = (
                top_filenames.index(expected_filename) + 1
                if expected_filename in top_filenames
                else None
            )

            rank_ok = rank is not None
            rank_hits += int(rank_ok)

            print(f"Expected image rank: {rank if rank else 'not in top ' + str(K)}")

            # Analyze the expected image directly to isolate vision quality
            # from ranking quality.
            expected_image = next(
                (
                    image for image in images
                    if image.get("filename") == expected_filename
                ),
                None,
            )

            if expected_image is None:
                print("Vision: SKIPPED — expected image not found")
                continue

            result = analyze_image(
                image_path=expected_image["image_path"],
                question=question,
                page_number=expected_image.get("page_number"),
            )

            answer = result.get("answer", "")
            returned_filename = result.get("image_filename")
            returned_page = result.get("page")

            vision_ok = fact_matches(question, answer)
            vision_matches += int(vision_ok)

            attribution_ok = (
                returned_filename == expected_filename
                and str(returned_page)
                == str(expected_image.get("page_number"))
            )
            attribution_matches += int(attribution_ok)

            print(f"Vision answer: {answer}")
            print(f"Expected facts: {'PASS' if vision_ok else 'FAIL'}")
            print(f"Image/page attribution: {'PASS' if attribution_ok else 'FAIL'}")

        except Exception as exc:
            errors += 1
            print(f"ERROR: {type(exc).__name__}: {exc}")

    total = len(dataset)

    print("\n" + "=" * 75)
    print("SUMMARY")
    print(f"Questions:                 {total}")
    print(f"Expected image Recall@{K}:       {rank_hits / total:.1%}")
    print(f"Vision fact match rate:    {vision_matches / total:.1%}")
    print(f"Image/page attribution:    {attribution_matches / total:.1%}")
    print(f"Execution errors:          {errors}")


if __name__ == "__main__":
    main()
