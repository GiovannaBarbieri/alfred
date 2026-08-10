from __future__ import annotations

import unittest
from contextlib import ExitStack
from datetime import date
from unittest.mock import MagicMock, patch

from app.services.general_indicators_classification import classify_general_indicator_launches
from app.services.general_indicators_service import (
    GeneralIndicatorConcurrentUpdateError,
    GeneralIndicatorConfirmationRequiredError,
    refresh_full_general_indicator_consultation,
    refresh_general_indicator_pendings,
)
from app.services.general_indicators_validation import validate_general_indicator_consultation


class GeneralIndicatorSelectiveUpdateTests(unittest.TestCase):
    def test_01_corrects_missing_tag(self) -> None:
        initial = validated([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)], "1-Mobile; 3-Produtos")
        initial_types = {item["type"] for item in initial["inconsistencies"]["items"]}
        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)])

        self.assertEqual(initial_types, {"tag_2_missing", "classification_impossible"})
        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")
        self.assertEqual(result["launches"][0]["validatedCategory"], "Melhoria")
        self.assertFalse(result["inconsistencies"]["items"])
        self.assertEqual(result["updateSummary"]["resolvedPendingCount"], initial["summary"]["blockingInconsistencyCount"])

    def test_02_corrects_category_outside_official_list(self) -> None:
        initial = validated(
            [launch(1, 401)],
            [hierarchy(401, 301, "PBI", 200)],
            "1-Mobile; 2-Categoria inventada; 3-Produtos",
        )
        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)])

        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")
        self.assertEqual(result["launches"][0]["validatedCategory"], "Melhoria")

    def test_03_feature_with_pbis_and_bugs_preserves_each_launch_and_real_type(self) -> None:
        rows = [launch(1, 401), launch(2, 402), launch(3, 450), launch(4, 451)]
        paths = [
            hierarchy(401, 301, "PBI", 200),
            hierarchy(402, 302, "PBI", 200),
            hierarchy(450, 350, "Bug", 200),
            hierarchy(451, 351, "Bug", 200),
        ]
        initial = validated(rows, paths, "1-Mobile; 2-Manutenção")
        result, _ = run_selective(initial, features=[feature(200, "1-Mobile; 2-Manutenção; 3-Produtos")], hierarchies=paths)

        self.assertEqual(len(result["launches"]), 4)
        self.assertEqual([item["validatedCategory"] for item in result["launches"]], ["Manutenção", "Manutenção", "Bug", "Bug"])
        self.assertEqual({item["idLancamento"] for item in result["launches"]}, {"1", "2", "3", "4"})

    def test_04_requeries_feature_once_and_revalidates_all_affected_launches(self) -> None:
        rows = [launch(1, 401), launch(2, 402), launch(3, 403)]
        paths = [hierarchy(401, 301, "PBI", 200), hierarchy(402, 302, "PBI", 200), hierarchy(403, 303, "PBI", 200)]
        initial = validated(rows, paths, "1-Mobile; 3-Produtos")
        result, mocks = run_selective(initial, features=[feature(200, VALID_TAGS)], hierarchies=paths)

        mocks["features"].assert_called_once_with([200])
        self.assertEqual(result["updateSummary"]["requeriedFeatureCount"], 1)
        self.assertEqual(result["updateSummary"]["revalidatedLaunchCount"], 3)

    def test_05_keeps_unresolved_pending_and_state(self) -> None:
        initial = validated([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)], "1-Mobile; 3-Produtos")
        result, _ = run_selective(initial, features=[feature(200, "1-Mobile; 3-Produtos")])

        self.assertEqual(result["status"], "COM_INCONSISTENCIAS")
        self.assertEqual(result["updateSummary"]["resolvedPendingCount"], 0)
        self.assertEqual(result["updateSummary"]["remainingPendingCount"], initial["summary"]["blockingInconsistencyCount"])

    def test_06_changes_to_ready_when_all_pendings_are_resolved(self) -> None:
        initial = validated([launch(1, 401), launch(2, 402)], [hierarchy(401, 301, "PBI", 200), hierarchy(402, 350, "Bug", 200)], "1-Mobile; 2-Melhoria")
        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)])

        self.assertTrue(result["canFinalize"])
        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")
        self.assertFalse(result["inconsistencies"]["items"])

    def test_07_update_without_pendings_does_not_query_tfs(self) -> None:
        initial = validated([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)], VALID_TAGS)
        result, mocks = run_selective(initial)

        mocks["raw"].assert_not_called()
        mocks["hierarchies"].assert_not_called()
        mocks["features"].assert_not_called()
        self.assertEqual(result["updateSummary"]["revalidatedLaunchCount"], 0)
        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")

    def test_duplicate_source_rows_survive_tag_only_selective_update(self) -> None:
        row = launch(1, 401)
        initial = validated([row, dict(row)], [hierarchy(401, 301, "PBI", 200)], "1-Mobile; 3-Produtos")

        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)])

        duplicate = next(
            issue for issue in result["inconsistencies"]["items"]
            if issue["type"] == "duplicate_id_identical"
        )
        self.assertEqual(len(duplicate["details"]["sourceRows"]), 2)
        self.assertEqual(len(result["launches"][0]["trace"]["duplicateSourceRows"]), 2)

    def test_08_sql_or_tfs_failure_restores_previous_execution(self) -> None:
        initial = validated([launch(1, 401, duration="inválida")], [hierarchy(401, 301, "PBI", 200)], VALID_TAGS)
        mocks = {}
        with self.assertRaisesRegex(RuntimeError, "TFS indisponível"):
            run_selective(initial, raw_error=RuntimeError("TFS indisponível"), captured=mocks)

        self.assertTrue(mocks["fail"].called)
        mocks["save"].assert_not_called()

    def test_09_rejects_two_simultaneous_updates(self) -> None:
        with patch(
            "app.services.general_indicators_service._begin_update",
            side_effect=GeneralIndicatorConcurrentUpdateError("em andamento"),
        ):
            with self.assertRaises(GeneralIndicatorConcurrentUpdateError):
                refresh_general_indicator_pendings(77)

    def test_10_redoes_complete_consultation_only_after_confirmation(self) -> None:
        initial = validated([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)], VALID_TAGS)
        with self.assertRaises(GeneralIndicatorConfirmationRequiredError):
            refresh_full_general_indicator_consultation(77, confirmed=False)
        context = MagicMock()
        with ExitStack() as stack:
            stack.enter_context(patch("app.services.general_indicators_service._begin_update", return_value=lock(0)))
            stack.enter_context(patch("app.services.general_indicators_service._load_update_context", return_value=(consultation(initial), initial["launches"], [])))
            full = stack.enter_context(patch("app.services.general_indicators_service.consult_general_indicator_launches", return_value=classified([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)], VALID_TAGS)))
            stack.enter_context(patch("app.services.general_indicators_service.get_connection", return_value=context))
            save = stack.enter_context(patch("app.services.general_indicators_service.save_general_indicator_validation"))
            stack.enter_context(patch("app.services.general_indicators_service.complete_general_indicator_update"))
            stack.enter_context(patch("app.services.general_indicators_service.target_configuration_for_period", return_value=None))

            result = refresh_full_general_indicator_consultation(77, confirmed=True)

        full.assert_called_once_with(start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        save.assert_called_once()
        self.assertEqual(result["updateSummary"]["type"], "COMPLETA")

    def test_11_preserves_unaffected_valid_launches(self) -> None:
        rows = [launch(1, 401), launch(2, 402)]
        paths = [hierarchy(401, 301, "PBI", 200), hierarchy(402, 302, "PBI", 201)]
        base = classified(rows, paths, VALID_TAGS, feature_tags={200: "1-Mobile; 3-Produtos", 201: VALID_TAGS})
        initial = validate_general_indicator_consultation(base)
        unaffected_before = next(item for item in initial["launches"] if item["idLancamento"] == "2")

        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)], hierarchies=[paths[0]])
        unaffected_after = next(item for item in result["launches"] if item["idLancamento"] == "2")

        self.assertEqual(unaffected_after, unaffected_before)
        self.assertEqual(result["summary"]["uniqueLaunchCount"], 2)

    def test_12_ready_for_finalization_does_not_finalize_or_calculate_kpis(self) -> None:
        initial = validated([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)], "1-Mobile; 3-Produtos")
        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)])

        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")
        self.assertEqual(result["nextStage"], "finalization")
        self.assertNotEqual(result["status"], "FINALIZADA")
        self.assertNotIn("kpis", result)

    def test_duration_issue_requeries_only_affected_launch(self) -> None:
        initial = validated([launch(1, 401, duration="inválida")], [hierarchy(401, 301, "PBI", 200)], VALID_TAGS)
        corrected = launch(1, 401, duration="0d 02:00:00")

        result, mocks = run_selective(initial, features=[feature(200, VALID_TAGS)], raw_rows=[corrected])

        mocks["raw"].assert_called_once_with([1])
        self.assertEqual(result["launches"][0]["durationHours"], 2.0)
        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")

    def test_conflicting_duplicate_is_not_silently_collapsed_during_refresh(self) -> None:
        first = launch(1, 401, duration="0d 01:00:00")
        second = launch(1, 401, duration="0d 02:00:00")
        initial = validated([first, second], [hierarchy(401, 301, "PBI", 200)], VALID_TAGS)

        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)], raw_rows=[first, second])

        self.assertEqual(result["summary"]["uniqueLaunchCount"], 1)
        self.assertEqual(result["status"], "COM_INCONSISTENCIAS")
        self.assertIn("duplicate_id_conflict", result["summary"]["inconsistencyCountsByType"])

    def test_selective_update_preserves_nonparticipation_snapshot(self) -> None:
        base = classify_general_indicator_launches(
            [launch(1, 401), {**launch(2, 402), "LoginUsuario": "fora"}],
            [hierarchy(401, 301, "PBI", 200), hierarchy(402, 302, "PBI", 201)],
            [feature(200, "1-Mobile; 3-Produtos"), feature(201, VALID_TAGS)],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            nonparticipating_logins={"fora"},
        )
        initial = validate_general_indicator_consultation(base)

        result, _ = run_selective(initial, features=[feature(200, VALID_TAGS)], hierarchies=[hierarchy(401, 301, "PBI", 200)])
        excluded = next(item for item in result["launches"] if item["idLancamento"] == "2")

        self.assertTrue(excluded["disregardedFromGeneralIndicators"])
        self.assertFalse(excluded["eligibleForOfficialCalculation"])
        self.assertEqual(result["summary"]["disregardedLaunchCount"], 1)


VALID_TAGS = "1-Mobile; 2-Melhoria; 3-Produtos"


def run_selective(initial, *, features=None, hierarchies=None, raw_rows=None, raw_error=None, captured=None):
    open_issues = [item for item in initial["inconsistencies"]["items"] if item["blocking"]]
    context = MagicMock()
    mocks = {}
    try:
        with ExitStack() as stack:
            stack.enter_context(patch("app.services.general_indicators_service._begin_update", return_value=lock(len(open_issues))))
            stack.enter_context(
                patch(
                    "app.services.general_indicators_service._load_update_context",
                    return_value=(consultation(initial), initial["launches"], open_issues),
                )
            )
            mocks["raw"] = stack.enter_context(patch("app.services.general_indicators_service.query_general_indicator_raw_launches_by_ids"))
            mocks["raw"].return_value = raw_rows or []
            if raw_error is not None:
                mocks["raw"].side_effect = raw_error
            mocks["hierarchies"] = stack.enter_context(patch("app.services.general_indicators_service.query_tfs_task_hierarchies", return_value=hierarchies or default_hierarchies(initial)))
            mocks["features"] = stack.enter_context(patch("app.services.general_indicators_service.query_tfs_indicator_items", return_value=features or []))
            stack.enter_context(patch("app.services.general_indicators_service.get_connection", return_value=context))
            mocks["save"] = stack.enter_context(patch("app.services.general_indicators_service.save_general_indicator_validation"))
            stack.enter_context(patch("app.services.general_indicators_service.complete_general_indicator_update"))
            mocks["fail"] = stack.enter_context(patch("app.services.general_indicators_service._fail_update"))
            if captured is not None:
                captured.update(mocks)
            return refresh_general_indicator_pendings(77), mocks
    except Exception:
        raise


def classified(rows, paths, tags, *, feature_tags=None):
    ids = {row["IdFeat"] for row in paths if row.get("IdFeat") is not None}
    features = [feature(item_id, (feature_tags or {}).get(item_id, tags)) for item_id in ids]
    return classify_general_indicator_launches(rows, paths, features, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))


def validated(rows, paths, tags):
    return validate_general_indicator_consultation(classified(rows, paths, tags))


def consultation(initial):
    return {
        "id": 77,
        "data_inicial": date(2026, 1, 1),
        "data_final": date(2026, 12, 31),
        "status": initial["status"],
        "resumo": initial["summary"],
    }


def default_hierarchies(initial):
    return [
        hierarchy(
            int(item["idTask"]),
            int(item["idParent"]) if item.get("idParent") else None,
            item.get("parentWorkItemType"),
            int(item["idFeature"]) if item.get("idFeature") else None,
        )
        for item in initial["launches"]
    ]


def lock(pending):
    return {"acquired": True, "updateId": 9, "previousStatus": "COM_INCONSISTENCIAS", "pendingBefore": pending}


def launch(launch_id, task_id, *, duration="0d 01:00:00"):
    return {
        "IdLancamento": launch_id,
        "DataHoraCadastro": "2026-03-10 09:00:00",
        "TempoDuracao": duration,
        "LoginUsuario": "usuario",
        "IdTask": task_id,
    }


def hierarchy(task_id, parent_id, parent_type, feature_id):
    return {
        "IdTask": task_id,
        "TaskWorkItemType": "Task",
        "IdParent": parent_id,
        "ParentWorkItemType": parent_type,
        "IdFeat": feature_id,
        "FeatureWorkItemType": "Feature" if feature_id else None,
        "IdEpic": 100 if feature_id else None,
    }


def feature(feature_id, tags):
    return {"ID": feature_id, "WorkItemType": "Feature", "Tags": tags}


if __name__ == "__main__":
    unittest.main()
