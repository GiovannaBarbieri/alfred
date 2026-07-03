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
    if filename.lower().endswith(".csv"):
        dataframe = _read_dataframe(filename, content).fillna("")
        return _normalize_dataframe_columns(dataframe, required_columns)

    return _read_excel_dataframe_with_required_columns(content, required_columns)


def normalize_text(value: str) -> str:
    without_accents = unicodedata.normalize("NFKD", value)
    ascii_text = "".join(char for char in without_accents if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", ascii_text.strip().lower())


def _read_dataframe(filename: str, content: bytes) -> pd.DataFrame:
    stream = io.BytesIO(content)
    if filename.lower().endswith(".csv"):
        return pd.read_csv(stream, dtype=str, sep=None, engine="python")
    return pd.read_excel(stream, dtype=str)


def _read_excel_dataframe_with_required_columns(
    content: bytes,
    required_columns: list[str],
) -> tuple[pd.DataFrame, dict[str, str]]:
    stream = io.BytesIO(content)
    sheets = pd.read_excel(stream, dtype=str, sheet_name=None)
    if not sheets:
        return _normalize_dataframe_columns(pd.DataFrame(), required_columns)

    best_dataframe: pd.DataFrame | None = None
    best_lookup: dict[str, str] = {}

    for dataframe in sheets.values():
        normalized_dataframe, column_lookup = _normalize_dataframe_columns(dataframe.fillna(""), required_columns)
        if len(column_lookup) > len(best_lookup):
            best_dataframe = normalized_dataframe
            best_lookup = column_lookup
        if all(column in column_lookup for column in required_columns):
            return normalized_dataframe, column_lookup

    return best_dataframe if best_dataframe is not None else pd.DataFrame(), best_lookup


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
