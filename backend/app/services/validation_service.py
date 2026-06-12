from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime

import pandas as pd

from app.importers.spreadsheet_importer import normalize_text
from app.schemas.imports import ClassificationSuggestion, DuplicateGroup, ImportIssue
from app.services.classification_service import ClassificationRule
from app.services.classification_service import matched_category_count


REQUIRED_COLUMNS = [
    "IdLancamento",
    "DataHoraCadastro",
    "Task",
    "LoginUsuario",
    "Duracao",
    "IdTask",
    "TituloTask",
    "IdPBI",
    "TituloPBI",
    "IdFeat",
    "TituloFeat",
    "IdEpic",
    "TituloEpic",
]

DURATION_PATTERN = re.compile(r"^\d{1,3}:[0-5]\d:[0-5]\d$")
EXCESSIVE_DURATION_SECONDS = 12 * 60 * 60
GENERIC_TITLES = {"ajuste", "ajustes", "atividade", "desenvolvimento", "correcao", "teste", "analise"}


def missing_column_issues(column_lookup: dict[str, str]) -> tuple[list[str], list[ImportIssue]]:
    missing_columns = [column for column in REQUIRED_COLUMNS if column not in column_lookup]
    issues = [
        ImportIssue(
            field=column,
            severity="bloqueio",
            code="missing_column",
            message=f"A coluna obrigatoria {column} nao foi encontrada.",
        )
        for column in missing_columns
    ]
    return missing_columns, issues


def validate_row(row: pd.Series, line_number: int) -> list[ImportIssue]:
    issues: list[ImportIssue] = []

    for column in REQUIRED_COLUMNS:
        value = str(row[column]).strip()
        if not value:
            issues.append(
                ImportIssue(
                    line=line_number,
                    field=column,
                    value=value,
                    severity="bloqueio",
                    code="required_empty",
                    message=f"Campo obrigatorio {column} vazio.",
                )
            )

    duration = str(row["Duracao"]).strip()
    if duration and not DURATION_PATTERN.match(duration):
        issues.append(
            ImportIssue(
                line=line_number,
                field="Duracao",
                value=duration,
                severity="bloqueio",
                code="invalid_duration",
                message="Duracao deve estar no formato HH:MM:SS.",
            )
        )
    elif duration == "00:00:00":
        issues.append(
            ImportIssue(
                line=line_number,
                field="Duracao",
                value=duration,
                severity="alerta",
                code="zero_duration",
                message="Duracao zerada. Registro sera importado com alerta.",
            )
        )

    date_value = str(row["DataHoraCadastro"]).strip()
    if date_value and pd.isna(pd.to_datetime(date_value, errors="coerce", dayfirst=True)):
        issues.append(
            ImportIssue(
                line=line_number,
                field="DataHoraCadastro",
                value=date_value,
                severity="bloqueio",
                code="invalid_datetime",
                message="DataHoraCadastro invalida.",
            )
        )

    return issues


def operational_alerts(
    row: pd.Series,
    line_number: int,
    suggestion: ClassificationSuggestion,
    settings: tuple[dict[str, str], dict[str, str], dict[str, list[str]], list[ClassificationRule]] | None = None,
) -> list[ImportIssue]:
    alerts: list[ImportIssue] = []
    duration = str(row["Duracao"]).strip()
    title = str(row["TituloTask"]).strip()
    normalized_title = normalize_text(title)

    if DURATION_PATTERN.match(duration) and duration_to_seconds(duration) > EXCESSIVE_DURATION_SECONDS:
        alerts.append(
            ImportIssue(
                line=line_number,
                field="Duracao",
                value=duration,
                severity="alerta",
                code="excessive_duration",
                message="Duracao alta para analise operacional. Validar se o apontamento esta correto.",
            )
        )

    if normalized_title in GENERIC_TITLES or len(normalized_title) < 8:
        alerts.append(
            ImportIssue(
                line=line_number,
                field="TituloTask",
                value=title,
                severity="alerta",
                code="generic_title",
                message="TituloTask muito generico para analise operacional.",
            )
        )

    if suggestion.subcategory in {"Nao aplicavel", "Nao classificado"}:
        alerts.append(
            ImportIssue(
                line=line_number,
                field="LoginUsuario",
                value=str(row["LoginUsuario"]).strip(),
                severity="alerta",
                code="missing_technical_profile",
                message="Colaborador sem perfil operacional para analise por subcategoria.",
            )
        )

    if matched_category_count(title, settings=settings) > 1:
        alerts.append(
            ImportIssue(
                line=line_number,
                field="TituloTask",
                value=title,
                severity="alerta",
                code="conflicting_categories",
                message="TituloTask possui palavras de mais de uma categoria. Revisao humana recomendada.",
            )
        )

    return alerts


def duplicate_groups(dataframe: pd.DataFrame) -> list[DuplicateGroup]:
    return [
        DuplicateGroup(
            idLancamento=id_lancamento,
            lines=lines,
            records=[duplicate_record(dataframe, line) for line in lines],
        )
        for id_lancamento, lines in find_duplicate_lines(dataframe).items()
    ]


def find_duplicate_lines(dataframe: pd.DataFrame) -> dict[str, list[int]]:
    values: dict[str, list[int]] = defaultdict(list)
    for row_index, value in dataframe["IdLancamento"].items():
        id_lancamento = str(value).strip()
        if id_lancamento:
            values[id_lancamento].append(int(row_index) + 2)

    return {key: lines for key, lines in values.items() if len(lines) > 1}


def selected_keep_line(lines: list[int], duplicate_keep_lines: set[int] | None) -> int | None:
    if not duplicate_keep_lines:
        return None
    selected = [line for line in lines if line in duplicate_keep_lines]
    if len(selected) != 1:
        return None
    return selected[0]


def duplicate_removed_lines(
    duplicate_lines: dict[str, list[int]],
    duplicate_keep_lines: set[int] | None,
) -> set[int]:
    removed: set[int] = set()
    for lines in duplicate_lines.values():
        keep_line = selected_keep_line(lines, duplicate_keep_lines)
        if keep_line is not None:
            removed.update(line for line in lines if line != keep_line)
    return removed


def duplicate_record(dataframe: pd.DataFrame, line_number: int) -> dict:
    row = dataframe.iloc[line_number - 2]
    return {
        "line": line_number,
        "idLancamento": str(row["IdLancamento"]).strip(),
        "dataHoraCadastro": str(row["DataHoraCadastro"]).strip(),
        "loginUsuario": str(row["LoginUsuario"]).strip(),
        "duracao": str(row["Duracao"]).strip(),
        "epic": str(row["TituloEpic"]).strip(),
        "feature": str(row["TituloFeat"]).strip(),
        "pbi": str(row["TituloPBI"]).strip(),
        "task": str(row["TituloTask"]).strip(),
    }


def duration_to_seconds(duration: str) -> int:
    hours, minutes, seconds = [int(part) for part in duration.split(":")]
    return (hours * 3600) + (minutes * 60) + seconds


def parse_datetime(value: str) -> datetime:
    parsed = pd.to_datetime(value, errors="raise", dayfirst=True)
    return parsed.to_pydatetime()
