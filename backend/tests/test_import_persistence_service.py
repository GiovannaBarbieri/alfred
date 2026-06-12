import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.schemas.imports import ImportIssue, ImportValidationResponse
from app.services.import_persistence_service import classification_status, persist_final_import


def validation() -> ImportValidationResponse:
    return ImportValidationResponse(
        filename="horas.csv",
        totalRows=1,
        validRows=1,
        blockedRows=0,
        alertRows=1,
        missingColumns=[],
        issues=[
            ImportIssue(
                line=2,
                field="Duracao",
                value="00:00:00",
                severity="alerta",
                code="zero_duration",
                message="Duracao zerada.",
            )
        ],
        duplicates=[],
        classifications=[],
        canComplete=True,
    )


def record(origin: str = "regra") -> dict:
    return {
        "Line": 2,
        "IdLancamento": "1001",
        "DataHoraCadastro": datetime(2026, 1, 10, 9, 0, 0),
        "Task": "501",
        "LoginUsuario": "henrique.maltauro",
        "Duracao": "01:30:00",
        "DuracaoSegundos": 5400,
        "IdTask": "501",
        "TituloTask": "Criando endpoint",
        "IdPBI": "401",
        "TituloPBI": "PBI Integracao",
        "IdFeat": "301",
        "TituloFeat": "Feature Financeira",
        "IdEpic": "201",
        "TituloEpic": "Epic Migracao",
        "Categoria": "Desenvolvimento",
        "Subcategoria": "Back",
        "OrigemClassificacao": origin,
        "ConfiancaClassificacao": 0.85,
        "NivelConfianca": "alta",
        "VersaoClassificador": "1.0.0",
        "StatusValidacao": "alerta",
    }


class ImportPersistenceServiceTests(unittest.TestCase):
    def test_classification_status_maps_known_origins(self) -> None:
        self.assertEqual(classification_status("padrao_titulo"), "automatica")
        self.assertEqual(classification_status("manual"), "alterada")
        self.assertEqual(classification_status("pendente"), "nao_classificada")
        self.assertEqual(classification_status("regra"), "sugerida")

    @patch("app.services.import_persistence_service.insert_classification")
    @patch("app.services.import_persistence_service.insert_lancamento")
    @patch("app.services.import_persistence_service.get_lookup_id")
    @patch("app.services.import_persistence_service.insert_issue")
    @patch("app.services.import_persistence_service.create_import")
    def test_persist_final_import_writes_import_issues_records_and_classification(
        self,
        create_import: MagicMock,
        insert_issue: MagicMock,
        get_lookup_id: MagicMock,
        insert_lancamento: MagicMock,
        insert_classification: MagicMock,
    ) -> None:
        connection = MagicMock()
        create_import.return_value = 88
        get_lookup_id.side_effect = [10, 20]
        insert_lancamento.return_value = 99

        import_id = persist_final_import(
            connection,
            filename="horas.csv",
            file_hash="abc",
            validation=validation(),
            records=[record()],
        )

        self.assertEqual(import_id, 88)
        create_import.assert_called_once()
        insert_issue.assert_called_once()
        insert_lancamento.assert_called_once()
        self.assertEqual(insert_lancamento.call_args.kwargs["classification_status"], "sugerida")
        insert_classification.assert_called_once()
        self.assertEqual(insert_classification.call_args.kwargs["lancamento_id"], 99)


if __name__ == "__main__":
    unittest.main()
