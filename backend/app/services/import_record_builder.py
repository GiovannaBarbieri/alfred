from __future__ import annotations

from collections import defaultdict

import pandas as pd

from app.schemas.imports import ImportIssue, ImportValidationResponse
from app.services.classification_service import CLASSIFIER_VERSION, confidence_level
from app.services.validation_service import duration_to_seconds, parse_datetime, selected_keep_line


def build_records_from_validation(
    dataframe: pd.DataFrame,
    validation: ImportValidationResponse,
    removed_duplicate_lines: set[int],
    classification_overrides: dict[int, dict[str, str]] | None = None,
) -> list[dict]:
    issues_by_line = _issues_by_line(validation.issues)
    classification_by_line = {classification.line: classification for classification in validation.classifications}
    records: list[dict] = []

    for row_index, row in dataframe.iterrows():
        line_number = int(row_index) + 2
        if line_number in removed_duplicate_lines:
            continue

        classification = classification_by_line[line_number]
        override = (classification_overrides or {}).get(line_number)
        category = override["category"] if override else classification.category
        subcategory = override["subcategory"] if override else classification.subcategory
        classification_origin = "manual" if override else classification.origin
        classification_confidence = 1.0 if override else classification.confidence
        has_alert = any(issue.severity == "alerta" for issue in issues_by_line[line_number])

        records.append(
            {
                "Line": line_number,
                "IdLancamento": str(row["IdLancamento"]).strip(),
                "DataHoraCadastro": parse_datetime(str(row["DataHoraCadastro"]).strip()),
                "Task": str(row["Task"]).strip(),
                "LoginUsuario": str(row["LoginUsuario"]).strip(),
                "Duracao": str(row["Duracao"]).strip(),
                "DuracaoSegundos": duration_to_seconds(str(row["Duracao"]).strip()),
                "IdTask": str(row["IdTask"]).strip(),
                "TituloTask": str(row["TituloTask"]).strip(),
                "IdPBI": str(row["IdPBI"]).strip(),
                "TituloPBI": str(row["TituloPBI"]).strip(),
                "IdFeat": str(row["IdFeat"]).strip(),
                "TituloFeat": str(row["TituloFeat"]).strip(),
                "IdEpic": str(row["IdEpic"]).strip(),
                "TituloEpic": str(row["TituloEpic"]).strip(),
                "Categoria": category,
                "Subcategoria": subcategory,
                "OrigemClassificacao": classification_origin,
                "ConfiancaClassificacao": classification_confidence,
                "NivelConfianca": confidence_level(classification_confidence),
                "VersaoClassificador": CLASSIFIER_VERSION,
                "StatusValidacao": "alerta" if has_alert else "valido",
            }
        )

    return records


def build_records_from_staging_rows(
    staging_rows: list[dict],
    validation: ImportValidationResponse,
    classification_overrides: dict[int, dict[str, str]] | None = None,
    duplicate_keep_lines: set[int] | None = None,
) -> list[dict]:
    issues_by_line = _issues_by_line(validation.issues)
    removed_duplicate_lines = _removed_duplicate_lines_from_validation(validation, duplicate_keep_lines)
    records: list[dict] = []

    for staging_row in staging_rows:
        line_number = int(staging_row["linha"])
        if line_number in removed_duplicate_lines:
            continue

        raw = staging_row["dados_originais"] or {}
        override = (classification_overrides or {}).get(line_number)
        category = override["category"] if override else staging_row.get("categoria_sugerida") or "Nao classificado"
        subcategory = override["subcategory"] if override else staging_row.get("subcategoria_sugerida") or "Nao classificado"
        classification_origin = "manual" if override else staging_row.get("origem_classificacao") or "pendente"
        classification_confidence = 1.0 if override else float(staging_row.get("confianca") or 0)
        has_alert = any(issue.severity == "alerta" for issue in issues_by_line[line_number])

        records.append(
            {
                "Line": line_number,
                "IdLancamento": str(raw.get("IdLancamento", "")).strip(),
                "DataHoraCadastro": parse_datetime(str(raw.get("DataHoraCadastro", "")).strip()),
                "Task": str(raw.get("Task", "")).strip(),
                "LoginUsuario": str(raw.get("LoginUsuario", "")).strip(),
                "Duracao": str(raw.get("Duracao", "")).strip(),
                "DuracaoSegundos": duration_to_seconds(str(raw.get("Duracao", "")).strip()),
                "IdTask": str(raw.get("IdTask", "")).strip(),
                "TituloTask": str(raw.get("TituloTask", "")).strip(),
                "IdPBI": str(raw.get("IdPBI", "")).strip(),
                "TituloPBI": str(raw.get("TituloPBI", "")).strip(),
                "IdFeat": str(raw.get("IdFeat", "")).strip(),
                "TituloFeat": str(raw.get("TituloFeat", "")).strip(),
                "IdEpic": str(raw.get("IdEpic", "")).strip(),
                "TituloEpic": str(raw.get("TituloEpic", "")).strip(),
                "Categoria": category,
                "Subcategoria": subcategory,
                "OrigemClassificacao": classification_origin,
                "ConfiancaClassificacao": classification_confidence,
                "NivelConfianca": confidence_level(classification_confidence),
                "VersaoClassificador": CLASSIFIER_VERSION,
                "StatusValidacao": "alerta" if has_alert else "valido",
            }
        )

    return records


def _issues_by_line(issues: list[ImportIssue]) -> dict[int, list[ImportIssue]]:
    grouped: dict[int, list[ImportIssue]] = defaultdict(list)
    for issue in issues:
        if issue.line:
            grouped[issue.line].append(issue)
    return grouped


def _removed_duplicate_lines_from_validation(
    validation: ImportValidationResponse,
    duplicate_keep_lines: set[int] | None,
) -> set[int]:
    if not duplicate_keep_lines:
        return set()

    removed: set[int] = set()
    for duplicate in validation.duplicates:
        keep_line = selected_keep_line(duplicate.lines, duplicate_keep_lines)
        if keep_line is not None:
            removed.update(line for line in duplicate.lines if line != keep_line)
    return removed
