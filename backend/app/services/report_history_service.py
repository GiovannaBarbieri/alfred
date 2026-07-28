from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import logging
from math import ceil
from typing import Any

from app.db import get_connection
from app.repositories.report_history_repository import (
    archive_report_history,
    begin_annual_report_update,
    delete_annual_report,
    delete_report_history,
    get_annual_report_detail,
    get_annual_report_period_analysis_source,
    get_annual_report_update,
    get_report_history_detail,
    list_annual_report_revisions,
    list_annual_reports,
    list_report_history,
    make_report_history_current,
)
from app.services.general_indicators_rules import build_finalized_general_indicators
from app.repositories.audit_repository import insert_audit_log
from app.schemas.report_history import (
    AnnualReportCurrentRevision,
    AnnualReportDeleteResponse,
    AnnualReportDetail,
    AnnualReportListItem,
    AnnualReportListResponse,
    AnnualReportRevisionSummary,
    AnnualReportUpdateResponse,
    AnnualReportUpdateState,
    AnnualReportUpdateStatus,
    ReportDetail,
    ReportDeleteResponse,
    ReportDeletionCandidate,
    ReportListItem,
    ReportListResponse,
    ReportStatusFilter,
    ReportType,
    ReportVersionInfo,
)

logger = logging.getLogger(__name__)


class ReportHistoryNotFoundError(Exception):
    pass


class ReportHistoryConflictError(Exception):
    pass


class ReportHistoryPeriodAnalysisError(Exception):
    pass


def list_annual_saved_reports(
    *,
    report_type: ReportType,
    year: int | None,
    search: str | None,
    page: int,
    page_size: int,
) -> AnnualReportListResponse:
    with get_connection() as connection:
        rows, total = list_annual_reports(
            connection,
            report_type=report_type.value,
            year=year,
            search=search,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
    return AnnualReportListResponse(
        items=[_annual_list_item(row) for row in rows],
        page=page,
        pageSize=page_size,
        totalItems=total,
        totalPages=ceil(total / page_size) if total else 0,
    )


def get_annual_saved_report(report_id: int) -> AnnualReportDetail:
    with get_connection() as connection:
        row = get_annual_report_detail(connection, report_id)
    if row is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")
    return _annual_detail(row)


def analyze_annual_saved_report_period(
    report_id: int,
    *,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    with get_connection() as connection:
        source = get_annual_report_period_analysis_source(connection, report_id)
    if source is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")

    official_start = source["period_start"]
    official_end = source["period_end"]
    if end_date < start_date:
        raise ReportHistoryPeriodAnalysisError("A Data Inicial deve ser menor ou igual à Data Final.")
    if start_date < official_start or end_date > official_end:
        raise ReportHistoryPeriodAnalysisError(
            "O período analisado deve estar contido no período oficial do relatório."
        )

    snapshot = dict(source.get("snapshot") or {})
    audit = list(snapshot.get("audit") or [])
    distribution_configuration = (
        dict(snapshot.get("rules") or {})
        .get("distribution", {})
        .get("configuration")
    )
    if not isinstance(distribution_configuration, dict) or not distribution_configuration:
        raise ReportHistoryPeriodAnalysisError(
            "Este snapshot não possui os pesos históricos necessários para a análise por período."
        )

    filtered_audit = [
        item
        for item in audit
        if _audit_date(item) is not None and start_date <= _audit_date(item) <= end_date
    ]
    launches = [_audit_item_to_validated_launch(item) for item in filtered_audit]
    analyzed = build_finalized_general_indicators(
        launches,
        start_date=start_date,
        end_date=end_date,
        consultation_id=int(source["source_consultation_id"]),
        consulted_at=snapshot.get("consultedAt") or datetime.now().astimezone(),
        finalized_at=snapshot.get("finalizedAt") or datetime.now().astimezone(),
        consultation_summary={
            "sourceRowCount": len(launches),
            "uniqueLaunchCount": len(launches),
            "consideredLaunchCount": sum(
                1 for item in launches if item["eligibleForOfficialCalculation"]
            ),
            "disregardedLaunchCount": sum(
                1 for item in launches if not item["eligibleForOfficialCalculation"]
            ),
        },
        distribution_configuration=distribution_configuration,
    )
    return {
        "reportId": report_id,
        "source": "SAVED_SNAPSHOT",
        "officialPeriod": {
            "startDate": official_start,
            "endDate": official_end,
        },
        "analyzedPeriod": {
            "startDate": start_date,
            "endDate": end_date,
        },
        "recordCount": analyzed["recordCount"],
        "totalHours": analyzed["totalHours"],
        "kpis": analyzed["kpis"],
        "categories": analyzed["categories"],
        "months": analyzed["months"],
    }


def _audit_date(item: dict[str, Any]) -> date | None:
    raw_value = str(item.get("date") or "").strip()
    if not raw_value:
        return None
    try:
        return date.fromisoformat(raw_value[:10])
    except ValueError:
        return None


def _audit_item_to_validated_launch(item: dict[str, Any]) -> dict[str, Any]:
    launch_date = _audit_date(item)
    duration_hours = Decimal(str(item.get("durationHours") or 0))
    included = bool(item.get("includedInOfficialCalculation"))
    return {
        "idLancamento": item.get("idLancamento"),
        "launchDate": item.get("date"),
        "monthYear": launch_date.strftime("%Y-%m") if launch_date else None,
        "durationHours": float(duration_hours),
        "durationSeconds": duration_hours * Decimal(3600),
        "user": item.get("collaborator"),
        "idTask": item.get("idTask"),
        "idParent": item.get("idParent"),
        "parentWorkItemType": item.get("parentType"),
        "idFeature": item.get("idFeature"),
        "validatedCategory": item.get("finalCategory"),
        "finalCategory": item.get("finalCategory"),
        "isUpdateSystem": bool(item.get("isUpdateSystem")),
        "validationState": item.get("validationState") or "valid",
        "eligibleForOfficialCalculation": included,
        "participatesInGeneralIndicators": bool(
            item.get("participatesInGeneralIndicators", included)
        ),
        "disregardedFromGeneralIndicators": not included,
        "exclusionReason": item.get("exclusionReason"),
        "auditIssues": list(item.get("validationIssues") or []),
        "trace": {
            "sourceOccurrenceCount": int(item.get("sourceOccurrenceCount") or 1),
            "duplicateSourceRows": list(item.get("sourceRows") or []),
            "featureTagsRaw": item.get("originalTags"),
        },
    }


def start_annual_saved_report_update(
    report_id: int,
    *,
    new_period_end: date,
    actor: str | None,
    hierarchy_contract_version: int,
) -> AnnualReportUpdateResponse:
    try:
        with get_connection() as connection:
            row = begin_annual_report_update(
                connection,
                report_id,
                new_period_end=new_period_end,
                actor=_clean_actor(actor),
                hierarchy_contract_version=hierarchy_contract_version,
            )
    except ValueError as exc:
        raise ReportHistoryConflictError(str(exc)) from exc
    if row is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")
    return AnnualReportUpdateResponse(
        reportId=row["report_id"],
        consultationId=row["consultation_id"],
        status=AnnualReportUpdateStatus.PROCESSING,
        periodStart=row["period_start"],
        periodEnd=row["period_end"],
    )


def get_annual_saved_report_update(report_id: int) -> AnnualReportUpdateState:
    with get_connection() as connection:
        row = get_annual_report_update(connection, report_id)
    if row is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")
    return _update_state(row)


def get_annual_saved_report_revisions(report_id: int) -> list[AnnualReportRevisionSummary]:
    with get_connection() as connection:
        rows = list_annual_report_revisions(connection, report_id)
    if rows is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")
    return [
        AnnualReportRevisionSummary(
            id=int(row["id"]),
            consultationId=int(row["source_consultation_id"]),
            revisionNumber=int(row["version_number"]),
            periodStart=row["period_start"],
            periodEnd=row["period_end"],
            finalizedAt=row["finalized_at"],
            createdBy=row.get("created_by"),
            previousRevisionId=row.get("previous_revision_id"),
        )
        for row in rows
    ]


def delete_annual_saved_report(report_id: int, *, actor: str | None) -> AnnualReportDeleteResponse:
    clean_actor = _clean_actor(actor)
    try:
        with get_connection() as connection:
            row = delete_annual_report(connection, report_id)
            if row is None:
                raise ReportHistoryNotFoundError("Relatório não encontrado.")
            insert_audit_log(
                connection,
                entity="annual_report_deletion",
                action="DELETE_PERMANENT",
                record_id=report_id,
                user=clean_actor or "sistema",
                after={
                    "reportId": row["id"],
                    "type": row["report_type"],
                    "year": row["report_year"],
                    "deletedRevisionCount": row["revision_count"],
                    "deletedConsultationCount": row["consultation_count"],
                    "deletedAt": row["deleted_at"],
                },
            )
    except ValueError as exc:
        raise ReportHistoryConflictError(str(exc)) from exc
    return AnnualReportDeleteResponse(
        deleted=True,
        id=row["id"],
        type=row["report_type"],
        year=row["report_year"],
        deletedRevisionCount=row["revision_count"],
        deletedConsultationCount=row["consultation_count"],
        deletedAt=row["deleted_at"],
    )


def list_saved_reports(
    *,
    report_type: ReportType,
    report_status: ReportStatusFilter,
    year: int | None,
    start_date: date | None,
    end_date: date | None,
    search: str | None,
    generated_from: date | None,
    generated_to: date | None,
    page: int,
    page_size: int,
) -> ReportListResponse:
    if start_date and end_date and start_date > end_date:
        raise ValueError("A data inicial do filtro não pode ser maior que a data final.")
    if generated_from and generated_to and generated_from > generated_to:
        raise ValueError("A data inicial de geração não pode ser maior que a data final.")
    with get_connection() as connection:
        rows, total = list_report_history(
            connection,
            report_type=report_type.value,
            report_status=report_status.value,
            year=year,
            start_date=start_date,
            end_date=end_date,
            search=search,
            generated_from=generated_from,
            generated_to=generated_to,
            offset=(page - 1) * page_size,
            limit=page_size,
        )
    return ReportListResponse(
        items=[_list_item(row) for row in rows],
        page=page,
        pageSize=page_size,
        totalItems=total,
        totalPages=ceil(total / page_size) if total else 0,
    )


def get_saved_report(report_id: int) -> ReportDetail:
    with get_connection() as connection:
        row = get_report_history_detail(connection, report_id)
    if row is None:
        raise ReportHistoryNotFoundError("Análise salva não encontrada.")
    return ReportDetail(report=_list_item(row), snapshot=row["snapshot"])


def make_saved_report_current(report_id: int, *, actor: str | None) -> ReportDetail:
    try:
        with get_connection() as connection:
            row = make_report_history_current(connection, report_id, actor=_clean_actor(actor))
    except ValueError as exc:
        raise ReportHistoryConflictError(str(exc)) from exc
    if row is None:
        raise ReportHistoryNotFoundError("Análise salva não encontrada.")
    return ReportDetail(report=_list_item(row), snapshot=row["snapshot"])


def archive_saved_report(report_id: int, *, actor: str | None) -> ReportDetail:
    with get_connection() as connection:
        row = archive_report_history(connection, report_id, actor=_clean_actor(actor))
    if row is None:
        raise ReportHistoryNotFoundError("Análise salva não encontrada.")
    return ReportDetail(report=_list_item(row), snapshot=row["snapshot"])


def delete_saved_report(report_id: int, *, actor: str | None) -> ReportDeleteResponse:
    clean_actor = _clean_actor(actor)
    try:
        with get_connection() as connection:
            row = delete_report_history(connection, report_id)
            if row is None:
                raise ReportHistoryNotFoundError("Análise salva não encontrada.")
            insert_audit_log(
                connection,
                entity="report_history_deletion",
                action="DELETE_PERMANENT",
                record_id=report_id,
                user=clean_actor or "sistema",
                after={
                    "reportId": row["id"],
                    "type": row["report_type"],
                    "periodStart": row["period_start"],
                    "periodEnd": row["period_end"],
                    "versionNumber": row["version_number"],
                    "deletedAt": row["deleted_at"],
                },
            )
    except ValueError as exc:
        raise ReportHistoryConflictError(str(exc)) from exc

    previous_versions = [
        ReportDeletionCandidate(
            id=item["id"],
            versionNumber=item["version_number"],
            status=item["report_status"],
            finalizedAt=item["finalized_at"],
        )
        for item in row["previous_versions"]
    ]
    response = ReportDeleteResponse(
        deleted=True,
        id=row["id"],
        consultationId=row["source_consultation_id"],
        type=row["report_type"],
        periodStart=row["period_start"],
        periodEnd=row["period_end"],
        versionNumber=row["version_number"],
        wasCurrent=row["was_current"],
        previousVersionsAvailable=bool(previous_versions),
        previousVersions=previous_versions,
        deletedAt=row["deleted_at"],
    )
    logger.info(
        "Permanent report deletion completed",
        extra={
            "report_id": response.id,
            "report_type": response.type.value,
            "period_start": response.periodStart.isoformat(),
            "period_end": response.periodEnd.isoformat(),
            "version_number": response.versionNumber,
            "deleted_by": clean_actor,
            "deleted_at": response.deletedAt.isoformat(),
        },
    )
    return response


def _list_item(row: dict[str, Any]) -> ReportListItem:
    return ReportListItem(
        id=int(row["id"]),
        consultationId=int(row["source_consultation_id"]),
        name=str(row["display_name"]),
        type=row["report_type"],
        version=ReportVersionInfo(
            versionNumber=int(row["version_number"]),
            status=row["report_status"],
            isCurrent=bool(row["is_current"]),
            supersededById=row.get("superseded_by_id"),
            supersedesId=row.get("supersedes_id"),
            supersededAt=row.get("superseded_at"),
            archivedAt=row.get("archived_at"),
            archivedBy=row.get("archived_by"),
            currentSelectedAt=row.get("current_selected_at"),
            currentSelectedBy=row.get("current_selected_by"),
        ),
        periodStart=row["period_start"],
        periodEnd=row["period_end"],
        consultedAt=row["created_at"],
        finalizedAt=row["finalized_at"],
        totalHours=float(row["total_hours"]),
        consideredLaunchCount=int(row["considered_launch_count"]),
        excludedCollaboratorCount=int(row["excluded_collaborator_count"]),
        projectsImprovementsPercentage=_float_or_none(row.get("projects_improvements_percentage")),
        projectsImprovementsStatus=row.get("projects_improvements_status"),
        errorsBugsPercentage=_float_or_none(row.get("errors_bugs_percentage")),
        errorsBugsStatus=row.get("errors_bugs_status"),
        responsible=row.get("finalized_by") or row.get("created_by"),
        snapshotContractVersion=int(row["snapshot_contract_version"]),
        resultHash=row.get("result_hash"),
    )


def _annual_list_item(row: dict[str, Any]) -> AnnualReportListItem:
    update_status = _update_status(row.get("active_status"))
    return AnnualReportListItem(
        id=int(row["id"]),
        name=str(row["display_name"]),
        type=row["report_type"],
        year=int(row["report_year"]),
        currentRevisionNumber=int(row["version_number"]),
        periodStart=row["current_period_start"],
        periodEnd=row["current_period_end"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
        finalizedAt=row["finalized_at"],
        totalHours=float(row["total_hours"]),
        consideredLaunchCount=int(row["considered_launch_count"]),
        excludedCollaboratorCount=int(row["excluded_collaborator_count"]),
        projectsImprovementsPercentage=_float_or_none(row.get("projects_improvements_percentage")),
        projectsImprovementsStatus=row.get("projects_improvements_status"),
        errorsBugsPercentage=_float_or_none(row.get("errors_bugs_percentage")),
        errorsBugsStatus=row.get("errors_bugs_status"),
        hasUpdateInProgress=update_status in {
            AnnualReportUpdateStatus.PROCESSING,
            AnnualReportUpdateStatus.PENDING_CORRECTIONS,
            AnnualReportUpdateStatus.READY_TO_FINALIZE,
        },
        updateStatus=update_status,
        responsible=row.get("last_updated_by") or row.get("created_by"),
    )


def _annual_detail(row: dict[str, Any]) -> AnnualReportDetail:
    report = _annual_list_item(row)
    snapshot = dict(row["snapshot"])
    audit_total = int(row.get("audit_total") or 0)
    snapshot["audit"] = []
    snapshot["auditPagination"] = {
        "page": 1,
        "pageSize": 0,
        "totalItems": audit_total,
        "totalPages": 0,
    }
    return AnnualReportDetail(
        report=report,
        currentRevision=AnnualReportCurrentRevision(
            id=int(row["current_revision_id"]),
            consultationId=int(row["source_consultation_id"]),
            revisionNumber=int(row["version_number"]),
            periodStart=row["current_period_start"],
            periodEnd=row["current_period_end"],
            finalizedAt=row["finalized_at"],
            responsible=row.get("last_updated_by") or row.get("created_by"),
            snapshotContractVersion=int(row["snapshot_contract_version"]),
            resultHash=row.get("result_hash"),
            previousRevisionId=row.get("previous_revision_id"),
        ),
        snapshot=snapshot,
        update=_update_state(row),
        revisionCount=int(row["revision_count"]),
    )


def _update_state(row: dict[str, Any]) -> AnnualReportUpdateState:
    status = _update_status(row.get("active_status") or row.get("status"))
    consultation_id = row.get("active_consultation_id") or row.get("consultation_id")
    return AnnualReportUpdateState(
        consultationId=int(consultation_id) if consultation_id is not None else None,
        status=status,
        currentPeriodEnd=row["current_period_end"],
        requestedPeriodEnd=row.get("requested_period_end"),
        createdAt=row.get("update_created_at") or row.get("criado_em"),
        createdBy=row.get("update_created_by") or row.get("iniciado_por"),
        inconsistenciesCount=int(row.get("inconsistencies_count") or 0),
        canContinue=status in {
            AnnualReportUpdateStatus.PENDING_CORRECTIONS,
            AnnualReportUpdateStatus.READY_TO_FINALIZE,
        },
        canFinalize=status == AnnualReportUpdateStatus.READY_TO_FINALIZE,
    )


def _update_status(status: Any) -> AnnualReportUpdateStatus:
    if status in {"CONSULTANDO", "ATUALIZANDO_PENDENCIAS", "REFAZENDO_CONSULTA", "FINALIZANDO"}:
        return AnnualReportUpdateStatus.PROCESSING
    if status == "COM_INCONSISTENCIAS":
        return AnnualReportUpdateStatus.PENDING_CORRECTIONS
    if status == "PRONTA_PARA_FINALIZAR":
        return AnnualReportUpdateStatus.READY_TO_FINALIZE
    if status == "ERRO":
        return AnnualReportUpdateStatus.FAILED
    return AnnualReportUpdateStatus.IDLE


def _clean_actor(actor: str | None) -> str | None:
    cleaned = str(actor or "").strip()
    return cleaned or None


def _float_or_none(value: Any) -> float | None:
    return float(value) if value is not None else None
