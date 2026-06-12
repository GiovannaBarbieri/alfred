from __future__ import annotations

import pandas as pd

from app.importers.spreadsheet_importer import read_normalized_dataframe
from app.schemas.imports import ClassificationSuggestion
from app.services.classification_service import classify_title
from app.services.validation_service import REQUIRED_COLUMNS


def build_staging_rows(filename: str, content: bytes) -> list[dict]:
    dataframe, column_lookup = read_normalized_dataframe(filename, content, REQUIRED_COLUMNS)
    return build_staging_rows_from_dataframe(dataframe, column_lookup)


def build_staging_rows_from_dataframe(
    dataframe: pd.DataFrame,
    column_lookup: dict[str, str],
    classifications: list[ClassificationSuggestion] | None = None,
) -> list[dict]:
    if any(column not in column_lookup for column in REQUIRED_COLUMNS):
        return []

    classifications_by_line = {classification.line: classification for classification in (classifications or [])}
    task_occurrences = {
        str(value).strip(): int(count)
        for value, count in dataframe["IdTask"].astype(str).str.strip().value_counts().items()
    }
    rows: list[dict] = []
    for row_index, row in dataframe.iterrows():
        line_number = int(row_index) + 2
        suggestion = classifications_by_line.get(line_number)
        if suggestion is None:
            suggestion, _ = classify_title(
                str(row["TituloTask"]).strip(),
                line_number,
                str(row["LoginUsuario"]).strip(),
                str(row["IdTask"]).strip(),
                str(row["TituloPBI"]).strip(),
                str(row["TituloFeat"]).strip(),
                str(row["TituloEpic"]).strip(),
                task_occurrences.get(str(row["IdTask"]).strip(), 1),
            )
        rows.append(
            {
                "line": line_number,
                "idLancamento": str(row["IdLancamento"]).strip(),
                "idTask": str(row["IdTask"]).strip(),
                "loginUsuario": str(row["LoginUsuario"]).strip(),
                "tituloTask": str(row["TituloTask"]).strip(),
                "raw": {column: str(row[column]).strip() for column in dataframe.columns},
                "category": suggestion.category,
                "subcategory": suggestion.subcategory,
                "origin": suggestion.origin,
                "confidence": suggestion.confidence,
                "confidenceLevel": suggestion.confidenceLevel,
            }
        )

    return rows
