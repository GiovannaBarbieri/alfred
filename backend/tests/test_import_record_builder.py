import unittest

import pandas as pd

from app.schemas.imports import ClassificationSuggestion, ImportIssue, ImportValidationResponse
from app.services.import_record_builder import build_records_from_validation


def dataframe() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "IdLancamento": "1001",
                "DataHoraCadastro": "10/01/2026 09:00:00",
                "Task": "501",
                "LoginUsuario": "henrique.maltauro",
                "Duracao": "01:30:00",
                "IdTask": "501",
                "TituloTask": "Criando endpoint",
                "IdPBI": "401",
                "TituloPBI": "PBI Integracao",
                "IdFeat": "301",
                "TituloFeat": "Feature Financeira",
                "IdEpic": "201",
                "TituloEpic": "Epic Migracao",
            },
            {
                "IdLancamento": "1002",
                "DataHoraCadastro": "10/01/2026 10:30:00",
                "Task": "501",
                "LoginUsuario": "henrique.maltauro",
                "Duracao": "00:30:00",
                "IdTask": "501",
                "TituloTask": "Criando endpoint",
                "IdPBI": "401",
                "TituloPBI": "PBI Integracao",
                "IdFeat": "301",
                "TituloFeat": "Feature Financeira",
                "IdEpic": "201",
                "TituloEpic": "Epic Migracao",
            },
        ]
    )


def validation() -> ImportValidationResponse:
    return ImportValidationResponse(
        filename="horas.csv",
        totalRows=2,
        validRows=2,
        blockedRows=0,
        alertRows=1,
        missingColumns=[],
        issues=[
            ImportIssue(
                line=2,
                field="Duracao",
                value="01:30:00",
                severity="alerta",
                code="sample_alert",
                message="Alerta de teste.",
            )
        ],
        duplicates=[],
        classifications=[
            ClassificationSuggestion(
                line=2,
                idTask="501",
                loginUsuario="henrique.maltauro",
                tituloTask="Criando endpoint",
                category="Desenvolvimento",
                subcategory="Back",
                origin="regra",
                confidence=0.85,
                confidenceLevel="alta",
                classifierVersion="1.0.0",
            ),
            ClassificationSuggestion(
                line=3,
                idTask="501",
                loginUsuario="henrique.maltauro",
                tituloTask="Criando endpoint",
                category="Desenvolvimento",
                subcategory="Back",
                origin="regra",
                confidence=0.85,
                confidenceLevel="alta",
                classifierVersion="1.0.0",
            ),
        ],
        canComplete=True,
    )


class ImportRecordBuilderTests(unittest.TestCase):
    def test_build_records_maps_core_fields_and_alert_status(self) -> None:
        records = build_records_from_validation(dataframe(), validation(), set())

        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["DuracaoSegundos"], 5400)
        self.assertEqual(records[0]["StatusValidacao"], "alerta")
        self.assertEqual(records[1]["StatusValidacao"], "valido")
        self.assertEqual(records[0]["Categoria"], "Desenvolvimento")
        self.assertEqual(records[0]["VersaoClassificador"], "1.0.0")

    def test_manual_override_changes_category_subcategory_and_origin(self) -> None:
        records = build_records_from_validation(
            dataframe(),
            validation(),
            set(),
            {2: {"category": "Definicao", "subcategory": "QA"}},
        )

        self.assertEqual(records[0]["Categoria"], "Definicao")
        self.assertEqual(records[0]["Subcategoria"], "QA")
        self.assertEqual(records[0]["OrigemClassificacao"], "manual")
        self.assertEqual(records[0]["ConfiancaClassificacao"], 1.0)

    def test_removed_duplicate_lines_are_skipped(self) -> None:
        records = build_records_from_validation(dataframe(), validation(), {3})

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["Line"], 2)


if __name__ == "__main__":
    unittest.main()
