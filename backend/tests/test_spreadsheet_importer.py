import io
import unittest

import pandas as pd

from app.importers.spreadsheet_importer import read_normalized_dataframe


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


class SpreadsheetImporterTests(unittest.TestCase):
    def test_excel_uses_sheet_that_contains_required_columns(self) -> None:
        output = io.BytesIO()
        valid_row = {
            "IdLancamento": "1",
            "DataHoraCadastro": "01/01/2026 08:00:00",
            "Task": "101",
            "LoginUsuario": "giovanna.barbieri",
            "Duracao": "01:00:00",
            "IdTask": "101",
            "TituloTask": "[Desenvolvimento] - Ajuste",
            "IdPBI": "201",
            "TituloPBI": "PBI",
            "IdFeat": "301",
            "TituloFeat": "Feature",
            "IdEpic": "401",
            "TituloEpic": "Epic",
        }
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            pd.DataFrame([{"Resumo": "Nao usar"}]).to_excel(writer, index=False, sheet_name="Resumo")
            pd.DataFrame([valid_row]).to_excel(writer, index=False, sheet_name="Base TFS")

        dataframe, column_lookup = read_normalized_dataframe("horas.xlsx", output.getvalue(), REQUIRED_COLUMNS)

        self.assertEqual(set(column_lookup), set(REQUIRED_COLUMNS))
        self.assertEqual(dataframe.iloc[0]["LoginUsuario"], "giovanna.barbieri")


if __name__ == "__main__":
    unittest.main()
