from __future__ import annotations

import hashlib
import time
from typing import Any

import pandas as pd

from app.db import get_connection
from app.repositories.import_repository import list_import_record_ids, list_imports_for_file_history
from app.repositories.staging_repository import (
    cancel_import_session,
    clear_staging_rows,
    create_import_session,
    get_import_session,
    insert_import_log,
    insert_staging_rows,
    list_staging_rows,
    update_import_session_summary,
)
from app.repositories.audit_repository import insert_audit_log
from app.schemas.imports import (
    ImportCompleteResponse,
    ImportFileHistory,
    ImportSessionResponse,
    ImportSessionSummary,
    ImportValidationResponse,
    RelatedImportSummary,
)
from app.importers.spreadsheet_importer import read_normalized_dataframe
from app.services.import_persistence_service import persist_final_import
from app.services.import_record_builder import build_records_from_staging_rows
from app.services.import_service import validate_import_dataframe, validate_import_file
from app.services.staging_row_builder import build_staging_rows_from_dataframe
from app.services.validation_service import REQUIRED_COLUMNS


def create_staged_import(filename: str, content: bytes) -> ImportSessionResponse:
    dataframe, column_lookup = read_normalized_dataframe(filename, content, REQUIRED_COLUMNS)
    return create_staged_import_from_dataframe(
        filename=filename,
        dataframe=dataframe,
        column_lookup=column_lookup,
        content=content,
    )


def create_staged_import_from_dataframe(
    *,
    filename: str,
    dataframe: pd.DataFrame,
    column_lookup: dict[str, str] | None = None,
    content: bytes | None = None,
) -> ImportSessionResponse:
    started_at = time.perf_counter()
    source_content = content if content is not None else dataframe.to_csv(index=False, lineterminator="\n").encode("utf-8")
    file_hash = hashlib.sha256(source_content).hexdigest()
    resolved_column_lookup = column_lookup or {column: column for column in dataframe.columns}
    validation = validate_import_dataframe(filename=filename, dataframe=dataframe, column_lookup=resolved_column_lookup)
    staging_rows = build_staging_rows_from_dataframe(dataframe, resolved_column_lookup, validation.classifications)

    with get_connection() as connection:
        validation.fileHistory = _build_file_history(
            connection=connection,
            filename=filename,
            file_hash=file_hash,
            dataframe=dataframe,
            column_lookup=resolved_column_lookup,
        )
        session_id = create_import_session(
            connection,
            filename=filename,
            file_hash=file_hash,
            content=source_content,
            total_rows=validation.totalRows,
            valid_rows=validation.validRows,
            alert_rows=validation.alertRows,
            blocked_rows=validation.blockedRows,
        )
        insert_staging_rows(connection, session_id, staging_rows)
        update_import_session_summary(
            connection,
            session_id,
            status="AGUARDANDO_CONFIRMACAO" if validation.canComplete else "VALIDADO",
            total_rows=validation.totalRows,
            valid_rows=validation.validRows,
            alert_rows=validation.alertRows,
            blocked_rows=validation.blockedRows,
        )
        insert_import_log(
            connection,
            session_id=session_id,
            stage="upload",
            event="session_created",
            message="Arquivo recebido e processado em staging.",
            metrics={**_validation_metrics(validation, started_at), "stagingRows": len(staging_rows)},
        )
        insert_audit_log(
            connection,
            entity="import_session",
            record_id=session_id,
            action="created",
            after={
                "filename": filename,
                "status": "AGUARDANDO_CONFIRMACAO" if validation.canComplete else "VALIDADO",
                **_validation_metrics(validation, started_at),
            },
        )
        session = get_import_session(connection, session_id)

    validation.sessionId = session_id
    return ImportSessionResponse(session=_session_summary(session), validation=validation)


def reprocess_staged_import(session_id: int) -> ImportSessionResponse:
    started_at = time.perf_counter()
    with get_connection() as connection:
        session = get_import_session(connection, session_id)
        if not session:
            raise ValueError("Sessao de importacao nao encontrada.")
        if _is_status(session["status"], "CANCELADO", "cancelada"):
            raise ValueError("Sessao cancelada nao pode ser reprocessada.")
        if _is_status(session["status"], "CONFIRMADO", "concluida"):
            raise ValueError("Sessao concluida nao pode ser reprocessada.")

        filename = session["nome_arquivo"]
        content = bytes(session["conteudo_arquivo"])
        dataframe, column_lookup = read_normalized_dataframe(filename, content, REQUIRED_COLUMNS)
        validation = validate_import_dataframe(filename=filename, dataframe=dataframe, column_lookup=column_lookup)
        validation.fileHistory = _build_file_history(
            connection=connection,
            filename=filename,
            file_hash=session["hash_arquivo"],
            dataframe=dataframe,
            column_lookup=column_lookup,
        )
        staging_rows = build_staging_rows_from_dataframe(dataframe, column_lookup, validation.classifications)
        clear_staging_rows(connection, session_id)
        insert_staging_rows(connection, session_id, staging_rows)
        update_import_session_summary(
            connection,
            session_id,
            status="AGUARDANDO_CONFIRMACAO" if validation.canComplete else "VALIDADO",
            total_rows=validation.totalRows,
            valid_rows=validation.validRows,
            alert_rows=validation.alertRows,
            blocked_rows=validation.blockedRows,
        )
        insert_import_log(
            connection,
            session_id=session_id,
            stage="classification",
            event="session_reprocessed",
            message="Sessao reprocessada com categorias e perfis operacionais atuais.",
            metrics={**_validation_metrics(validation, started_at), "stagingRows": len(staging_rows)},
        )
        insert_audit_log(
            connection,
            entity="import_session",
            record_id=session_id,
            action="reprocessed",
            before={"status": session["status"]},
            after={
                "status": "AGUARDANDO_CONFIRMACAO" if validation.canComplete else "VALIDADO",
                **_validation_metrics(validation, started_at),
            },
        )
        session = get_import_session(connection, session_id)

    validation.sessionId = session_id
    return ImportSessionResponse(session=_session_summary(session), validation=validation)


def cancel_staged_import(session_id: int) -> ImportSessionSummary:
    with get_connection() as connection:
        session = get_import_session(connection, session_id)
        if not session:
            raise ValueError("Sessao de importacao nao encontrada.")
        cancel_import_session(connection, session_id)
        insert_audit_log(
            connection,
            entity="import_session",
            record_id=session_id,
            action="cancelled",
            before={"status": session["status"]},
            after={"status": "CANCELADO"},
        )
        insert_import_log(
            connection,
            session_id=session_id,
            stage="cancel",
            event="session_cancelled",
            message="Importacao temporaria cancelada pelo usuario.",
        )
        session = get_import_session(connection, session_id)
    return _session_summary(session)


def complete_staged_import(
    session_id: int,
    duplicate_keep_lines: set[int] | None = None,
    classification_overrides: dict[int, dict[str, str]] | None = None,
) -> ImportCompleteResponse:
    started_at = time.perf_counter()
    with get_connection() as connection:
        session = get_import_session(connection, session_id)
        if not session:
            raise ValueError("Sessao de importacao nao encontrada.")
        if _is_status(session["status"], "CANCELADO", "cancelada"):
            raise ValueError("Sessao cancelada nao pode ser concluida.")
        if _is_status(session["status"], "CONFIRMADO", "concluida"):
            raise ValueError("Sessao ja concluida.")

        filename = session["nome_arquivo"]
        content = bytes(session["conteudo_arquivo"])
        validation = validate_import_file(filename=filename, content=content, duplicate_keep_lines=duplicate_keep_lines)
        if not validation.canComplete:
            insert_import_log(
                connection,
                session_id=session_id,
                stage="validation",
                level="warning",
                event="completion_blocked",
                message="Conclusao bloqueada por erros de validacao.",
                metrics=_validation_metrics(validation, started_at),
            )
            update_import_session_summary(
                connection,
                session_id,
                status="ERRO",
                total_rows=validation.totalRows,
                valid_rows=validation.validRows,
                alert_rows=validation.alertRows,
                blocked_rows=validation.blockedRows,
            )
            insert_audit_log(
                connection,
                entity="import_session",
                record_id=session_id,
                action="completion_blocked",
                before={"status": session["status"]},
                after={"status": "ERRO", **_validation_metrics(validation, started_at)},
            )
            raise ValueError("A importacao possui bloqueios. Corrija os erros antes de concluir.")

        staging_rows = list_staging_rows(connection, session_id)
        if not staging_rows:
            raise ValueError("Sessao sem dados temporarios para concluir. Reprocesse ou envie a planilha novamente.")
        records = build_records_from_staging_rows(
            staging_rows,
            validation,
            classification_overrides=classification_overrides,
            duplicate_keep_lines=duplicate_keep_lines,
        )
        import_id = persist_final_import(
            connection,
            filename=filename,
            file_hash=session["hash_arquivo"],
            validation=validation,
            records=records,
            duplicate_keep_lines=duplicate_keep_lines,
        )
        update_import_session_summary(
            connection,
            session_id,
            status="CONFIRMADO",
            total_rows=validation.totalRows,
            valid_rows=validation.validRows,
            alert_rows=validation.alertRows,
            blocked_rows=validation.blockedRows,
            import_id=import_id,
        )
        insert_import_log(
            connection,
            session_id=session_id,
            import_id=import_id,
            stage="persistence",
            event="session_completed",
            message="Dados confirmados e persistidos nas tabelas finais.",
            metrics={**_validation_metrics(validation, started_at), "savedRows": len(records)},
        )
        insert_audit_log(
            connection,
            entity="import_session",
            record_id=session_id,
            action="completed",
            before={"status": session["status"]},
            after={
                "status": "CONFIRMADO",
                "importId": import_id,
                "savedRows": len(records),
                **_validation_metrics(validation, started_at),
            },
        )
        insert_audit_log(
            connection,
            entity="import",
            record_id=import_id,
            action="created",
            after={
                "filename": filename,
                "status": "concluida",
                "savedRows": len(records),
                "classifierVersion": _classifier_version_from_records(records),
            },
        )

    return ImportCompleteResponse(
        importId=import_id,
        filename=filename,
        status="concluida",
        totalRows=validation.totalRows,
        validRows=validation.validRows,
        alertRows=validation.alertRows,
        blockedRows=validation.blockedRows,
        savedRows=len(records),
    )

def _validation_metrics(validation: ImportValidationResponse, started_at: float) -> dict[str, Any]:
    return {
        "totalRows": validation.totalRows,
        "validRows": validation.validRows,
        "alertRows": validation.alertRows,
        "blockedRows": validation.blockedRows,
        "duplicates": len(validation.duplicates),
        "classifications": len(validation.classifications),
        "elapsedMs": round((time.perf_counter() - started_at) * 1000, 2),
    }


def _build_file_history(
    *,
    connection,
    filename: str,
    file_hash: str,
    dataframe: pd.DataFrame,
    column_lookup: dict[str, str],
) -> ImportFileHistory:
    related_imports = list_imports_for_file_history(connection, filename, file_hash)
    if not related_imports:
        return ImportFileHistory(
            status="novo",
            message="Nenhuma importacao anterior encontrada para este arquivo/projeto.",
        )

    exact_match = next((row for row in related_imports if row["hash_arquivo"] == file_hash), None)
    same_project_imports = [row for row in related_imports if _project_name(row["nome_arquivo"]) == _project_name(filename)]
    latest_same_project = same_project_imports[0] if same_project_imports else None
    current_record_ids = _current_record_ids(dataframe, column_lookup)
    latest_record_ids = list_import_record_ids(connection, int(latest_same_project["id"])) if latest_same_project else set()

    new_records = len(current_record_ids - latest_record_ids)
    removed_records = len(latest_record_ids - current_record_ids)
    unchanged_records = len(current_record_ids & latest_record_ids)

    if exact_match:
        message = f"Este arquivo ja foi importado anteriormente na importacao #{exact_match['id']}."
        status = "arquivo_ja_importado"
    elif latest_same_project:
        message = (
            f"Ja existe importacao para este projeto. A planilha parece ser uma nova versao: "
            f"{new_records} novo(s), {removed_records} removido(s) e {unchanged_records} mantido(s)."
        )
        status = "nova_versao"
    else:
        message = "Hash do arquivo ja existe em outra importacao, mas sem projeto com o mesmo nome."
        status = "arquivo_relacionado"

    return ImportFileHistory(
        status=status,
        message=message,
        sameProjectImportCount=len(same_project_imports),
        exactDuplicate=exact_match is not None,
        latestImport=_related_import_summary(latest_same_project, file_hash) if latest_same_project else None,
        matchingImport=_related_import_summary(exact_match, file_hash) if exact_match else None,
        newRecords=new_records,
        removedRecords=removed_records,
        unchangedRecords=unchanged_records,
    )


def _current_record_ids(dataframe: pd.DataFrame, column_lookup: dict[str, str]) -> set[str]:
    if "IdLancamento" not in column_lookup:
        return set()
    return {
        str(value).strip()
        for value in dataframe["IdLancamento"].tolist()
        if str(value).strip()
    }


def _related_import_summary(row: dict[str, Any], current_hash: str) -> RelatedImportSummary:
    return RelatedImportSummary(
        importId=row["id"],
        filename=row["nome_arquivo"],
        importedAt=row["data_importacao"].isoformat(),
        totalRows=row["total_registros"],
        totalHours=round(int(row["total_seconds"] or 0) / 3600, 2),
        sameFileHash=row["hash_arquivo"] == current_hash,
    )


def _project_name(filename: str) -> str:
    from pathlib import Path

    return Path(filename).stem.strip().lower()


def _session_summary(row: dict[str, Any] | None) -> ImportSessionSummary:
    if not row:
        raise ValueError("Sessao de importacao nao encontrada.")
    return ImportSessionSummary(
        sessionId=row["id"],
        filename=row["nome_arquivo"],
        status=row["status"],
        totalRows=row["total_registros"],
        validRows=row["registros_validos"],
        alertRows=row["registros_com_alerta"],
        blockedRows=row["registros_bloqueados"],
        createdAt=row["criado_em"].isoformat(),
        updatedAt=row["atualizado_em"].isoformat(),
        importId=row["importacao_final_id"],
    )


def _is_status(value: str, *candidates: str) -> bool:
    return value.lower() in {candidate.lower() for candidate in candidates}


def _classifier_version_from_records(records: list[dict[str, Any]]) -> str:
    versions = [str(record.get("VersaoClassificador", "")).strip() for record in records]
    versions = [version for version in versions if version]
    if not versions:
        return "1.0.0"
    unique_versions = sorted(set(versions))
    return unique_versions[0] if len(unique_versions) == 1 else "multi"
