from __future__ import annotations

import unittest
from datetime import date, datetime
from unittest.mock import MagicMock, patch

from app.schemas.general_indicators import GeneralIndicatorFinalizedSnapshot
from app.services.general_indicators_rules import (
    build_finalized_general_indicators,
    finalized_result_hash,
)
from app.services.general_indicators_service import (
    GeneralIndicatorEmptyError,
    GeneralIndicatorNotReadyError,
    finalize_general_indicator_consultation,
    get_finalized_general_indicator_result,
)


def valid_launch(launch_id, *, category="Melhoria", hours=1, update_system=False, parent_type="PBI"):
    return {
        "idLancamento": str(launch_id), "launchDate": "2026-01-10T09:00:00",
        "durationSeconds": hours * 3600, "durationHours": hours, "user": "usuario",
        "idTask": str(400 + launch_id), "idParent": str(300 + launch_id),
        "parentWorkItemType": parent_type, "idFeature": "200",
        "tag1": "1-Atualização do sistema" if update_system else "1-Mobile",
        "tag2": f"2-{category}", "tag3": "3-Produtos",
        "validatedCategory": category, "finalCategory": category,
        "isUpdateSystem": update_system, "monthYear": "2026-01", "validationState": "valid",
    }


class GeneralIndicatorFinalizationRulesTests(unittest.TestCase):
    def test_builds_complete_versioned_and_typed_official_snapshot(self) -> None:
        excluded = valid_launch(3, category="Melhoria", hours=3)
        excluded.update(
            {
                "user": "usuario.excluido",
                "validationState": "disregarded",
                "eligibleForOfficialCalculation": False,
                "participatesInGeneralIndicators": False,
                "disregardedFromGeneralIndicators": True,
                "exclusionReason": "Não participante.",
            }
        )
        april = valid_launch(4, category="Bug", hours=2, parent_type="Bug")
        april["launchDate"] = "2026-04-10T09:00:00"
        april["monthYear"] = "2026-04"
        result = build_finalized_general_indicators(
            [
                valid_launch(1, category="Novo projeto", hours=2),
                valid_launch(2, category="Erro TI", hours=1),
                excluded,
                april,
            ],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 6, 30),
            consultation_id=80,
            consulted_at=datetime(2026, 7, 1, 9, 0),
            validated_at=datetime(2026, 7, 1, 9, 30),
            finalized_at=datetime(2026, 7, 1, 10, 0),
            consultation_summary={
                "sourceRowCount": 4,
                "uniqueLaunchCount": 4,
                "consideredLaunchCount": 3,
                "disregardedLaunchCount": 1,
                "excludedCollaboratorCount": 1,
                "grossHours": 8,
                "consideredHours": 5,
                "disregardedHours": 3,
                "pendingCount": 0,
                "affectedLaunchCount": 0,
                "affectedHours": 0,
            },
            backend_build="commit-abc",
        )

        self.assertEqual(result["contractVersion"], 2)
        self.assertEqual(result["metadata"]["backendBuild"], "commit-abc")
        self.assertEqual(result["summary"]["excludedCollaborators"], ["usuario.excluido"])
        self.assertEqual(result["summary"]["grossHours"], 8)
        self.assertEqual(len(result["months"]), 6)
        self.assertEqual(len(result["quarters"]), 2)
        self.assertIn("participatingCategories", result["rules"]["distribution"])
        self.assertIn("Bug", result["rules"]["distribution"]["participatingCategories"])
        self.assertEqual(
            result["rules"]["distribution"]["method"],
            "Distribuição proporcional ponderada",
        )
        self.assertEqual(len(result["integrity"]["launchSnapshotHash"]), 64)
        self.assertEqual(result["integrity"]["resultHash"], finalized_result_hash(result))
        self.assertEqual(
            sum(item["totalHours"] for item in result["quarters"]),
            sum(item["totalHours"] for item in result["months"]),
        )
        self.assertEqual(
            result["quarters"][0]["newProjectHours"],
            sum(item["categories"].get("Novo projeto", 0) for item in result["months"][:3]),
        )
        GeneralIndicatorFinalizedSnapshot.model_validate(result)

    def test_hashes_are_deterministic_and_sensitive_to_snapshot_changes(self) -> None:
        arguments = {
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 1, 31),
            "consultation_id": 81,
            "consulted_at": datetime(2026, 2, 1, 9, 0),
            "finalized_at": datetime(2026, 2, 1, 10, 0),
        }
        first = build_finalized_general_indicators([valid_launch(1)], **arguments)
        second = build_finalized_general_indicators([valid_launch(1)], **arguments)
        changed = build_finalized_general_indicators([valid_launch(1, hours=2)], **arguments)

        self.assertEqual(first["integrity"], second["integrity"])
        self.assertNotEqual(
            first["integrity"]["launchSnapshotHash"],
            changed["integrity"]["launchSnapshotHash"],
        )
        self.assertNotEqual(first["integrity"]["resultHash"], changed["integrity"]["resultHash"])

    def test_later_tag_or_participation_changes_do_not_mutate_final_snapshot(self) -> None:
        launch_item = valid_launch(1, category="Melhoria")
        launch_item["trace"] = {"featureTagsRaw": "1-Mobile; 2-Melhoria; 3-Produto"}
        result = build_finalized_general_indicators(
            [launch_item],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=84,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
        )
        original_hash = result["integrity"]["resultHash"]

        launch_item["trace"]["featureTagsRaw"] = "1-Mobile; 2-Novo projeto; 3-Produto"
        launch_item["participatesInGeneralIndicators"] = False
        launch_item["disregardedFromGeneralIndicators"] = True

        self.assertEqual(result["audit"][0]["originalTags"], "1-Mobile; 2-Melhoria; 3-Produto")
        self.assertTrue(result["audit"][0]["participatesInGeneralIndicators"])
        self.assertEqual(result["integrity"]["resultHash"], original_hash)

    def test_builds_official_result_with_distribution_kpis_and_audit(self) -> None:
        launches = [
            valid_launch(1, category="Manutenção", hours=2),
            valid_launch(2, category="Melhoria", hours=2),
            valid_launch(3, category="Manutenção", hours=2, update_system=True),
            valid_launch(4, category="Bug", hours=1, parent_type="Bug"),
        ]

        result = build_finalized_general_indicators(
            launches,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=77,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
        )

        self.assertEqual(result["status"], "FINALIZADA")
        self.assertEqual(result["recordCount"], 4)
        self.assertEqual(result["totalHours"], 7.0)
        self.assertTrue(result["distribution"][0]["isBalanced"])
        self.assertEqual(result["distribution"][0]["distributedHours"], 2.0)
        self.assertEqual(sum(item["allocatedHours"] for item in result["audit"]), 2.0)
        self.assertIn("Erros TI e Bugs", result["audit"][3]["kpiParticipation"])
        self.assertNotIn("inconsistencies", result)

    def test_removed_launches_are_excluded_from_total_distribution_kpis_and_audit(self) -> None:
        removed_update = valid_launch(2, category="ManutenÃ§Ã£o", hours=2, update_system=True)
        removed_update.update(
            {
                "validationState": "disregarded",
                "eligibleForOfficialCalculation": False,
                "disregardedFromGeneralIndicators": True,
                "removedByWorkItemState": True,
                "exclusionReason": "work_item_removed",
                "removedWorkItems": [{"level": "Task", "id": "402", "state": "Removed", "type": "Task"}],
            }
        )
        removed_bug = valid_launch(3, category="Bug", hours=1, parent_type="Bug")
        removed_bug.update(
            {
                "validationState": "disregarded",
                "eligibleForOfficialCalculation": False,
                "disregardedFromGeneralIndicators": True,
                "removedByWorkItemState": True,
                "exclusionReason": "work_item_removed",
                "removedWorkItems": [{"level": "PBI/Bug", "id": "303", "state": "Removed", "type": "Bug"}],
            }
        )

        result = build_finalized_general_indicators(
            [valid_launch(1, category="Melhoria", hours=1), removed_update, removed_bug],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=88,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
            consultation_summary={
                "sourceRowCount": 3,
                "uniqueLaunchCount": 3,
                "consideredLaunchCount": 1,
                "disregardedLaunchCount": 2,
                "removedLaunchCount": 2,
                "removedHours": 3,
            },
        )

        self.assertEqual(result["recordCount"], 1)
        self.assertEqual(result["totalHours"], 1.0)
        self.assertEqual(result["summary"]["removedLaunchCount"], 2)
        self.assertEqual(result["summary"]["removedHours"], 3.0)
        self.assertEqual(result["distribution"][0]["updateSystemHours"], 0.0)
        self.assertEqual(result["distribution"][0]["distributedHours"], 0.0)
        self.assertEqual(result["kpis"]["projectsImprovements"]["hours"], 1.0)
        self.assertEqual(result["kpis"]["errorsBugs"]["hours"], 0.0)
        removed_audit = [item for item in result["audit"] if item["removedByWorkItemState"]]
        self.assertEqual(len(removed_audit), 2)
        self.assertFalse(removed_audit[0]["includedInOfficialCalculation"])
        self.assertEqual(removed_audit[0]["exclusionReason"], "work_item_removed")
        self.assertEqual(removed_audit[0]["removedWorkItems"][0]["state"], "Removed")

    def test_displayed_distribution_and_launch_allocations_close_after_rounding(self) -> None:
        launches = [
            valid_launch(1, category="Manutenção", hours=1),
            valid_launch(2, category="Novo projeto", hours=1),
            valid_launch(3, category="Melhoria", hours=1),
            valid_launch(4, category="Manutenção", hours=1, update_system=True),
        ]

        result = build_finalized_general_indicators(
            launches,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=78,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
        )

        distribution = result["distribution"][0]
        displayed_parts = sum(
            distribution[key]
            for key in ("maintenanceHours", "newProjectHours", "improvementHours", "itErrorHours", "bugHours")
        )
        self.assertAlmostEqual(displayed_parts, distribution["updateSystemHours"], places=4)
        self.assertAlmostEqual(sum(item["allocatedHours"] for item in result["audit"]), 1.0, places=4)
        self.assertTrue(distribution["isBalanced"])

    def test_final_audit_preserves_original_tags_validation_and_source_evidence(self) -> None:
        launch_item = valid_launch(1)
        launch_item["validationState"] = "auto_treated"
        launch_item["auditIssues"] = [
            {
                "type": "duplicate_id_identical",
                "severity": "TRATADA_AUTOMATICAMENTE",
                "status": "TRATADA",
                "message": "Linha duplicada idêntica reduzida automaticamente a um lançamento.",
                "treatment": "deduplicated",
                "originalText": "1",
            }
        ]
        launch_item["trace"] = {
            "featureTagsRaw": " 1-Mobile ; 2-Melhoria ; 3-Produtos ",
            "sourceOccurrenceCount": 2,
            "duplicateSourceRows": [{"IdLancamento": 1}, {"IdLancamento": 1}],
        }

        result = build_finalized_general_indicators(
            [launch_item],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=79,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
            inconsistency_history=[
                {
                    "id": 10,
                    "idLancamento": "1",
                    "idFeature": "200",
                    "type": "tag_2_missing",
                    "severity": "IMPEDITIVA",
                    "scope": "feature",
                    "message": "A TAG obrigatória 2- não foi encontrada.",
                    "blocking": True,
                    "status": "SUPERADA",
                    "active": False,
                    "affectedLaunchIds": ["1"],
                }
            ],
        )
        audit = result["audit"][0]

        self.assertEqual(audit["originalTags"], " 1-Mobile ; 2-Melhoria ; 3-Produtos ")
        self.assertEqual(audit["sourceOccurrenceCount"], 2)
        self.assertEqual(len(audit["sourceRows"]), 2)
        self.assertEqual(audit["validationIssues"][0]["type"], "duplicate_id_identical")
        self.assertEqual(audit["validationHistory"][0]["status"], "SUPERADA")
        self.assertEqual(result["inconsistencyHistory"][0]["type"], "tag_2_missing")
        self.assertTrue(audit["includedInOfficialCalculation"])


class GeneralIndicatorFinalizationServiceTests(unittest.TestCase):
    def test_result_endpoint_uses_typed_snapshot_contract(self) -> None:
        from app.main import app

        operation = app.openapi()["paths"]["/api/general-indicators/consultations/{consultation_id}/result"]["get"]
        response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]

        self.assertEqual(
            response_schema["$ref"],
            "#/components/schemas/GeneralIndicatorFinalizedSnapshot",
        )

    @patch("app.services.general_indicators_service.query_tfs_indicator_items")
    @patch("app.services.general_indicators_service.query_tfs_task_hierarchies")
    @patch("app.services.general_indicators_service.query_general_indicator_raw_launches")
    @patch("app.services.general_indicators_service.get_general_indicator_consultation")
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_reopens_persisted_result_without_querying_tfs(
        self,
        _connection,
        get_consultation,
        raw_query,
        hierarchy_query,
        feature_query,
    ) -> None:
        persisted = build_finalized_general_indicators(
            [valid_launch(1)],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=82,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
        )
        get_consultation.return_value = {
            "id": 82,
            "status": "FINALIZADA",
            "resultado": persisted,
            "resultado_versao": 2,
        }

        reopened = get_finalized_general_indicator_result(82)

        self.assertEqual(reopened["integrity"], persisted["integrity"])
        raw_query.assert_not_called()
        hierarchy_query.assert_not_called()
        feature_query.assert_not_called()

    @patch("app.services.general_indicators_service.get_general_indicator_consultation")
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_reads_legacy_result_without_recalculation_or_overwrite(
        self,
        _connection,
        get_consultation,
    ) -> None:
        legacy = build_finalized_general_indicators(
            [valid_launch(1)],
            start_date=date(2026, 1, 1),
            end_date=date(2026, 1, 31),
            consultation_id=83,
            consulted_at=datetime(2026, 2, 1, 9, 0),
            finalized_at=datetime(2026, 2, 1, 10, 0),
        )
        for key in ("contractVersion", "metadata", "summary", "rules", "integrity", "quarters"):
            legacy.pop(key, None)
        get_consultation.return_value = {
            "id": 83,
            "status": "FINALIZADA",
            "resultado": legacy,
            "resultado_versao": 1,
            "criado_em": datetime(2026, 2, 1, 9, 0),
            "ultima_validacao_em": datetime(2026, 2, 1, 9, 30),
            "finalizado_em": datetime(2026, 2, 1, 10, 0),
        }

        reopened = get_finalized_general_indicator_result(83)

        self.assertEqual(reopened["contractVersion"], 1)
        self.assertEqual(reopened["quarters"], [])
        self.assertIsNone(reopened["rules"])
        self.assertEqual(get_consultation.return_value["resultado"], legacy)
        GeneralIndicatorFinalizedSnapshot.model_validate(reopened)
    @patch("app.services.general_indicators_service.begin_general_indicator_finalization", return_value={"acquired": False, "reason": "not_ready"})
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_rejects_consultation_with_open_pendings(self, _connection, _begin) -> None:
        with self.assertRaises(GeneralIndicatorNotReadyError):
            finalize_general_indicator_consultation(77)

    @patch("app.services.general_indicators_service.fail_general_indicator_finalization")
    @patch("app.services.general_indicators_service.list_general_indicator_launches", return_value=[])
    @patch("app.services.general_indicators_service.get_general_indicator_consultation", return_value={"id": 77})
    @patch("app.services.general_indicators_service.begin_general_indicator_finalization", return_value={"acquired": True})
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_rejects_empty_consultation_and_restores_ready_state(self, _connection, _begin, _get, _list, fail) -> None:
        with self.assertRaises(GeneralIndicatorEmptyError):
            finalize_general_indicator_consultation(77)
        fail.assert_called_once()

    @patch("app.services.general_indicators_service.complete_general_indicator_finalization", return_value=901)
    @patch("app.services.general_indicators_service.build_finalized_general_indicators", return_value={"status": "FINALIZADA"})
    @patch("app.services.general_indicators_service.list_general_indicator_launches", return_value=[valid_launch(1)])
    @patch(
        "app.services.general_indicators_service.get_general_indicator_consultation",
        return_value={
            "id": 77,
            "data_inicial": date(2026, 1, 1),
            "data_final": date(2026, 1, 31),
            "criado_em": datetime(2026, 2, 1, 9, 0),
        },
    )
    @patch("app.services.general_indicators_service.begin_general_indicator_finalization", return_value={"acquired": True})
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_finalizes_snapshot_without_requerying_tfs(self, _connection, _begin, _get, _list, build, complete) -> None:
        result = finalize_general_indicator_consultation(77)

        self.assertEqual(result["status"], "FINALIZADA")
        self.assertEqual(result["reportId"], 901)
        build.assert_called_once()
        complete.assert_called_once()

    @patch("app.services.general_indicators_service.fail_general_indicator_finalization")
    @patch("app.services.general_indicators_service.complete_general_indicator_finalization", return_value=False)
    @patch("app.services.general_indicators_service.list_general_indicator_launches", return_value=[valid_launch(1)])
    @patch(
        "app.services.general_indicators_service.get_general_indicator_consultation",
        return_value={
            "id": 77,
            "data_inicial": date(2026, 1, 1),
            "data_final": date(2026, 1, 31),
            "criado_em": datetime(2026, 2, 1, 9, 0),
        },
    )
    @patch("app.services.general_indicators_service.begin_general_indicator_finalization", return_value={"acquired": True})
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_does_not_return_unpersisted_result_when_final_state_was_lost(
        self,
        _connection,
        _begin,
        _get,
        _list,
        _complete,
        fail,
    ) -> None:
        from app.services.general_indicators_service import GeneralIndicatorConcurrentUpdateError

        with self.assertRaises(GeneralIndicatorConcurrentUpdateError):
            finalize_general_indicator_consultation(77)
        fail.assert_called_once()

    @patch("app.services.general_indicators_service.begin_general_indicator_finalization", return_value={"acquired": False, "reason": "finalized", "result": {"status": "FINALIZADA", "consultationId": 77}, "reportId": 901})
    @patch("app.services.general_indicators_service.get_connection", return_value=MagicMock())
    def test_finalization_is_idempotent_for_already_finalized_consultation(self, _connection, _begin) -> None:
        result = finalize_general_indicator_consultation(77)
        self.assertEqual(result["status"], "FINALIZADA")
        self.assertEqual(result["reportId"], 901)


if __name__ == "__main__":
    unittest.main()
