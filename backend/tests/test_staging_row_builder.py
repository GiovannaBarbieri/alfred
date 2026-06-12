import csv
import io
import unittest
from unittest.mock import patch

from app.services.staging_row_builder import build_staging_rows


REQUIRED_COLUMNS = [
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
]


def csv_bytes(rows: list[dict[str, str]], columns: list[str] | None = None) -> bytes:
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=columns or REQUIRED_COLUMNS, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode("utf-8")


def row(**overrides: str) -> dict[str, str]:
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
    return data


class StagingRowBuilderTests(unittest.TestCase):
    def setUp(self) -> None:
        patcher = patch("app.services.classification_service.get_connection", side_effect=RuntimeError("db disabled"))
        self.addCleanup(patcher.stop)
        patcher.start()

    def test_build_staging_rows_maps_raw_data_and_initial_classification(self) -> None:
        rows = build_staging_rows("horas.csv", csv_bytes([row()]))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["line"], 2)
        self.assertEqual(rows[0]["idLancamento"], "1001")
        self.assertEqual(rows[0]["idTask"], "501")
        self.assertEqual(rows[0]["category"], "Desenvolvimento")
        self.assertEqual(rows[0]["subcategory"], "Back")
        self.assertEqual(rows[0]["origin"], "regra")
        self.assertEqual(rows[0]["raw"]["TituloEpic"], "Epic Migracao")

    def test_build_staging_rows_returns_empty_when_required_column_is_missing(self) -> None:
        columns = [column for column in REQUIRED_COLUMNS if column != "TituloTask"]

        rows = build_staging_rows("horas.csv", csv_bytes([row()], columns))

        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
