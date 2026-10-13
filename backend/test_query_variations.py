from app.services.vector_store import search_documents

document_id = "35dda60c66aa4852bc4a97cf7feb8dba"

queries = [
    "How many fielders may stand outside the 30-yard circle during the T20 powerplay?",
    "T20 powerplay two fielders outside the 30-yard circle",
    "In a T20 match, only two fielders may stand outside the 30-yard circle during the first six overs"
]

for query in queries:
    results = search_documents(
        query=query,
        limit=3,
        document_id=document_id
    )

    print(f"\nQuery: {query}")
    for rank, result in enumerate(results, start=1):
        print(
            f"{rank}. {result.get('chunk_id')} "
            f"(score={result.get('score', 'N/A')})"
        )
