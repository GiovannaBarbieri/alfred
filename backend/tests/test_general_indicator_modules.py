from __future__ import annotations

import unittest
from datetime import date, datetime

from app.services.general_indicator_modules_service import (
    MODULE_EXCLUSION_REASON,
    apply_general_indicator_module_configuration,
    extract_level_one_tags,
)
from app.services.general_indicators_rules import build_finalized_general_indicators
from app.services.general_indicators_validation import validate_general_indicator_consultation


def launch(launch_id: str, module: str, *, hours: float = 1) -> dict:
    return {
        "idLancamento": launch_id,
        "launchDate": "2026-01-10T09:00:00",
        "durationSeconds": hours * 3600,
        "durationHours": hours,
        "user": "usuario",
        "participatesInGeneralIndicators": True,
        "disregardedFromGeneralIndicators": False,
        "idTask": f"task-{launch_id}",
        "idParent": f"pbi-{launch_id}",
        "parentWorkItemType": "PBI",
        "idFeature": "feature-1",
        "tag1": module,
        "tag2": "2-Melhoria",
        "tag3": "3-Produto",
        "finalCategory": "Melhoria",
        "isUpdateSystem": False,
        "monthYear": "2026-01",
        "validationState": "pending",
        "classificationState": "classified",
        "trace": {
            "featureTagsRaw": f"{module}; 2-Melhoria; 3-Produto",
            "featureTypeValidated": True,
            "featureMetadataFound": True,
        },
    }


class GeneralIndicatorModuleRulesTests(unittest.TestCase):
    def test_extracts_complete_level_one_tag_as_identity(self) -> None:
        self.assertEqual(
            extract_level_one_tags("2-Melhoria; 1-Portal Cliente; 3-Produto; 1-Portal Cliente"),
            ["1-Portal Cliente"],
        )
        self.assertNotEqual(
            extract_level_one_tags("1-Portal Cliente"),
            extract_level_one_tags("1-Portal Clientes"),
        )

    def test_inactive_module_is_disregarded_but_launch_is_preserved(self) -> None:
        consultation = {
            "period": {"startDate": "2026-01-01", "endDate": "2026-01-31"},
            "summary": {"sourceRowCount": 2, "uniqueLaunchCount": 2},
            "launches": [
                launch("1", "1-Portal", hours=2),
                launch("2", "1-ERP", hours=3),
            ],
            "diagnostics": {"duplicateIds": []},
        }
        apply_general_indicator_module_configuration(
            consultation,
            [
                {"tag_name": "1-Portal", "active": False},
                {"tag_name": "1-ERP", "active": True},
            ],
        )
        validated = validate_general_indicator_consultation(consultation)

        self.assertEqual(len(validated["launches"]), 2)
        excluded = validated["launches"][0]
        self.assertEqual(excluded["validationState"], "disregarded")
        self.assertFalse(excluded["eligibleForOfficialCalculation"])
        self.assertEqual(excluded["exclusionReason"], MODULE_EXCLUSION_REASON)
        self.assertEqual(validated["summary"]["excludedCollaboratorCount"], 0)
        self.assertEqual(validated["summary"]["disregardedModules"][0]["tagName"], "1-Portal")

    def test_finalized_snapshot_excludes_hours_and_keeps_module_audit(self) -> None:
        included = launch("1", "1-ERP", hours=3)
        included.update(validationState="valid", eligibleForOfficialCalculation=True)
        excluded = launch("2", "1-Portal", hours=2)
        excluded.update(
            validationState="disregarded",
            eligibleForOfficialCalculation=False,
            disregardedFromGeneralIndicators=True,
            moduleTag="1-Portal",
            moduleActive=False,
            excludedByModule=True,
            exclusionReason=MODULE_EXCLUSION_REASON,
        )
        result = build_finalized_general_indicators(
            [included, excluded],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=1,
            consulted_at=datetime(2026, 2, 1, 9),
            finalized_at=datetime(2026, 2, 1, 10),
            consultation_summary={
                "moduleConfiguration": [
                    {"tagName": "1-ERP", "active": True},
                    {"tagName": "1-Portal", "active": False},
                ],
            },
        )

        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["totalHours"], 3)
        self.assertEqual(result["disregardedModules"], [
            {"tagName": "1-Portal", "hours": 2.0, "launchCount": 1},
        ])
        self.assertEqual(len(result["audit"]), 2)
        self.assertTrue(result["audit"][1]["excludedByModule"])
        self.assertEqual(result["rules"]["modules"]["configuration"][1]["tagName"], "1-Portal")

    def test_unknown_module_remains_active_until_synchronized(self) -> None:
        consultation = {
            "summary": {},
            "launches": [launch("1", "1-Novo módulo")],
        }
        apply_general_indicator_module_configuration(consultation, [])
        self.assertFalse(consultation["launches"][0]["excludedByModule"])
        self.assertFalse(consultation["launches"][0]["disregardedFromGeneralIndicators"])


if __name__ == "__main__":
    unittest.main()
