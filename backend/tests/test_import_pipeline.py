import csv
import io
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.api.routes.imports import _sqlserver_import_filename
from app.schemas.imports import SQLServerImportRequest
from app.services.import_pipeline import create_staged_import


def sample_csv() -> bytes:
    stream = io.StringIO()
    writer = csv.DictWriter(
        stream,
        fieldnames=[
            "IdLancamento",
            "DataHoraCadastro",
            "Task",
            "LoginUsuario",
            "Duracao",
            "IdTask",
            "TituloTask",
            "IdPBI",
            "TituloPBI",
            "IdFeat",
            "TituloFeat",
            "IdEpic",
            "TituloEpic",
        ],
        lineterminator="\n",
    )
    writer.writeheader()
    writer.writerow(
        {
            "IdLancamento": "1001",
            "DataHoraCadastro": "10/01/2026 09:00:00",
            "Task": "501",
            "LoginUsuario": "henrique.maltauro",
            "Duracao": "01:30:00",
            "IdTask": "501",
            "TituloTask": "[Desenvolvimento][Back] - Criando endpoint",
            "IdPBI": "401",
            "TituloPBI": "PBI Integracao",
            "IdFeat": "301",
            "TituloFeat": "Feature Financeira",
            "IdEpic": "201",
            "TituloEpic": "Epic Migracao",
        }
    )
    return stream.getvalue().encode("utf-8")


class ImportPipelineTests(unittest.TestCase):
    def test_sqlserver_import_filename_uses_custom_project_name(self) -> None:
        payload = SQLServerImportRequest(ids=[187358], idType="epic", projectName="187358 - Cadastro Agil V2")

        self.assertEqual(_sqlserver_import_filename(payload), "187358 - Cadastro Agil V2.csv")

    def test_sqlserver_import_filename_removes_invalid_characters(self) -> None:
        payload = SQLServerImportRequest(ids=[187358], idType="epic", projectName='Projeto / Financeiro: "Teste"')

        self.assertEqual(_sqlserver_import_filename(payload), "Projeto Financeiro Teste.csv")

    def test_sqlserver_import_filename_keeps_automatic_fallback(self) -> None:
        payload = SQLServerImportRequest(ids=[187358], idType="epic")

        self.assertEqual(_sqlserver_import_filename(payload), "sqlserver-epic-187358.csv")

    @patch("app.services.import_pipeline.insert_import_log")
    @patch("app.services.import_pipeline.update_import_session_summary")
    @patch("app.services.import_pipeline.insert_staging_rows")
    @patch("app.services.import_pipeline.create_import_session")
    @patch("app.services.import_pipeline.get_import_session")
    @patch("app.services.import_pipeline.get_connection")
    def test_create_staged_import_writes_only_temporary_session_and_rows(
        self,
        get_connection: MagicMock,
        get_import_session: MagicMock,
        create_import_session: MagicMock,
        insert_staging_rows: MagicMock,
        update_import_session_summary: MagicMock,
        insert_import_log: MagicMock,
    ) -> None:
        connection = MagicMock()
        get_connection.return_value.__enter__.return_value = connection
        create_import_session.return_value = 77
        get_import_session.return_value = {
            "id": 77,
            "nome_arquivo": "horas.csv",
            "status": "staged",
            "total_registros": 1,
            "registros_validos": 1,
            "registros_com_alerta": 0,
            "registros_bloqueados": 0,
            "criado_em": datetime(2026, 1, 10, 9, 0, 0),
            "atualizado_em": datetime(2026, 1, 10, 9, 1, 0),
            "importacao_final_id": None,
        }

        response = create_staged_import("horas.csv", sample_csv())

        self.assertEqual(response.session.sessionId, 77)
        self.assertEqual(response.validation.sessionId, 77)
        insert_staging_rows.assert_called_once()
        insert_import_log.assert_called_once()
        update_import_session_summary.assert_called_once_with(
            connection,
            77,
            status="AGUARDANDO_CONFIRMACAO",
            total_rows=1,
            valid_rows=1,
            alert_rows=1,
            blocked_rows=0,
        )


if __name__ == "__main__":
    unittest.main()
