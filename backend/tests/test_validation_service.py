import unittest
from unittest.mock import patch

import pandas as pd

from app.schemas.imports import ClassificationSuggestion
from app.services.validation_service import (
    duplicate_groups,
    duplicate_removed_lines,
    duration_to_seconds,
    find_duplicate_lines,
    missing_column_issues,
    operational_alerts,
    parse_datetime,
    selected_keep_line,
    validate_row,
)


def valid_row(**overrides: str) -> pd.Series:
    data = {
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
    data.update(overrides)
    return pd.Series(data)


def suggestion(**overrides) -> ClassificationSuggestion:
    data = {
        "line": 2,
        "idTask": "501",
        "loginUsuario": "henrique.maltauro",
        "tituloTask": "Criando endpoint",
        "category": "Desenvolvimento",
        "subcategory": "Back",
        "origin": "regra",
        "confidence": 0.85,
        "confidenceLevel": "alta",
        "classifierVersion": "1.0.0",
    }
    data.update(overrides)
    return ClassificationSuggestion(**data)


class ValidationServiceTests(unittest.TestCase):
    def test_missing_column_issues_reports_required_columns(self) -> None:
        missing_columns, issues = missing_column_issues({"IdLancamento": "IdLancamento"})

        self.assertIn("TituloTask", missing_columns)
        self.assertTrue(any(issue.code == "missing_column" for issue in issues))

    def test_validate_row_blocks_invalid_duration_and_date(self) -> None:
        issues = validate_row(valid_row(Duracao="1 hora", DataHoraCadastro="data ruim"), 2)

        self.assertTrue(any(issue.code == "invalid_duration" and issue.severity == "bloqueio" for issue in issues))
        self.assertTrue(any(issue.code == "invalid_datetime" and issue.severity == "bloqueio" for issue in issues))

    def test_validate_row_alerts_zero_duration(self) -> None:
        issues = validate_row(valid_row(Duracao="00:00:00"), 2)

        self.assertTrue(any(issue.code == "zero_duration" and issue.severity == "alerta" for issue in issues))

    def test_duplicate_helpers_detect_and_resolve_removed_lines(self) -> None:
        dataframe = pd.DataFrame(
            [
                valid_row(IdLancamento="DUP-1"),
                valid_row(IdLancamento="DUP-1", Task="502"),
                valid_row(IdLancamento="OK-1", Task="503"),
            ]
        )

        duplicates = find_duplicate_lines(dataframe)

        self.assertEqual(duplicates, {"DUP-1": [2, 3]})
        self.assertEqual(selected_keep_line([2, 3], {2}), 2)
        self.assertEqual(duplicate_removed_lines(duplicates, {2}), {3})
        self.assertEqual(duplicate_groups(dataframe)[0].records[0]["line"], 2)

    def test_duration_to_seconds_and_parse_datetime(self) -> None:
        self.assertEqual(duration_to_seconds("01:02:03"), 3723)
        self.assertEqual(parse_datetime("10/01/2026 09:00:00").year, 2026)
        self.assertEqual(parse_datetime("2026-01-07 16:42:38.643").month, 1)
        self.assertEqual(parse_datetime("2026-01-07 16:42:38.643").day, 7)

    @patch("app.services.validation_service.matched_category_count", return_value=2)
    def test_operational_alerts_cover_excessive_generic_missing_profile_and_conflict(self, _matched) -> None:
        alerts = operational_alerts(
            valid_row(Duracao="13:00:00", TituloTask="Ajuste"),
            2,
            suggestion(subcategory="Nao aplicavel"),
        )
        codes = {alert.code for alert in alerts}

        self.assertIn("excessive_duration", codes)
        self.assertIn("generic_title", codes)
        self.assertIn("missing_technical_profile", codes)
        self.assertIn("conflicting_categories", codes)


if __name__ == "__main__":
    unittest.main()
