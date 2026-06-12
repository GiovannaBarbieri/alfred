from __future__ import annotations

from typing import Any

from app.repositories.import_repository import (
    create_import,
    get_lookup_id,
    insert_classification,
    insert_duplicate_resolution,
    insert_issue,
    insert_lancamento,
)
from app.schemas.imports import ImportValidationResponse


def persist_final_import(
    connection,
    *,
    filename: str,
    file_hash: str,
    validation: ImportValidationResponse,
    records: list[dict[str, Any]],
    duplicate_keep_lines: set[int] | None = None,
) -> int:
    import_id = _persist_import_records(
        connection,
        filename=filename,
        file_hash=file_hash,
        validation=validation,
        records=records,
    )
    _persist_duplicate_resolutions(connection, import_id, validation, records, duplicate_keep_lines)
    return import_id


def classification_status(origin: str) -> str:
    if origin in {"padrao_titulo", "padrao_titulo_categoria"}:
        return "automatica"
    if origin == "manual":
        return "alterada"
    if origin == "pendente":
        return "nao_classificada"
    return "sugerida"


def _persist_import_records(
    connection,
    *,
    filename: str,
    file_hash: str,
    validation: ImportValidationResponse,
    records: list[dict[str, Any]],
) -> int:
    import_id = create_import(
        connection,
        filename=filename,
        file_hash=file_hash,
        status="concluida",
        total_rows=validation.totalRows,
        valid_rows=validation.validRows,
        alert_rows=validation.alertRows,
        blocked_rows=validation.blockedRows,
        classifier_version=_classifier_version_from_records(records),
    )

    for issue in validation.issues:
        insert_issue(connection, import_id, issue.model_dump())

    for record in records:
        category_id = get_lookup_id(connection, "categorias", record["Categoria"])
        subcategory_id = get_lookup_id(connection, "subcategorias", record["Subcategoria"])
        lancamento_id = insert_lancamento(
            connection,
            import_id=import_id,
            record=record,
            category_id=category_id,
            subcategory_id=subcategory_id,
            classification_status=classification_status(record["OrigemClassificacao"]),
        )
        insert_classification(
            connection,
            lancamento_id=lancamento_id,
            title=record["TituloTask"],
            category_id=category_id,
            subcategory_id=subcategory_id,
            origin=record["OrigemClassificacao"],
            confidence=record["ConfiancaClassificacao"],
            confidence_level=record["NivelConfianca"],
            classifier_version=record["VersaoClassificador"],
        )

    return import_id


def _classifier_version_from_records(records: list[dict[str, Any]]) -> str:
    versions = [str(record.get("VersaoClassificador", "")).strip() for record in records]
    versions = [version for version in versions if version]
    if not versions:
        return "1.0.0"
    unique_versions = sorted(set(versions))
    return unique_versions[0] if len(unique_versions) == 1 else "multi"


def _persist_duplicate_resolutions(
    connection,
    import_id: int,
    validation: ImportValidationResponse,
    records: list[dict[str, Any]],
    duplicate_keep_lines: set[int] | None,
) -> None:
    if not duplicate_keep_lines:
        return

    saved_record_ids_by_line = {
        record["Line"]: _find_lancamento_id(connection, import_id, record["IdLancamento"])
        for record in records
    }
    for duplicate in validation.duplicates:
        kept_line = next((line for line in duplicate.lines if line in duplicate_keep_lines), None)
        if kept_line is not None:
            insert_duplicate_resolution(
                connection,
                import_id=import_id,
                id_lancamento=duplicate.idLancamento,
                lines=duplicate.lines,
                kept_line=kept_line,
                kept_record_id=saved_record_ids_by_line.get(kept_line),
            )


def _find_lancamento_id(connection, import_id: int, id_lancamento: str) -> int | None:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT id FROM lancamentos_horas WHERE importacao_id = %s AND id_lancamento = %s",
            (import_id, id_lancamento),
        )
        row = cursor.fetchone()
        return int(row["id"]) if row else None
