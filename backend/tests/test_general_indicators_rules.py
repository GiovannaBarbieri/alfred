from __future__ import annotations

import unittest
from datetime import date
from decimal import Decimal

from app.services.general_indicators_rules import (
    build_general_indicators,
    calculate_kpis,
    classify_indicator,
    deduplicate_launches,
    distribute_update_system,
    parse_duration_seconds,
    parse_indicator_tags,
)


class GeneralIndicatorsRulesTests(unittest.TestCase):
    def test_duration_without_days(self) -> None:
        self.assertEqual(parse_duration_seconds("0d 01:30:00"), 5400)
        self.assertEqual(parse_duration_seconds("01:30:00"), 5400)

    def test_duration_with_days(self) -> None:
        self.assertEqual(parse_duration_seconds("1d 02:30:00"), 95400)

    def test_invalid_duration(self) -> None:
        self.assertIsNone(parse_duration_seconds("1d 02:75:00"))
        self.assertIsNone(parse_duration_seconds("texto"))

    def test_parses_tags_one_two_and_three_ignoring_others(self) -> None:
        tags, issue = parse_indicator_tags(" 1-Mobile - Advise Hub ; 2-novo projeto; 3-Produtos; 4-Ticket ")

        self.assertIsNone(issue)
        self.assertEqual(tags["module"], "Mobile - Advise Hub")
        self.assertEqual(tags["category"], "novo projeto")
        self.assertEqual(tags["demand"], "Produtos")

    def test_missing_and_invalid_tags_are_reported(self) -> None:
        self.assertEqual(parse_indicator_tags(None)[1], "tag_missing")
        self.assertEqual(parse_indicator_tags("1-Sistema; 2-")[1], "tag_invalid")

    def test_bug_work_item_type_overrides_tag_category(self) -> None:
        self.assertEqual(classify_indicator("Melhoria", " bug "), "Bug")
        self.assertEqual(classify_indicator("novo PROJETO", "Product Backlog Item"), "Novo projeto")

    def test_duplicate_id_is_counted_once_and_conflict_is_exposed(self) -> None:
        unique, issues = deduplicate_launches(
            [
                {"IdLancamento": 10, "TempoDuracao": "00:10:00"},
                {"IdLancamento": 10, "TempoDuracao": "00:20:00"},
            ]
        )

        self.assertEqual(len(unique), 1)
        self.assertEqual(len(issues), 1)
        self.assertTrue(issues[0]["details"]["conflict"])

    def test_weighted_proportional_distribution_closes_exactly(self) -> None:
        result, issues = distribute_update_system(
            [
                entry("Manutenção", 100),
                entry("Novo projeto", 300),
                entry("Atualização do sistema", 80, update=True),
            ]
        )

        self.assertEqual(issues, [])
        self.assertEqual(result["allocated"]["Manutenção"], Decimal(5))
        self.assertEqual(result["allocated"]["Novo projeto"], Decimal(75))
        self.assertEqual(sum(result["allocated"].values()), Decimal(80))
        self.assertEqual(sum(result["adjusted"].values()), Decimal(480))

    def test_distribution_preserves_total_for_repeating_shares(self) -> None:
        result, issues = distribute_update_system(
            [
                entry("Manutenção", 11),
                entry("Novo projeto", 1),
                entry("Melhoria", 2),
                entry("Atualização do sistema", 100, update=True),
            ]
        )

        self.assertEqual(issues, [])
        expected_without_residual = Decimal(100) * Decimal(11) / Decimal(26)
        self.assertEqual(result["allocated"]["Manutenção"], expected_without_residual)
        self.assertEqual(sum(result["allocated"].values()), Decimal(100))

    def test_bug_participates_in_update_distribution(self) -> None:
        result, _ = distribute_update_system(
            [entry("Erro TI", 100), entry("Bug", 100), entry("Atualização do sistema", 50, update=True)]
        )

        self.assertAlmostEqual(float(result["allocated"]["Erro TI"]), 50 * 3 / 7)
        self.assertAlmostEqual(float(result["allocated"]["Bug"]), 50 * 4 / 7)
        self.assertAlmostEqual(float(result["adjusted"]["Bug"]), 100 + 50 * 4 / 7)

    def test_configured_weights_are_used_for_all_five_categories(self) -> None:
        result, issues = distribute_update_system(
            [
                entry("Novo projeto", 150),
                entry("Melhoria", 200),
                entry("Erro TI", 80),
                entry("Bug", 70),
                entry("Manutenção", 500),
                entry("Atualização do sistema", 235, update=True),
            ]
        )

        self.assertEqual(issues, [])
        self.assertAlmostEqual(float(result["allocated"]["Novo projeto"]), 235 * 750 / 2770)
        self.assertAlmostEqual(float(result["allocated"]["Melhoria"]), 235 * 1000 / 2770)
        self.assertAlmostEqual(float(result["allocated"]["Erro TI"]), 235 * 240 / 2770)
        self.assertAlmostEqual(float(result["allocated"]["Bug"]), 235 * 280 / 2770)
        self.assertAlmostEqual(float(result["allocated"]["Manutenção"]), 235 * 500 / 2770)
        self.assertEqual(sum(result["allocated"].values()), Decimal(235))

    def test_inactive_category_is_excluded_from_distribution(self) -> None:
        configuration = {
            "Novo projeto": {"weight": 4, "active": True},
            "Bug": {"weight": 3, "active": False},
            "Manutenção": {"weight": 1, "active": True},
        }
        result, issues = distribute_update_system(
            [
                entry("Novo projeto", 100),
                entry("Bug", 100),
                entry("Manutenção", 100),
                entry("Atualização do sistema", 50, update=True),
            ],
            distribution_configuration=configuration,
        )

        self.assertEqual(issues, [])
        self.assertEqual(result["allocated"]["Bug"], Decimal(0))
        self.assertEqual(result["allocated"]["Novo projeto"], Decimal(40))
        self.assertEqual(result["allocated"]["Manutenção"], Decimal(10))

    def test_zero_distribution_base_is_reported_and_total_is_preserved(self) -> None:
        result, issues = distribute_update_system([entry("Atualização do sistema", 120, update=True)], period="2026-01")

        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["type"], "distribution_impossible")
        self.assertEqual(sum(result["adjusted"].values()), Decimal(120))

    def test_kpi_thresholds(self) -> None:
        within = calculate_kpis(
            {"Novo projeto": Decimal(30), "Melhoria": Decimal(10), "Erro TI": Decimal(10), "Bug": Decimal(0)},
            Decimal(100),
        )
        attention = calculate_kpis(
            {"Novo projeto": Decimal(35), "Erro TI": Decimal(11), "Bug": Decimal(4)}, Decimal(100)
        )
        critical = calculate_kpis({"Novo projeto": Decimal(29), "Erro TI": Decimal(16)}, Decimal(100))

        self.assertEqual(within["projectsImprovements"]["status"], "within_target")
        self.assertEqual(within["errorsBugs"]["status"], "within_target")
        self.assertEqual(attention["projectsImprovements"]["status"], "attention")
        self.assertEqual(attention["errorsBugs"]["status"], "attention")
        self.assertEqual(critical["projectsImprovements"]["status"], "alert")
        self.assertEqual(critical["errorsBugs"]["status"], "critical")

    def test_build_report_reports_inconsistencies_without_failing(self) -> None:
        rows = [
            launch(1, "2026-01-10 09:00:00", "0d 01:00:00", 100, 200),
            launch(1, "2026-01-10 09:00:00", "0d 01:00:00", 100, 200),
            launch(2, "2026-02-10 09:00:00", "inválida", 999, 201),
        ]
        metadata = [
            {"Id": 100, "Tags": "1-Sistema; 2-Melhoria; 3-Produtos", "WorkItemType": "Feature"},
            {"Id": 200, "Tags": None, "WorkItemType": "Bug"},
            {"Id": 201, "Tags": None, "WorkItemType": "Product Backlog Item"},
        ]

        report = build_general_indicators(
            rows, metadata, start_date=date(2026, 1, 1), end_date=date(2026, 3, 31)
        )

        self.assertEqual(report["recordCount"], 1)
        self.assertEqual(report["totalHours"], 1.0)
        self.assertEqual(report["kpis"]["errorsBugs"]["percentage"], 100.0)
        self.assertEqual(report["inconsistencies"]["counts"]["duplicate_id"], 1)
        self.assertEqual(report["inconsistencies"]["counts"]["invalid_duration"], 1)
        self.assertEqual(report["inconsistencies"]["counts"]["tfs_item_not_found"], 1)


def entry(category: str, seconds: int, *, update: bool = False) -> dict:
    return {"category": category, "seconds": Decimal(seconds), "is_update_system": update}


def launch(launch_id: int, created: str, duration: str, feature_id: int, pbi_id: int) -> dict:
    return {
        "IdLancamento": launch_id,
        "DataHoraCadastro": created,
        "TempoDuracao": duration,
        "IdFeat": feature_id,
        "IdPBI": pbi_id,
    }


if __name__ == "__main__":
    unittest.main()
