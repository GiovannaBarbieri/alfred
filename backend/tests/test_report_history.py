from __future__ import annotations

import unittest
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.repositories.report_history_repository import (
    archive_report_history,
    delete_report_history,
    general_indicator_display_name,
    make_report_history_current,
    register_finalized_general_indicator_report,
)
from app.schemas.report_history import ReportStatusFilter, ReportType
from app.services.report_history_service import (
    ReportHistoryConflictError,
    ReportHistoryNotFoundError,
    archive_saved_report,
    delete_saved_report,
    get_saved_report,
    list_saved_reports,
    make_saved_report_current,
)


class ReportHistoryNamingTests(unittest.TestCase):
    def test_names_complete_first_quarter(self) -> None:
        self.assertEqual(
            general_indicator_display_name(date(2026, 1, 1), date(2026, 3, 31)),
            "Indicadores Gerais — 2026",
        )

    def test_names_complete_second_quarter(self) -> None:
        self.assertEqual(
            general_indicator_display_name(date(2026, 4, 1), date(2026, 6, 30)),
            "Indicadores Gerais — 2026",
        )

    def test_names_complete_semester(self) -> None:
        self.assertEqual(
            general_indicator_display_name(date(2026, 1, 1), date(2026, 6, 30)),
            "Indicadores Gerais — 2026",
        )

    def test_names_complete_year(self) -> None:
        self.assertEqual(
            general_indicator_display_name(date(2026, 1, 1), date(2026, 12, 31)),
            "Indicadores Gerais — 2026",
        )

    def test_names_custom_period(self) -> None:
        self.assertEqual(
            general_indicator_display_name(date(2026, 2, 1), date(2026, 4, 17)),
            "Indicadores Gerais — 2026",
        )


class ReportHistoryRepositoryTests(unittest.TestCase):
    def test_first_finalization_creates_version_one_as_current(self) -> None:
        connection, cursor = connection_with_cursor()
        detail = report_row(version=1, status="CURRENT", current=True)
        cursor.fetchone.side_effect = [
            None,
            {"id": 1, "current_revision_id": None, "current_period_end": date(2026, 6, 30)},
            {"next_version": 1},
            {"id": 10},
            detail,
        ]

        result = register_finalized_general_indicator_report(
            connection,
            consultation=consultation_row(),
            result=snapshot(),
        )

        self.assertEqual(result["version_number"], 1)
        insert = next(call for call in cursor.execute.call_args_list if "INSERT INTO report_history" in call.args[0])
        self.assertEqual(insert.args[1][6], 1)

    def test_second_finalization_increments_version_and_supersedes_current(self) -> None:
        connection, cursor = connection_with_cursor()
        detail = report_row(version=2, status="CURRENT", current=True)
        cursor.fetchone.side_effect = [
            {"id": 1, "current_revision_id": 10, "current_period_end": date(2026, 3, 31)},
            {"next_version": 2},
            {"id": 11},
            detail,
        ]

        register_finalized_general_indicator_report(
            connection,
            consultation=consultation_row(consultation_id=51, annual_report_id=1),
            result=snapshot(consultation_id=51),
        )

        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("report_status = 'SUPERSEDED'" in sql for sql in statements))
        self.assertTrue(any("superseded_by_id = %s" in sql for sql in statements))

    def test_finalization_uses_transaction_advisory_lock_for_period(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            None,
            {"id": 1, "current_revision_id": None, "current_period_end": date(2026, 6, 30)},
            {"next_version": 1},
            {"id": 10},
            report_row(),
        ]

        register_finalized_general_indicator_report(
            connection,
            consultation=consultation_row(),
            result=snapshot(),
        )

        first_statement = cursor.execute.call_args_list[0].args[0]
        self.assertIn("pg_advisory_xact_lock", first_statement)

    @patch("app.repositories.report_history_repository.get_report_history_detail")
    def test_old_version_can_become_current(self, get_detail: MagicMock) -> None:
        old = report_row(version=1, status="SUPERSEDED", current=False)
        get_detail.side_effect = [old, {**old, "report_status": "CURRENT", "is_current": True}]
        connection, cursor = connection_with_cursor()
        cursor.fetchall.return_value = [
            {"id": 10, "report_status": "SUPERSEDED", "is_current": False, "archived_at": None},
            {"id": 11, "report_status": "CURRENT", "is_current": True, "archived_at": None},
        ]

        result = make_report_history_current(connection, 10, actor="user")

        self.assertTrue(result["is_current"])
        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("SET report_status = 'CURRENT'" in sql for sql in statements))

    @patch("app.repositories.report_history_repository.get_report_history_detail")
    def test_current_version_make_current_is_idempotent(self, get_detail: MagicMock) -> None:
        current = report_row()
        get_detail.return_value = current
        connection, cursor = connection_with_cursor()

        self.assertEqual(make_report_history_current(connection, 10, actor=None), current)
        cursor.execute.assert_not_called()

    @patch("app.repositories.report_history_repository.get_report_history_detail")
    def test_archived_version_cannot_become_current(self, get_detail: MagicMock) -> None:
        get_detail.return_value = report_row(status="ARCHIVED", current=False, archived=True)
        connection, _ = connection_with_cursor()

        with self.assertRaisesRegex(ValueError, "arquivada"):
            make_report_history_current(connection, 10, actor=None)

    @patch("app.repositories.report_history_repository.get_report_history_detail")
    def test_archive_is_idempotent(self, get_detail: MagicMock) -> None:
        archived = report_row(status="ARCHIVED", current=False, archived=True)
        get_detail.return_value = archived
        connection, cursor = connection_with_cursor()

        self.assertEqual(archive_report_history(connection, 10, actor=None), archived)
        cursor.execute.assert_not_called()

    @patch("app.repositories.report_history_repository.get_report_history_detail")
    def test_archiving_current_does_not_select_another_version(self, get_detail: MagicMock) -> None:
        current = report_row()
        archived = report_row(status="ARCHIVED", current=False, archived=True)
        get_detail.side_effect = [current, archived]
        connection, cursor = connection_with_cursor()

        result = archive_report_history(connection, 10, actor="user")

        self.assertEqual(result["report_status"], "ARCHIVED")
        update_statements = [call.args[0] for call in cursor.execute.call_args_list if "UPDATE report_history" in call.args[0]]
        self.assertEqual(len(update_statements), 1)

    def test_deletes_superseded_analysis_and_its_consultation(self) -> None:
        connection, cursor = deletion_connection(target_status="SUPERSEDED", target_current=False)

        result = delete_report_history(connection, 11)

        self.assertFalse(result["was_current"])
        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("DELETE FROM report_history" in sql for sql in statements))
        self.assertTrue(any("DELETE FROM general_indicator_consultations" in sql for sql in statements))

    def test_deletes_current_without_promoting_previous_version(self) -> None:
        connection, cursor = deletion_connection(target_status="CURRENT", target_current=True)

        result = delete_report_history(connection, 11)

        self.assertTrue(result["was_current"])
        self.assertEqual([item["version_number"] for item in result["previous_versions"]], [1])
        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertFalse(any("SET report_status = 'CURRENT'" in sql for sql in statements))

    def test_deletes_archived_analysis(self) -> None:
        connection, _ = deletion_connection(target_status="ARCHIVED", target_current=False)

        result = delete_report_history(connection, 11)

        self.assertEqual(result["version_number"], 2)

    def test_rejects_analysis_while_consultation_is_processing(self) -> None:
        connection, cursor = deletion_connection(consultation_status="FINALIZANDO")

        with self.assertRaisesRegex(ValueError, "processamento"):
            delete_report_history(connection, 11)

        self.assertFalse(any("DELETE FROM report_history" in call.args[0] for call in cursor.execute.call_args_list))

    def test_deletion_relies_on_consultation_cascade_and_removes_related_audit(self) -> None:
        connection, cursor = deletion_connection()

        delete_report_history(connection, 11)

        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("DELETE FROM audit_log" in sql for sql in statements))
        consultation_delete = next(sql for sql in statements if "DELETE FROM general_indicator_consultations" in sql)
        self.assertNotIn("general_indicator_launches", consultation_delete)

    def test_deletion_preserves_historical_version_numbers(self) -> None:
        connection, cursor = deletion_connection()

        delete_report_history(connection, 11)

        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertFalse(any("version_number =" in sql and "UPDATE" in sql for sql in statements))

    def test_deleting_middle_version_bridges_superseded_link_to_successor(self) -> None:
        connection, cursor = deletion_connection(
            target_id=11,
            target_version=2,
            successor_id=12,
            include_successor=True,
        )

        delete_report_history(connection, 11)

        link_update = next(call for call in cursor.execute.call_args_list if "WHERE superseded_by_id = %s" in call.args[0])
        self.assertEqual(link_update.args[1], (12, 12, 12, 11))

    def test_missing_analysis_returns_none(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.return_value = None

        self.assertIsNone(delete_report_history(connection, 999))
        self.assertEqual(cursor.execute.call_count, 1)

    def test_delete_and_read_use_compatible_database_locks(self) -> None:
        connection, cursor = deletion_connection()
        read_connection, read_cursor = connection_with_cursor()
        read_cursor.fetchone.return_value = report_row()

        delete_report_history(connection, 11)
        from app.repositories.report_history_repository import get_report_history_detail

        get_report_history_detail(read_connection, 11)

        statements = [call.args[0] for call in cursor.execute.call_args_list]
        self.assertTrue(any("pg_advisory_xact_lock" in sql for sql in statements))
        self.assertTrue(any("FOR UPDATE OF History, Consultation" in sql for sql in statements))
        self.assertIn("FOR SHARE OF History, Consultation", read_cursor.execute.call_args.args[0])


class ReportHistoryServiceTests(unittest.TestCase):
    @patch("app.services.report_history_service.list_report_history")
    @patch("app.services.report_history_service.get_connection")
    def test_lists_only_current_by_default_contract(
        self,
        get_connection: MagicMock,
        list_history: MagicMock,
    ) -> None:
        get_connection.return_value = MagicMock()
        list_history.return_value = ([report_row()], 1)

        result = list_saved_reports(
            report_type=ReportType.GENERAL_INDICATORS,
            report_status=ReportStatusFilter.CURRENT,
            year=None,
            start_date=None,
            end_date=None,
            search=None,
            generated_from=None,
            generated_to=None,
            page=1,
            page_size=20,
        )

        self.assertEqual(result.totalItems, 1)
        self.assertEqual(result.items[0].version.status, "CURRENT")
        self.assertEqual(list_history.call_args.kwargs["report_status"], "CURRENT")

    @patch("app.services.report_history_service.list_report_history")
    @patch("app.services.report_history_service.get_connection")
    def test_forwards_search_year_period_status_and_pagination(
        self,
        get_connection: MagicMock,
        list_history: MagicMock,
    ) -> None:
        get_connection.return_value = MagicMock()
        list_history.return_value = ([], 41)

        result = list_saved_reports(
            report_type=ReportType.GENERAL_INDICATORS,
            report_status=ReportStatusFilter.SUPERSEDED,
            year=2026,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            search="semestre",
            generated_from=date(2026, 7, 1),
            generated_to=date(2026, 7, 31),
            page=3,
            page_size=20,
        )

        arguments = list_history.call_args.kwargs
        self.assertEqual(arguments["report_status"], "SUPERSEDED")
        self.assertEqual(arguments["year"], 2026)
        self.assertEqual(arguments["search"], "semestre")
        self.assertEqual(arguments["offset"], 40)
        self.assertEqual(result.totalPages, 3)

    @patch("app.services.report_history_service.get_report_history_detail")
    @patch("app.services.report_history_service.get_connection")
    def test_opens_persisted_snapshot_without_tfs(
        self,
        get_connection: MagicMock,
        get_detail: MagicMock,
    ) -> None:
        get_connection.return_value = MagicMock()
        get_detail.return_value = report_row(snapshot_value=snapshot())

        result = get_saved_report(10)

        self.assertEqual(result.snapshot.consultationId, 50)
        self.assertEqual(result.report.id, 10)

    @patch("app.services.report_history_service.get_report_history_detail", return_value=None)
    @patch("app.services.report_history_service.get_connection")
    def test_missing_detail_returns_not_found(self, get_connection: MagicMock, _detail: MagicMock) -> None:
        get_connection.return_value = MagicMock()
        with self.assertRaises(ReportHistoryNotFoundError):
            get_saved_report(999)

    @patch("app.services.report_history_service.make_report_history_current")
    @patch("app.services.report_history_service.get_connection")
    def test_make_current_records_actor(
        self,
        get_connection: MagicMock,
        make_current: MagicMock,
    ) -> None:
        get_connection.return_value = MagicMock()
        make_current.return_value = report_row(snapshot_value=snapshot())

        result = make_saved_report_current(10, actor="  giovanna  ")

        self.assertTrue(result.report.version.isCurrent)
        self.assertEqual(make_current.call_args.kwargs["actor"], "giovanna")

    @patch("app.services.report_history_service.make_report_history_current", side_effect=ValueError("arquivada"))
    @patch("app.services.report_history_service.get_connection")
    def test_make_current_maps_conflict(self, get_connection: MagicMock, _make: MagicMock) -> None:
        get_connection.return_value = MagicMock()
        with self.assertRaises(ReportHistoryConflictError):
            make_saved_report_current(10, actor=None)

    @patch("app.services.report_history_service.archive_report_history")
    @patch("app.services.report_history_service.get_connection")
    def test_archive_returns_snapshot_by_id(
        self,
        get_connection: MagicMock,
        archive: MagicMock,
    ) -> None:
        get_connection.return_value = MagicMock()
        archive.return_value = report_row(
            status="ARCHIVED",
            current=False,
            archived=True,
            snapshot_value=snapshot(),
        )

        result = archive_saved_report(10, actor=None)

        self.assertEqual(result.report.version.status, "ARCHIVED")
        self.assertEqual(result.snapshot.totalHours, 100)

    @patch("app.services.report_history_service.insert_audit_log")
    @patch("app.services.report_history_service.delete_report_history")
    @patch("app.services.report_history_service.get_connection")
    def test_delete_returns_candidates_and_writes_minimal_technical_audit(
        self,
        get_connection: MagicMock,
        delete_history: MagicMock,
        insert_audit: MagicMock,
    ) -> None:
        get_connection.return_value = MagicMock()
        delete_history.return_value = deletion_result()

        result = delete_saved_report(11, actor="  giovanna  ")

        self.assertTrue(result.deleted)
        self.assertTrue(result.wasCurrent)
        self.assertTrue(result.previousVersionsAvailable)
        self.assertEqual(result.previousVersions[0].versionNumber, 1)
        self.assertEqual(insert_audit.call_args.kwargs["user"], "giovanna")
        self.assertNotIn("snapshot", insert_audit.call_args.kwargs["after"])

    def test_openapi_exposes_typed_history_contracts(self) -> None:
        from app.main import app

        paths = app.openapi()["paths"]
        self.assertEqual(
            paths["/api/general-indicators/reports"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/AnnualReportListResponse",
        )
        self.assertEqual(
            paths["/api/general-indicators/reports/{report_id}"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/AnnualReportDetail",
        )
        self.assertEqual(
            paths["/api/general-indicators/reports/{report_id}"]["delete"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/AnnualReportDeleteResponse",
        )
        self.assertIn("/api/general-indicators/reports/{report_id}/updates", paths)
        self.assertIn("/api/general-indicators/reports/{report_id}/updates/current", paths)
        self.assertIn("/api/general-indicators/reports/{report_id}/revisions", paths)

    def test_migration_backfills_versions_without_updating_snapshot(self) -> None:
        migration = Path(__file__).parents[1] / "migrations" / "0006_general_indicator_report_history.sql"
        sql = migration.read_text(encoding="utf-8")

        self.assertIn("ROW_NUMBER() OVER", sql)
        self.assertIn("ON CONFLICT (source_consultation_id) DO NOTHING", sql)
        self.assertNotIn("UPDATE general_indicator_consultations", sql)
        self.assertIn("uq_report_history_current", sql)


def connection_with_cursor() -> tuple[MagicMock, MagicMock]:
    connection = MagicMock()
    cursor = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    return connection, cursor


def deletion_connection(
    *,
    target_id: int = 11,
    target_version: int = 2,
    target_status: str = "CURRENT",
    target_current: bool = True,
    consultation_status: str = "FINALIZADA",
    successor_id: int | None = None,
    include_successor: bool = False,
) -> tuple[MagicMock, MagicMock]:
    connection, cursor = connection_with_cursor()
    cursor.fetchone.return_value = {"period_key": "GENERAL_INDICATORS:2026-01-01:2026-06-30"}
    now = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    versions = [
        {
            "id": 10,
            "source_consultation_id": 50,
            "report_type": "GENERAL_INDICATORS",
            "period_key": "GENERAL_INDICATORS:2026-01-01:2026-06-30",
            "period_start": date(2026, 1, 1),
            "period_end": date(2026, 6, 30),
            "version_number": 1,
            "report_status": "SUPERSEDED",
            "is_current": False,
            "superseded_by_id": target_id,
            "finalized_at": now,
            "consultation_status": "FINALIZADA",
        },
        {
            "id": target_id,
            "source_consultation_id": 51,
            "report_type": "GENERAL_INDICATORS",
            "period_key": "GENERAL_INDICATORS:2026-01-01:2026-06-30",
            "period_start": date(2026, 1, 1),
            "period_end": date(2026, 6, 30),
            "version_number": target_version,
            "report_status": target_status,
            "is_current": target_current,
            "superseded_by_id": successor_id,
            "finalized_at": now,
            "consultation_status": consultation_status,
        },
    ]
    if include_successor:
        versions.append(
            {
                **versions[1],
                "id": int(successor_id or 12),
                "source_consultation_id": 52,
                "version_number": target_version + 1,
                "report_status": "CURRENT",
                "is_current": True,
                "superseded_by_id": None,
                "consultation_status": "FINALIZADA",
            }
        )
    cursor.fetchall.return_value = versions
    return connection, cursor


def deletion_result() -> dict:
    now = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    return {
        "id": 11,
        "source_consultation_id": 51,
        "report_type": "GENERAL_INDICATORS",
        "period_start": date(2026, 1, 1),
        "period_end": date(2026, 6, 30),
        "version_number": 2,
        "was_current": True,
        "previous_versions": [
            {
                "id": 10,
                "version_number": 1,
                "report_status": "SUPERSEDED",
                "finalized_at": now,
            }
        ],
        "deleted_at": now,
    }


def consultation_row(consultation_id: int = 50, annual_report_id: int | None = None) -> dict:
    now = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    return {
        "id": consultation_id,
        "data_inicial": date(2026, 1, 1),
        "data_final": date(2026, 6, 30),
        "criado_em": now,
        "finalizado_em": now,
        "iniciado_por": None,
        "finalizado_por": None,
        "annual_report_id": annual_report_id,
    }


def snapshot(consultation_id: int = 50) -> dict:
    return {
        "contractVersion": 2,
        "consultationId": consultation_id,
        "status": "FINALIZADA",
        "period": {"startDate": "2026-01-01", "endDate": "2026-06-30"},
        "consultedAt": "2026-07-23T10:00:00+00:00",
        "finalizedAt": "2026-07-23T12:00:00+00:00",
        "recordCount": 12,
        "totalHours": 100,
        "summary": {"consideredLaunchCount": 12, "excludedCollaboratorCount": 2},
        "kpis": {
            "projectsImprovements": {"hours": 40, "percentage": 40, "difference": 0, "status": "within_target", "target": 40},
            "errorsBugs": {"hours": 5, "percentage": 5, "difference": -5, "status": "within_target", "limit": 10},
        },
        "categories": [],
        "distribution": [],
        "months": [],
        "quarters": [],
        "audit": [],
        "inconsistencyHistory": [],
    }


def report_row(
    *,
    version: int = 1,
    status: str = "CURRENT",
    current: bool = True,
    archived: bool = False,
    snapshot_value: dict | None = None,
) -> dict:
    now = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
    return {
        "id": 10,
        "source_consultation_id": 50,
        "report_type": "GENERAL_INDICATORS",
        "period_key": "GENERAL_INDICATORS:2026-01-01:2026-06-30",
        "display_name": "Indicadores Gerais — 1º semestre de 2026",
        "version_number": version,
        "report_status": status,
        "is_current": current,
        "superseded_by_id": None,
        "supersedes_id": None,
        "superseded_at": None,
        "archived_at": now if archived else None,
        "archived_by": None,
        "period_start": date(2026, 1, 1),
        "period_end": date(2026, 6, 30),
        "created_at": now,
        "finalized_at": now,
        "created_by": None,
        "finalized_by": None,
        "current_selected_at": None,
        "current_selected_by": None,
        "total_hours": Decimal("100"),
        "considered_launch_count": 12,
        "excluded_collaborator_count": 2,
        "projects_improvements_percentage": Decimal("40"),
        "projects_improvements_status": "within_target",
        "errors_bugs_percentage": Decimal("5"),
        "errors_bugs_status": "within_target",
        "snapshot_contract_version": 2,
        "result_hash": None,
        "consultation_status": "FINALIZADA",
        "snapshot": snapshot_value or snapshot(),
    }


if __name__ == "__main__":
    unittest.main()
