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
from app.services.general_indicator_targets_service import target_configuration_for_period
from app.schemas.general_indicators import GeneralIndicatorFinalizationResponse, GeneralIndicatorFinalizedSnapshot
from app.schemas.report_history import (
    AnnualReportUpdateRequest,
    GeneralIndicatorFinalizeRequest,
    ReportType,
    SavedReportDeleteResponse,
    SavedReportDetail,
    SavedReportListResponse,
    ReportPeriodAnalysisResponse,
    ReportPeriodsComparisonResponse,
    ReportComparisonType,
    SavedReportComparisonOptionsResponse,
    SavedReportsComparisonRequest,
    SavedReportsComparisonResponse,
    ReportTypeOptionsResponse,
)
from app.services.report_history_service import (
    ReportHistoryConflictError,
    ReportHistoryNotFoundError,
    ReportHistoryPeriodAnalysisError,
    analyze_annual_saved_report_period,
    compare_annual_saved_report_periods,
    compare_saved_report_snapshots,
    delete_annual_saved_report,
    get_annual_saved_report,
    list_annual_saved_report_types,
    list_annual_saved_reports,
    list_saved_reports_for_comparison,
    update_annual_saved_report,
)
from app.services.sqlserver_service import (
    SQLServerConfigurationError,
    SQLServerConnectionError,
    SQLServerIntegrationError,
    SQLServerTimeoutError,
)

router = APIRouter()


@router.get("/reports", response_model=SavedReportListResponse)
def list_general_indicator_reports(
    report_type: str | None = Query(default=None, alias="type", max_length=100),
    year: int | None = Query(default=None, ge=2000, le=2200),
    search: str | None = Query(default=None, max_length=255),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, alias="pageSize", ge=1, le=100),
) -> SavedReportListResponse:
    return list_annual_saved_reports(
        report_type=report_type,
        year=year,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/reports/types", response_model=ReportTypeOptionsResponse)
def list_general_indicator_report_types() -> ReportTypeOptionsResponse:
    return list_annual_saved_report_types()


@router.get("/reports/comparison-options", response_model=SavedReportComparisonOptionsResponse)
def list_general_indicator_report_comparison_options(
    report_type: ReportType = Query(default=ReportType.GENERAL_INDICATORS, alias="type"),
    comparison_type: ReportComparisonType = Query(
        default=ReportComparisonType.FREE,
        alias="comparisonType",
    ),
) -> SavedReportComparisonOptionsResponse:
    return list_saved_reports_for_comparison(
        report_type=report_type,
        comparison_type=comparison_type,
    )


@router.post("/reports/compare", response_model=SavedReportsComparisonResponse)
def compare_general_indicator_saved_reports(
    payload: SavedReportsComparisonRequest,
) -> SavedReportsComparisonResponse:
    try:
        return compare_saved_report_snapshots(
            report_type=payload.reportType,
            report_a_revision_id=payload.reportARevisionId,
            report_b_revision_id=payload.reportBRevisionId,
        )
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryPeriodAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/reports/{report_id}", response_model=SavedReportDetail)
def get_general_indicator_report(report_id: int) -> SavedReportDetail:
    try:
        return get_annual_saved_report(report_id)
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/reports/{report_id}/update", response_model=SavedReportDetail)
def update_general_indicator_report(
    report_id: int,
    payload: AnnualReportUpdateRequest,
) -> SavedReportDetail:
    try:
        return update_annual_saved_report(
            report_id,
            start_date=payload.startDate,
            end_date=payload.endDate,
            actor=payload.actor,
        )
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (SQLServerConfigurationError, SQLServerConnectionError) as exc:
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    except SQLServerTimeoutError as exc:
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    except SQLServerIntegrationError as exc:
        raise HTTPException(status_code=400, detail=exc.user_message) from exc


@router.get("/reports/{report_id}/period-analysis", response_model=ReportPeriodAnalysisResponse)
def get_general_indicator_report_period_analysis(
    report_id: int,
    start_date: date = Query(alias="startDate"),
    end_date: date = Query(alias="endDate"),
) -> ReportPeriodAnalysisResponse:
    try:
        return ReportPeriodAnalysisResponse.model_validate(
            analyze_annual_saved_report_period(
                report_id,
                start_date=start_date,
                end_date=end_date,
            )
        )
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryPeriodAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/reports/{report_id}/compare-periods", response_model=ReportPeriodsComparisonResponse)
def compare_general_indicator_report_periods(
    report_id: int,
    start_date_a: date = Query(alias="startDateA"),
    end_date_a: date = Query(alias="endDateA"),
    start_date_b: date = Query(alias="startDateB"),
    end_date_b: date = Query(alias="endDateB"),
) -> ReportPeriodsComparisonResponse:
    try:
        return ReportPeriodsComparisonResponse.model_validate(
            compare_annual_saved_report_periods(
                report_id,
                start_date_a=start_date_a,
                end_date_a=end_date_a,
                start_date_b=start_date_b,
                end_date_b=end_date_b,
            )
        )
    except ReportHistoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ReportHistoryPeriodAnalysisError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/reports/{report_id}", response_model=SavedReportDeleteResponse)
def delete_general_indicator_report(
    report_id: int,
    actor: str | None = Query(default=None, max_length=255),
) -> SavedReportDeleteResponse:
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
        target_configuration_for_period(start_date, end_date)
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


@router.post("/consultations/{consultation_id}/finalize", response_model=GeneralIndicatorFinalizationResponse)
def finalize_general_indicators(
    consultation_id: int,
    payload: GeneralIndicatorFinalizeRequest,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, alias="pageSize", ge=1, le=500),
) -> GeneralIndicatorFinalizationResponse:
    try:
        return GeneralIndicatorFinalizationResponse.model_validate(
            paginate_finalized_general_indicator_response(
                finalize_general_indicator_consultation(
                    consultation_id,
                    report_name=payload.reportName,
                ),
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
