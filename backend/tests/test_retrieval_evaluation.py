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
            "caption": "Monthly sales bar chart by product",
        },
        {
            "page_number": 10,
            "image_index": 1,
            "filename": "page_10_image_1.png",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Which product had the highest monthly sales?",
        context="Figure 6. Monthly sales bar chart. Figure 7. Process diagram.",
    )

    assert len(ranked) == len(images)
    assert ranked[0]["filename"] == "page_9_image_2.png"


def test_relevant_diagram_ranks_first_regardless_of_page_number():
    images = [
        {
            "page_number": 3,
            "image_index": 1,
            "filename": "network_chart.png",
        },
        {
            "page_number": 12,
            "image_index": 2,
            "filename": "network_architecture.png",
            "description": (
                "Network architecture diagram showing servers, "
                "clients, and their connections."
            ),
        },
    ]

    ranked = rank_document_images(
        images,
        question="How are the servers and clients connected in the network architecture?",
        context="The document contains a network architecture diagram.",
    )

    assert ranked[0]["filename"] == "network_architecture.png"


def test_relevant_table_ranks_first_regardless_of_page_number():
    images = [
        {
            "page_number": 2,
            "image_index": 1,
            "filename": "cover_image.png",
        },
        {
            "page_number": 15,
            "image_index": 1,
            "filename": "results_table.png",
            "caption": "Experimental results comparing model accuracy",
        },
    ]

    ranked = rank_document_images(
        images,
        question="Which model achieved the highest accuracy in the experimental results?",
        context="Table comparing model accuracy across experiments.",
    )

    assert ranked[0]["filename"] == "results_table.png"