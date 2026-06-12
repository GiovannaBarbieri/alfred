import csv
import io
import unittest

from app.services.import_service import build_import_records, validate_import_file


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
    base = {
        "IdLancamento": "1001",
        "DataHoraCadastro": "10/01/2026 09:00:00",
        "Task": "501",
        "LoginUsuario": "henrique.maltauro",
        "Duracao": "01:30:00",
        "IdTask": "501",
        "TituloTask": "[Desenvolvimento][Back] - Criando endpoint de integracao",
        "IdPBI": "401",
        "TituloPBI": "PBI Integracao",
        "IdFeat": "301",
        "TituloFeat": "Feature Financeira",
        "IdEpic": "201",
        "TituloEpic": "Epic Migracao",
    }
    base.update(overrides)
    return base


class ImportServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        patcher = unittest.mock.patch("app.services.classification_service.get_connection", side_effect=RuntimeError("db disabled"))
        self.addCleanup(patcher.stop)
        patcher.start()

    def test_missing_required_column_blocks_import(self) -> None:
        columns = [column for column in REQUIRED_COLUMNS if column != "TituloEpic"]
        result = validate_import_file("horas.csv", csv_bytes([row()], columns))

        self.assertFalse(result.canComplete)
        self.assertIn("TituloEpic", result.missingColumns)
        self.assertEqual(result.blockedRows, 1)
        self.assertTrue(any(issue.code == "missing_column" for issue in result.issues))

    def test_duplicate_id_lancamento_blocks_until_user_selects_one_line(self) -> None:
        rows = [
            row(IdLancamento="DUP-1", IdTask="501"),
            row(IdLancamento="DUP-1", IdTask="502", TituloTask="[Definicao][Back] - Estudo da regra"),
        ]

        blocked = validate_import_file("horas.csv", csv_bytes(rows))
        resolved = validate_import_file("horas.csv", csv_bytes(rows), duplicate_keep_lines={2})

        self.assertFalse(blocked.canComplete)
        self.assertEqual(blocked.duplicates[0].lines, [2, 3])
        self.assertTrue(any(issue.code == "duplicate_id" and issue.severity == "bloqueio" for issue in blocked.issues))
        self.assertTrue(resolved.canComplete)
        self.assertEqual(resolved.validRows, 1)
        self.assertTrue(any(issue.code == "duplicate_resolved" and issue.severity == "alerta" for issue in resolved.issues))

    def test_zero_duration_generates_alert_without_blocking(self) -> None:
        result = validate_import_file("horas.csv", csv_bytes([row(Duracao="00:00:00")]))

        self.assertTrue(result.canComplete)
        self.assertEqual(result.blockedRows, 0)
        self.assertTrue(any(issue.code == "zero_duration" and issue.severity == "alerta" for issue in result.issues))

    def test_keyword_classification_handles_definition_terms(self) -> None:
        result = validate_import_file(
            "horas.csv",
            csv_bytes([row(TituloTask="Analisando e levantando regra da migracao")]),
        )

        self.assertEqual(result.classifications[0].category, "Definicao")
        self.assertEqual(result.classifications[0].origin, "regra")

    def test_manual_overrides_can_apply_to_all_records_from_same_task(self) -> None:
        rows = [
            row(IdLancamento="1001", IdTask="501", TituloTask="Titulo sem padrao para revisar"),
            row(IdLancamento="1002", IdTask="501", TituloTask="Titulo sem padrao para revisar"),
        ]
        overrides = {
            2: {"category": "Desenvolvimento", "subcategory": "Back"},
            3: {"category": "Desenvolvimento", "subcategory": "Back"},
        }

        records = build_import_records("horas.csv", csv_bytes(rows), classification_overrides=overrides)

        self.assertEqual(len(records), 2)
        self.assertEqual({record["IdTask"] for record in records}, {"501"})
        self.assertEqual({record["Categoria"] for record in records}, {"Desenvolvimento"})
        self.assertEqual({record["Subcategoria"] for record in records}, {"Back"})
        self.assertEqual({record["OrigemClassificacao"] for record in records}, {"manual"})


if __name__ == "__main__":
    unittest.main()
