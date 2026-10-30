import csv
import io
import logging
from pathlib import Path
from app.services.loaders.base import BaseLoader, Segment, compute_file_hash

logger = logging.getLogger(__name__)


class SpreadsheetLoader(BaseLoader):
    """
    Sheet-aware loader for Excel (.xlsx, .xls) and CSV files.
    Preserves column headers with every row so context is never lost during retrieval.
    """

    def load(self, path: Path | str) -> list[Segment]:
        file_path = Path(path).resolve()
        file_hash = compute_file_hash(file_path)
        ext = file_path.suffix.lower()

        if ext == ".csv":
            return self._load_csv(file_path, file_hash)
        else:
            return self._load_excel(file_path, file_hash)

    def _load_csv(self, file_path: Path, file_hash: str) -> list[Segment]:
        rows_formatted = []
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f)
                headers = next(reader, None)
                if not headers:
                    return []
                for row_idx, row in enumerate(reader, start=1):
                    # Format as: Header1: Val1 | Header2: Val2
                    pairs = [
                        f"{headers[i].strip()}: {row[i].strip()}"
                        for i in range(min(len(headers), len(row)))
                        if row[i].strip()
                    ]
                    if pairs:
                        rows_formatted.append(f"Row {row_idx}: " + " | ".join(pairs))
        except Exception as e:
            logger.error("Failed to parse CSV %s: %s", file_path.name, e)
            return []

        text = "\n".join(rows_formatted)
        if not text.strip():
            return []

        return [
            Segment(
                text=text,
                source=file_path.name,
                page_or_slide_or_sheet="Sheet1",
                content_type="table",
                metadata={"file_hash": file_hash, "sheet_name": "Sheet1"},
            )
        ]

    def _load_excel(self, file_path: Path, file_hash: str) -> list[Segment]:
        segments: list[Segment] = []
        try:
            import openpyxl
            wb = openpyxl.load_workbook(str(file_path), data_only=True)
            for sheetname in wb.sheetnames:
                sheet = wb[sheetname]
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    continue

                headers = [str(c).strip() if c is not None else f"Col{idx+1}" for idx, c in enumerate(rows[0])]
                sheet_lines = []

                for r_idx, row in enumerate(rows[1:], start=2):
                    pairs = []
                    for c_idx, val in enumerate(row):
                        if val is not None and str(val).strip():
                            header_name = headers[c_idx] if c_idx < len(headers) else f"Col{c_idx+1}"
                            pairs.append(f"{header_name}: {str(val).strip()}")
                    if pairs:
                        sheet_lines.append(f"Row {r_idx}: " + " | ".join(pairs))

                text = f"[Sheet: {sheetname}]\n" + "\n".join(sheet_lines)
                if sheet_lines:
                    segments.append(
                        Segment(
                            text=text,
                            source=file_path.name,
                            page_or_slide_or_sheet=sheetname,
                            content_type="table",
                            metadata={"file_hash": file_hash, "sheet_name": sheetname},
                        )
                    )
        except Exception as e:
            logger.error("Failed to load Excel workbook %s: %s", file_path.name, e)

        return segments

