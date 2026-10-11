
from app.services.vector_store import index_document

document_id = "af64344508d84104bc207449da0f4bcb"

result = index_document(document_id)
print(result)
