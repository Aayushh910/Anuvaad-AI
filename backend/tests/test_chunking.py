from app.services.chunking import chunk_document

DOCUMENT_ID = "af64344508d84104bc207449da0f4bcb"

result = chunk_document(DOCUMENT_ID)
print(result)

