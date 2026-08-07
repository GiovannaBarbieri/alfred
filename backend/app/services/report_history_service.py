from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
import logging
from math import ceil
from typing import Any

from app.db import get_connection
from app.repositories.general_indicators_repository import HIERARCHY_CONTRACT_VERSION
from app.repositories.report_history_repository import (
    archive_report_history,
    begin_annual_report_update,
    delete_annual_report,
    delete_report_history,
    get_annual_report_detail,
    get_annual_report_period_analysis_source,
    get_annual_report_update,
    get_report_history_detail,
    get_saved_report_comparison_source,
    list_annual_report_revisions,
    list_annual_report_types,
    list_annual_reports,
    list_saved_report_comparison_options,
    list_report_history,
    make_report_history_current,
)
from app.services.general_indicators_rules import (
    build_finalized_general_indicators,
    calculate_kpis,
    canonical_category,
)
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
    ReportTypeOption,
    ReportTypeOptionsResponse,
    ReportVersionInfo,
    ReportComparisonType,
    ReportPeriodKind,
    SavedReportComparisonOption,
    SavedReportComparisonOptionsResponse,
    SavedReportsComparisonResponse,
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
    report_type: str | None,
    year: int | None,
    search: str | None,
    page: int,
    page_size: int,
) -> AnnualReportListResponse:
    with get_connection() as connection:
        rows, total = list_annual_reports(
            connection,
            report_type=report_type,
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


def list_annual_saved_report_types() -> ReportTypeOptionsResponse:
    with get_connection() as connection:
        rows = list_annual_report_types(connection)
    return ReportTypeOptionsResponse(
        items=[
            ReportTypeOption(value=row["report_type"], label=_report_type_label(row["report_type"]))
            for row in rows
            if row.get("report_type")
        ]
    )


def get_annual_saved_report(report_id: int) -> AnnualReportDetail:
    with get_connection() as connection:
        row = get_annual_report_detail(connection, report_id)
    if row is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")
    return _annual_detail(row)


def list_saved_reports_for_comparison(
    *,
    report_type: ReportType,
    comparison_type: ReportComparisonType,
) -> SavedReportComparisonOptionsResponse:
    with get_connection() as connection:
        rows = list_saved_report_comparison_options(
            connection,
            report_type=report_type.value,
        )
    items = [_saved_report_comparison_option(row) for row in rows]
    if comparison_type != ReportComparisonType.FREE:
        accepted_kinds = {
            ReportComparisonType.QUARTER: {
                ReportPeriodKind.FIRST_QUARTER,
                ReportPeriodKind.SECOND_QUARTER,
                ReportPeriodKind.THIRD_QUARTER,
                ReportPeriodKind.FOURTH_QUARTER,
            },
            ReportComparisonType.SEMESTER: {
                ReportPeriodKind.FIRST_SEMESTER,
                ReportPeriodKind.SECOND_SEMESTER,
            },
            ReportComparisonType.YEAR: {ReportPeriodKind.YEAR},
        }[comparison_type]
        items = [item for item in items if item.periodKind in accepted_kinds]
    return SavedReportComparisonOptionsResponse(
        reportType=report_type,
        comparisonType=comparison_type,
        items=items,
    )


def compare_saved_report_snapshots(
    *,
    report_type: ReportType,
    report_a_revision_id: int,
    report_b_revision_id: int,
) -> SavedReportsComparisonResponse:
    if report_a_revision_id == report_b_revision_id:
        raise ReportHistoryPeriodAnalysisError(
            "Selecione dois relatórios diferentes para realizar a comparação."
        )
    with get_connection() as connection:
        source_a = get_saved_report_comparison_source(
            connection,
            revision_id=report_a_revision_id,
            report_type=report_type.value,
        )
        source_b = get_saved_report_comparison_source(
            connection,
            revision_id=report_b_revision_id,
            report_type=report_type.value,
        )
    if source_a is None or source_b is None:
        raise ReportHistoryNotFoundError(
            "Um dos relatórios selecionados não existe mais ou não possui snapshot finalizado."
        )

    period_a = _saved_snapshot_comparison_payload(source_a)
    period_b = _saved_snapshot_comparison_payload(source_b)
    summary_a = _comparison_period_summary(period_a)
    summary_b = _comparison_period_summary(period_b)
    categories_a = _executive_category_hours(period_a)
    categories_b = _executive_category_hours(period_b)
    categories_comparison = _compare_executive_categories(
        categories_a,
        categories_b,
        total_a=period_a["totalHours"],
        total_b=period_b["totalHours"],
    )

    start_a = source_a["period_start"]
    end_a = source_a["period_end"]
    start_b = source_b["period_start"]
    end_b = source_b["period_end"]
    days_a = (end_a - start_a).days + 1
    days_b = (end_b - start_b).days + 1
    kind_a, label_a = _classify_report_period(start_a, end_a)
    kind_b, label_b = _classify_report_period(start_b, end_b)
    different_durations = days_a != days_b
    different_period_types = kind_a != kind_b
    overlapping_periods = start_a <= end_b and start_b <= end_a
    warnings: list[dict[str, str]] = []
    if different_durations:
        warnings.append(
            {
                "code": "DIFFERENT_DURATIONS",
                "message": (
                    "Os relatórios possuem durações diferentes. "
                    "Use as médias diárias para uma comparação proporcional."
                ),
            }
        )
    if different_period_types:
        warnings.append(
            {
                "code": "DIFFERENT_PERIOD_TYPES",
                "message": f"Os tipos de período são diferentes: {label_a} e {label_b}.",
            }
        )
    if overlapping_periods:
        warnings.append(
            {
                "code": "OVERLAPPING_PERIODS",
                "message": "Os relatórios selecionados possuem datas sobrepostas.",
            }
        )

    report_period_a = _comparison_report_period(
        start_a,
        end_a,
        total_hours=period_a["totalHours"],
        launch_count=period_a["recordCount"],
        kind=kind_a,
        label=label_a,
    )
    report_period_b = _comparison_report_period(
        start_b,
        end_b,
        total_hours=period_b["totalHours"],
        launch_count=period_b["recordCount"],
        kind=kind_b,
        label=label_b,
    )
    return SavedReportsComparisonResponse.model_validate(
        {
            "source": "SAVED_SNAPSHOTS",
            "reportType": report_type,
            "reportA": _saved_report_comparison_context(
                source_a,
                report_period_a,
                summary_a,
            ),
            "reportB": _saved_report_comparison_context(
                source_b,
                report_period_b,
                summary_b,
            ),
            "summaryA": summary_a,
            "summaryB": summary_b,
            "differences": {
                "totalHours": _comparison_difference(
                    period_a["totalHours"],
                    period_b["totalHours"],
                    unit="HOURS",
                ),
                "consideredLaunches": _comparison_difference(
                    period_a["recordCount"],
                    period_b["recordCount"],
                    unit="COUNT",
                ),
                "consideredCollaborators": _comparison_difference(
                    summary_a["consideredCollaboratorCount"],
                    summary_b["consideredCollaboratorCount"],
                    unit="COUNT",
                ),
                "dailyAverageHours": _comparison_difference(
                    report_period_a["dailyAverageHours"],
                    report_period_b["dailyAverageHours"],
                    unit="HOURS",
                ),
                "dailyAverageLaunches": _comparison_difference(
                    report_period_a["dailyAverageLaunches"],
                    report_period_b["dailyAverageLaunches"],
                    unit="COUNT",
                ),
                "projectsImprovements": _comparison_difference(
                    summary_a["projectsImprovementsPercentage"],
                    summary_b["projectsImprovementsPercentage"],
                    unit="PERCENTAGE",
                ),
                "errorsBugs": _comparison_difference(
                    summary_a["errorsBugsPercentage"],
                    summary_b["errorsBugsPercentage"],
                    unit="PERCENTAGE",
                ),
            },
            "categoriesComparison": categories_comparison,
            "chartData": categories_comparison,
            "comparisonSummary": _comparison_highlights(categories_comparison),
            "differentDurations": different_durations,
            "differentPeriodTypes": different_period_types,
            "overlappingPeriods": overlapping_periods,
            "warnings": warnings,
        }
    )


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
    granularity, evolution = _period_analysis_evolution(
        analyzed,
        start_date=start_date,
        end_date=end_date,
    )
    projects_improvements = analyzed["kpis"]["projectsImprovements"]
    errors_bugs = analyzed["kpis"]["errorsBugs"]
    return {
        "reportId": report_id,
        "reportName": source["display_name"],
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
        "summary": {
            "totalHours": analyzed["totalHours"],
            "consideredLaunchCount": analyzed["recordCount"],
            "projectsImprovementsHours": projects_improvements["hours"],
            "projectsImprovementsPercentage": projects_improvements["percentage"],
            "errorsBugsHours": errors_bugs["hours"],
            "errorsBugsPercentage": errors_bugs["percentage"],
        },
        "kpis": analyzed["kpis"],
        "categories": analyzed["categories"],
        "months": analyzed["months"],
        "granularity": granularity,
        "evolution": evolution,
        "appliedWeights": [
            {
                "category": category,
                "weight": float(settings.get("weight", 0)),
                "active": bool(settings.get("active", True)),
            }
            for category, settings in distribution_configuration.items()
        ],
    }


def compare_annual_saved_report_periods(
    report_id: int,
    *,
    start_date_a: date,
    end_date_a: date,
    start_date_b: date,
    end_date_b: date,
) -> dict[str, Any]:
    period_a = analyze_annual_saved_report_period(
        report_id,
        start_date=start_date_a,
        end_date=end_date_a,
    )
    period_b = analyze_annual_saved_report_period(
        report_id,
        start_date=start_date_b,
        end_date=end_date_b,
    )
    days_a = (end_date_a - start_date_a).days + 1
    days_b = (end_date_b - start_date_b).days + 1
    summary_a = _comparison_period_summary(period_a)
    summary_b = _comparison_period_summary(period_b)
    categories_a = _executive_category_hours(period_a)
    categories_b = _executive_category_hours(period_b)
    categories_comparison = []
    for category in ("Novo Projeto", "Melhoria", "Erro TI", "Bug", "Manutenção", "Operacional"):
        hours_a = categories_a[category]
        hours_b = categories_b[category]
        difference = _comparison_difference(hours_a, hours_b, unit="HOURS")
        categories_comparison.append(
            {
                "category": category,
                "hoursA": hours_a,
                "hoursB": hours_b,
                "participationA": _percentage(hours_a, period_a["totalHours"]),
                "participationB": _percentage(hours_b, period_b["totalHours"]),
                "absoluteDifference": difference["absoluteDifference"],
                "percentageDifference": difference["percentageDifference"],
                "direction": difference["direction"],
            }
        )

    return {
        "reportId": report_id,
        "reportName": period_a["reportName"],
        "source": "SAVED_SNAPSHOT",
        "officialPeriod": period_a["officialPeriod"],
        "periodA": {
            "startDate": start_date_a,
            "endDate": end_date_a,
            "dayCount": days_a,
            "dailyAverageHours": _round(period_a["totalHours"] / days_a),
        },
        "periodB": {
            "startDate": start_date_b,
            "endDate": end_date_b,
            "dayCount": days_b,
            "dailyAverageHours": _round(period_b["totalHours"] / days_b),
        },
        "summaryA": summary_a,
        "summaryB": summary_b,
        "differences": {
            "totalHours": _comparison_difference(
                period_a["totalHours"],
                period_b["totalHours"],
                unit="HOURS",
            ),
            "consideredLaunches": _comparison_difference(
                period_a["recordCount"],
                period_b["recordCount"],
                unit="COUNT",
            ),
            "projectsImprovements": _comparison_difference(
                summary_a["projectsImprovementsPercentage"],
                summary_b["projectsImprovementsPercentage"],
                unit="PERCENTAGE",
            ),
            "errorsBugs": _comparison_difference(
                summary_a["errorsBugsPercentage"],
                summary_b["errorsBugsPercentage"],
                unit="PERCENTAGE",
            ),
        },
        "categoriesComparison": categories_comparison,
        "chartData": categories_comparison,
        "comparisonSummary": _comparison_highlights(categories_comparison),
        "differentDurations": days_a != days_b,
    }


def _saved_report_comparison_option(row: dict[str, Any]) -> SavedReportComparisonOption:
    period_kind, period_label = _classify_report_period(
        row["period_start"],
        row["period_end"],
    )
    return SavedReportComparisonOption(
        revisionId=int(row["revision_id"]),
        reportId=int(row["report_id"]),
        reportName=str(row["report_name"]),
        reportType=row["report_type"],
        periodStart=row["period_start"],
        periodEnd=row["period_end"],
        periodKind=period_kind,
        periodLabel=period_label,
        versionNumber=int(row["version_number"]),
        status=row["report_status"],
        isCurrent=bool(row["is_current"]),
        generatedAt=row["finalized_at"],
        totalHours=float(row["total_hours"]),
        consideredLaunchCount=int(row["considered_launch_count"]),
    )


def _classify_report_period(
    start_date: date,
    end_date: date,
) -> tuple[ReportPeriodKind, str]:
    if start_date.year != end_date.year:
        return ReportPeriodKind.CUSTOM, "Período personalizado"
    year = start_date.year
    exact_periods = {
        (date(year, 1, 1), date(year, 3, 31)): (
            ReportPeriodKind.FIRST_QUARTER,
            f"1º trimestre de {year}",
        ),
        (date(year, 4, 1), date(year, 6, 30)): (
            ReportPeriodKind.SECOND_QUARTER,
            f"2º trimestre de {year}",
        ),
        (date(year, 7, 1), date(year, 9, 30)): (
            ReportPeriodKind.THIRD_QUARTER,
            f"3º trimestre de {year}",
        ),
        (date(year, 10, 1), date(year, 12, 31)): (
            ReportPeriodKind.FOURTH_QUARTER,
            f"4º trimestre de {year}",
        ),
        (date(year, 1, 1), date(year, 6, 30)): (
            ReportPeriodKind.FIRST_SEMESTER,
            f"1º semestre de {year}",
        ),
        (date(year, 7, 1), date(year, 12, 31)): (
            ReportPeriodKind.SECOND_SEMESTER,
            f"2º semestre de {year}",
        ),
        (date(year, 1, 1), date(year, 12, 31)): (
            ReportPeriodKind.YEAR,
            f"Ano de {year}",
        ),
    }
    return exact_periods.get(
        (start_date, end_date),
        (ReportPeriodKind.CUSTOM, "Período personalizado"),
    )


def _saved_snapshot_comparison_payload(source: dict[str, Any]) -> dict[str, Any]:
    snapshot = dict(source.get("snapshot") or {})
    record_count = int(
        snapshot.get("recordCount")
        or dict(snapshot.get("summary") or {}).get("consideredLaunchCount")
        or source.get("considered_launch_count")
        or 0
    )
    categories = list(snapshot.get("categories") or [])
    kpis = dict(snapshot.get("kpis") or {})
    if record_count <= 0 or not categories or not kpis:
        raise ReportHistoryPeriodAnalysisError(
            f'O relatório "{source["report_name"]}" não possui dados válidos para comparação.'
        )
    total_hours = float(snapshot.get("totalHours") or source.get("total_hours") or 0)
    audit = list(snapshot.get("audit") or [])
    collaborators = {
        str(item.get("collaborator") or "").strip().casefold()
        for item in audit
        if bool(item.get("includedInOfficialCalculation"))
        and str(item.get("collaborator") or "").strip()
    }
    return {
        "reportName": source["report_name"],
        "totalHours": total_hours,
        "recordCount": record_count,
        "consideredCollaboratorCount": len(collaborators),
        "kpis": kpis,
        "categories": categories,
    }


def _comparison_report_period(
    start_date: date,
    end_date: date,
    *,
    total_hours: float,
    launch_count: int,
    kind: ReportPeriodKind,
    label: str,
) -> dict[str, Any]:
    day_count = (end_date - start_date).days + 1
    return {
        "startDate": start_date,
        "endDate": end_date,
        "dayCount": day_count,
        "dailyAverageHours": _round(total_hours / day_count),
        "dailyAverageLaunches": _round(launch_count / day_count),
        "periodKind": kind,
        "periodLabel": label,
    }


def _saved_report_comparison_context(
    source: dict[str, Any],
    period: dict[str, Any],
    summary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "revisionId": int(source["revision_id"]),
        "reportId": int(source["report_id"]),
        "reportName": str(source["report_name"]),
        "reportType": source["report_type"],
        "versionNumber": int(source["version_number"]),
        "status": source["report_status"],
        "isCurrent": bool(source["is_current"]),
        "generatedAt": source["finalized_at"],
        "period": period,
        "totalHours": summary["totalHours"],
        "consideredLaunchCount": summary["consideredLaunchCount"],
        "consideredCollaboratorCount": summary["consideredCollaboratorCount"],
    }


def _compare_executive_categories(
    categories_a: dict[str, float],
    categories_b: dict[str, float],
    *,
    total_a: float,
    total_b: float,
) -> list[dict[str, Any]]:
    result = []
    for category in ("Novo Projeto", "Melhoria", "Erro TI", "Bug", "Manutenção", "Operacional"):
        hours_a = categories_a[category]
        hours_b = categories_b[category]
        difference = _comparison_difference(hours_a, hours_b, unit="HOURS")
        result.append(
            {
                "category": category,
                "hoursA": hours_a,
                "hoursB": hours_b,
                "participationA": _percentage(hours_a, total_a),
                "participationB": _percentage(hours_b, total_b),
                "absoluteDifference": difference["absoluteDifference"],
                "percentageDifference": difference["percentageDifference"],
                "direction": difference["direction"],
            }
        )
    return result


def _comparison_period_summary(period: dict[str, Any]) -> dict[str, Any]:
    projects = period["kpis"]["projectsImprovements"]
    errors = period["kpis"]["errorsBugs"]
    return {
        "totalHours": period["totalHours"],
        "consideredLaunchCount": period["recordCount"],
        "consideredCollaboratorCount": int(period.get("consideredCollaboratorCount") or 0),
        "projectsImprovementsHours": projects["hours"],
        "projectsImprovementsPercentage": projects["percentage"],
        "errorsBugsHours": errors["hours"],
        "errorsBugsPercentage": errors["percentage"],
    }


def _executive_category_hours(period: dict[str, Any]) -> dict[str, float]:
    result = {
        "Novo Projeto": 0.0,
        "Melhoria": 0.0,
        "Erro TI": 0.0,
        "Bug": 0.0,
        "Manutenção": 0.0,
        "Operacional": 0.0,
    }
    category_names = {
        "Novo projeto": "Novo Projeto",
        "Melhoria": "Melhoria",
        "Erro TI": "Erro TI",
        "Bug": "Bug",
        "Manutenção": "Manutenção",
    }
    for item in period["categories"]:
        category = canonical_category(item.get("category"))
        target = category_names.get(category, "Operacional")
        result[target] = _round(result[target] + float(item.get("adjustedHours") or 0))
    return result


def _comparison_difference(value_a: float, value_b: float, *, unit: str) -> dict[str, Any]:
    absolute = _round(float(value_b) - float(value_a))
    percentage = None if float(value_a) == 0 else _round((absolute / float(value_a)) * 100)
    return {
        "valueA": _round(float(value_a)),
        "valueB": _round(float(value_b)),
        "absoluteDifference": absolute,
        "percentageDifference": percentage,
        "direction": "INCREASE" if absolute > 0 else "REDUCTION" if absolute < 0 else "UNCHANGED",
        "unit": unit,
    }


def _comparison_highlights(categories: list[dict[str, Any]]) -> dict[str, Any]:
    percentage_items = [item for item in categories if item["percentageDifference"] is not None]
    positive_percentages = [item for item in percentage_items if item["percentageDifference"] > 0]
    negative_percentages = [item for item in percentage_items if item["percentageDifference"] < 0]
    positive_hours = [item for item in categories if item["absoluteDifference"] > 0]
    negative_hours = [item for item in categories if item["absoluteDifference"] < 0]

    def highlight(items: list[dict[str, Any]], field: str, *, largest: bool) -> dict[str, Any] | None:
        if not items:
            return None
        item = max(items, key=lambda entry: entry[field]) if largest else min(items, key=lambda entry: entry[field])
        return {"category": item["category"], "value": item[field]}

    return {
        "largestPercentageIncrease": highlight(positive_percentages, "percentageDifference", largest=True),
        "largestPercentageReduction": highlight(negative_percentages, "percentageDifference", largest=False),
        "largestHoursIncrease": highlight(positive_hours, "absoluteDifference", largest=True),
        "largestHoursReduction": highlight(negative_hours, "absoluteDifference", largest=False),
    }


def _percentage(value: float, total: float) -> float:
    return _round((float(value) / float(total)) * 100) if total else 0.0


def _round(value: float) -> float:
    return round(float(value), 4)


def _period_analysis_evolution(
    analyzed: dict[str, Any],
    *,
    start_date: date,
    end_date: date,
) -> tuple[str, list[dict[str, Any]]]:
    if (end_date - start_date).days + 1 > 31:
        return "MONTH", list(analyzed["months"])

    categories_by_date: dict[date, dict[str, Decimal]] = defaultdict(lambda: defaultdict(Decimal))
    for item in analyzed.get("audit", []):
        item_date = _audit_date(item)
        if (
            item_date is None
            or not item.get("includedInOfficialCalculation")
            or item.get("isUpdateSystem")
        ):
            continue
        category = canonical_category(item.get("finalCategory"))
        adjusted_hours = Decimal(str(item.get("durationHours") or 0)) + Decimal(
            str(item.get("allocatedHours") or 0)
        )
        categories_by_date[item_date][category] += adjusted_hours * Decimal(3600)

    points: list[dict[str, Any]] = []
    current = start_date
    while current <= end_date:
        categories = categories_by_date.get(current, {})
        total_seconds = sum(categories.values(), Decimal(0))
        kpis = calculate_kpis(categories, total_seconds)
        points.append(
            {
                "month": current.isoformat(),
                "label": current.strftime("%d/%m"),
                "competence": {"startDate": current, "endDate": current},
                "totalHours": float((total_seconds / Decimal(3600)).quantize(Decimal("0.0001"))),
                "projectsImprovements": kpis["projectsImprovements"],
                "errorsBugs": kpis["errorsBugs"],
                "categories": {
                    category: float((seconds / Decimal(3600)).quantize(Decimal("0.0001")))
                    for category, seconds in sorted(categories.items())
                },
            }
        )
        current += timedelta(days=1)
    return "DAY", points


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
    start_date: date,
    end_date: date,
    actor: str | None,
    hierarchy_contract_version: int,
) -> AnnualReportUpdateResponse:
    try:
        with get_connection() as connection:
            row = begin_annual_report_update(
                connection,
                report_id,
                period_start=start_date,
                period_end=end_date,
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


def update_annual_saved_report(
    report_id: int,
    *,
    start_date: date,
    end_date: date,
    actor: str | None,
) -> AnnualReportDetail:
    if end_date < start_date:
        raise ValueError("A data final deve ser igual ou posterior à data inicial.")
    consultation_id: int | None = None
    clean_actor = _clean_actor(actor)
    try:
        try:
            with get_connection() as connection:
                row = begin_annual_report_update(
                    connection,
                    report_id,
                    period_start=start_date,
                    period_end=end_date,
                    actor=clean_actor,
                    hierarchy_contract_version=HIERARCHY_CONTRACT_VERSION,
                )
        except ValueError as exc:
            raise ReportHistoryConflictError(str(exc)) from exc
        if row is None:
            raise ReportHistoryNotFoundError("Relatório não encontrado.")
        consultation_id = int(row["consultation_id"])

        from app.services.general_indicators_service import (
            finalize_general_indicator_consultation,
            process_general_indicator_validation,
        )

        validation = process_general_indicator_validation(
            consultation_id,
            start_date=start_date,
            end_date=end_date,
        )
        if validation.get("status") != "PRONTA_PARA_FINALIZAR":
            raise ValueError("A atualização encontrou inconsistências. O relatório anterior foi preservado.")
        finalize_general_indicator_consultation(consultation_id, report_name="Relatório atualizado")
    except ValueError:
        if consultation_id is not None:
            _cancel_annual_report_update(report_id, consultation_id, "Atualização cancelada por validação.")
        raise
    except Exception as exc:
        if consultation_id is not None:
            _cancel_annual_report_update(report_id, consultation_id, str(exc))
        raise
    return get_annual_saved_report(report_id)


def get_annual_saved_report_update(report_id: int) -> AnnualReportUpdateState:
    with get_connection() as connection:
        row = get_annual_report_update(connection, report_id)
    if row is None:
        raise ReportHistoryNotFoundError("Relatório não encontrado.")
    return _update_state(row)


def _cancel_annual_report_update(report_id: int, consultation_id: int, message: str) -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE general_indicator_annual_reports
                SET active_consultation_id = NULL
                WHERE id = %s AND active_consultation_id = %s
                """,
                (report_id, consultation_id),
            )
            cursor.execute(
                """
                UPDATE general_indicator_consultations
                SET status = 'ERRO', mensagem_erro = %s, atualizado_em = NOW()
                WHERE id = %s AND status <> 'FINALIZADA'
                """,
                (message, consultation_id),
            )


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
            "report_type": response.type,
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


def _report_type_label(value: str) -> str:
    known = {
        ReportType.GENERAL_INDICATORS.value: "Indicadores Gerais",
    }
    if value in known:
        return known[value]
    words = value.replace("_", " ").replace("-", " ").strip().split()
    return " ".join(word[:1].upper() + word[1:].lower() for word in words) or value


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
