import unittest
from datetime import date
from unittest.mock import patch

from app.services.sqlserver_service import (
    SQLServerAmbiguousIdError,
    SQLServerConfigurationError,
    SQLServerIdNotFoundError,
    SQLServerInvalidIdError,
    SQLServerQueryError,
    _connection_string,
    _map_pyodbc_error,
    _resolve_sqlserver_driver,
    dataframe_to_import_content,
    normalize_sqlserver_rows,
    query_general_indicator_raw_launches,
    query_general_indicator_raw_launches_by_ids,
    query_tfs_indicator_items,
    query_tfs_task_hierarchies,
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

    def test_normalize_sqlserver_rows_converts_day_duration_to_hours(self) -> None:
        dataframe = normalize_sqlserver_rows([{"IdLancamento": "1001", "TempoDuracao": "1d 02:03:04"}])

        self.assertEqual(dataframe.loc[0, "Duracao"], "26:03:04")

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

    @patch("app.services.sqlserver_service.settings")
    def test_connection_string_uses_sql_auth(self, settings) -> None:
        settings.sqlserver_auth = "sql"
        settings.sqlserver_driver = "ODBC Driver 18 for SQL Server"
        settings.sqlserver_host = "srvbanco009"
        settings.sqlserver_port = 1463
        settings.sqlserver_database = "Tfs_Fabrica"
        settings.sqlserver_user = "readonly"
        settings.sqlserver_password = "secret"
        settings.sqlserver_encrypt = False
        settings.sqlserver_trust_cert = True
        settings.sqlserver_connection_timeout_seconds = 10

        connection_string = _connection_string()

        self.assertIn("UID=readonly;", connection_string)
        self.assertIn("PWD=secret;", connection_string)
        self.assertNotIn("Trusted_Connection=yes;", connection_string)

    @patch("app.services.sqlserver_service.settings")
    def test_connection_string_uses_windows_auth_without_password(self, settings) -> None:
        settings.sqlserver_auth = "windows"
        settings.sqlserver_driver = "ODBC Driver 18 for SQL Server"
        settings.sqlserver_host = "srvbanco009"
        settings.sqlserver_port = 1463
        settings.sqlserver_database = "Tfs_Fabrica"
        settings.sqlserver_user = None
        settings.sqlserver_password = None
        settings.sqlserver_encrypt = False
        settings.sqlserver_trust_cert = True
        settings.sqlserver_connection_timeout_seconds = 10

        connection_string = _connection_string()

        self.assertIn("Trusted_Connection=yes;", connection_string)
        self.assertNotIn("UID=", connection_string)
        self.assertNotIn("PWD=", connection_string)

    @patch("app.services.sqlserver_service.settings")
    def test_connection_string_rejects_unknown_auth_mode(self, settings) -> None:
        settings.sqlserver_auth = "unknown"
        settings.sqlserver_host = "srvbanco009"
        settings.sqlserver_database = "Tfs_Fabrica"

        with self.assertRaises(SQLServerConfigurationError):
            _connection_string()

    @patch("app.services.sqlserver_service._load_pyodbc")
    @patch("app.services.sqlserver_service.settings")
    def test_driver_resolution_preserves_configured_driver_when_installed(self, settings, load_pyodbc) -> None:
        settings.sqlserver_driver = "ODBC Driver 18 for SQL Server"
        load_pyodbc.return_value.drivers.return_value = [
            "ODBC Driver 17 for SQL Server",
            "ODBC Driver 18 for SQL Server",
        ]

        self.assertEqual(_resolve_sqlserver_driver(), "ODBC Driver 18 for SQL Server")

    @patch("app.services.sqlserver_service._load_pyodbc")
    @patch("app.services.sqlserver_service.settings")
    def test_driver_resolution_falls_back_to_installed_driver(self, settings, load_pyodbc) -> None:
        settings.sqlserver_driver = "ODBC Driver 18 for SQL Server"
        load_pyodbc.return_value.drivers.return_value = ["SQL Server", "ODBC Driver 17 for SQL Server"]

        self.assertEqual(_resolve_sqlserver_driver(), "ODBC Driver 17 for SQL Server")

    @patch("app.services.sqlserver_service._execute_query")
    def test_raw_launch_query_preserves_source_unit_without_hierarchy_joins(self, execute_query) -> None:
        execute_query.return_value = []

        query_general_indicator_raw_launches(start_date=date(2026, 1, 1), end_date=date(2026, 6, 30))

        query, params = execute_query.call_args.args
        self.assertEqual(params, ["2026-01-01", "2026-07-01"])
        self.assertIn("Lancamento.ID AS IdLancamento", query)
        self.assertIn("Lancamento.TaskID AS IdTask", query)
        self.assertNotIn("LinksAre", query)
        self.assertNotIn("WorkItemLONgTexts", query)

    @patch("app.services.sqlserver_service._execute_query")
    def test_selective_raw_launch_query_uses_only_requested_ids_in_safe_batches(self, execute_query) -> None:
        execute_query.side_effect = [[{"IdLancamento": 1}], [{"IdLancamento": 251}]]

        rows = query_general_indicator_raw_launches_by_ids([*range(1, 302), 1])

        self.assertEqual(rows, [{"IdLancamento": 1}, {"IdLancamento": 251}])
        self.assertEqual(execute_query.call_count, 2)
        self.assertEqual(execute_query.call_args_list[0].args[1], list(range(1, 251)))
        self.assertEqual(execute_query.call_args_list[1].args[1], list(range(251, 302)))
        self.assertNotIn("DataHoraCadastro >=", execute_query.call_args_list[0].args[0])

    @patch("app.services.sqlserver_service._execute_query")
    def test_task_hierarchy_query_uses_unique_ids_and_safe_batches(self, execute_query) -> None:
        execute_query.side_effect = [
            [
                {"IdItem": 1, "ItemWorkItemType": "Task", "ItemTitle": "Task", "IdParent": 301, "ParentWorkItemType": "PBI", "ParentTitle": "PBI"},
                {"IdItem": 301, "ItemWorkItemType": "PBI", "ItemTitle": "PBI", "IdParent": 200, "ParentWorkItemType": "Feature", "ParentTitle": "Feature"},
                {"IdItem": 200, "ItemWorkItemType": "Feature", "ItemTitle": "Feature", "IdParent": 100, "ParentWorkItemType": "Epic", "ParentTitle": "Epic"},
            ],
        ]

        rows = query_tfs_task_hierarchies([*range(1, 902), 1])

        self.assertEqual(rows[0]["IdTask"], 1)
        self.assertEqual(rows[0]["IdParent"], 301)
        self.assertEqual(rows[0]["IdFeat"], 200)
        self.assertEqual(rows[0]["IdEpic"], 100)
        self.assertEqual(execute_query.call_count, 1)
        self.assertEqual(execute_query.call_args_list[0].args[1], list(range(1, 902)))
        self.assertIn("ParentWorkItemType", execute_query.call_args_list[0].args[0])
        self.assertIn("ItemWorkItemType", execute_query.call_args_list[0].args[0])
        self.assertIn("ItemTitle", execute_query.call_args_list[0].args[0])
        self.assertIn("ParentTitle", execute_query.call_args_list[0].args[0])
        self.assertIn("ORDER BY Item.Rev DESC, Item.RevisedDate DESC", execute_query.call_args_list[0].args[0])
        self.assertIn("ORDER BY Title.Rev DESC", execute_query.call_args_list[0].args[0])
        self.assertNotIn("NOLOCK", execute_query.call_args_list[0].args[0].upper())

    @patch("app.services.sqlserver_service._execute_query")
    def test_tfs_metadata_query_reuses_ids_for_type_and_tags(self, execute_query) -> None:
        execute_query.return_value = []

        query_tfs_indicator_items([20, 10, 20])

        query, params = execute_query.call_args.args
        self.assertEqual(params, [10, 20, 10, 20])
        self.assertIn("WorkItemType", query)
        self.assertIn("tbl_WorkItemCoreLatest", query)
        self.assertIn("tbl_PropertyValue", query)
        self.assertIn("tbl_TagDefinition", query)

    @patch("app.services.sqlserver_service._execute_query")
    def test_tfs_metadata_query_splits_large_id_lists_into_safe_batches(self, execute_query) -> None:
        execute_query.side_effect = [
            [{"ID": 1}],
            [{"ID": 201}],
            [{"ID": 401}],
            [{"ID": 601}],
            [{"ID": 801}],
        ]

        rows = query_tfs_indicator_items(range(1, 902))

        self.assertEqual(rows, [{"ID": 1}, {"ID": 201}, {"ID": 401}, {"ID": 601}, {"ID": 801}])
        self.assertEqual(execute_query.call_count, 5)
        first_params = execute_query.call_args_list[0].args[1]
        last_params = execute_query.call_args_list[4].args[1]
        self.assertEqual(len(first_params), 400)
        self.assertEqual(last_params, [*range(801, 902), *range(801, 902)])

    def test_query_error_is_not_misclassified_only_because_driver_mentions_sql_server(self) -> None:
        error = Exception("42S02", "[Microsoft][ODBC Driver 17 for SQL Server] Invalid object name")

        mapped = _map_pyodbc_error(error, fallback=SQLServerQueryError)

        self.assertIsInstance(mapped, SQLServerQueryError)


if __name__ == "__main__":
    unittest.main()
