
from app.services.vector_store import search_documents

DOCUMENT_ID = "af64344508d84104bc207449da0f4bcb"


def main():
    query = "Why can reader-preference cause writer starvation?"

    results = search_documents(
        query=query,
        limit=5,
        document_id=DOCUMENT_ID,
    )

    print(f"\nQuery: {query}")
    print(f"Results found: {len(results)}")

    for i, result in enumerate(results, start=1):
        print(f"\n--- Result {i} ---")
        print(f"Score: {result['score']:.4f}")
        print(f"Chunk index: {result['chunk_index']}")
        print(result["text"][:500])


if __name__ == "__main__":
    main()
