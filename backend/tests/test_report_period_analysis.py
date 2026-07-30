from __future__ import annotations

from copy import deepcopy
from datetime import date
from unittest import TestCase
from unittest.mock import MagicMock, patch

from app.repositories.report_history_repository import get_annual_report_period_analysis_source
from app.services.report_history_service import (
    ReportHistoryPeriodAnalysisError,
    analyze_annual_saved_report_period,
)


class ReportPeriodAnalysisTests(TestCase):
    def setUp(self) -> None:
        self.snapshot = {
            "consultedAt": "2026-03-01T10:00:00-03:00",
            "finalizedAt": "2026-03-01T10:05:00-03:00",
            "rules": {
                "distribution": {
                    "configuration": {
                        "Novo projeto": {"weight": "4", "active": True},
                        "Manutenção": {"weight": "1", "active": True},
                    }
                }
            },
            "audit": [
                audit_item("1", "2026-01-10", 10, "Novo projeto"),
                audit_item("2", "2026-01-11", 10, "Manutenção"),
                audit_item("3", "2026-01-12", 10, "Atualização do sistema", update=True),
                audit_item("4", "2026-02-05", 5, "Bug"),
            ],
        }

    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_uses_snapshot_weights_and_does_not_mutate_snapshot(self, get_source, _connection) -> None:
        get_source.return_value = source_row(self.snapshot)
        original = deepcopy(self.snapshot)

        result = analyze_annual_saved_report_period(
            91,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
        )

        categories = {item["category"]: item for item in result["categories"]}
        self.assertEqual(categories["Novo projeto"]["adjustedHours"], 18.0)
        self.assertEqual(categories["Manutenção"]["adjustedHours"], 12.0)
        self.assertEqual(result["totalHours"], 30.0)
        self.assertEqual(result["recordCount"], 3)
        self.assertEqual(result["source"], "SAVED_SNAPSHOT")
        self.assertEqual(result["reportName"], "Relatório de teste")
        self.assertEqual(result["granularity"], "DAY")
        self.assertEqual(len(result["evolution"]), 31)
        self.assertEqual(result["summary"]["consideredLaunchCount"], 3)
        self.assertEqual(result["appliedWeights"][0]["category"], "Novo projeto")
        self.assertNotIn("audit", result)
        self.assertEqual(self.snapshot, original)

    @patch("app.services.sqlserver_service._execute_query")
    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_never_queries_sql_server_or_tfs(
        self,
        get_source,
        _connection,
        execute_sqlserver_query,
    ) -> None:
        get_source.return_value = source_row(self.snapshot)

        analyze_annual_saved_report_period(
            91,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 2, 28),
        )

        execute_sqlserver_query.assert_not_called()

    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_filters_custom_period_using_only_persisted_launches(self, get_source, _connection) -> None:
        get_source.return_value = source_row(self.snapshot)

        result = analyze_annual_saved_report_period(
            91,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
        )

        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["totalHours"], 5.0)
        self.assertEqual(result["kpis"]["errorsBugs"]["percentage"], 100.0)
        self.assertEqual([month["month"] for month in result["months"]], ["2026-02"])
        self.assertEqual(result["granularity"], "DAY")
        self.assertEqual(result["evolution"][4]["totalHours"], 5.0)

    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_uses_monthly_evolution_for_intervals_above_31_days(self, get_source, _connection) -> None:
        get_source.return_value = source_row(self.snapshot)

        result = analyze_annual_saved_report_period(
            91,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 2, 28),
        )

        self.assertEqual(result["granularity"], "MONTH")
        self.assertEqual([point["month"] for point in result["evolution"]], ["2026-01", "2026-02"])

    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_daily_evolution_includes_zero_days_and_reconciles_distributed_hours(
        self,
        get_source,
        _connection,
    ) -> None:
        get_source.return_value = source_row(self.snapshot)

        result = analyze_annual_saved_report_period(
            91,
            start_date=date(2026, 1, 10),
            end_date=date(2026, 1, 12),
        )

        self.assertEqual([point["label"] for point in result["evolution"]], ["10/01", "11/01", "12/01"])
        self.assertEqual(sum(point["totalHours"] for point in result["evolution"]), result["totalHours"])
        self.assertEqual(result["evolution"][2]["totalHours"], 0.0)

    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_rejects_dates_outside_official_report(self, get_source, _connection) -> None:
        get_source.return_value = source_row(self.snapshot)

        with self.assertRaises(ReportHistoryPeriodAnalysisError):
            analyze_annual_saved_report_period(
                91,
                start_date=date(2025, 12, 31),
                end_date=date(2026, 1, 31),
            )

    @patch("app.services.report_history_service.get_connection", return_value=MagicMock())
    @patch("app.services.report_history_service.get_annual_report_period_analysis_source")
    def test_rejects_snapshot_without_historical_weights(self, get_source, _connection) -> None:
        snapshot = deepcopy(self.snapshot)
        snapshot["rules"] = {}
        get_source.return_value = source_row(snapshot)

        with self.assertRaisesRegex(ReportHistoryPeriodAnalysisError, "pesos hist"):
            analyze_annual_saved_report_period(
                91,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
            )

    def test_snapshot_repository_is_read_only(self) -> None:
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = source_row(self.snapshot)

        result = get_annual_report_period_analysis_source(connection, 91)

        self.assertEqual(result["id"], 91)
        statement = cursor.execute.call_args.args[0].upper()
        self.assertIn("SELECT", statement)
        self.assertNotIn("UPDATE ", statement)
        self.assertNotIn("INSERT ", statement)
        self.assertNotIn("DELETE ", statement)


def source_row(snapshot: dict) -> dict:
    return {
        "id": 91,
        "display_name": "Relatório de teste",
        "period_start": date(2026, 1, 1),
        "period_end": date(2026, 2, 28),
        "source_consultation_id": 77,
        "snapshot": snapshot,
    }


def audit_item(
    launch_id: str,
    launch_date: str,
    duration_hours: float,
    category: str,
    *,
    update: bool = False,
) -> dict:
    return {
        "idLancamento": launch_id,
        "date": f"{launch_date}T09:00:00",
        "collaborator": "usuario",
        "durationHours": duration_hours,
        "idTask": launch_id,
        "finalCategory": category,
        "isUpdateSystem": update,
        "validationState": "valid",
        "validationIssues": [],
        "includedInOfficialCalculation": True,
        "participatesInGeneralIndicators": True,
        "disregardedFromGeneralIndicators": False,
        "sourceOccurrenceCount": 1,
        "sourceRows": [],
    }
