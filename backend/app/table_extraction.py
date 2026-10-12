
from pathlib import Path
import json

from docling.document_converter import DocumentConverter


def extract_tables(pdf_path: str) -> list[dict]:
    """Extract structured tables and page numbers from a PDF."""

    document = DocumentConverter().convert(pdf_path).document
    extracted_tables = []

    for table_index, table in enumerate(document.tables, start=1):
        provenance = getattr(table, "prov", None) or []
        page_number = (
            provenance[0].page_no
            if provenance
            else None
        )

        rows = []
        for grid_row in table.data.grid:
            rows.append([
                cell.text.strip()
                for cell in grid_row
            ])

        extracted_tables.append({
            "table_id": table_index,
            "page_number": page_number,
            "rows": rows,
            "row_count": len(rows),
            "column_count": table.data.num_cols,
        })

    return extracted_tables


def save_tables(pdf_path: str, output_path: str) -> list[dict]:
    """Extract tables and save them as JSON."""

    tables = extract_tables(pdf_path)

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(
        json.dumps(tables, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return tables
