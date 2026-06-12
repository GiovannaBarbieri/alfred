from __future__ import annotations

import io
import re
import unicodedata

import pandas as pd


def read_normalized_dataframe(
    filename: str,
    content: bytes,
    required_columns: list[str],
) -> tuple[pd.DataFrame, dict[str, str]]:
    dataframe = _read_dataframe(filename, content)
    dataframe = dataframe.fillna("")
    return _normalize_dataframe_columns(dataframe, required_columns)


def normalize_text(value: str) -> str:
    without_accents = unicodedata.normalize("NFKD", value)
    ascii_text = "".join(char for char in without_accents if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", ascii_text.strip().lower())


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    stream = io.BytesIO(content)
    if filename.lower().endswith(".csv"):
        return pd.read_csv(stream, dtype=str, sep=None, engine="python")
    return pd.read_excel(stream, dtype=str)


def _normalize_dataframe_columns(
    dataframe: pd.DataFrame,
    required_columns: list[str],
) -> tuple[pd.DataFrame, dict[str, str]]:
    column_lookup: dict[str, str] = {}
    rename_map: dict[str, str] = {}
    required_by_normalized = {normalize_text(column): column for column in required_columns}

    for original in dataframe.columns:
        normalized = normalize_text(str(original))
        required = required_by_normalized.get(normalized)
        if required:
            column_lookup[required] = str(original)
            rename_map[str(original)] = required

    return dataframe.rename(columns=rename_map), column_lookup
