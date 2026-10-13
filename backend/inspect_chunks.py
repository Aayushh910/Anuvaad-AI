import json
from pathlib import Path

path = Path("storage/chunks/35dda60c66aa4852bc4a97cf7feb8dba.json")
chunks = json.loads(path.read_text(encoding="utf-8"))

terms = ["bowler", "overs per", "four overs", "maximum overs"]

for chunk in chunks:
    text = chunk.get("text", "")
    if any(term in text.lower() for term in terms):
        print(f"\nChunk ID: {chunk['chunk_id']}")
        print(text)
        print("-" * 60)

print(f"\nTotal chunks: {len(chunks)}")
