import unicodedata
import json
import re
from pathlib import Path

from app.services.answering import generate_answer

BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "evaluation" / "multimodal_answer_dataset.json"

DOCUMENT_ID = "35dda60c66aa4852bc4a97cf7feb8dba"


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = text.replace("–", "-").replace("—", "-")
    text = re.sub(r"[【\[].*?[】\]]", " ", text)
    text = re.sub(r"[^\w\s.%]", " ", text)
    return " ".join(text.lower().split())


def answer_matches(question: str, answer: str) -> bool:
    text = normalize(answer)

    checks = {
    "What is the length of a cricket pitch?": [
        "22 yards", "20.12 metres"
    ],
    "Which country has won the most Men's Cricket World Cup titles?": [
        "australia", "six"
    ],
    "How many runs did A. Verma score?": [
        "62"
    ],
    "Who was Player of the Match in the Mumbai Strikers versus Delhi Titans match?": [
        "verma"
    ],
    "What percentage of dismissals were caught?": [
        "55", "caught"
    ],
    "In which region did A. Verma score the most runs?": [
        "midwicket"
    ],
    }

    required = checks.get(question)
    return bool(required) and all(term in text for term in required)



def main():
    dataset = json.loads(DATASET_PATH.read_text(encoding="utf-8"))

    correct_answers = 0
    correct_pages = 0
    correct_images = 0
    errors = 0

    print("DocuMind AI — Multimodal Answer Evaluation")
    print("=" * 75)

    for index, item in enumerate(dataset, start=1):
        question = item["question"]
        expected = normalize(item["expected_answer"])
        expected_page = item["expected_page"]
        expected_filename = item["expected_filename"]

        print(f"\n[{index}/{len(dataset)}] {question}")

        try:
            result = generate_answer(
                question=question,
                document_id=DOCUMENT_ID,
                limit=5,
            )

            answer = result.get("answer", "")
            sources = result.get("sources", [])

            print("Returned sources:")
            for  source in sources:
                print(
                    f"  type={source.get('content_type')}, "
                    f"page={source.get('page')}, "
                    f"image={source.get('image_filename')}, "
                    f"chunk={source.get('chunk_id')}"
                )

            normalized_answer = normalize(answer)

            # Basic expected-answer phrase matching.
            answer_correct = answer_matches(question, answer)
            correct_answers += int(answer_correct)

            # Check whether any returned source cites the expected page.
            page_correct = any(
                str(source.get("page")) == str(expected_page)
                for source in sources
            )
            correct_pages += int(page_correct)

            # Image evidence is explicitly identified by filename.
            image_correct = any(
                source.get("image_filename") == expected_filename
                for source in sources
            )
            correct_images += int(image_correct)

            print(f"Answer: {answer}")
            print(f"Answer match: {'PASS' if answer_correct else 'FAIL'}")
            print(f"Expected page cited: {'PASS' if page_correct else 'FAIL'}")
            print(f"Expected image cited: {'PASS' if image_correct else 'FAIL'}")

            if not sources:
                print("Warning: No sources returned.")

        except Exception as exc:
            errors += 1
            print(f"ERROR: {type(exc).__name__}: {exc}")

    total = len(dataset)

    if total == 0:
        raise RuntimeError("Evaluation dataset is empty.")

    print("\n" + "=" * 75)
    print("SUMMARY")
    print(f"Questions:           {total}")
    print(f"Answer match rate:   {correct_answers / total:.1%}")
    print(f"Page attribution:    {correct_pages / total:.1%}")
    print(f"Image attribution:   {correct_images / total:.1%}")
    print(f"Execution errors:    {errors}")


if __name__ == "__main__":
    main()
