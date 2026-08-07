from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date, datetime
from time import perf_counter
from typing import Any, Callable

from app.core.config import settings
from app.db import get_connection
from app.repositories.general_indicators_repository import (
    begin_general_indicator_update,
    begin_general_indicator_finalization,
    complete_general_indicator_update,
    complete_general_indicator_finalization,
    create_general_indicator_consultation,
    fail_general_indicator_update,
    fail_general_indicator_finalization,
    get_general_indicator_consultation,
    is_general_indicator_update_active,
    list_general_indicator_distribution_weights,
    list_active_general_indicator_inconsistencies,
    list_active_blocking_inconsistencies,
    list_general_indicator_inconsistency_history,
    list_general_indicator_launches,
    list_general_indicator_launches_page,
    list_nonparticipating_general_indicator_logins,
    mark_general_indicator_consultation_error,
    mark_stale_general_indicator_consultation_error,
    save_general_indicator_validation,
    update_general_indicator_consultation_progress,
)
from app.repositories.general_indicator_modules_repository import list_general_indicator_modules
from app.services.general_indicators_classification import classify_general_indicator_launches
from app.services.general_indicators_rules import (
    build_finalized_general_indicators,
    distribution_configuration_snapshot,
)
from app.services.general_indicators_validation import validate_general_indicator_consultation
from app.services.general_indicator_modules_service import apply_general_indicator_module_configuration
from app.services.sqlserver_service import (
    GENERAL_INDICATOR_FEATURE_BATCH_SIZE,
    GENERAL_INDICATOR_HIERARCHY_BATCH_SIZE,
    SQLServerIntegrationError,
    query_general_indicator_raw_launches,
    query_general_indicator_raw_launches_by_ids,
    query_tfs_indicator_items,
    query_tfs_task_hierarchies,
)

logger = logging.getLogger(__name__)


class GeneralIndicatorUpdateError(Exception):
    pass


class GeneralIndicatorConsultationNotFoundError(GeneralIndicatorUpdateError):
    pass


class GeneralIndicatorConcurrentUpdateError(GeneralIndicatorUpdateError):
    pass


class GeneralIndicatorFinalizedError(GeneralIndicatorUpdateError):
    pass


class GeneralIndicatorConfirmationRequiredError(GeneralIndicatorUpdateError):
    pass


class GeneralIndicatorNotReadyError(GeneralIndicatorUpdateError):
    pass


class GeneralIndicatorEmptyError(GeneralIndicatorUpdateError):
    pass


class GeneralIndicatorHierarchyRefreshRequiredError(GeneralIndicatorUpdateError):
    pass


def consult_general_indicator_launches(
    *,
    start_date: date,
    end_date: date,
    progress_callback: Callable[[dict[str, Any]], None] | None = None,
) -> dict[str, Any]:
    started_at = perf_counter()
    _notify_progress(progress_callback, "launches", 10, "Consultando lançamentos do período.")
    launches = query_general_indicator_raw_launches(start_date=start_date, end_date=end_date)
    with get_connection() as connection:
        nonparticipating_logins = list_nonparticipating_general_indicator_logins(connection)
        modules = list_general_indicator_modules(connection)
    elapsed = perf_counter() - started_at
    logger.info("Indicadores gerais: lancamentos consultados. quantidade=%s segundos=%.2f", len(launches), elapsed)
    task_ids = sorted(
        {
            parsed
            for row in launches
            if (parsed := _numeric_id(row.get("IdTask") or row.get("Task"))) is not None
        }
    )
    _notify_progress(
        progress_callback,
        "hierarchy",
        35,
        "Resolvendo hierarquia das Tasks em lotes.",
        sourceRowCount=len(launches),
        uniqueTaskCount=len(task_ids),
        elapsedSeconds=round(elapsed, 2),
    )
    hierarchy_started_at = perf_counter()
    hierarchies = query_tfs_task_hierarchies(task_ids)
    hierarchy_elapsed = perf_counter() - hierarchy_started_at
    logger.info(
        "Indicadores gerais: hierarquias consultadas. tasks=%s linhas=%s segundos=%.2f",
        len(task_ids),
        len(hierarchies),
        hierarchy_elapsed,
    )
    feature_ids = sorted(
        {
            parsed
            for row in hierarchies
            if (parsed := _numeric_id(row.get("IdFeat"))) is not None
        }
    )
    _notify_progress(
        progress_callback,
        "features",
        65,
        "Consultando Features e TAGs em lotes.",
        sourceRowCount=len(launches),
        uniqueTaskCount=len(task_ids),
        hierarchyRowCount=len(hierarchies),
        uniqueFeatureCount=len(feature_ids),
        elapsedSeconds=round(perf_counter() - started_at, 2),
    )
    features_started_at = perf_counter()
    features = query_tfs_indicator_items(feature_ids)
    features_elapsed = perf_counter() - features_started_at
    logger.info(
        "Indicadores gerais: Features consultadas. features=%s segundos=%.2f",
        len(feature_ids),
        features_elapsed,
    )
    classified = classify_general_indicator_launches(
        launches,
        hierarchies,
        features,
        start_date=start_date,
        end_date=end_date,
        nonparticipating_logins=nonparticipating_logins,
    )
    apply_general_indicator_module_configuration(classified, modules)
    total_elapsed = perf_counter() - started_at
    hierarchy_query_count = int(
        getattr(
            hierarchies,
            "query_count",
            (len(task_ids) + GENERAL_INDICATOR_HIERARCHY_BATCH_SIZE - 1) // GENERAL_INDICATOR_HIERARCHY_BATCH_SIZE,
        )
    )
    feature_query_count = (len(feature_ids) + GENERAL_INDICATOR_FEATURE_BATCH_SIZE - 1) // GENERAL_INDICATOR_FEATURE_BATCH_SIZE
    classified.setdefault("summary", {})["performance"] = {
        "sourceQueryCount": 1,
        "hierarchyQueryCount": hierarchy_query_count,
        "featureQueryCount": feature_query_count,
        "estimatedSqlServerQueryCount": 1 + hierarchy_query_count + feature_query_count,
        "sourceSeconds": round(elapsed, 2),
        "hierarchySeconds": round(hierarchy_elapsed, 2),
        "featureSeconds": round(features_elapsed, 2),
        "totalConsultationSeconds": round(total_elapsed, 2),
    }
    _notify_progress(
        progress_callback,
        "validation",
        85,
        "Classificação concluída. Validando inconsistências.",
        sourceRowCount=len(launches),
        uniqueLaunchCount=classified.get("summary", {}).get("uniqueLaunchCount", len(launches)),
        uniqueTaskCount=len(task_ids),
        uniqueFeatureCount=len(feature_ids),
        elapsedSeconds=round(total_elapsed, 2),
    )
    return classified


def run_general_indicator_validation(*, start_date: date, end_date: date) -> dict[str, Any]:
    job = create_general_indicator_validation(start_date=start_date, end_date=end_date)
    return process_general_indicator_validation(
        int(job["consultationId"]),
        start_date=start_date,
        end_date=end_date,
    )


def create_general_indicator_validation(*, start_date: date, end_date: date) -> dict[str, Any]:
    if end_date < start_date:
        raise ValueError("A Data Final deve ser igual ou posterior à Data Inicial.")
    with get_connection() as connection:
        consultation_id = create_general_indicator_consultation(
            connection,
            start_date=start_date,
            end_date=end_date,
        )
        update_general_indicator_consultation_progress(
            connection,
            consultation_id,
            progress={"stage": "queued", "percentage": 0, "message": "Consulta aguardando processamento."},
        )
    return {
        "consultationId": consultation_id,
        "status": "CONSULTANDO",
        "period": {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
        "progress": {"stage": "queued", "percentage": 0, "message": "Consulta aguardando processamento."},
    }


def process_general_indicator_validation(
    consultation_id: int,
    *,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    started_at = perf_counter()

    def progress(payload: dict[str, Any]) -> None:
        with get_connection() as connection:
            update_general_indicator_consultation_progress(connection, consultation_id, progress=payload)

    try:
        distribution_configuration = _current_distribution_configuration()
        consultation = consult_general_indicator_launches(
            start_date=start_date,
            end_date=end_date,
            progress_callback=progress,
        )
        validation = validate_general_indicator_consultation(
            consultation,
            distribution_configuration=distribution_configuration,
        )
        validation["consultationId"] = consultation_id
        validation["summary"]["distributionConfiguration"] = distribution_configuration_snapshot(
            distribution_configuration
        )
        validation["summary"]["processing"] = {
            "stage": "completed",
            "percentage": 100,
            "message": "Consulta e validação concluídas.",
            "elapsedSeconds": round(perf_counter() - started_at, 2),
        }
        with get_connection() as connection:
            save_general_indicator_validation(connection, consultation_id, validation)
        return validation
    except Exception as exc:
        logger.exception("Falha ao processar consulta de indicadores gerais. consulta_id=%s", consultation_id)
        message = exc.user_message if isinstance(exc, SQLServerIntegrationError) else str(exc)
        with get_connection() as connection:
            mark_general_indicator_consultation_error(connection, consultation_id, message=message)
        return get_general_indicator_consultation_snapshot(consultation_id)


def get_general_indicator_consultation_snapshot(
    consultation_id: int,
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    with get_connection() as connection:
        consultation = get_general_indicator_consultation(connection, consultation_id)
        if consultation is None:
            raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
        status = str(consultation["status"])
        summary = dict(consultation.get("resumo") or {})
        requires_full_refresh = int(consultation.get("hierarchy_contract_version") or 1) < 2
        period = {
            "startDate": consultation["data_inicial"].isoformat(),
            "endDate": consultation["data_final"].isoformat(),
        }
        if status == "CONSULTANDO" and mark_stale_general_indicator_consultation_error(connection, consultation_id):
            status = "ERRO"
            consultation["mensagem_erro"] = "A consulta assíncrona expirou antes de concluir. Execute uma nova consulta."
        if status in {"CONSULTANDO", "ERRO"}:
            return {
                "consultationId": consultation_id,
                "annualReportId": consultation.get("annual_report_id"),
                "status": status,
                "period": period,
                "progress": summary.get("processing", {}),
                "error": consultation.get("mensagem_erro"),
            }
        total = int(summary.get("uniqueLaunchCount", 0))
        launches = list_general_indicator_launches_page(
            connection,
            consultation_id,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
        issues = list_active_general_indicator_inconsistencies(connection, consultation_id)
    return {
        "consultationId": consultation_id,
        "annualReportId": consultation.get("annual_report_id"),
        "stage": "validation_completed",
        "nextStage": "finalization" if status == "PRONTA_PARA_FINALIZAR" else "correction",
        "status": status,
        "canFinalize": status == "PRONTA_PARA_FINALIZAR" and not requires_full_refresh,
        "requiresFullRefresh": requires_full_refresh,
        "validatedAt": consultation["ultima_validacao_em"].isoformat() if consultation.get("ultima_validacao_em") else None,
        "period": period,
        "summary": summary,
        "launches": launches,
        "diagnostics": {"duplicates": [], "unresolvedTaskIds": [], "unresolvedParentIds": [], "unresolvedFeatureIds": []},
        "inconsistencies": {"items": issues, "byFeature": [], "byLaunch": []},
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": max((total + page_size - 1) // page_size, 1),
        },
    }


def paginate_general_indicator_response(
    payload: dict[str, Any],
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    launches = list(payload.get("launches", []))
    total = len(launches)
    start = (page - 1) * page_size
    return {
        **payload,
        "launches": launches[start : start + page_size],
        "pagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": max((total + page_size - 1) // page_size, 1),
        },
    }


def paginate_finalized_general_indicator_response(
    payload: dict[str, Any],
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    audit = list(payload.get("audit", []))
    total = len(audit)
    start = (page - 1) * page_size
    return {
        **payload,
        "audit": audit[start : start + page_size],
        "auditPagination": {
            "page": page,
            "pageSize": page_size,
            "totalItems": total,
            "totalPages": max((total + page_size - 1) // page_size, 1),
        },
    }


def get_finalized_general_indicator_audit(
    consultation_id: int,
    *,
    page: int = 1,
    page_size: int = 100,
) -> dict[str, Any]:
    with get_connection() as connection:
        consultation = get_general_indicator_consultation(connection, consultation_id)
    if consultation is None:
        raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
    if consultation.get("status") != "FINALIZADA" or not consultation.get("resultado"):
        raise GeneralIndicatorNotReadyError("A consulta ainda não possui resultado finalizado.")
    return paginate_finalized_general_indicator_response(
        _compatible_finalized_snapshot(consultation),
        page=page,
        page_size=page_size,
    )


def get_finalized_general_indicator_result(consultation_id: int) -> dict[str, Any]:
    """Retorna exclusivamente o snapshot persistido, sem consultar SQL Server/TFS."""
    with get_connection() as connection:
        consultation = get_general_indicator_consultation(connection, consultation_id)
    if consultation is None:
        raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
    if consultation.get("status") != "FINALIZADA" or not consultation.get("resultado"):
        raise GeneralIndicatorNotReadyError("A consulta ainda não possui resultado finalizado.")
    return _compatible_finalized_snapshot(consultation)


def _notify_progress(
    callback: Callable[[dict[str, Any]], None] | None,
    stage: str,
    percentage: int,
    message: str,
    **metrics: Any,
) -> None:
    if callback is not None:
        callback({"stage": stage, "percentage": percentage, "message": message, **metrics})


def _current_distribution_configuration() -> dict[str, dict[str, Any]]:
    with get_connection() as connection:
        rows = list_general_indicator_distribution_weights(connection)
    if not rows:
        return distribution_configuration_snapshot()
    return {
        str(row["category_name"]): {
            "weight": str(row["distribution_weight"]),
            "active": bool(row["active"]),
        }
        for row in rows
    }


def _consultation_distribution_configuration(
    consultation: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    summary = dict(consultation.get("resumo") or {})
    configured = summary.get("distributionConfiguration")
    if isinstance(configured, dict) and configured:
        return configured
    return _current_distribution_configuration()


def refresh_general_indicator_pendings(consultation_id: int) -> dict[str, Any]:
    lock = _begin_update(consultation_id, update_type="SELETIVA")
    try:
        consultation, persisted_launches, open_issues = _load_update_context(consultation_id)
        old_issue_keys = {_issue_key(issue) for issue in open_issues}
        affected_launch_ids = {
            str(launch_id)
            for issue in open_issues
            for launch_id in [issue.get("idLancamento"), *issue.get("affectedLaunchIds", [])]
            if launch_id is not None
        }
        feature_ids = {
            int(feature_id)
            for issue in open_issues
            if (feature_id := _numeric_id(issue.get("idFeature"))) is not None
        }
        raw_refresh_ids = {
            numeric_id
            for issue in open_issues
            if issue.get("type") in _RAW_REFRESH_ISSUE_TYPES
            and (numeric_id := _numeric_id(issue.get("idLancamento"))) is not None
        }

        persisted_by_id = {
            str(item.get("idLancamento")): item
            for item in persisted_launches
            if item.get("idLancamento") is not None
        }
        fresh_raw_rows = query_general_indicator_raw_launches_by_ids(sorted(raw_refresh_ids)) if raw_refresh_ids else []
        fresh_raw_by_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in fresh_raw_rows:
            fresh_raw_by_id[str(row.get("IdLancamento"))].append(row)
        affected_sources: list[dict[str, Any]] = []
        for launch_id in sorted(affected_launch_ids):
            if fresh_raw_by_id.get(launch_id):
                affected_sources.extend(fresh_raw_by_id[launch_id])
            elif launch_id in persisted_by_id:
                affected_sources.append(_technical_launch_to_source(persisted_by_id[launch_id]))
        task_ids = sorted(
            {
                parsed
                for row in affected_sources
                if (parsed := _numeric_id(row.get("IdTask") or row.get("Task"))) is not None
            }
        )
        hierarchies = query_tfs_task_hierarchies(task_ids) if task_ids else []
        feature_ids.update(
            parsed
            for row in hierarchies
            if (parsed := _numeric_id(row.get("IdFeat"))) is not None
        )
        features = query_tfs_indicator_items(sorted(feature_ids)) if feature_ids else []
        refreshed = classify_general_indicator_launches(
            affected_sources,
            hierarchies,
            features,
            start_date=consultation["data_inicial"],
            end_date=consultation["data_final"],
            nonparticipating_logins={
                str(item.get("user") or "").strip().casefold()
                for item in persisted_launches
                if not item.get("participatesInGeneralIndicators", True)
            },
        )
        with get_connection() as connection:
            modules = list_general_indicator_modules(connection)
        refreshed_by_id = {
            str(item.get("idLancamento")): item
            for item in refreshed["launches"]
            if item.get("idLancamento") is not None
        }
        for launch_id, refreshed_launch in refreshed_by_id.items():
            if launch_id in fresh_raw_by_id or launch_id not in persisted_by_id:
                continue
            previous_trace = persisted_by_id[launch_id].get("trace", {})
            refreshed_trace = refreshed_launch.setdefault("trace", {})
            for key in ("sourceOccurrenceCount", "duplicateConflict", "duplicateSourceRows"):
                if key in previous_trace:
                    refreshed_trace[key] = previous_trace[key]
        merged_launches = [
            refreshed_by_id.get(str(item.get("idLancamento")), item)
            for item in persisted_launches
        ]
        distribution_configuration = _consultation_distribution_configuration(consultation)
        refreshed_consultation = _rebuild_consultation_payload(
            consultation,
            merged_launches,
            refreshed.get("diagnostics", {}),
        )
        apply_general_indicator_module_configuration(refreshed_consultation, modules)
        validation = validate_general_indicator_consultation(
            refreshed_consultation,
            distribution_configuration=distribution_configuration,
        )
        validation["summary"]["distributionConfiguration"] = distribution_configuration_snapshot(
            distribution_configuration
        )
        result = _attach_update_summary(
            validation,
            consultation_id=consultation_id,
            update_type="SELETIVA",
            pending_before=int(lock["pendingBefore"]),
            old_issue_keys=old_issue_keys,
            requeried_features=len(feature_ids),
            revalidated_launches=len(affected_launch_ids),
        )
        with get_connection() as connection:
            if not is_general_indicator_update_active(connection, consultation_id, int(lock["updateId"])):
                raise GeneralIndicatorConcurrentUpdateError(
                    "Esta atualização expirou ou foi substituída por outro processamento."
                )
            save_general_indicator_validation(connection, consultation_id, result)
            complete_general_indicator_update(connection, int(lock["updateId"]), result=result)
        return result
    except Exception as exc:
        _fail_update(consultation_id, lock, exc)
        raise


def refresh_full_general_indicator_consultation(consultation_id: int, *, confirmed: bool) -> dict[str, Any]:
    if not confirmed:
        raise GeneralIndicatorConfirmationRequiredError("Confirme a atualização completa antes de continuar.")
    lock = _begin_update(consultation_id, update_type="COMPLETA")
    try:
        consultation, _, open_issues = _load_update_context(consultation_id)
        old_issue_keys = {_issue_key(issue) for issue in open_issues}
        refreshed = consult_general_indicator_launches(
            start_date=consultation["data_inicial"],
            end_date=consultation["data_final"],
        )
        distribution_configuration = _current_distribution_configuration()
        validation = validate_general_indicator_consultation(
            refreshed,
            distribution_configuration=distribution_configuration,
        )
        validation["summary"]["distributionConfiguration"] = distribution_configuration_snapshot(
            distribution_configuration
        )
        feature_ids = {item.get("idFeature") for item in validation["launches"] if item.get("idFeature")}
        result = _attach_update_summary(
            validation,
            consultation_id=consultation_id,
            update_type="COMPLETA",
            pending_before=int(lock["pendingBefore"]),
            old_issue_keys=old_issue_keys,
            requeried_features=len(feature_ids),
            revalidated_launches=len(validation["launches"]),
        )
        with get_connection() as connection:
            if not is_general_indicator_update_active(connection, consultation_id, int(lock["updateId"])):
                raise GeneralIndicatorConcurrentUpdateError(
                    "Esta atualização expirou ou foi substituída por outro processamento."
                )
            save_general_indicator_validation(connection, consultation_id, result)
            complete_general_indicator_update(connection, int(lock["updateId"]), result=result)
        return result
    except Exception as exc:
        _fail_update(consultation_id, lock, exc)
        raise


def finalize_general_indicator_consultation(
    consultation_id: int,
    *,
    report_name: str = "Indicadores Gerais",
) -> dict[str, Any]:
    if not report_name.strip():
        raise ValueError("Informe o nome do relatório.")
    if len(report_name) > 255:
        raise ValueError("O nome do relatório deve possuir no máximo 255 caracteres.")
    with get_connection() as connection:
        lock = begin_general_indicator_finalization(connection, consultation_id)
    if not lock.get("acquired"):
        reason = lock.get("reason")
        if reason == "finalized" and lock.get("result"):
            finalized_result = dict(lock["result"])
            if lock.get("reportId") is not None:
                finalized_result["reportId"] = int(lock["reportId"])
            return finalized_result
        if reason == "not_found":
            raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
        if reason == "hierarchy_outdated":
            raise GeneralIndicatorHierarchyRefreshRequiredError(
                "Esta consulta usa uma versão antiga da hierarquia. Execute Refazer consulta completa."
            )
        if reason == "not_ready":
            raise GeneralIndicatorNotReadyError("Resolva todas as inconsistências impeditivas antes de finalizar.")
        raise GeneralIndicatorConcurrentUpdateError("Já existe um processamento em andamento para esta consulta.")

    try:
        with get_connection() as connection:
            consultation = get_general_indicator_consultation(connection, consultation_id)
            launches = list_general_indicator_launches(connection, consultation_id)
            inconsistency_history = list_general_indicator_inconsistency_history(connection, consultation_id)
        if consultation is None:
            raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
        if not launches:
            raise GeneralIndicatorEmptyError("A consulta não possui lançamentos para finalizar.")
        finalized_at = datetime.now().astimezone()
        result = build_finalized_general_indicators(
            launches,
            start_date=consultation["data_inicial"],
            end_date=consultation["data_final"],
            consultation_id=consultation_id,
            consulted_at=consultation["criado_em"],
            finalized_at=finalized_at,
            inconsistency_history=inconsistency_history,
            consultation_summary=dict(consultation.get("resumo") or {}),
            validated_at=consultation.get("ultima_validacao_em"),
            initiated_by=consultation.get("iniciado_por"),
            finalized_by=consultation.get("finalizado_por"),
            backend_build=settings.backend_build_identifier,
            distribution_configuration=_consultation_distribution_configuration(consultation),
        )
        with get_connection() as connection:
            report_id = complete_general_indicator_finalization(
                connection,
                consultation_id,
                result=result,
                report_name=report_name,
            )
        if not report_id:
            raise GeneralIndicatorConcurrentUpdateError(
                "A consulta mudou de estado durante a finalização e o resultado não foi gravado."
            )
        return {**result, "reportId": report_id}
    except Exception as exc:
        try:
            with get_connection() as connection:
                fail_general_indicator_finalization(connection, consultation_id, message=str(exc))
        except Exception:
            logger.exception("Falha ao restaurar consulta após erro na finalização dos indicadores gerais.")
        raise


_RAW_REFRESH_ISSUE_TYPES = {
    "duplicate_id_conflict",
    "duration_empty",
    "duration_invalid",
    "duration_negative",
    "date_invalid",
    "date_outside_period",
    "task_not_found",
    "hierarchy_ambiguous",
    "parent_not_found",
    "parent_type_not_identified",
    "parent_type_unsupported",
    "feature_not_found",
    "feature_type_invalid",
}


def _begin_update(consultation_id: int, *, update_type: str) -> dict[str, Any]:
    with get_connection() as connection:
        result = begin_general_indicator_update(connection, consultation_id, update_type=update_type)
    if result.get("acquired"):
        return result
    reason = result.get("reason")
    if reason == "hierarchy_outdated":
        raise GeneralIndicatorHierarchyRefreshRequiredError(
            "Esta consulta usa uma versão antiga da hierarquia. Execute Refazer consulta completa."
        )
    if reason == "not_found":
        raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
    if reason == "finalized":
        raise GeneralIndicatorFinalizedError("Uma consulta finalizada não pode ser sobrescrita.")
    raise GeneralIndicatorConcurrentUpdateError("Já existe uma atualização em andamento para esta consulta.")


def _load_update_context(consultation_id: int) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    with get_connection() as connection:
        consultation = get_general_indicator_consultation(connection, consultation_id)
        launches = list_general_indicator_launches(connection, consultation_id)
        issues = list_active_blocking_inconsistencies(connection, consultation_id)
    if consultation is None:
        raise GeneralIndicatorConsultationNotFoundError("Consulta de indicadores não encontrada.")
    return consultation, launches, issues


def _technical_launch_to_source(launch: dict[str, Any]) -> dict[str, Any]:
    return {
        "IdLancamento": launch.get("idLancamento"),
        "DataHoraCadastro": launch.get("launchDate"),
        "TempoDuracao": launch.get("durationOriginal"),
        "LoginUsuario": launch.get("user"),
        "IdTask": launch.get("idTask"),
        "Task": launch.get("idTask"),
    }


def _rebuild_consultation_payload(
    consultation: dict[str, Any],
    launches: list[dict[str, Any]],
    refreshed_diagnostics: dict[str, Any],
) -> dict[str, Any]:
    duplicate_diagnostics = list(refreshed_diagnostics.get("duplicates", []))
    refreshed_duplicate_ids = {str(item.get("idLancamento")) for item in duplicate_diagnostics}
    for launch in launches:
        occurrences = int(launch.get("trace", {}).get("sourceOccurrenceCount", 1))
        launch_id = str(launch.get("idLancamento") or "")
        if occurrences > 1 and launch_id not in refreshed_duplicate_ids:
            duplicate_diagnostics.append(
                {
                    "idLancamento": launch_id,
                    "occurrences": occurrences,
                    "conflict": bool(launch.get("trace", {}).get("duplicateConflict")),
                    "sourceRows": launch.get("trace", {}).get("duplicateSourceRows", []),
                }
            )
    previous_summary = dict(consultation.get("resumo") or {})
    classified_count = sum(item.get("classificationState") == "classified" for item in launches)
    return {
        "stage": "consultation_classified",
        "nextStage": "validation",
        "period": {
            "startDate": consultation["data_inicial"].isoformat(),
            "endDate": consultation["data_final"].isoformat(),
        },
        "summary": {
            "sourceRowCount": int(previous_summary.get("sourceRowCount", len(launches))),
            "uniqueLaunchCount": len(launches),
            "classifiedCount": classified_count,
            "pendingClassificationCount": len(launches) - classified_count,
            "duplicateIdCount": len(duplicate_diagnostics),
        },
        "launches": launches,
        "diagnostics": {
            "duplicates": duplicate_diagnostics,
            "unresolvedTaskIds": [],
            "unresolvedParentIds": [],
            "unresolvedFeatureIds": [],
        },
    }


def _attach_update_summary(
    validation: dict[str, Any],
    *,
    consultation_id: int,
    update_type: str,
    pending_before: int,
    old_issue_keys: set[tuple[str, str, str, str]],
    requeried_features: int,
    revalidated_launches: int,
) -> dict[str, Any]:
    new_blocking_issues = [
        issue for issue in validation["inconsistencies"]["items"] if issue.get("blocking")
    ]
    new_issue_keys = {_issue_key(issue) for issue in new_blocking_issues}
    validation["consultationId"] = consultation_id
    validation["updateSummary"] = {
        "type": update_type,
        "pendingBefore": pending_before,
        "resolvedPendingCount": len(old_issue_keys - new_issue_keys),
        "remainingPendingCount": len(new_issue_keys),
        "requeriedFeatureCount": requeried_features,
        "revalidatedLaunchCount": revalidated_launches,
        "newInconsistencyCount": len(new_issue_keys - old_issue_keys),
        "status": validation["status"],
        "updatedAt": validation["validatedAt"],
    }
    return validation


def _issue_key(issue: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        str(issue.get("type") or ""),
        str(issue.get("scope") or ""),
        str(issue.get("idLancamento") or ""),
        str(issue.get("idFeature") or ""),
    )


def _fail_update(consultation_id: int, lock: dict[str, Any], exc: Exception) -> None:
    try:
        with get_connection() as connection:
            fail_general_indicator_update(
                connection,
                consultation_id,
                int(lock["updateId"]),
                previous_status=str(lock["previousStatus"]),
                message=str(exc),
            )
    except Exception:
        logger.exception("Falha ao restaurar estado após erro na atualização dos indicadores gerais.")


def _numeric_id(value: Any) -> int | None:
    text = str(value or "").strip()
    if text.endswith(".0"):
        text = text[:-2]
    return int(text) if text.isdigit() else None


def _compatible_finalized_snapshot(consultation: dict[str, Any]) -> dict[str, Any]:
    """Adapta a leitura de contratos antigos sem recalcular ou sobrescrever o resultado."""
    snapshot = dict(consultation["resultado"])
    contract_version = int(
        snapshot.get("contractVersion")
        or consultation.get("resultado_versao")
        or 1
    )
    snapshot.setdefault("contractVersion", contract_version)
    snapshot.setdefault("quarters", [])
    if "metadata" not in snapshot:
        snapshot["metadata"] = {
            "consultationId": int(consultation["id"]),
            "consultedAt": snapshot.get("consultedAt") or consultation["criado_em"].isoformat(),
            "validatedAt": (
                consultation["ultima_validacao_em"].isoformat()
                if consultation.get("ultima_validacao_em")
                else None
            ),
            "finalizedAt": snapshot.get("finalizedAt") or (
                consultation["finalizado_em"].isoformat()
                if consultation.get("finalizado_em")
                else None
            ),
            "initiatedBy": consultation.get("iniciado_por"),
            "finalizedBy": consultation.get("finalizado_por"),
            "resultContractVersion": contract_version,
            "calculationVersion": consultation.get("calculo_versao"),
            "classificationVersion": consultation.get("classificacao_versao"),
            "distributionRulesVersion": consultation.get("distribuicao_versao"),
            "targetsVersion": consultation.get("metas_versao"),
            "backendBuild": consultation.get("backend_build"),
        }
    snapshot.setdefault("summary", None)
    snapshot.setdefault("rules", None)
    snapshot.setdefault(
        "integrity",
        {
            "algorithm": "SHA-256",
            "launchSnapshotHash": consultation.get("snapshot_hash"),
            "resultHash": consultation.get("resultado_hash"),
        },
    )
    return snapshot
