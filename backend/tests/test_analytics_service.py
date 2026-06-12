from __future__ import annotations

import unittest
from datetime import datetime, timedelta

from app.services.analytics_service import (
    build_operational_insights,
    generate_and_persist_operational_insights,
    list_persisted_operational_insights,
    update_operational_insight_status,
)


class FakeAnalyticsRepository:
    def __init__(self) -> None:
        now = datetime(2026, 5, 25, 10, 0, 0)
        self.imports = [
            {
                "id": 2,
                "nome_arquivo": "175613 - Migracao.xlsx",
                "project_name": "175613 - Migracao",
                "data_importacao": now,
                "status": "concluida",
                "total_registros": 20,
                "total_records": 20,
                "total_seconds": 100 * 3600,
            },
            {
                "id": 1,
                "nome_arquivo": "175613 - Migracao.xlsx",
                "project_name": "175613 - Migracao",
                "data_importacao": now - timedelta(days=7),
                "status": "concluida",
                "total_registros": 15,
                "total_records": 15,
                "total_seconds": 70 * 3600,
            },
        ]
        self.saved_insights: list[dict] = []
        self.next_saved_id = 1

    def list_imports(self):
        return self.imports

    def get_category_metrics(self, import_id: int):
        if import_id == 2:
            return [
                {"category": "Retrabalho", "total_seconds": 40 * 3600, "total_records": 8},
                {"category": "Desenvolvimento", "total_seconds": 60 * 3600, "total_records": 12},
            ]
        return [
            {"category": "Retrabalho", "total_seconds": 10 * 3600, "total_records": 4},
            {"category": "Desenvolvimento", "total_seconds": 60 * 3600, "total_records": 11},
        ]

    def get_collaborator_metrics(self, import_id: int):
        return [
            {"login_usuario": "dev.back", "total_seconds": 60 * 3600, "total_records": 10},
            {"login_usuario": "dev.front", "total_seconds": 40 * 3600, "total_records": 10},
        ]

    def get_low_confidence_stats(self, import_id: int, threshold: float = 0.9):
        return {"total_classifications": 20, "low_confidence_count": 4, "average_confidence": 0.82}

    def get_pending_reviews_stats(self, import_id: int):
        return [{"tipo": "low_confidence", "status": "pendente", "total": 3}]

    def get_unresolved_alert_stats(self, import_id: int):
        return [{"tipo_erro": "zero_duration", "severidade": "alerta", "total": 2}]

    def get_excessive_duration_records(self, import_id: int, threshold_seconds: int = 12 * 60 * 60):
        return [{"id_lancamento": "99", "login_usuario": "dev.back", "titulo_task": "API", "duracao_segundos": 13 * 3600}]

    def get_generic_title_records(self, import_id: int):
        return [{"id_task": "501", "titulo_task": "ajuste", "total_records": 2, "total_seconds": 3600}]

    def save_insight(self, insight: dict):
        existing = next(
            (
                item
                for item in self.saved_insights
                if item["importacao_id"] == insight["importId"]
                and item["tipo"] == insight["tipo"]
                and item["titulo"] == insight["titulo"]
                and item["descricao"] == insight["descricao"]
            ),
            None,
        )
        if existing:
            existing["metricas_json"] = insight["metadata"]
            return existing
        row = {
            "id": self.next_saved_id,
            "importacao_id": insight["importId"],
            "tipo": insight["tipo"],
            "severidade": insight["severidade"],
            "titulo": insight["titulo"],
            "descricao": insight["descricao"],
            "recomendacao": insight["recomendacao"],
            "metricas_json": insight["metadata"],
            "status": "novo",
            "gerado_em": datetime(2026, 5, 25, 11, 0, 0),
            "revisado_em": None,
            "usuario_revisao": None,
            "nome_arquivo": "175613 - Migracao.xlsx",
        }
        self.next_saved_id += 1
        self.saved_insights.append(row)
        return row

    def list_saved_insights(self, *, import_id=None, insight_type=None, severity=None, status=None):
        rows = self.saved_insights
        if import_id is not None:
            rows = [row for row in rows if row["importacao_id"] == import_id]
        if insight_type:
            rows = [row for row in rows if row["tipo"] == insight_type]
        if severity:
            rows = [row for row in rows if row["severidade"] == severity]
        if status:
            rows = [row for row in rows if row["status"] == status]
        return rows

    def get_saved_insight(self, insight_id: int):
        return next((row for row in self.saved_insights if row["id"] == insight_id), None)

    def update_insight_status(self, insight_id: int, *, status: str, user: str):
        row = self.get_saved_insight(insight_id)
        if not row:
            return None
        row["status"] = status
        row["revisado_em"] = datetime(2026, 5, 25, 12, 0, 0) if status in {"revisado", "ignorado"} else None
        row["usuario_revisao"] = user if status in {"revisado", "ignorado"} else None
        return row


class AnalyticsServiceTests(unittest.TestCase):
    def test_generates_operational_insights_from_existing_data(self) -> None:
        result = build_operational_insights(FakeAnalyticsRepository(), import_id=2)

        self.assertEqual(result["context"]["importId"], 2)
        self.assertGreaterEqual(result["summary"]["total"], 6)
        self.assertGreater(result["summary"]["alta"], 0)
        self.assertTrue(any(insight["tipo"] == "tendencia" for insight in result["insights"]))
        self.assertTrue(any(insight["tipo"] == "concentracao" for insight in result["insights"]))
        self.assertTrue(any(insight["tipo"] == "qualidade" for insight in result["insights"]))
        self.assertTrue(any(insight["tipo"] == "risco" for insight in result["insights"]))
        self.assertTrue(any(insight["tipo"] == "anomalia" for insight in result["insights"]))

    def test_filters_by_type_and_severity(self) -> None:
        result = build_operational_insights(FakeAnalyticsRepository(), import_id=2, insight_type="risco", severity="media")

        self.assertGreater(result["summary"]["total"], 0)
        self.assertTrue(all(insight["tipo"] == "risco" for insight in result["insights"]))
        self.assertTrue(all(insight["severidade"] == "media" for insight in result["insights"]))

    def test_returns_empty_state_without_imports(self) -> None:
        class EmptyRepository(FakeAnalyticsRepository):
            def __init__(self) -> None:
                self.imports = []

        result = build_operational_insights(EmptyRepository())

        self.assertIsNone(result["context"])
        self.assertEqual(result["summary"]["total"], 0)
        self.assertEqual(result["insights"], [])

    def test_generates_and_persists_insights_without_simple_duplicates(self) -> None:
        repository = FakeAnalyticsRepository()

        first = generate_and_persist_operational_insights(repository, import_id=2)
        second = generate_and_persist_operational_insights(repository, import_id=2)

        self.assertEqual(first["summary"]["total"], second["summary"]["total"])
        self.assertEqual(len(repository.saved_insights), first["summary"]["total"])
        self.assertTrue(all(insight["status"] == "novo" for insight in second["insights"]))

    def test_lists_persisted_insights_with_filters(self) -> None:
        repository = FakeAnalyticsRepository()
        generate_and_persist_operational_insights(repository, import_id=2)

        result = list_persisted_operational_insights(repository, import_id=2, insight_type="risco")

        self.assertGreater(result["summary"]["total"], 0)
        self.assertTrue(all(insight["tipo"] == "risco" for insight in result["insights"]))
        self.assertEqual(result["summary"]["novo"], result["summary"]["total"])

    def test_updates_persisted_insight_status(self) -> None:
        repository = FakeAnalyticsRepository()
        generated = generate_and_persist_operational_insights(repository, import_id=2)
        insight_id = generated["insights"][0]["id"]

        updated, before = update_operational_insight_status(
            repository,
            insight_id=insight_id,
            status="revisado",
            user="sistema",
        )

        self.assertEqual(before["status"], "novo")
        self.assertEqual(updated["status"], "revisado")
        self.assertEqual(updated["reviewUser"], "sistema")


if __name__ == "__main__":
    unittest.main()
