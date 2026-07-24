from __future__ import annotations

from datetime import date

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.services.general_indicators_service import (
    GeneralIndicatorConcurrentUpdateError,
    GeneralIndicatorConfirmationRequiredError,
    GeneralIndicatorConsultationNotFoundError,
    GeneralIndicatorFinalizedError,
    GeneralIndicatorHierarchyRefreshRequiredError,
    GeneralIndicatorEmptyError,
    GeneralIndicatorNotReadyError,
    create_general_indicator_validation,
    finalize_general_indicator_consultation,
    get_general_indicator_consultation_snapshot,
    get_finalized_general_indicator_audit,
    get_finalized_general_indicator_result,
    paginate_finalized_general_indicator_response,
    paginate_general_indicator_response,
    process_general_indicator_validation,
    refresh_full_general_indicator_consultation,
    refresh_general_indicator_pendings,
    run_general_indicator_validation,
)
from app.schemas.general_indicators import GeneralIndicatorFinalizedSnapshot
from app.schemas.report_history import (
    AnnualReportDeleteResponse,
    AnnualReportDetail,
    AnnualReportListResponse,
    AnnualReportRevisionSummary,
    AnnualReportUpdateRequest,
    AnnualReportUpdateResponse,
    AnnualReportUpdateState,
    ReportActionRequest,
    ReportDeleteResponse,
    ReportDetail,
    ReportListResponse,
    ReportStatusFilter,
    ReportType,
)
from app.services.report_history_service import (
    ReportHistoryConflictError,
    ReportHistoryNotFoundError,
    archive_saved_report,
    delete_annual_saved_report,
    delete_saved_report,
    get_annual_saved_report,
    get_annual_saved_report_revisions,
    get_annual_saved_report_update,
    get_saved_report,
    list_annual_saved_reports,
    list_saved_reports,
    make_saved_report_current,
    start_annual_saved_report_update,
)
from app.services.general_indicators_classification import HIERARCHY_CONTRACT_VERSION
from app.services.sqlserver_service import (
    SQLServerConfigurationError,
    SQLServerConnectionError,
    SQLServerIntegrationError,
    SQLServerTimeoutError,
)

router = APIRouter()


@router.get("/reports", response_model=AnnualReportListResponse)
def list_general_indicator_reports(
    report_type: ReportType = Query(default=ReportType.GENERAL_INDICATORS, alias="type"),
    year: int | None = Query(default=None, ge=2000, le=2200),
    search: str | None = Query(default=None, max_length=255),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
) -> AnnualReportListResponse:
    return list_annual_saved_reports(
        report_type=report_type,
        year=year,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/reports/{report_id}", response_model=AnnualReportDetail)
def get_general_indicator_report(report_id: int) -> AnnualReportDetail:
    try:
        return get_annual_saved_report(report_id)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/reports/{report_id}/make-current", response_model=ReportDetail)
def make_general_indicator_report_current(
    report_id: int,
    payload: ReportActionRequest | None = None,
) -> ReportDetail:
    try:
        return make_saved_report_current(report_id, actor=payload.actor if payload else None)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/reports/{report_id}/archive", response_model=ReportDetail)
def archive_general_indicator_report(
    report_id: int,
    payload: ReportActionRequest | None = None,
) -> ReportDetail:
    try:
        return archive_saved_report(report_id, actor=payload.actor if payload else None)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/reports/{report_id}/updates", response_model=AnnualReportUpdateResponse, status_code=status.HTTP_202_ACCEPTED)
def start_general_indicator_report_update(
    report_id: int,
    payload: AnnualReportUpdateRequest,
    background_tasks: BackgroundTasks,
) -> AnnualReportUpdateResponse:
    try:
        update = start_annual_saved_report_update(
            report_id,
            new_period_end=payload.newPeriodEnd,
            actor=payload.actor,
            hierarchy_contract_version=HIERARCHY_CONTRACT_VERSION,
        )
        background_tasks.add_task(
            process_general_indicator_validation,
            update.consultationId,
            start_date=update.periodStart,
            end_date=update.periodEnd,
        )
        return update
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/reports/{report_id}/updates/current", response_model=AnnualReportUpdateState)
def get_general_indicator_report_update(report_id: int) -> AnnualReportUpdateState:
    try:
        return get_annual_saved_report_update(report_id)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/reports/{report_id}/revisions", response_model=list[AnnualReportRevisionSummary])
def list_general_indicator_report_revisions(report_id: int) -> list[AnnualReportRevisionSummary]:
    try:
        return get_annual_saved_report_revisions(report_id)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/reports/{report_id}", response_model=AnnualReportDeleteResponse)
def delete_general_indicator_report(
    report_id: int,
    actor: str | None = Query(default=None, max_length=255),
) -> AnnualReportDeleteResponse:
    try:
        return delete_annual_saved_report(report_id, actor=actor)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/consultations", status_code=status.HTTP_202_ACCEPTED)
def start_general_indicator_consultation(
    background_tasks: BackgroundTasks,
    start_date: date = Query(alias="startDate"),
    end_date: date = Query(alias="endDate"),
) -> dict:
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="A data final deve ser igual ou posterior à data inicial.")
    try:
        job = create_general_indicator_validation(start_date=start_date, end_date=end_date)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    background_tasks.add_task(
        process_general_indicator_validation,
        int(job["consultationId"]),
        start_date=start_date,
        end_date=end_date,
    )
    return job


@router.get("/consultations/{consultation_id}")
def get_general_indicator_consultation(
    consultation_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> dict:
    try:
        return get_general_indicator_consultation_snapshot(
            consultation_id,
            page=page,
            page_size=page_size,
        )
    except GeneralIndicatorConsultationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/consultations/{consultation_id}/finalize", response_model=GeneralIndicatorFinalizedSnapshot)
def finalize_general_indicators(
    consultation_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> GeneralIndicatorFinalizedSnapshot:
    try:
        return GeneralIndicatorFinalizedSnapshot.model_validate(
            paginate_finalized_general_indicator_response(
                finalize_general_indicator_consultation(consultation_id),
                page=page,
                page_size=page_size,
            )
        )
    except GeneralIndicatorConsultationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeneralIndicatorConcurrentUpdateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (
        GeneralIndicatorNotReadyError,
        GeneralIndicatorEmptyError,
        GeneralIndicatorHierarchyRefreshRequiredError,
        ValueError,
    ) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/consultations/{consultation_id}/audit", response_model=GeneralIndicatorFinalizedSnapshot)
def get_general_indicator_audit(
    consultation_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> GeneralIndicatorFinalizedSnapshot:
    try:
        return GeneralIndicatorFinalizedSnapshot.model_validate(
            get_finalized_general_indicator_audit(
                consultation_id,
                page=page,
                page_size=page_size,
            )
        )
    except GeneralIndicatorConsultationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeneralIndicatorNotReadyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/consultations/{consultation_id}/result", response_model=GeneralIndicatorFinalizedSnapshot)
def get_general_indicator_result(consultation_id: int) -> GeneralIndicatorFinalizedSnapshot:
    try:
        return GeneralIndicatorFinalizedSnapshot.model_validate(
            get_finalized_general_indicator_result(consultation_id)
        )
    except GeneralIndicatorConsultationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except GeneralIndicatorNotReadyError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.post("/consultations/{consultation_id}/pending-refresh")
def update_general_indicator_pendings(
    consultation_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> dict:
    try:
        return paginate_general_indicator_response(
            refresh_general_indicator_pendings(consultation_id),
            page=page,
            page_size=page_size,
        )
    except GeneralIndicatorConsultationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (GeneralIndicatorConcurrentUpdateError, GeneralIndicatorFinalizedError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except GeneralIndicatorHierarchyRefreshRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (SQLServerConfigurationError, SQLServerConnectionError) as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except SQLServerTimeoutError as exc:
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    except SQLServerIntegrationError as exc:
        raise HTTPException(status_code=400, detail=exc.user_message) from exc


@router.post("/consultations/{consultation_id}/full-refresh")
def redo_general_indicator_consultation(
    consultation_id: int,
    confirm: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> dict:
    try:
        return paginate_general_indicator_response(
            refresh_full_general_indicator_consultation(consultation_id, confirmed=confirm),
            page=page,
            page_size=page_size,
        )
    except GeneralIndicatorConfirmationRequiredError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except GeneralIndicatorConsultationNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (GeneralIndicatorConcurrentUpdateError, GeneralIndicatorFinalizedError) as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (SQLServerConfigurationError, SQLServerConnectionError) as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except SQLServerTimeoutError as exc:
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    except SQLServerIntegrationError as exc:
        raise HTTPException(status_code=400, detail=exc.user_message) from exc


@router.get("/consultation")
def consult_general_indicators(
    start_date: date = Query(alias="startDate"),
    end_date: date = Query(alias="endDate"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> dict:
    if end_date < start_date:
        raise HTTPException(status_code=422, detail="A data final deve ser igual ou posterior à data inicial.")
    try:
        return paginate_general_indicator_response(
            run_general_indicator_validation(start_date=start_date, end_date=end_date),
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (SQLServerConfigurationError, SQLServerConnectionError) as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except SQLServerTimeoutError as exc:
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    except SQLServerIntegrationError as exc:
        raise HTTPException(status_code=400, detail=exc.user_message) from exc
