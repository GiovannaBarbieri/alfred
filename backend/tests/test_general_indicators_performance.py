from __future__ import annotations

import unittest
from datetime import date, datetime
from unittest.mock import ANY, MagicMock, patch

from app.api.routes.general_indicators import router
from app.services.general_indicators_service import (
    create_general_indicator_validation,
    get_general_indicator_consultation_snapshot,
    paginate_finalized_general_indicator_response,
    paginate_general_indicator_response,
)
from app.services.sqlserver_service import (
    _GENERAL_INDICATOR_RAW_LAUNCHES_BY_IDS_QUERY,
    _GENERAL_INDICATOR_RAW_LAUNCHES_QUERY,
    _TFS_INDICATOR_ITEMS_QUERY,
    _TFS_TASK_HIERARCHIES_QUERY,
)


class GeneralIndicatorPerformanceTests(unittest.TestCase):
    @patch("app.services.general_indicators_service.update_general_indicator_consultation_progress")
    @patch("app.services.general_indicators_service.create_general_indicator_consultation", return_value=77)
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_async_creation_returns_before_querying_tfs(self, _connection, create, progress) -> None:
        result = create_general_indicator_validation(
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )

        self.assertEqual(result["consultationId"], 77)
        self.assertEqual(result["status"], "CONSULTANDO")
        self.assertEqual(result["progress"]["percentage"], 0)
        create.assert_called_once()
        progress.assert_called_once()

    def test_consultation_payload_is_paginated(self) -> None:
        payload = {"launches": [{"idLancamento": str(index)} for index in range(25_000)]}

        page = paginate_general_indicator_response(payload, page=125, page_size=100)

        self.assertEqual(len(page["launches"]), 100)
        self.assertEqual(page["launches"][0]["idLancamento"], "12400")
        self.assertEqual(page["pagination"]["totalPages"], 250)

    def test_final_audit_is_paginated(self) -> None:
        payload = {"audit": [{"idLancamento": str(index)} for index in range(205)]}

        page = paginate_finalized_general_indicator_response(payload, page=3, page_size=100)

        self.assertEqual(len(page["audit"]), 5)
        self.assertEqual(page["auditPagination"]["totalItems"], 205)

    @patch("app.services.general_indicators_service.get_general_indicator_consultation")
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_polling_returns_persisted_progress_while_processing(self, _connection, get_consultation) -> None:
        get_consultation.return_value = {
            "id": 77,
            "status": "CONSULTANDO",
            "data_inicial": date(2026, 1, 1),
            "data_final": date(2026, 12, 31),
            "resumo": {"processing": {"stage": "features", "percentage": 65}},
            "mensagem_erro": None,
        }

        result = get_general_indicator_consultation_snapshot(77)

        self.assertEqual(result["status"], "CONSULTANDO")
        self.assertEqual(result["progress"]["percentage"], 65)

    @patch("app.services.general_indicators_service.list_active_general_indicator_inconsistencies", return_value=[])
    @patch("app.services.general_indicators_service.list_general_indicator_launches_page")
    @patch("app.services.general_indicators_service.get_general_indicator_consultation")
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_completed_poll_loads_only_requested_page(self, _connection, get_consultation, list_page, _issues) -> None:
        get_consultation.return_value = {
            "id": 77,
            "status": "PRONTA_PARA_FINALIZAR",
            "data_inicial": date(2026, 1, 1),
            "data_final": date(2026, 12, 31),
            "resumo": {"uniqueLaunchCount": 250},
            "ultima_validacao_em": datetime(2026, 7, 21, 10, 0),
        }
        list_page.return_value = [{"idLancamento": str(index)} for index in range(100, 200)]

        result = get_general_indicator_consultation_snapshot(77, page=2, page_size=100)

        list_page.assert_called_once_with(ANY, 77, offset=100, limit=100)
        self.assertEqual(result["pagination"]["totalPages"], 3)
        self.assertEqual(len(result["launches"]), 100)

    def test_official_queries_do_not_use_dirty_reads(self) -> None:
        for query in (
            _GENERAL_INDICATOR_RAW_LAUNCHES_QUERY,
            _GENERAL_INDICATOR_RAW_LAUNCHES_BY_IDS_QUERY,
            _TFS_TASK_HIERARCHIES_QUERY,
            _TFS_INDICATOR_ITEMS_QUERY,
        ):
            self.assertNotIn("NOLOCK", query.upper())

    def test_async_and_audit_endpoints_are_registered(self) -> None:
        paths = {(method, route.path) for route in router.routes for method in route.methods}
        self.assertIn(("POST", "/consultations"), paths)
        self.assertIn(("GET", "/consultations/{consultation_id}"), paths)
        self.assertIn(("GET", "/consultations/{consultation_id}/audit"), paths)


if __name__ == "__main__":
    unittest.main()
