from __future__ import annotations

from datetime import date
from unittest import TestCase
from unittest.mock import patch

from app.services.report_history_service import compare_annual_saved_report_periods


class ReportPeriodComparisonTests(TestCase):
    @patch("app.services.report_history_service.analyze_annual_saved_report_period")
    def test_compares_periods_and_calculates_daily_average(self, analyze) -> None:
        analyze.side_effect = [
            period_result(100, 10, {"Novo projeto": 40, "Manutenção": 60}, 40, 5),
            period_result(150, 12, {"Novo projeto": 90, "Manutenção": 50, "Bug": 10}, 60, 10),
        ]

        result = compare_annual_saved_report_periods(
            8,
            start_date_a=date(2026, 1, 1),
            end_date_a=date(2026, 1, 10),
            start_date_b=date(2026, 2, 1),
            end_date_b=date(2026, 2, 15),
        )

        self.assertTrue(result["differentDurations"])
        self.assertEqual(result["periodA"]["dailyAverageHours"], 10)
        self.assertEqual(result["periodB"]["dailyAverageHours"], 10)
        self.assertEqual(result["differences"]["totalHours"]["absoluteDifference"], 50)
        self.assertEqual(result["differences"]["totalHours"]["percentageDifference"], 50)
        categories = {item["category"]: item for item in result["categoriesComparison"]}
        self.assertEqual(categories["Novo Projeto"]["hoursA"], 40)
        self.assertEqual(categories["Novo Projeto"]["hoursB"], 90)
        self.assertEqual(categories["Manutenção"]["hoursA"], 60)
        self.assertEqual(categories["Manutenção"]["hoursB"], 50)
        self.assertEqual(categories["Operacional"]["hoursA"], 0)
        self.assertEqual(
            [item["category"] for item in result["categoriesComparison"]],
            ["Novo Projeto", "Melhoria", "Erro TI", "Bug", "Manutenção", "Operacional"],
        )
        self.assertEqual(result["comparisonSummary"]["largestHoursIncrease"]["category"], "Novo Projeto")

    @patch("app.services.report_history_service.analyze_annual_saved_report_period")
    def test_treats_zero_base_without_division_error(self, analyze) -> None:
        analyze.side_effect = [
            period_result(0, 0, {}, 0, 0),
            period_result(10, 1, {"Bug": 10}, 0, 100),
        ]

        result = compare_annual_saved_report_periods(
            8,
            start_date_a=date(2026, 1, 1),
            end_date_a=date(2026, 1, 1),
            start_date_b=date(2026, 2, 1),
            end_date_b=date(2026, 2, 1),
        )

        self.assertIsNone(result["differences"]["totalHours"]["percentageDifference"])
        bug = next(item for item in result["categoriesComparison"] if item["category"] == "Bug")
        self.assertIsNone(bug["percentageDifference"])
        self.assertEqual(bug["direction"], "INCREASE")

    @patch("app.services.report_history_service.analyze_annual_saved_report_period")
    def test_reuses_snapshot_period_analysis_for_both_intervals(self, analyze) -> None:
        analyze.side_effect = [period_result(1, 1, {}, 0, 0), period_result(1, 1, {}, 0, 0)]

        compare_annual_saved_report_periods(
            9,
            start_date_a=date(2026, 1, 1),
            end_date_a=date(2026, 1, 31),
            start_date_b=date(2026, 2, 1),
            end_date_b=date(2026, 2, 28),
        )

        self.assertEqual(analyze.call_count, 2)
        self.assertEqual(analyze.call_args_list[0].args[0], 9)
        self.assertEqual(analyze.call_args_list[1].args[0], 9)


def period_result(
    total_hours: float,
    record_count: int,
    categories: dict[str, float],
    projects_percentage: float,
    errors_percentage: float,
) -> dict:
    return {
        "reportName": "Relatório",
        "officialPeriod": {"startDate": date(2026, 1, 1), "endDate": date(2026, 6, 30)},
        "totalHours": total_hours,
        "recordCount": record_count,
        "kpis": {
            "projectsImprovements": {
                "hours": total_hours * projects_percentage / 100,
                "percentage": projects_percentage,
            },
            "errorsBugs": {
                "hours": total_hours * errors_percentage / 100,
                "percentage": errors_percentage,
            },
        },
        "categories": [
            {"category": category, "adjustedHours": hours}
            for category, hours in categories.items()
        ],
    }
