import json
from pathlib import Path

path = Path("storage/chunks/35dda60c66aa4852bc4a97cf7feb8dba.json")
chunks = json.loads(path.read_text(encoding="utf-8"))

for chunk in chunks:
    text = chunk.get("text", "")
    if any(term in text.lower() for term in [
        "30-yard", "outside the circle", "powerplay", "power play"
    ]):
        print(f"\nChunk: {chunk['chunk_id']}")
        print(text)
        print("-" * 60)
