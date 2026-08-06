from __future__ import annotations

from contextlib import nullcontext
from datetime import date, datetime, timezone
from unittest import TestCase
from unittest.mock import patch

from app.schemas.report_history import (
    ReportComparisonType,
    ReportPeriodKind,
    ReportType,
)
from app.services.report_history_service import (
    ReportHistoryPeriodAnalysisError,
    _classify_report_period,
    compare_saved_report_snapshots,
    list_saved_reports_for_comparison,
)


class SavedReportComparisonTests(TestCase):
    def test_classifies_exact_quarters_semesters_year_and_custom_periods(self) -> None:
        self.assertEqual(
            _classify_report_period(date(2026, 1, 1), date(2026, 3, 31))[0],
            ReportPeriodKind.FIRST_QUARTER,
        )
        self.assertEqual(
            _classify_report_period(date(2026, 7, 1), date(2026, 12, 31))[0],
            ReportPeriodKind.SECOND_SEMESTER,
        )
        self.assertEqual(
            _classify_report_period(date(2026, 1, 1), date(2026, 12, 31))[0],
            ReportPeriodKind.YEAR,
        )
        self.assertEqual(
            _classify_report_period(date(2026, 2, 1), date(2026, 5, 31))[0],
            ReportPeriodKind.CUSTOM,
        )

    @patch("app.services.report_history_service.list_saved_report_comparison_options")
    @patch("app.services.report_history_service.get_connection")
    def test_filters_options_by_comparison_context(self, get_connection, list_options) -> None:
        get_connection.return_value = nullcontext(object())
        list_options.return_value = [
            comparison_source(1, date(2026, 1, 1), date(2026, 3, 31), current=True),
            comparison_source(2, date(2026, 1, 1), date(2026, 6, 30)),
        ]

        result = list_saved_reports_for_comparison(
            report_type=ReportType.GENERAL_INDICATORS,
            comparison_type=ReportComparisonType.QUARTER,
        )

        self.assertEqual([item.revisionId for item in result.items], [1])
        self.assertTrue(result.items[0].isCurrent)
        self.assertEqual(result.items[0].periodKind, ReportPeriodKind.FIRST_QUARTER)

    def test_rejects_the_same_revision_twice(self) -> None:
        with self.assertRaisesRegex(
            ReportHistoryPeriodAnalysisError,
            "dois relatórios diferentes",
        ):
            compare_saved_report_snapshots(
                report_type=ReportType.GENERAL_INDICATORS,
                report_a_revision_id=7,
                report_b_revision_id=7,
            )

    @patch("app.services.report_history_service.get_saved_report_comparison_source")
    @patch("app.services.report_history_service.get_connection")
    def test_compares_two_persisted_snapshots_without_sql_server(
        self,
        get_connection,
        get_source,
    ) -> None:
        get_connection.return_value = nullcontext(object())
        get_source.side_effect = [
            comparison_source(
                10,
                date(2025, 1, 1),
                date(2025, 3, 31),
                total_hours=900,
                launch_count=90,
                current=False,
            ),
            comparison_source(
                20,
                date(2026, 1, 1),
                date(2026, 6, 30),
                total_hours=1810,
                launch_count=200,
                current=True,
            ),
        ]

        result = compare_saved_report_snapshots(
            report_type=ReportType.GENERAL_INDICATORS,
            report_a_revision_id=10,
            report_b_revision_id=20,
        )

        self.assertEqual(result.source, "SAVED_SNAPSHOTS")
        self.assertEqual(result.reportA.revisionId, 10)
        self.assertEqual(result.reportB.revisionId, 20)
        self.assertTrue(result.differentDurations)
        self.assertTrue(result.differentPeriodTypes)
        self.assertFalse(result.overlappingPeriods)
        self.assertEqual(result.reportA.period.periodKind, ReportPeriodKind.FIRST_QUARTER)
        self.assertEqual(result.reportB.period.periodKind, ReportPeriodKind.FIRST_SEMESTER)
        self.assertEqual(result.reportA.period.dailyAverageHours, 10)
        self.assertEqual(result.reportB.period.dailyAverageHours, 10)
        self.assertEqual(result.summaryA.consideredCollaboratorCount, 2)
        self.assertEqual(result.differences["consideredLaunches"].absoluteDifference, 110)
        self.assertEqual(
            [item.category for item in result.categoriesComparison],
            ["Novo Projeto", "Melhoria", "Erro TI", "Bug", "Manutenção", "Operacional"],
        )
        self.assertEqual(get_source.call_count, 2)


def comparison_source(
    revision_id: int,
    period_start: date,
    period_end: date,
    *,
    total_hours: float = 100,
    launch_count: int = 10,
    current: bool = False,
) -> dict:
    return {
        "report_id": revision_id + 100,
        "report_name": f"Relatório {revision_id}",
        "revision_id": revision_id,
        "report_type": "GENERAL_INDICATORS",
        "version_number": 2 if current else 1,
        "report_status": "CURRENT" if current else "SUPERSEDED",
        "is_current": current,
        "period_start": period_start,
        "period_end": period_end,
        "finalized_at": datetime(2026, 7, 1, tzinfo=timezone.utc),
        "total_hours": total_hours,
        "considered_launch_count": launch_count,
        "snapshot": {
            "recordCount": launch_count,
            "totalHours": total_hours,
            "summary": {"consideredLaunchCount": launch_count},
            "kpis": {
                "projectsImprovements": {
                    "hours": total_hours * 0.4,
                    "percentage": 40,
                },
                "errorsBugs": {
                    "hours": total_hours * 0.1,
                    "percentage": 10,
                },
            },
            "categories": [
                {
                    "category": "Novo projeto",
                    "adjustedHours": total_hours * 0.4,
                },
                {
                    "category": "Manutenção",
                    "adjustedHours": total_hours * 0.6,
                },
            ],
            "audit": [
                {
                    "collaborator": "ana",
                    "includedInOfficialCalculation": True,
                },
                {
                    "collaborator": "bruno",
                    "includedInOfficialCalculation": True,
                },
            ],
        },
    }
