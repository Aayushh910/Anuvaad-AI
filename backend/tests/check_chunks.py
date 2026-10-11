
import json
from pathlib import Path

document_id = "af64344508d84104bc207449da0f4bcb"

path = Path("storage/chunks") / f"{document_id}.json"
chunks = json.loads(path.read_text(encoding="utf-8"))

print(f"Total chunks: {len(chunks)}")

for chunk in chunks[:3]:
    print("\n" + "=" * 60)
    print(f"Chunk ID: {chunk['chunk_id']}")
    print(f"Chunk index: {chunk['chunk_index']}")
    print(chunk["text"][:500])
