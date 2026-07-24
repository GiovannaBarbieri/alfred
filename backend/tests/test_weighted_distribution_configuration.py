from __future__ import annotations

import unittest
from pathlib import Path

from app.services.general_indicators_rules import (
    DISTRIBUTION_RULES_VERSION,
    distribution_configuration_snapshot,
)


class WeightedDistributionConfigurationTests(unittest.TestCase):
    def test_migration_persists_initial_weights_and_active_state(self) -> None:
        sql = migration_sql()

        self.assertIn("general_indicator_distribution_weights", sql)
        self.assertIn("distribution_weight", sql)
        self.assertIn("active BOOLEAN", sql)
        for category, weight in (
            ("Novo projeto", 4),
            ("Melhoria", 4),
            ("Erro TI", 3),
            ("Bug", 3),
            ("Manutenção", 1),
        ):
            self.assertIn(f"('{category}', {weight}, TRUE)", sql)

    def test_rules_version_identifies_weighted_distribution(self) -> None:
        self.assertEqual(DISTRIBUTION_RULES_VERSION, "update-system-weighted-proportional-v2")

    def test_snapshot_preserves_weights_and_active_flags(self) -> None:
        snapshot = distribution_configuration_snapshot(
            {
                "Novo projeto": {"weight": 4, "active": True},
                "Bug": {"weight": 3, "active": False},
            }
        )

        self.assertEqual(snapshot["Novo projeto"], {"weight": "4", "active": True})
        self.assertEqual(snapshot["Bug"], {"weight": "3", "active": False})


def migration_sql() -> str:
    return (
        Path(__file__).parents[1] / "migrations" / "0009_weighted_distribution_configuration.sql"
    ).read_text(encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
