from __future__ import annotations

import unittest
from datetime import date, datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.repositories.report_history_repository import begin_annual_report_update
from app.services.general_indicators_service import create_general_indicator_validation


class AnnualReportUpdateRepositoryTests(unittest.TestCase):
    def test_update_creates_consultation_for_the_complete_accumulated_period(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            annual_row(),
            {"id": 90, "criado_em": datetime(2026, 7, 1, tzinfo=timezone.utc)},
        ]

        result = begin_annual_report_update(
            connection,
            10,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 6, 30),
            actor="giovanna",
            hierarchy_contract_version=2,
        )

        self.assertEqual(result["period_start"], date(2026, 1, 1))
        self.assertEqual(result["period_end"], date(2026, 6, 30))
        insert = next(call for call in cursor.execute.call_args_list if "INSERT INTO general_indicator_consultations" in call.args[0])
        self.assertEqual(insert.args[1][0], date(2026, 1, 1))
        self.assertEqual(insert.args[1][1], date(2026, 6, 30))

    def test_update_accepts_changed_period(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            annual_row(),
            {"id": 91, "criado_em": datetime(2026, 7, 1, tzinfo=timezone.utc)},
        ]

        result = begin_annual_report_update(
            connection,
            10,
            period_start=date(2026, 2, 1),
            period_end=date(2026, 2, 28),
            actor=None,
            hierarchy_contract_version=2,
        )

        self.assertEqual(result["period_start"], date(2026, 2, 1))
        self.assertEqual(result["period_end"], date(2026, 2, 28))

    def test_update_rejects_inverted_period(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.return_value = annual_row()

        with self.assertRaisesRegex(ValueError, "posterior"):
            begin_annual_report_update(
                connection,
                10,
                period_start=date(2026, 3, 31),
                period_end=date(2026, 2, 28),
                actor=None,
                hierarchy_contract_version=2,
            )

    def test_update_rejects_concurrent_active_consultation(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [annual_row(active_consultation_id=80), {"status": "COM_INCONSISTENCIAS"}]

        with self.assertRaisesRegex(ValueError, "andamento"):
            begin_annual_report_update(
                connection,
                10,
                period_start=date(2026, 1, 1),
                period_end=date(2026, 6, 30),
                actor=None,
                hierarchy_contract_version=2,
            )

    def test_update_uses_advisory_lock(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            annual_row(),
            {"id": 90, "criado_em": datetime(2026, 7, 1, tzinfo=timezone.utc)},
        ]

        begin_annual_report_update(
            connection,
            10,
            period_start=date(2026, 1, 1),
            period_end=date(2026, 6, 30),
            actor=None,
            hierarchy_contract_version=2,
        )

        self.assertIn("pg_advisory_xact_lock", cursor.execute.call_args_list[0].args[0])


class AnnualReportArchitectureTests(unittest.TestCase):
    @patch("app.services.general_indicators_service.get_connection")
    @patch("app.services.general_indicators_service.create_general_indicator_consultation", return_value=10)
    @patch("app.services.general_indicators_service.update_general_indicator_consultation_progress")
    def test_initial_consultation_accepts_non_january_start(self, _progress, _create, connection) -> None:
        connection.return_value.__enter__.return_value = MagicMock()
        result = create_general_indicator_validation(
            start_date=date(2026, 2, 1),
            end_date=date(2026, 3, 31),
        )
        self.assertEqual(result["consultationId"], 10)

    @patch("app.services.general_indicators_service.get_connection")
    @patch("app.services.general_indicators_service.create_general_indicator_consultation", return_value=11)
    @patch("app.services.general_indicators_service.update_general_indicator_consultation_progress")
    def test_initial_consultation_accepts_cross_year_period(self, _progress, _create, connection) -> None:
        connection.return_value.__enter__.return_value = MagicMock()
        result = create_general_indicator_validation(
            start_date=date(2026, 12, 1),
            end_date=date(2027, 1, 31),
        )
        self.assertEqual(result["consultationId"], 11)

    def test_initial_consultation_rejects_inverted_period(self) -> None:
        with self.assertRaisesRegex(ValueError, "posterior"):
            create_general_indicator_validation(
                start_date=date(2026, 3, 31),
                end_date=date(2026, 2, 1),
            )

    def test_migration_preserves_snapshots_and_builds_one_identity_per_year(self) -> None:
        sql = migration_sql()
        self.assertIn("uq_annual_report_type_year", sql)
        self.assertIn("PARTITION BY History.report_type, EXTRACT(YEAR FROM History.period_start)", sql)
        self.assertNotIn("SET resultado =", sql)
        self.assertNotIn("UPDATE general_indicator_consultations\nSET resultado", sql)

    def test_migration_records_incompatible_legacy_periods(self) -> None:
        sql = migration_sql()
        self.assertIn("annual_report_migration_issues", sql)
        self.assertIn("LEGACY_PERIOD_NOT_ANNUAL", sql)
        self.assertIn("snapshot histórico foi preservado sem recálculo", sql)

    def test_revision_snapshot_is_not_duplicated(self) -> None:
        sql = migration_sql()
        annual_table = sql.split("CREATE TABLE IF NOT EXISTS general_indicator_annual_reports", 1)[1].split(");", 1)[0]
        self.assertNotIn("snapshot", annual_table.lower())
        self.assertIn("source_consultation_id", read_repository())

    def test_finalization_switches_current_revision_only_at_completion(self) -> None:
        repository = read_repository()
        self.assertIn("SET current_revision_id = %s", repository)
        self.assertIn("active_consultation_id = NULL", repository)
        self.assertIn("previous_revision_id", repository)

    def test_previous_snapshot_remains_available_during_processing(self) -> None:
        repository = read_repository()
        begin = repository.split("def begin_annual_report_update", 1)[1].split("def get_annual_report_update", 1)[0]
        self.assertNotIn("current_revision_id =", begin)
        self.assertIn("active_consultation_id = %s", begin)

    def test_detail_reads_persisted_snapshot_without_tfs(self) -> None:
        repository = read_repository()
        detail = repository.split("def get_annual_report_detail", 1)[1].split("def begin_annual_report_update", 1)[0]
        self.assertIn("CurrentConsultation.resultado - 'audit' AS snapshot", detail)
        self.assertIn("jsonb_array_length(CurrentConsultation.resultado -> 'audit')", detail)
        self.assertNotIn("sqlserver", detail.casefold())

    def test_detail_does_not_transfer_the_full_audit_collection(self) -> None:
        service = read_report_history_service()
        detail = service.split("def _annual_detail", 1)[1].split("def _update_state", 1)[0]
        self.assertIn('snapshot["audit"] = []', detail)
        self.assertIn('"totalItems": audit_total', detail)

    def test_deletion_removes_all_revisions_and_consultations(self) -> None:
        repository = read_repository()
        deletion = repository.split("def delete_annual_report", 1)[1].split("def general_indicator_display_name", 1)[0]
        self.assertIn("DELETE FROM report_history WHERE annual_report_id", deletion)
        self.assertIn("DELETE FROM general_indicator_consultations WHERE annual_report_id", deletion)
        self.assertIn("DELETE FROM general_indicator_annual_reports", deletion)


def annual_row(active_consultation_id: int | None = None) -> dict:
    return {
        "id": 10,
        "report_year": 2026,
        "current_period_start": date(2026, 1, 1),
        "current_period_end": date(2026, 3, 31),
        "active_consultation_id": active_consultation_id,
    }


def connection_with_cursor() -> tuple[MagicMock, MagicMock]:
    connection = MagicMock()
    cursor = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    return connection, cursor


def migration_sql() -> str:
    path = Path(__file__).parents[1] / "migrations" / "0008_annual_general_indicator_reports.sql"
    return path.read_text(encoding="utf-8")


def read_repository() -> str:
    path = Path(__file__).parents[1] / "app" / "repositories" / "report_history_repository.py"
    return path.read_text(encoding="utf-8")


def read_report_history_service() -> str:
    path = Path(__file__).parents[1] / "app" / "services" / "report_history_service.py"
    return path.read_text(encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
