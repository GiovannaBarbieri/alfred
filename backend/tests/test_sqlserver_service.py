import unittest
from unittest.mock import patch

from app.services.sqlserver_service import (
    SQLServerAmbiguousIdError,
    SQLServerIdNotFoundError,
    SQLServerInvalidIdError,
    dataframe_to_import_content,
    normalize_sqlserver_rows,
    resolve_sqlserver_id_type,
    validate_sqlserver_ids,
)


class SQLServerServiceTests(unittest.TestCase):
    def test_normalize_sqlserver_rows_maps_aliases_to_import_columns(self) -> None:
        dataframe = normalize_sqlserver_rows(
            [
                {
                    "id_lancamento": "1001",
                    "data_hora_cadastro": "10/01/2026 09:00:00",
                    "atividade": "501",
                    "usuario": "ana.silva",
                    "TempoDuracao": "01:00:00",
                    "task_id": "501",
                    "task_title": "[Desenvolvimento] - API",
                    "pbi_id": "401",
                    "pbi_title": "PBI",
                    "feature_id": "301",
                    "feature_title": "Feature",
                    "epic_id": "201",
                    "epic_title": "Epic",
                }
            ]
        )

        self.assertEqual(list(dataframe.columns)[0], "IdLancamento")
        self.assertEqual(dataframe.loc[0, "LoginUsuario"], "ana.silva")
        self.assertEqual(dataframe.loc[0, "Duracao"], "01:00:00")
        self.assertEqual(dataframe.loc[0, "TituloTask"], "[Desenvolvimento] - API")

    def test_dataframe_to_import_content_creates_csv_bytes(self) -> None:
        dataframe = normalize_sqlserver_rows([{"IdLancamento": "1001"}])

        content = dataframe_to_import_content(dataframe)

        self.assertIsInstance(content, bytes)
        self.assertIn(b"IdLancamento", content)

    def test_validate_sqlserver_ids_accepts_multiple_numeric_ids(self) -> None:
        self.assertEqual(validate_sqlserver_ids(["456", 123, "123"]), [123, 456])

    def test_validate_sqlserver_ids_rejects_invalid_values(self) -> None:
        with self.assertRaises(SQLServerInvalidIdError):
            validate_sqlserver_ids(["123", "abc"])

    @patch("app.services.sqlserver_service._find_existing_ids")
    def test_resolve_sqlserver_id_type_detects_epic(self, find_existing_ids) -> None:
        find_existing_ids.side_effect = [{123}, set()]

        self.assertEqual(resolve_sqlserver_id_type([123], "auto"), "epic")

    @patch("app.services.sqlserver_service._find_existing_ids")
    def test_resolve_sqlserver_id_type_detects_feature(self, find_existing_ids) -> None:
        find_existing_ids.side_effect = [set(), {123}]

        self.assertEqual(resolve_sqlserver_id_type([123], "auto"), "feature")

    @patch("app.services.sqlserver_service._find_existing_ids")
    def test_resolve_sqlserver_id_type_rejects_ambiguous_ids(self, find_existing_ids) -> None:
        find_existing_ids.side_effect = [{123}, {123}]

        with self.assertRaises(SQLServerAmbiguousIdError):
            resolve_sqlserver_id_type([123], "auto")

    @patch("app.services.sqlserver_service._find_existing_ids")
    def test_resolve_sqlserver_id_type_rejects_unknown_ids(self, find_existing_ids) -> None:
        find_existing_ids.side_effect = [set(), set()]

        with self.assertRaises(SQLServerIdNotFoundError):
            resolve_sqlserver_id_type([123], "auto")


if __name__ == "__main__":
    unittest.main()
