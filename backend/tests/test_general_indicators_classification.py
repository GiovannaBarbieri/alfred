from __future__ import annotations

import unittest
from datetime import date

from app.services.general_indicators_classification import classify_general_indicator_launches


class GeneralIndicatorsClassificationTests(unittest.TestCase):
    def test_two_distinct_launches_in_same_task_are_preserved(self) -> None:
        result = classify([launch(1, 401), launch(2, 401)], [hierarchy(401, 301, "Product Backlog Item", 200)])

        self.assertEqual(result["summary"]["uniqueLaunchCount"], 2)
        self.assertEqual([item["idLancamento"] for item in result["launches"]], ["1", "2"])

    def test_multiple_tasks_in_same_pbi_are_preserved(self) -> None:
        result = classify(
            [launch(1, 401), launch(2, 402)],
            [hierarchy(401, 301, "Product Backlog Item", 200), hierarchy(402, 301, "Product Backlog Item", 200)],
        )

        self.assertEqual(result["summary"]["uniqueLaunchCount"], 2)
        self.assertEqual({item["idParent"] for item in result["launches"]}, {"301"})

    def test_multiple_pbis_in_same_feature_use_feature_tag_two(self) -> None:
        result = classify(
            [launch(1, 401), launch(2, 402)],
            [hierarchy(401, 301, "PBI", 200), hierarchy(402, 302, "Product Backlog Item", 200)],
        )

        self.assertEqual([item["finalCategory"] for item in result["launches"]], ["Melhoria", "Melhoria"])

    def test_multiple_bugs_in_same_feature_remain_independent(self) -> None:
        result = classify(
            [launch(1, 401), launch(2, 402)],
            [hierarchy(401, 350, "Bug", 200), hierarchy(402, 351, "Bug", 200)],
        )

        self.assertEqual([item["finalCategory"] for item in result["launches"]], ["Bug", "Bug"])

    def test_pbi_and_bug_can_coexist_in_same_feature(self) -> None:
        result = classify(
            [launch(1, 401, "0d 03:00:00"), launch(2, 450, "0d 04:00:00")],
            [hierarchy(401, 301, "PBI", 200), hierarchy(450, 350, "Bug", 200)],
        )

        self.assertEqual(result["launches"][0]["finalCategory"], "Melhoria")
        self.assertEqual(result["launches"][1]["finalCategory"], "Bug")
        self.assertEqual(sum(item["durationHours"] for item in result["launches"]), 7.0)

    def test_pbi_launch_is_classified_by_feature_tag_two(self) -> None:
        item = classify([launch(1, 401)], [hierarchy(401, 301, "Product Backlog Item", 200)])["launches"][0]

        self.assertEqual(item["finalCategory"], "Melhoria")
        self.assertEqual(item["trace"]["classificationSource"], "feature_tag_2")

    def test_bug_launch_is_classified_by_parent_type(self) -> None:
        item = classify([launch(1, 401)], [hierarchy(401, 350, "Bug", 200)])["launches"][0]

        self.assertTrue(item["isBug"])
        self.assertEqual(item["finalCategory"], "Bug")
        self.assertEqual(item["trace"]["classificationSource"], "parent_work_item_type")

    def test_real_bug_hierarchy_example_preserves_launches_and_traceability(self) -> None:
        bug_hierarchy = hierarchy(148871, 148793, "Bug", 145742)
        bug_hierarchy.update(
            {
                "TaskTitle": "Corrigindo Falhas na Gravação de Dados no Banco",
                "ParentTitle": "[Backend] POST core/v1/Orgao-dien - Corrigir órgão",
                "FeatureTitle": "[PD] Incluir opção de cadastro",
                "IdEpic": 140000,
                "EpicWorkItemType": "Epic",
                "EpicTitle": "Produto",
            }
        )

        result = classify([launch(9001, 148871), launch(9002, 148871)], [bug_hierarchy])

        self.assertEqual([item["idLancamento"] for item in result["launches"]], ["9001", "9002"])
        self.assertEqual([item["finalCategory"] for item in result["launches"]], ["Bug", "Bug"])
        self.assertEqual(result["launches"][0]["idParent"], "148793")
        self.assertEqual(result["launches"][0]["parentWorkItemType"], "Bug")
        self.assertEqual(result["launches"][0]["trace"]["hierarchy"]["feature"]["id"], "145742")
        self.assertEqual(
            result["launches"][0]["trace"]["hierarchy"]["task"]["title"],
            "Corrigindo Falhas na Gravação de Dados no Banco",
        )

    def test_update_system_marks_pbi_but_never_bug(self) -> None:
        result = classify(
            [launch(1, 401), launch(2, 450)],
            [hierarchy(401, 301, "PBI", 200), hierarchy(450, 350, "Bug", 200)],
            tags="1-Atualização do sistema; 2-Melhoria; 3-Produtos",
        )

        self.assertTrue(result["launches"][0]["isUpdateSystem"])
        self.assertFalse(result["launches"][1]["isUpdateSystem"])
        self.assertEqual(result["launches"][1]["finalCategory"], "Bug")
        self.assertNotIn("kpis", result)

    def test_database_and_spider_modules_do_not_enter_update_system_distribution(self) -> None:
        for module_tag in ("1-Banco de dados", "1-Spider Processos"):
            with self.subTest(module_tag=module_tag):
                item = classify(
                    [launch(1, 401)],
                    [hierarchy(401, 301, "PBI", 200)],
                    tags=f"{module_tag}; 2-Melhoria; 3-Produtos",
                )["launches"][0]

                self.assertFalse(item["isUpdateSystem"])
                self.assertEqual(item["finalCategory"], "Melhoria")

    def test_duplicate_launch_id_is_kept_once_with_source_evidence(self) -> None:
        result = classify(
            [launch(1, 401, "0d 01:00:00"), launch(1, 401, "0d 02:00:00")],
            [hierarchy(401, 301, "PBI", 200)],
        )

        self.assertEqual(result["summary"]["sourceRowCount"], 2)
        self.assertEqual(result["summary"]["uniqueLaunchCount"], 1)
        self.assertTrue(result["diagnostics"]["duplicates"][0]["conflict"])
        self.assertEqual(len(result["diagnostics"]["duplicates"][0]["sourceRows"]), 2)
        self.assertEqual(result["launches"][0]["trace"]["sourceOccurrenceCount"], 2)
        self.assertEqual(len(result["launches"][0]["trace"]["duplicateSourceRows"]), 2)

    def test_repeated_sql_hierarchy_rows_do_not_duplicate_launch(self) -> None:
        repeated = hierarchy(401, 301, "PBI", 200)
        result = classify([launch(1, 401)], [repeated, dict(repeated)])

        self.assertEqual(result["summary"]["uniqueLaunchCount"], 1)
        self.assertEqual(result["launches"][0]["classificationState"], "classified")
        self.assertEqual(result["launches"][0]["trace"]["hierarchyCandidateCount"], 1)

    def test_missing_parent_is_preserved_for_later_validation(self) -> None:
        result = classify([launch(1, 401)], [hierarchy(401, None, None, None)])
        item = result["launches"][0]

        self.assertEqual(item["classificationState"], "parent_pending")
        self.assertEqual(item["validationState"], "pending")
        self.assertIsNone(item["finalCategory"])

    def test_missing_feature_is_preserved_for_later_validation(self) -> None:
        result = classify([launch(1, 401)], [hierarchy(401, 301, "PBI", None)], features=[])
        item = result["launches"][0]

        self.assertEqual(item["classificationState"], "feature_pending")
        self.assertEqual(item["validationState"], "pending")
        self.assertIsNone(item["finalCategory"])

    def test_non_feature_candidate_is_not_exposed_or_used_for_tags(self) -> None:
        wrong_hierarchy = hierarchy(401, 301, "PBI", 188157)
        wrong_hierarchy.update(
            {
                "FeatureWorkItemType": "Product Backlog Item",
                "FeatureTitle": "PBI incorretamente posicionado",
            }
        )
        result = classify(
            [launch(1, 401)],
            [wrong_hierarchy],
            features=[
                {
                    "ID": 188157,
                    "WorkItemType": "Product Backlog Item",
                    "Tags": "1-Mobile; 2-Melhoria; 3-Produtos",
                }
            ],
        )
        item = result["launches"][0]

        self.assertEqual(item["classificationState"], "feature_type_invalid")
        self.assertIsNone(item["idFeature"])
        self.assertIsNone(item["featureTitle"])
        self.assertIsNone(item["finalCategory"])
        self.assertIsNone(item["trace"]["featureTagsSourceId"])
        self.assertEqual(item["trace"]["featureCandidateId"], "188157")

    def test_real_pbi_188157_resolves_to_feature_186550_and_maintenance(self) -> None:
        real_hierarchy = hierarchy(190682, 188157, "Product Backlog Item", 186550)
        real_hierarchy.update(
            {
                "ParentTitle": "[Homologação] [CM] [ANALISE] [APP] [HUB] Beatriz Pestana Pangoni",
                "ParentDepth": 2,
                "FeatureTitle": "82140 - [CM] [ANALISE] [APP] [HUB] Beatriz Pestana Pangoni",
            }
        )
        result = classify(
            [launch(274116, 190682)],
            [real_hierarchy],
            tags="1-Mobile - Advise Hub; 2-Manutenção; 3-Comercial",
        )
        item = result["launches"][0]

        self.assertEqual(item["parentItemId"], "188157")
        self.assertEqual(item["featureId"], "186550")
        self.assertEqual(item["finalCategory"], "Manutenção")
        self.assertEqual(item["trace"]["featureTagsSourceId"], "186550")
        self.assertEqual(item["trace"]["hierarchy"]["parent"]["depth"], 2)

    def test_disregards_launch_when_any_resolved_work_item_state_is_removed(self) -> None:
        scenarios = [
            ("task", {"TaskState": "Removed"}, "Task"),
            ("pbi", {"ParentState": "Removed"}, "PBI/Bug"),
            ("bug", {"ParentWorkItemType": "Bug", "ParentState": "Removed"}, "PBI/Bug"),
            ("feature", {"FeatureState": "Removed"}, "Feature"),
            ("epic", {"EpicState": "Removed"}, "Epic"),
        ]

        for name, updates, level in scenarios:
            with self.subTest(name=name):
                row = hierarchy(401, 301, "PBI", 200)
                row.update(updates)
                result = classify([launch(1, 401)], [row])
                item = result["launches"][0]

                self.assertTrue(item["disregardedFromGeneralIndicators"])
                self.assertTrue(item["removedByWorkItemState"])
                self.assertEqual(item["workItemRemovedReason"], "work_item_removed")
                self.assertIn("work_item_removed", item["disregardedReasons"])
                self.assertEqual(item["removedWorkItems"][0]["level"], level)
                self.assertEqual(result["summary"]["consideredLaunchCount"], 0)
                self.assertEqual(result["summary"]["removedLaunchCount"], 1)
                self.assertEqual(result["summary"]["removedHours"], 1.0)

    def test_removed_state_is_normalized_and_null_state_is_ignored(self) -> None:
        removed = hierarchy(401, 301, "PBI", 200)
        removed["ParentState"] = " REMOVED "
        clean = hierarchy(402, 302, "PBI", 201)
        clean["ParentState"] = None

        result = classify([launch(1, 401), launch(2, 402)], [removed, clean])

        self.assertTrue(result["launches"][0]["removedByWorkItemState"])
        self.assertFalse(result["launches"][1]["removedByWorkItemState"])
        self.assertFalse(result["launches"][1]["disregardedFromGeneralIndicators"])
        self.assertEqual(result["summary"]["consideredLaunchCount"], 1)

    def test_multiple_removed_levels_disregard_launch_once_with_full_audit(self) -> None:
        row = hierarchy(401, 301, "PBI", 200)
        row.update({"TaskState": "Removed", "ParentState": "removed", "FeatureState": " REMOVED ", "EpicState": "Removed"})

        result = classify([launch(1, 401)], [row])
        item = result["launches"][0]

        self.assertEqual(result["summary"]["uniqueLaunchCount"], 1)
        self.assertEqual(result["summary"]["removedLaunchCount"], 1)
        self.assertEqual(result["summary"]["disregardedLaunchCount"], 1)
        self.assertEqual([level["level"] for level in item["removedWorkItems"]], ["Task", "PBI/Bug", "Feature", "Epic"])

    def test_partial_hierarchy_without_removed_keeps_existing_pending_behavior(self) -> None:
        result = classify([launch(1, 401)], [hierarchy(401, None, None, None)])
        item = result["launches"][0]

        self.assertFalse(item["removedByWorkItemState"])
        self.assertFalse(item["disregardedFromGeneralIndicators"])
        self.assertEqual(item["classificationState"], "parent_pending")

    def test_duplicate_launch_id_with_removed_is_counted_once(self) -> None:
        row = hierarchy(401, 301, "PBI", 200)
        row["TaskState"] = "Removed"

        result = classify([launch(1, 401), launch(1, 401)], [row])

        self.assertEqual(result["summary"]["sourceRowCount"], 2)
        self.assertEqual(result["summary"]["uniqueLaunchCount"], 1)
        self.assertEqual(result["summary"]["removedLaunchCount"], 1)
        self.assertEqual(result["summary"]["removedHours"], 1.0)


def classify(launches, hierarchies, *, tags="1-Mobile; 2-Melhoria; 3-Produtos", features=None):
    if features is None:
        feature_ids = {row["IdFeat"] for row in hierarchies if row.get("IdFeat") is not None}
        features = [{"ID": feature_id, "WorkItemType": "Feature", "Tags": tags} for feature_id in feature_ids]
    return classify_general_indicator_launches(
        launches,
        hierarchies,
        features,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )


def launch(launch_id, task_id, duration="0d 01:00:00"):
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
        "TaskState": "Done",
        "IdParent": parent_id,
        "ParentWorkItemType": parent_type,
        "ParentState": "Done" if parent_id else None,
        "IdFeat": feature_id,
        "FeatureWorkItemType": "Feature" if feature_id else None,
        "FeatureState": "Done" if feature_id else None,
        "IdEpic": 100 if feature_id else None,
        "EpicState": "Done" if feature_id else None,
    }


if __name__ == "__main__":
    unittest.main()
