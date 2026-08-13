from __future__ import annotations

from typing import Any

from app.repositories.audit_repository import insert_audit_log
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


def delete_final_import(connection, *, import_id: int, actor: str | None = None) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, nome_arquivo, status, total_registros, registros_validos, data_importacao
            FROM importacoes
            WHERE id = %s
            FOR UPDATE
            """,
            (import_id,),
        )
        import_row = cursor.fetchone()
        if not import_row:
            return None

        cursor.execute(
            """
            SELECT
                COUNT(*) AS lancamentos,
                COALESCE(SUM(duracao_segundos), 0) AS total_seconds
            FROM lancamentos_horas
            WHERE importacao_id = %s
            """,
            (import_id,),
        )
        totals = cursor.fetchone() or {"lancamentos": 0, "total_seconds": 0}

        # Some related tables already cascade from importacoes, but deleting the
        # direct children first avoids FK ordering issues with duplicate rows that
        # reference lancamentos_horas.
        cursor.execute("DELETE FROM duplicidades_importacao WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM erros_importacao WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM pending_reviews WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM analytics_insights WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM import_logs WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM lancamentos_horas WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM importacoes WHERE id = %s", (import_id,))

    before = {
        "id": import_row["id"],
        "filename": import_row["nome_arquivo"],
        "status": import_row["status"],
        "totalRows": import_row["total_registros"],
        "validRows": import_row["registros_validos"],
        "importedAt": import_row["data_importacao"],
        "launchCount": totals["lancamentos"],
        "totalSeconds": totals["total_seconds"],
    }
    insert_audit_log(
        connection,
        entity="project_report",
        action="delete",
        record_id=import_id,
        user=(actor or "sistema").strip() or "sistema",
        before=before,
    )
    return before


def replace_final_import(
    connection,
    *,
    import_id: int,
    filename: str,
    file_hash: str,
    validation: ImportValidationResponse,
    records: list[dict[str, Any]],
) -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM importacoes WHERE id = %s FOR UPDATE", (import_id,))
        if not cursor.fetchone():
            raise ValueError("Relatorio de projeto nao encontrado.")

        cursor.execute("DELETE FROM analytics_insights WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM pending_reviews WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM duplicidades_importacao WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM erros_importacao WHERE importacao_id = %s", (import_id,))
        cursor.execute("DELETE FROM lancamentos_horas WHERE importacao_id = %s", (import_id,))
        cursor.execute(
            """
            UPDATE importacoes
            SET
                nome_arquivo = %s,
                hash_arquivo = %s,
                status = %s,
                total_registros = %s,
                registros_validos = %s,
                registros_com_alerta = %s,
                registros_bloqueados = %s,
                versao_classificador = %s,
                data_importacao = NOW()
            WHERE id = %s
            """,
            (
                filename,
                file_hash,
                "concluida",
                validation.totalRows,
                validation.validRows,
                validation.alertRows,
                validation.blockedRows,
                _classifier_version_from_records(records),
                import_id,
            ),
        )

    for issue in validation.issues:
        insert_issue(connection, import_id, issue.model_dump())

    saved_rows = 0
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
        saved_rows += 1

    return saved_rows


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
