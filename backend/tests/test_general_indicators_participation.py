from __future__ import annotations

import unittest
from datetime import date, datetime

from app.services.general_indicators_classification import classify_general_indicator_launches
from app.services.general_indicators_rules import build_finalized_general_indicators
from app.services.general_indicators_validation import NONPARTICIPATION_REASON, validate_general_indicator_consultation


class GeneralIndicatorParticipationTests(unittest.TestCase):
    def test_nonparticipant_is_stored_but_does_not_generate_invalid_hierarchy_pending(self) -> None:
        result = validate([launch(1, "fora", task_id=999)], [], excluded={"fora"})

        self.assertTrue(result["canFinalize"])
        self.assertEqual(result["inconsistencies"]["items"], [])
        self.assertEqual(result["launches"][0]["validationState"], "disregarded")
        self.assertEqual(result["launches"][0]["exclusionReason"], NONPARTICIPATION_REASON)

    def test_mixed_participation_counts_and_hours_close_exactly(self) -> None:
        rows = [launch(1, "dentro", hours=2), launch(2, "fora", hours=3)]
        paths = [hierarchy(1), hierarchy(2)]
        result = validate(rows, paths, excluded={"fora"})

        summary = result["summary"]
        self.assertEqual(summary["consideredLaunchCount"], 1)
        self.assertEqual(summary["disregardedLaunchCount"], 1)
        self.assertEqual(summary["excludedCollaboratorCount"], 1)
        self.assertEqual(summary["grossHours"], 5)
        self.assertEqual(summary["consideredHours"], 2)
        self.assertEqual(summary["disregardedHours"], 3)
        self.assertEqual(summary["grossHours"], summary["consideredHours"] + summary["disregardedHours"])

    def test_multiple_launches_from_same_nonparticipant_remain_independent(self) -> None:
        result = validate(
            [launch(1, "fora"), launch(2, "fora")],
            [hierarchy(1), hierarchy(2)],
            excluded={"FORA"},
        )

        self.assertEqual({item["idLancamento"] for item in result["launches"]}, {"1", "2"})
        self.assertEqual(result["summary"]["disregardedLaunchCount"], 2)
        self.assertEqual(result["summary"]["excludedCollaboratorCount"], 1)

    def test_excluded_conflicting_duplicate_does_not_block(self) -> None:
        first = launch(1, "fora", hours=1)
        second = launch(1, "fora", hours=2)
        result = validate([first, second], [hierarchy(1)], excluded={"fora"})

        self.assertTrue(result["canFinalize"])
        self.assertNotIn("duplicate_id_conflict", result["summary"]["inconsistencyCountsByType"])

    def test_feature_tag_pending_preserves_derived_classification_for_audit(self) -> None:
        result = validate([launch(1, "dentro")], [hierarchy(1)], tags="1-Mobile; 3-Produto")
        types = [item["type"] for item in result["inconsistencies"]["items"]]

        self.assertIn("tag_2_missing", types)
        self.assertIn("classification_impossible", types)
        self.assertEqual(result["summary"]["pendingCount"], 1)
        self.assertEqual(result["summary"]["blockingInconsistencyCount"], 2)
        derived = next(item for item in result["inconsistencies"]["items"] if item["type"] == "classification_impossible")
        self.assertTrue(derived["details"]["isDerived"])
        self.assertEqual(derived["details"]["derivedFromType"], "tag_2_missing")

    def test_excluded_launch_does_not_inflate_feature_tag_impact(self) -> None:
        result = validate(
            [launch(1, "dentro", hours=2), launch(2, "fora", hours=5)],
            [hierarchy(1), hierarchy(2)],
            excluded={"fora"},
            tags="1-Mobile; 3-Produto",
        )
        issue = next(item for item in result["inconsistencies"]["items"] if item["type"] == "tag_2_missing")

        self.assertEqual(issue["details"]["affectedLaunchCount"], 1)
        self.assertEqual(issue["details"]["affectedHours"], 2)

    def test_all_excluded_is_ready_but_preserves_raw_totals(self) -> None:
        result = validate([launch(1, "fora", hours=4)], [], excluded={"fora"})

        self.assertTrue(result["canFinalize"])
        self.assertEqual(result["summary"]["grossHours"], 4)
        self.assertEqual(result["summary"]["consideredHours"], 0)

    def test_finalization_excludes_hours_and_preserves_full_audit(self) -> None:
        validated = validate(
            [launch(1, "dentro", hours=2), launch(2, "fora", hours=3)],
            [hierarchy(1), hierarchy(2)],
            excluded={"fora"},
        )
        result = build_finalized_general_indicators(
            validated["launches"],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=1,
            consulted_at=datetime(2026, 2, 1),
            finalized_at=datetime(2026, 2, 2),
        )

        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["totalHours"], 2)
        self.assertEqual(len(result["audit"]), 2)
        excluded_audit = next(item for item in result["audit"] if item["collaborator"] == "fora")
        self.assertFalse(excluded_audit["includedInOfficialCalculation"])
        self.assertEqual(excluded_audit["exclusionReason"], NONPARTICIPATION_REASON)


def validate(rows, paths, *, excluded=(), tags="1-Mobile; 2-Melhoria; 3-Produto"):
    consultation = classify_general_indicator_launches(
        rows,
        paths,
        [{"ID": 200, "WorkItemType": "Feature", "Tags": tags}],
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        nonparticipating_logins=excluded,
    )
    return validate_general_indicator_consultation(consultation)


def launch(launch_id, user, *, task_id=None, hours=1):
    return {
        "IdLancamento": launch_id,
        "DataHoraCadastro": "2026-01-10 09:00:00",
        "TempoDuracao": f"0d {hours:02d}:00:00",
        "LoginUsuario": user,
        "IdTask": task_id or launch_id,
    }


def hierarchy(task_id):
    return {
        "IdTask": task_id,
        "TaskWorkItemType": "Task",
        "IdParent": 300 + task_id,
        "ParentWorkItemType": "PBI",
        "IdFeat": 200,
        "FeatureWorkItemType": "Feature",
        "FeatureTitle": "Feature de teste",
        "IdEpic": 100,
    }


if __name__ == "__main__":
    unittest.main()
