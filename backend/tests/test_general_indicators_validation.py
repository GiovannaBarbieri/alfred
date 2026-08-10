from __future__ import annotations

import unittest
from datetime import date

from app.services.general_indicators_classification import classify_general_indicator_launches
from app.services.general_indicators_validation import validate_general_indicator_consultation


class GeneralIndicatorsValidationTests(unittest.TestCase):
    def test_feature_without_tag_one_is_blocking(self) -> None:
        result = validate(tags="2-Melhoria; 3-Produtos")
        self.assert_blocking(result, "tag_1_missing")

    def test_feature_without_tag_two_is_blocking(self) -> None:
        result = validate(tags="1-Mobile; 3-Produtos")
        self.assert_blocking(result, "tag_2_missing")

    def test_feature_without_tag_three_is_blocking(self) -> None:
        result = validate(tags="1-Mobile; 2-Melhoria")
        self.assert_blocking(result, "tag_3_missing")

    def test_feature_with_two_tag_twos_does_not_choose_silently(self) -> None:
        result = validate(tags="1-Mobile; 2-Melhoria; 2-Manutenção; 3-Produtos")
        self.assert_blocking(result, "tag_2_multiple")
        self.assertIsNone(result["launches"][0]["validatedCategory"])

    def test_unregistered_category_preserves_original_text_and_blocks(self) -> None:
        result = validate(tags="1-Mobile; 2-Categoria inventada; 3-Produtos")
        issue = issue_by_type(result, "category_unrecognized")
        self.assertEqual(issue["originalText"], "Categoria inventada")
        self.assertTrue(issue["blocking"])

    def test_bug_feature_tags_are_still_mandatory(self) -> None:
        result = validate(tags="1-Mobile; 3-Produtos", parent_type="Bug")
        self.assertEqual(result["launches"][0]["finalCategory"], "Bug")
        self.assert_blocking(result, "tag_2_missing")

    def test_pbi_and_bug_from_same_feature_share_grouped_tag_issue(self) -> None:
        consultation = classify(
            [launch(1, 401), launch(2, 450)],
            [hierarchy(401, 301, "PBI", 200), hierarchy(450, 350, "Bug", 200)],
            tags="1-Mobile; 2-Melhoria",
        )
        result = validate_general_indicator_consultation(consultation)
        group = result["inconsistencies"]["byFeature"][0]

        self.assertEqual(set(group["affectedLaunchIds"]), {"1", "2"})
        self.assertEqual(issue_by_type(result, "tag_3_missing")["details"]["bugLaunchCount"], 1)
        self.assertEqual(issue_by_type(result, "tag_3_missing")["details"]["pbiLaunchCount"], 1)

    def test_identical_duplicate_is_automatically_treated(self) -> None:
        row = launch(1, 401)
        consultation = classify([row, dict(row)], [hierarchy(401, 301, "PBI", 200)])
        result = validate_general_indicator_consultation(consultation)

        issue = issue_by_type(result, "duplicate_id_identical")
        self.assertFalse(issue["blocking"])
        self.assertEqual(issue["status"], "TRATADA")
        self.assertTrue(result["canFinalize"])

    def test_conflicting_duplicate_is_blocking(self) -> None:
        consultation = classify(
            [launch(1, 401, duration="0d 01:00:00"), launch(1, 401, duration="0d 02:00:00")],
            [hierarchy(401, 301, "PBI", 200)],
        )
        result = validate_general_indicator_consultation(consultation)
        self.assert_blocking(result, "duplicate_id_conflict")

    def test_invalid_duration_is_blocking(self) -> None:
        result = validate(duration="inválida")
        self.assert_blocking(result, "duration_invalid")

    def test_missing_launch_id_is_blocking_and_excluded_from_valid_totals(self) -> None:
        consultation = classify([launch(None, 401)], [hierarchy(401, 301, "PBI", 200)])
        result = validate_general_indicator_consultation(consultation)

        self.assert_blocking(result, "launch_id_missing")
        self.assertEqual(result["launches"][0]["validationState"], "blocking")
        self.assertEqual(result["summary"]["validLaunchCount"], 0)

    def test_update_system_without_monthly_base_is_blocking_before_finalization(self) -> None:
        result = validate(tags="1-Atualização do sistema; 2-Melhoria; 3-Produtos")

        issue = issue_by_type(result, "distribution_impossible")
        self.assertTrue(issue["blocking"])
        self.assertEqual(issue["details"]["month"], "2026-03")
        self.assertFalse(result["canFinalize"])

    def test_update_system_with_monthly_base_can_be_finalized(self) -> None:
        consultation = classify(
            [launch(1, 401), launch(2, 402)],
            [hierarchy(401, 301, "PBI", 200), hierarchy(402, 302, "PBI", 201)],
            features=[
                {"ID": 200, "WorkItemType": "Feature", "Tags": "1-Atualização do sistema; 2-Melhoria; 3-Produtos"},
                {"ID": 201, "WorkItemType": "Feature", "Tags": "1-Mobile; 2-Manutenção; 3-Produtos"},
            ],
        )
        result = validate_general_indicator_consultation(consultation)

        self.assertFalse(any(item["type"] == "distribution_impossible" for item in result["inconsistencies"]["items"]))
        self.assertTrue(result["canFinalize"])

    def test_task_without_parent_is_blocking(self) -> None:
        consultation = classify([launch(1, 401)], [hierarchy(401, None, None, None)], features=[])
        result = validate_general_indicator_consultation(consultation)
        self.assert_blocking(result, "parent_not_found")

    def test_parent_without_feature_is_blocking(self) -> None:
        consultation = classify([launch(1, 401)], [hierarchy(401, 301, "PBI", None)], features=[])
        result = validate_general_indicator_consultation(consultation)
        self.assert_blocking(result, "feature_not_found")

    def test_fully_valid_consultation_is_ready_to_finalize(self) -> None:
        result = validate()
        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")
        self.assertTrue(result["canFinalize"])
        self.assertEqual(result["summary"]["validLaunchCount"], 1)
        self.assertEqual(result["summary"]["inconsistencyCount"], 0)

    def test_blocking_consultation_reports_affected_totals(self) -> None:
        result = validate(tags="1-Mobile; 3-Produtos", duration="0d 02:30:00")
        self.assertEqual(result["status"], "COM_INCONSISTENCIAS")
        self.assertEqual(result["summary"]["affectedLaunchCount"], 1)
        self.assertEqual(result["summary"]["affectedFeatureCount"], 1)
        self.assertEqual(result["summary"]["affectedHours"], 2.5)

    def test_finalization_is_blocked_while_blocking_issue_exists(self) -> None:
        result = validate(tags="1-Mobile; 2-Desconhecida; 3-Produtos")
        self.assertFalse(result["canFinalize"])
        self.assertGreater(result["summary"]["blockingInconsistencyCount"], 0)

    def test_empty_and_negative_durations_have_specific_types(self) -> None:
        self.assert_blocking(validate(duration=""), "duration_empty")
        self.assert_blocking(validate(duration="-0d 01:00:00"), "duration_negative")

    def test_date_outside_period_and_unsupported_parent_type_are_blocking(self) -> None:
        consultation = classify(
            [launch(1, 401, created="2025-12-31 09:00:00")],
            [hierarchy(401, 301, "Feature", 200)],
        )
        result = validate_general_indicator_consultation(consultation)
        self.assert_blocking(result, "date_outside_period")
        self.assert_blocking(result, "parent_type_unsupported")

    def test_tags_are_never_validated_on_a_non_feature_candidate(self) -> None:
        wrong_hierarchy = hierarchy(401, 301, "PBI", 188157)
        wrong_hierarchy["FeatureWorkItemType"] = "Product Backlog Item"
        consultation = classify(
            [launch(1, 401)],
            [wrong_hierarchy],
            features=[{"ID": 188157, "WorkItemType": "Product Backlog Item", "Tags": None}],
        )
        result = validate_general_indicator_consultation(consultation)
        issue_types = {item["type"] for item in result["inconsistencies"]["items"]}

        self.assertIn("feature_type_invalid", issue_types)
        self.assertFalse({"tag_1_missing", "tag_2_missing", "tag_3_missing"} & issue_types)
        self.assertIsNone(result["launches"][0]["idFeature"])

    def test_technical_category_normalization_is_recorded_without_blocking(self) -> None:
        result = validate(tags="1-Mobile; 2-melhoria; 3-Produtos")
        issue = issue_by_type(result, "category_normalized")
        self.assertFalse(issue["blocking"])
        self.assertEqual(result["launches"][0]["validatedCategory"], "Melhoria")
        self.assertTrue(result["canFinalize"])
        self.assertEqual(result["launches"][0]["auditIssues"][0]["type"], "category_normalized")
        self.assertTrue(result["launches"][0]["eligibleForOfficialCalculation"])

    def test_blocking_reason_is_persisted_on_the_affected_launch(self) -> None:
        result = validate(tags="1-Mobile; 3-Produtos")
        affected = result["launches"][0]

        self.assertFalse(affected["eligibleForOfficialCalculation"])
        self.assertIn("TAG obrigatória 2-", affected["exclusionReason"])
        self.assertIn("tag_2_missing", {issue["type"] for issue in affected["auditIssues"]})

    def test_invalid_upper_parent_relates_classification_as_derived_issue(self) -> None:
        wrong_hierarchy = hierarchy(401, 301, "PBI", 188157)
        wrong_hierarchy["FeatureWorkItemType"] = "Epic"
        result = validate_general_indicator_consultation(
            classify([launch(1, 401)], [wrong_hierarchy], features=[])
        )

        root = issue_by_type(result, "feature_type_invalid")
        derived = issue_by_type(result, "classification_impossible")
        self.assertTrue(root["details"]["isRootCause"])
        self.assertTrue(derived["details"]["isDerived"])
        self.assertEqual(derived["details"]["derivedFromType"], "feature_type_invalid")
        self.assertEqual(root["details"]["displayGroupKey"], derived["details"]["displayGroupKey"])
        self.assertEqual(result["summary"]["pendingCount"], 1)
        self.assertEqual(result["summary"]["blockingInconsistencyCount"], 2)

    def test_task_without_parent_relates_classification_as_consequence(self) -> None:
        result = validate_general_indicator_consultation(
            classify([launch(1, 401)], [hierarchy(401, None, None, None)], features=[])
        )

        derived = issue_by_type(result, "classification_impossible")
        self.assertEqual(derived["details"]["derivedFromType"], "parent_not_found")
        self.assertEqual(result["summary"]["pendingCount"], 1)

    def test_missing_tag_two_relates_classification_as_consequence(self) -> None:
        result = validate(tags="1-Mobile; 3-Produtos")

        derived = issue_by_type(result, "classification_impossible")
        self.assertEqual(derived["details"]["derivedFromType"], "tag_2_missing")
        self.assertEqual(result["summary"]["pendingCount"], 1)

    def test_invalid_category_relates_classification_as_consequence(self) -> None:
        result = validate(tags="1-Mobile; 2-Categoria inventada; 3-Produtos")

        derived = issue_by_type(result, "classification_impossible")
        self.assertEqual(derived["details"]["derivedFromType"], "category_unrecognized")
        self.assertEqual(result["summary"]["pendingCount"], 1)

    def test_root_cause_without_consequence_remains_single_operational_issue(self) -> None:
        result = validate(duration="inválida")

        self.assertEqual([item["type"] for item in result["inconsistencies"]["items"]], ["duration_invalid"])
        self.assertEqual(result["summary"]["pendingCount"], 1)

    def test_classification_without_known_cause_remains_visible_as_root(self) -> None:
        consultation = classify([launch(1, 401)], [hierarchy(401, 301, "PBI", 200)])
        consultation["launches"][0]["finalCategory"] = None
        consultation["launches"][0]["tag2"] = None
        result = validate_general_indicator_consultation(consultation)

        issue = issue_by_type(result, "classification_impossible")
        self.assertTrue(issue["details"]["isRootCause"])
        self.assertFalse(issue["details"]["isDerived"])
        self.assertEqual(result["summary"]["pendingCount"], 1)

    def test_independent_causes_on_same_launch_keep_distinct_display_groups(self) -> None:
        result = validate(tags="1-Mobile; 2-Melhoria", duration="inválida")
        roots = [item for item in result["inconsistencies"]["items"] if item["details"]["isRootCause"]]

        self.assertEqual({item["type"] for item in roots}, {"duration_invalid", "tag_3_missing"})
        self.assertEqual(len({item["details"]["displayGroupKey"] for item in roots}), 2)
        self.assertEqual(result["summary"]["pendingCount"], 2)

    def test_multiple_launches_with_same_hierarchy_cause_share_operational_group(self) -> None:
        wrong_hierarchy = hierarchy(401, 301, "PBI", 188157)
        wrong_hierarchy["FeatureWorkItemType"] = "Epic"
        result = validate_general_indicator_consultation(
            classify([launch(1, 401), launch(2, 401)], [wrong_hierarchy], features=[])
        )
        roots = [item for item in result["inconsistencies"]["items"] if item["type"] == "feature_type_invalid"]
        derived = [item for item in result["inconsistencies"]["items"] if item["type"] == "classification_impossible"]

        self.assertEqual(len(roots), 2)
        self.assertEqual(len(derived), 2)
        self.assertEqual(len({item["details"]["displayGroupKey"] for item in roots + derived}), 1)
        self.assertEqual(result["summary"]["pendingCount"], 1)
        self.assertEqual(result["summary"]["affectedLaunchCount"], 2)

    def test_derived_issue_relationship_is_preserved_in_launch_audit(self) -> None:
        result = validate(tags="1-Mobile; 3-Produtos")
        audit_issue = next(
            item for item in result["launches"][0]["auditIssues"]
            if item["type"] == "classification_impossible"
        )

        self.assertTrue(audit_issue["isDerived"])
        self.assertEqual(audit_issue["derivedFromType"], "tag_2_missing")
        self.assertTrue(audit_issue["rootCauseId"])
        self.assertTrue(audit_issue["displayGroupKey"])

    def test_removed_work_item_is_disregarded_without_blocking_inconsistency(self) -> None:
        row = hierarchy(401, 301, "PBI", 200)
        row["ParentState"] = "Removed"
        consultation = classify([launch(1, 401)], [row])

        result = validate_general_indicator_consultation(consultation)

        self.assertTrue(result["canFinalize"])
        self.assertEqual(result["status"], "PRONTA_PARA_FINALIZAR")
        self.assertEqual(result["summary"]["removedLaunchCount"], 1)
        self.assertEqual(result["summary"]["removedHours"], 1.0)
        self.assertEqual(result["summary"]["consideredLaunchCount"], 0)
        self.assertEqual(result["inconsistencies"]["items"], [])
        self.assertEqual(result["launches"][0]["validationState"], "disregarded")
        self.assertEqual(result["launches"][0]["exclusionReason"], "work_item_removed")

    def assert_blocking(self, result, issue_type) -> None:
        self.assertTrue(issue_by_type(result, issue_type)["blocking"])
        self.assertFalse(result["canFinalize"])


def validate(*, tags="1-Mobile; 2-Melhoria; 3-Produtos", parent_type="PBI", duration="0d 01:00:00"):
    consultation = classify(
        [launch(1, 401, duration=duration)],
        [hierarchy(401, 301, parent_type, 200)],
        tags=tags,
    )
    return validate_general_indicator_consultation(consultation)


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


def launch(launch_id, task_id, *, duration="0d 01:00:00", created="2026-03-10 09:00:00"):
    return {
        "IdLancamento": launch_id,
        "DataHoraCadastro": created,
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


def issue_by_type(result, issue_type):
    return next(item for item in result["inconsistencies"]["items"] if item["type"] == issue_type)


if __name__ == "__main__":
    unittest.main()
