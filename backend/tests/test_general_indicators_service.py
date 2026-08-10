from __future__ import annotations

import unittest
from datetime import date
from unittest.mock import MagicMock, patch

from app.services.general_indicators_service import consult_general_indicator_launches, run_general_indicator_validation


class GeneralIndicatorsServiceTests(unittest.TestCase):
    @patch("app.services.general_indicators_service.save_general_indicator_validation")
    @patch("app.services.general_indicators_service.create_general_indicator_consultation", return_value=77)
    @patch("app.services.general_indicators_service.validate_general_indicator_consultation")
    @patch("app.services.general_indicators_service.consult_general_indicator_launches")
    @patch("app.services.general_indicators_service.get_connection")
    def test_validation_flow_persists_state_and_result(
        self,
        get_connection,
        consult_launches,
        validate_consultation,
        create_consultation,
        save_validation,
    ) -> None:
        first_context = MagicMock()
        second_context = MagicMock()
        third_context = MagicMock()
        first_connection = first_context.__enter__.return_value
        third_connection = third_context.__enter__.return_value
        get_connection.side_effect = [first_context, second_context, third_context]
        consult_launches.return_value = {"stage": "consultation_classified"}
        validate_consultation.return_value = {
            "stage": "validation_completed",
            "status": "PRONTA_PARA_FINALIZAR",
            "summary": {},
        }

        with patch("app.services.general_indicators_service.target_configuration_for_period", return_value=None):
            result = run_general_indicator_validation(start_date=date(2026, 1, 1), end_date=date(2026, 3, 31))

        self.assertEqual(result["consultationId"], 77)
        create_consultation.assert_called_once_with(
            first_connection,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
        )
        save_validation.assert_called_once_with(third_connection, 77, result)

    @patch("app.services.general_indicators_service.list_general_indicator_modules", return_value=[])
    @patch("app.services.general_indicators_service.list_nonparticipating_general_indicator_logins", return_value={"fora"})
    @patch("app.services.general_indicators_service.classify_general_indicator_launches")
    @patch("app.services.general_indicators_service.query_tfs_indicator_items")
    @patch("app.services.general_indicators_service.query_tfs_task_hierarchies")
    @patch("app.services.general_indicators_service.query_general_indicator_raw_launches")
    def test_consultation_queries_unique_tasks_and_features_in_batches(
        self,
        query_launches,
        query_hierarchies,
        query_features,
        classify_launches,
        _list_nonparticipants,
        _list_modules,
    ) -> None:
        launches = [
            {"IdLancamento": 1, "IdTask": 401},
            {"IdLancamento": 2, "IdTask": 401},
            {"IdLancamento": 3, "IdTask": 402},
        ]
        hierarchies = [
            {"IdTask": 401, "IdParent": 301, "IdFeat": 200},
            {"IdTask": 402, "IdParent": 302, "IdFeat": 200},
        ]
        features = [{"ID": 200, "Tags": "1-Mobile; 2-Melhoria; 3-Produtos"}]
        query_launches.return_value = launches
        query_hierarchies.return_value = hierarchies
        query_features.return_value = features
        classify_launches.return_value = {"stage": "consultation_classified"}

        result = consult_general_indicator_launches(start_date=date(2026, 1, 1), end_date=date(2026, 3, 31))

        self.assertEqual(result["stage"], "consultation_classified")
        self.assertEqual(result["summary"]["performance"]["estimatedSqlServerQueryCount"], 3)
        query_hierarchies.assert_called_once_with([401, 402])
        query_features.assert_called_once_with([200])
        classify_launches.assert_called_once_with(
            launches,
            hierarchies,
            features,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            nonparticipating_logins={"fora"},
        )


if __name__ == "__main__":
    unittest.main()
