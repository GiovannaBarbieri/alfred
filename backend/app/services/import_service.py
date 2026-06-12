from __future__ import annotations

import pandas as pd

from app.importers.spreadsheet_importer import read_normalized_dataframe
from app.schemas.imports import (
    ClassificationSuggestion,
    ImportPreviewCategory,
    ImportPreviewSummary,
    ImportIssue,
    ImportValidationResponse,
)
from app.services.classification_service import classify_title, load_classification_settings, load_collaborator_subcategories
from app.services.import_record_builder import build_records_from_validation
from app.services.validation_service import (
    REQUIRED_COLUMNS,
    duplicate_groups,
    duplicate_removed_lines,
    duration_to_seconds,
    find_duplicate_lines,
    missing_column_issues,
    operational_alerts,
    selected_keep_line,
    validate_row,
)

CLASSIFICATION_REVIEW_THRESHOLD = 0.9


def validate_import_file(
    filename: str,
    content: bytes,
    duplicate_keep_lines: set[int] | None = None,
) -> ImportValidationResponse:
    dataframe, column_lookup = read_normalized_dataframe(filename, content, REQUIRED_COLUMNS)
    return validate_import_dataframe(
        filename=filename,
        dataframe=dataframe,
        column_lookup=column_lookup,
        duplicate_keep_lines=duplicate_keep_lines,
    )


def validate_import_dataframe(
    filename: str,
    dataframe: pd.DataFrame,
    column_lookup: dict[str, str],
    duplicate_keep_lines: set[int] | None = None,
) -> ImportValidationResponse:
    classifications: list[ClassificationSuggestion] = []

    missing_columns, issues = missing_column_issues(column_lookup)

    if missing_columns:
        return ImportValidationResponse(
            filename=filename,
            totalRows=len(dataframe),
            validRows=0,
            blockedRows=len(dataframe),
            alertRows=0,
            missingColumns=missing_columns,
            issues=issues,
            duplicates=[],
            classifications=[],
            preview=None,
            canComplete=False,
        )

    duplicate_lines = find_duplicate_lines(dataframe)
    removed_duplicate_lines = duplicate_removed_lines(duplicate_lines, duplicate_keep_lines)
    duplicates = duplicate_groups(dataframe)
    classification_settings = load_classification_settings()
    collaborator_subcategories = load_collaborator_subcategories()
    task_occurrences = {
        str(value).strip(): int(count)
        for value, count in dataframe["IdTask"].astype(str).str.strip().value_counts().items()
    }

    blocked_lines: set[int] = set()
    alert_lines: set[int] = set()

    for row_index, row in dataframe.iterrows():
        line_number = int(row_index) + 2
        if line_number in removed_duplicate_lines:
            continue

        row_issues = validate_row(row, line_number)
        for issue in row_issues:
            issues.append(issue)
            if issue.severity == "bloqueio":
                blocked_lines.add(line_number)
            else:
                alert_lines.add(line_number)

        title = str(row["TituloTask"]).strip()
        suggestion, title_alert = classify_title(
            title,
            line_number,
            str(row["LoginUsuario"]).strip(),
            str(row["IdTask"]).strip(),
            str(row["TituloPBI"]).strip(),
            str(row["TituloFeat"]).strip(),
            str(row["TituloEpic"]).strip(),
            task_occurrences.get(str(row["IdTask"]).strip(), 1),
            settings=classification_settings,
            collaborator_subcategories=collaborator_subcategories,
        )
        classifications.append(suggestion)
        if title_alert:
            issues.append(title_alert)
            alert_lines.add(line_number)
        for alert in operational_alerts(row, line_number, suggestion, settings=classification_settings):
            issues.append(alert)
            alert_lines.add(line_number)

    for id_lancamento, lines in duplicate_lines.items():
        keep_line = selected_keep_line(lines, duplicate_keep_lines)
        if keep_line is None:
            blocked_lines.update(lines)
            issues.append(
                ImportIssue(
                    line=None,
                    field="IdLancamento",
                    value=id_lancamento,
                    severity="bloqueio",
                    code="duplicate_id",
                    message=f"IdLancamento duplicado nas linhas {', '.join(map(str, lines))}.",
                )
            )
        else:
            issues.append(
                ImportIssue(
                    line=keep_line,
                    field="IdLancamento",
                    value=id_lancamento,
                    severity="alerta",
                    code="duplicate_resolved",
                    message=f"Duplicidade resolvida. Linha {keep_line} mantida.",
                )
            )
            alert_lines.add(keep_line)

    valid_rows = max(len(dataframe) - len(blocked_lines) - len(removed_duplicate_lines), 0)

    preview = build_preview_summary(
        dataframe=dataframe,
        classifications=classifications,
        removed_duplicate_lines=removed_duplicate_lines,
    )

    return ImportValidationResponse(
        filename=filename,
        totalRows=len(dataframe),
        validRows=valid_rows,
        blockedRows=len(blocked_lines),
        alertRows=len(alert_lines),
        missingColumns=[],
        issues=issues,
        duplicates=duplicates,
        classifications=classifications,
        preview=preview,
        canComplete=len(blocked_lines) == 0,
    )


def build_preview_summary(
    *,
    dataframe: pd.DataFrame,
    classifications: list[ClassificationSuggestion],
    removed_duplicate_lines: set[int],
) -> ImportPreviewSummary:
    classifications_by_line = {classification.line: classification for classification in classifications}
    total_seconds = 0
    collaborators: set[str] = set()
    tasks: set[str] = set()
    category_seconds: dict[str, int] = {}
    category_records: dict[str, int] = {}
    zero_duration_count = 0

    for row_index, row in dataframe.iterrows():
        line_number = int(row_index) + 2
        if line_number in removed_duplicate_lines:
            continue

        duration = str(row["Duracao"]).strip()
        seconds = 0
        if duration == "00:00:00":
            zero_duration_count += 1
        try:
            seconds = duration_to_seconds(duration)
        except (ValueError, AttributeError):
            seconds = 0

        total_seconds += seconds
        collaborators.add(str(row["LoginUsuario"]).strip())
        tasks.add(str(row["IdTask"]).strip())

        classification = classifications_by_line.get(line_number)
        category = classification.category if classification else "Nao classificado"
        category_seconds[category] = category_seconds.get(category, 0) + seconds
        category_records[category] = category_records.get(category, 0) + 1

    average_confidence = (
        sum(classification.confidence for classification in classifications) / len(classifications)
        if classifications
        else 0
    )
    total_hours = round(total_seconds / 3600, 2)
    top_categories = [
        ImportPreviewCategory(
            category=category,
            totalHours=round(seconds / 3600, 2),
            totalRecords=category_records.get(category, 0),
            percentage=round((seconds / total_seconds) * 100, 1) if total_seconds else 0,
        )
        for category, seconds in sorted(category_seconds.items(), key=lambda item: item[1], reverse=True)[:5]
    ]

    return ImportPreviewSummary(
        totalHours=total_hours,
        collaboratorsCount=len([collaborator for collaborator in collaborators if collaborator]),
        tasksCount=len([task for task in tasks if task]),
        categoriesCount=len([category for category in category_seconds if category != "Nao classificado"]),
        averageConfidence=round(average_confidence, 2),
        lowConfidenceCount=sum(
            1
            for classification in classifications
            if classification.confidenceLevel == "baixa" or classification.confidence < CLASSIFICATION_REVIEW_THRESHOLD
        ),
        unclassifiedCount=sum(1 for classification in classifications if classification.category == "Nao classificado"),
        zeroDurationCount=zero_duration_count,
        topCategories=top_categories,
    )


def build_import_records(
    filename: str,
    content: bytes,
    duplicate_keep_lines: set[int] | None = None,
    classification_overrides: dict[int, dict[str, str]] | None = None,
) -> list[dict]:
    validation = validate_import_file(filename, content, duplicate_keep_lines=duplicate_keep_lines)
    if not validation.canComplete:
        return []

    dataframe, _ = read_normalized_dataframe(filename, content, REQUIRED_COLUMNS)
    removed_duplicate_lines = duplicate_removed_lines(find_duplicate_lines(dataframe), duplicate_keep_lines)
    return build_records_from_validation(
        dataframe,
        validation,
        removed_duplicate_lines,
        classification_overrides,
    )
