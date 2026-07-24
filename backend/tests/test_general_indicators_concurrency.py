from __future__ import annotations

import unittest
from unittest.mock import MagicMock

from app.repositories.general_indicators_repository import (
    begin_general_indicator_finalization,
    begin_general_indicator_update,
    complete_general_indicator_finalization,
    fail_general_indicator_update,
    is_general_indicator_update_active,
    save_general_indicator_validation,
)


class GeneralIndicatorConcurrencyRepositoryTests(unittest.TestCase):
    def test_finalized_consultation_launches_cannot_be_rewritten(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.return_value = {"status": "FINALIZADA"}

        with self.assertRaisesRegex(ValueError, "finalizada"):
            save_general_indicator_validation(
                connection,
                77,
                {"launches": [], "inconsistencies": {"items": []}},
            )

        executed_sql = "\n".join(str(call.args[0]) for call in cursor.execute.call_args_list)
        self.assertNotIn("DELETE FROM general_indicator_launches", executed_sql)

    def test_update_is_rejected_while_finalization_is_active(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.return_value = {
            "id": 77,
            "status": "FINALIZANDO",
            "hierarchy_contract_version": 2,
            "processing_expired": False,
        }

        result = begin_general_indicator_update(connection, 77, update_type="SELETIVA")

        self.assertFalse(result["acquired"])
        self.assertEqual(result["reason"], "concurrent")
        self.assertEqual(result["previousStatus"], "FINALIZANDO")

    def test_expired_finalization_is_recovered_before_new_update(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            {"id": 77, "status": "FINALIZANDO", "hierarchy_contract_version": 2, "processing_expired": True},
            {"total": 0},
            {"id": 91},
        ]

        result = begin_general_indicator_update(connection, 77, update_type="SELETIVA")

        self.assertTrue(result["acquired"])
        self.assertEqual(result["previousStatus"], "PRONTA_PARA_FINALIZAR")
        self.assertEqual(result["updateId"], 91)

    def test_expired_finalization_can_be_retried_safely(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            {"id": 77, "status": "FINALIZANDO", "resultado": None, "hierarchy_contract_version": 2, "processing_expired": True},
            {"total": 0},
        ]

        result = begin_general_indicator_finalization(connection, 77)

        self.assertTrue(result["acquired"])

    def test_expired_update_restores_previous_state_and_closes_history(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.side_effect = [
            {"id": 77, "status": "ATUALIZANDO_PENDENCIAS", "hierarchy_contract_version": 2, "processing_expired": True},
            {"id": 90, "estado_anterior": "COM_INCONSISTENCIAS"},
            {"total": 2},
            {"id": 91},
        ]

        result = begin_general_indicator_update(connection, 77, update_type="SELETIVA")

        self.assertTrue(result["acquired"])
        self.assertEqual(result["previousStatus"], "COM_INCONSISTENCIAS")
        self.assertEqual(result["pendingBefore"], 2)
        executed_sql = "\n".join(str(call.args[0]) for call in cursor.execute.call_args_list)
        self.assertIn("status = 'ERRO'", executed_sql)

    def test_old_hierarchy_snapshot_requires_full_refresh(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.return_value = {
            "id": 77,
            "status": "COM_INCONSISTENCIAS",
            "hierarchy_contract_version": 1,
            "processing_expired": False,
        }

        result = begin_general_indicator_update(connection, 77, update_type="SELETIVA")

        self.assertFalse(result["acquired"])
        self.assertEqual(result["reason"], "hierarchy_outdated")

    def test_finalization_completion_reports_when_state_was_lost(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.rowcount = 0

        completed = complete_general_indicator_finalization(
            connection,
            77,
            result={"status": "FINALIZADA"},
        )

        self.assertFalse(completed)

    def test_expired_worker_is_not_allowed_to_persist_or_restore_state(self) -> None:
        connection, cursor = connection_with_cursor()
        cursor.fetchone.return_value = None

        self.assertFalse(is_general_indicator_update_active(connection, 77, 90))

        cursor.rowcount = 0
        restored = fail_general_indicator_update(
            connection,
            77,
            90,
            previous_status="COM_INCONSISTENCIAS",
            message="execução antiga",
        )
        self.assertFalse(restored)


def connection_with_cursor() -> tuple[MagicMock, MagicMock]:
    connection = MagicMock()
    cursor = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    return connection, cursor


if __name__ == "__main__":
    unittest.main()
