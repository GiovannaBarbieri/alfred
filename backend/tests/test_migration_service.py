from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.services.migration_service import (
    MIGRATIONS_DIR,
    DatabaseMigrationError,
    discover_database_migrations,
    run_database_migrations,
)


class DatabaseMigrationServiceTests(unittest.TestCase):
    def test_discovers_versioned_migrations_in_order(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            migrations_dir = Path(temporary_directory)
            (migrations_dir / "0002_second.sql").write_text("SELECT 2;", encoding="utf-8")
            (migrations_dir / "0001_first.sql").write_text("SELECT 1;", encoding="utf-8")

            migrations = discover_database_migrations(migrations_dir)

        self.assertEqual([item.version for item in migrations], ["0001", "0002"])
        self.assertEqual(len(migrations[0].checksum), 64)

    def test_applies_pending_migration_and_records_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            migrations_dir = Path(temporary_directory)
            (migrations_dir / "0001_first.sql").write_text("CREATE TABLE example (id INT);", encoding="utf-8")
            factory, cursor = connection_factory(applied=[])

            applied = run_database_migrations(migrations_dir, factory)

        self.assertEqual(applied, ["0001"])
        migration_calls = [call for call in cursor.execute.call_args_list if call.kwargs.get("prepare") is False]
        self.assertEqual(len(migration_calls), 1)
        insert_call = next(call for call in cursor.execute.call_args_list if "INSERT INTO schema_migrations" in call.args[0])
        self.assertEqual(insert_call.args[1][0], "0001")
        self.assertEqual(len(insert_call.args[1][2]), 64)

    def test_already_applied_migration_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            migrations_dir = Path(temporary_directory)
            path = migrations_dir / "0001_first.sql"
            path.write_text("SELECT 1;", encoding="utf-8")
            migration = discover_database_migrations(migrations_dir)[0]
            factory, cursor = connection_factory(
                applied=[{"version": "0001", "name": "first", "checksum": migration.checksum}]
            )

            applied = run_database_migrations(migrations_dir, factory)

        self.assertEqual(applied, [])
        self.assertFalse(any(call.kwargs.get("prepare") is False for call in cursor.execute.call_args_list))

    def test_changed_applied_migration_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            migrations_dir = Path(temporary_directory)
            (migrations_dir / "0001_first.sql").write_text("SELECT 2;", encoding="utf-8")
            factory, _ = connection_factory(
                applied=[{"version": "0001", "name": "first", "checksum": "0" * 64}]
            )

            with self.assertRaisesRegex(DatabaseMigrationError, "conteúdo diferente"):
                run_database_migrations(migrations_dir, factory)

    def test_general_indicators_migration_contains_required_structure(self) -> None:
        migrations = discover_database_migrations(MIGRATIONS_DIR)
        migration = migrations[0]

        for table in (
            "general_indicator_consultations",
            "general_indicator_launches",
            "general_indicator_inconsistencies",
            "general_indicator_updates",
        ):
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {table}", migration.sql)
        self.assertIn("idx_general_indicator_launches_unique", migration.sql)
        self.assertIn("REFERENCES general_indicator_consultations", migration.sql)
        self.assertIn("chk_general_indicator_consultation_period", migration.sql)
        self.assertEqual([item.version for item in migrations], ["0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008", "0009", "0010", "0011"])
        self.assertIn("DROP CONSTRAINT IF EXISTS uq_annual_report_type_year", migrations[10].sql)
        self.assertIn("idx_general_indicator_launches_consulta_ordem", migrations[1].sql)
        self.assertIn("participa_indicadores_gerais", migrations[2].sql)
        self.assertIn("hierarchy_contract_version", migrations[3].sql)
        self.assertIn("resultado_versao", migrations[4].sql)
        self.assertIn("snapshot_hash", migrations[4].sql)
        self.assertIn("resultado_hash", migrations[4].sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS report_history", migrations[5].sql)
        self.assertIn("ROW_NUMBER() OVER", migrations[5].sql)
        self.assertIn("uq_report_history_current", migrations[5].sql)
        self.assertIn("uq_report_history_group_version", migrations[5].sql)
        self.assertIn("archived_by", migrations[6].sql)
        self.assertIn("CREATE TABLE IF NOT EXISTS general_indicator_annual_reports", migrations[7].sql)
        self.assertIn("annual_report_migration_issues", migrations[7].sql)
        self.assertIn("uq_annual_report_type_year", migrations[7].sql)
        self.assertIn("ROW_NUMBER() OVER", migrations[7].sql)

    def test_startup_runs_migrations_before_runtime_schema(self) -> None:
        from app import main

        calls: list[str] = []
        with (
            patch.object(main, "run_database_migrations", side_effect=lambda: calls.append("migrations")),
            patch.object(main, "ensure_runtime_schema", side_effect=lambda: calls.append("runtime")),
            patch.object(main, "cleanup_old_import_sessions", return_value=0),
        ):
            main.startup()

        self.assertEqual(calls, ["migrations", "runtime"])

    def test_startup_stops_when_migration_fails(self) -> None:
        from app import main

        with (
            patch.object(main, "run_database_migrations", side_effect=DatabaseMigrationError("falha")),
            patch.object(main, "ensure_runtime_schema") as runtime_schema,
        ):
            with self.assertRaises(DatabaseMigrationError):
                main.startup()

        runtime_schema.assert_not_called()


def connection_factory(*, applied: list[dict]) -> tuple[MagicMock, MagicMock]:
    factory = MagicMock()
    connection = MagicMock()
    cursor = MagicMock()
    factory.return_value.__enter__.return_value = connection
    connection.cursor.return_value.__enter__.return_value = cursor
    cursor.fetchall.return_value = applied
    return factory, cursor


if __name__ == "__main__":
    unittest.main()
