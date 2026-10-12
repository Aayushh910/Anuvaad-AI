
from app.services.image_retrieval import rank_document_images


def test_retrieval_evaluation_returns_ranked_images():
    images = [
        {
            "page_number": 9,
            "image_index": 1,
            "filename": "page_9_image_1.png",
        },
        {
            "page_number": 9,
            "image_index": 2,
            "filename": "page_9_image_2.png",
            "caption": "Full scorecard of Mumbai Strikers vs Delhi Titans",
        },
        {
            "page_number": 10,
            "image_index": 1,
            "filename": "page_10_image_1.png",
        },
    ]

    ranked = rank_document_images(
        images,
        question=(
            "According to the scorecard, how many fours and sixes "
            "did A. Verma hit?"
        ),
        context="Figure 6. Full scorecard. Figure 7. Wagon wheel.",

    )

    assert len(ranked) == len(images)
    assert ranked[0]["filename"] == "page_9_image_2.png"



def test_scorecard_ranking_works_on_different_page_numbers():
    images = [
        {
            "page_number": 4,
            "image_index": 1,
            "filename": "chart.png",
        },
        {
            "page_number": 12,
            "image_index": 3,
            "filename": "scorecard.png",
        },
    ]

    ranked = rank_document_images(
        images,
        question="According to the scorecard, how many fours and sixes?",
        context="The scorecard contains the batter's performance.",
    )

    assert ranked[0]["filename"] == "scorecard.png"


def test_wagon_wheel_ranking_works_on_different_page_numbers():
    images = [
        {
            "page_number": 3,
            "image_index": 1,
            "filename": "scorecard.png",
        },
        {
            "page_number": 8,
            "image_index": 2,
            "filename": "wagon_wheel.png",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Which regions of the ground contributed the runs?",
        context="Figure: Wagon wheel showing scoring regions.",
    )

    assert ranked[0]["filename"] == "wagon_wheel.png"
