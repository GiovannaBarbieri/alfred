import unittest
from unittest.mock import MagicMock, patch

from app.repositories.staging_repository import delete_old_import_sessions
from app.services.session_cleanup_service import cleanup_old_import_sessions


class SessionCleanupServiceTests(unittest.TestCase):
    def test_delete_old_import_sessions_removes_only_unconfirmed_stale_sessions(self) -> None:
        connection = MagicMock()
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchall.return_value = [{"id": 10}, {"id": 11}]

        deleted = delete_old_import_sessions(connection, retention_days=7)

        self.assertEqual(deleted, 2)
        sql = cursor.execute.call_args.args[0]
        params = cursor.execute.call_args.args[1]
        self.assertIn("importacao_final_id IS NULL", sql)
        self.assertIn("UPPER(status) <> 'CONFIRMADO'", sql)
        self.assertIn("atualizado_em < NOW()", sql)
        self.assertEqual(params, (7,))

    @patch("app.services.session_cleanup_service.delete_old_import_sessions")
    @patch("app.services.session_cleanup_service.get_connection")
    def test_cleanup_old_import_sessions_uses_configured_connection(
        self,
        get_connection: MagicMock,
        delete_old_sessions: MagicMock,
    ) -> None:
        connection = MagicMock()
        get_connection.return_value.__enter__.return_value = connection
        delete_old_sessions.return_value = 3

        deleted = cleanup_old_import_sessions(retention_days=10)

        self.assertEqual(deleted, 3)
        delete_old_sessions.assert_called_once_with(connection, 10)

    @patch("app.services.session_cleanup_service.get_connection")
    def test_cleanup_old_import_sessions_can_be_disabled(self, get_connection: MagicMock) -> None:
        deleted = cleanup_old_import_sessions(retention_days=0)

        self.assertEqual(deleted, 0)
        get_connection.assert_not_called()


if __name__ == "__main__":
    unittest.main()
