from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.schemas.general_indicator_targets import GeneralIndicatorTargetPeriodPayload
from app.services.general_indicator_targets_service import (
    GeneralIndicatorTargetConfigurationError,
    create_general_indicator_target_period,
    target_configuration_for_period,
)
from app.services.general_indicators_rules import (
    build_finalized_general_indicators,
    calculate_kpis,
)


NOW = datetime(2026, 8, 10, 12, 0, tzinfo=timezone.utc)


def _connection_context() -> tuple[MagicMock, MagicMock]:
    context = MagicMock()
    return context, context.__enter__.return_value


def _period_row(
    period_id: int,
    start: date,
    end: date,
    projects_target: str,
    errors_limit: str,
) -> dict:
    return {
        "id": period_id,
        "start_date": start,
        "end_date": end,
        "projects_target": Decimal(projects_target),
        "errors_limit": Decimal(errors_limit),
        "created_at": NOW,
        "created_by": "sistema",
        "updated_at": NOW,
        "updated_by": "sistema",
    }


def _launch(launch_id: int, *, category: str, hours: int) -> dict:
    return {
        "idLancamento": str(launch_id),
        "durationSeconds": hours * 3600,
        "durationHours": hours,
        "launchDate": "2025-01-15",
        "monthYear": "2025-01",
        "user": "giovanna.barbieri",
        "idTask": 100 + launch_id,
        "idParent": 200,
        "parentWorkItemType": "PBI",
        "idFeature": 300,
        "validatedCategory": category,
        "finalCategory": category,
        "tag1": "1-Mobile",
        "tag2": f"2-{category}",
        "tag3": "3-Produto",
        "isUpdateSystem": False,
        "validationState": "valid",
        "eligibleForOfficialCalculation": True,
        "disregardedFromGeneralIndicators": False,
        "participatesInGeneralIndicators": True,
        "trace": {"featureTagsRaw": f"1-Mobile; 2-{category}; 3-Produto"},
    }


@patch("app.services.general_indicator_targets_service.find_target_periods_covering")
@patch("app.services.general_indicator_targets_service.get_connection")
def test_selects_2025_target_period(get_connection, find_periods) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context
    find_periods.return_value = [
        _period_row(1, date(2025, 1, 1), date(2025, 12, 31), "31.44", "10.16")
    ]

    result = target_configuration_for_period(date(2025, 1, 1), date(2025, 7, 31))

    assert result["projectsImprovements"]["target"] == "31.44"
    assert result["errorsBugs"]["limit"] == "10.16"


@patch("app.services.general_indicator_targets_service.find_target_periods_covering")
@patch("app.services.general_indicator_targets_service.get_connection")
def test_selects_2026_target_period(get_connection, find_periods) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context
    find_periods.return_value = [
        _period_row(2, date(2026, 1, 1), date(2026, 12, 31), "40.00", "10.00")
    ]

    result = target_configuration_for_period(date(2026, 1, 1), date(2026, 6, 30))

    assert result["projectsImprovements"]["target"] == "40.00"
    assert result["errorsBugs"]["limit"] == "10.00"


@patch("app.services.general_indicator_targets_service.find_target_periods_covering")
@patch("app.services.general_indicator_targets_service.get_connection")
def test_rejects_period_without_target_configuration(get_connection, find_periods) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context
    find_periods.return_value = []

    with pytest.raises(GeneralIndicatorTargetConfigurationError) as exc_info:
        target_configuration_for_period(date(2024, 1, 1), date(2024, 12, 31))

    assert "Não existe configuração de metas aplicável" in str(exc_info.value)


@patch("app.services.general_indicator_targets_service.find_target_periods_covering")
@patch("app.services.general_indicator_targets_service.get_connection")
def test_rejects_period_crossing_target_periods(get_connection, find_periods) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context
    find_periods.return_value = [
        _period_row(2, date(2026, 1, 1), date(2026, 12, 31), "40.00", "10.00"),
        _period_row(3, date(2027, 1, 1), date(2027, 12, 31), "41.00", "9.50"),
    ]

    with pytest.raises(GeneralIndicatorTargetConfigurationError) as exc_info:
        target_configuration_for_period(date(2026, 10, 1), date(2027, 3, 31))

    assert "atravessa mais de uma vigência" in str(exc_info.value)


@patch("app.services.general_indicator_targets_service.has_overlapping_target_period", return_value=True)
@patch("app.services.general_indicator_targets_service.get_connection")
def test_rejects_overlapping_target_periods(get_connection, _has_overlap) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context

    with pytest.raises(HTTPException) as exc_info:
        create_general_indicator_target_period(
            GeneralIndicatorTargetPeriodPayload(
                startDate=date(2026, 7, 1),
                endDate=date(2026, 12, 31),
                projectsTarget=Decimal("42.00"),
                errorsLimit=Decimal("9.50"),
            )
        )

    assert exc_info.value.status_code == 400
    assert "sobreposta" in exc_info.value.detail


def test_kpis_use_configured_targets_and_limits() -> None:
    targets_2025 = {
        "projectsImprovements": {"target": "31.44"},
        "errorsBugs": {"limit": "10.16"},
    }
    targets_2026 = {
        "projectsImprovements": {"target": "40.00"},
        "errorsBugs": {"limit": "10.00"},
    }

    assert calculate_kpis({"Novo projeto": Decimal(32)}, Decimal(100), target_configuration=targets_2025)[
        "projectsImprovements"
    ]["status"] == "within_target"
    assert calculate_kpis({"Novo projeto": Decimal(32)}, Decimal(100), target_configuration=targets_2026)[
        "projectsImprovements"
    ]["status"] == "attention"
    assert calculate_kpis({"Erro TI": Decimal("10.10")}, Decimal(100), target_configuration=targets_2025)[
        "errorsBugs"
    ]["status"] == "within_target"
    assert calculate_kpis({"Erro TI": Decimal("10.10")}, Decimal(100), target_configuration=targets_2026)[
        "errorsBugs"
    ]["status"] == "attention"


def test_finalized_snapshot_freezes_target_configuration() -> None:
    target_configuration = {
        "id": 1,
        "version": "general-indicators-target-periods-v1",
        "startDate": "2025-01-01",
        "endDate": "2025-12-31",
        "projectsImprovements": {"target": "31.44", "attentionFrom": "30.00"},
        "errorsBugs": {"limit": "10.16", "criticalAbove": "15.00"},
    }

    result = build_finalized_general_indicators(
        [
            _launch(1, category="Novo projeto", hours=32),
            _launch(2, category="Erro TI", hours=10),
            _launch(3, category="Manutenção", hours=58),
        ],
        start_date=date(2025, 1, 1),
        end_date=date(2025, 1, 31),
        consultation_id=10,
        consulted_at=NOW,
        finalized_at=NOW,
        target_configuration=target_configuration,
    )

    target_configuration["projectsImprovements"]["target"] = "40.00"
    assert result["kpis"]["projectsImprovements"]["target"] == 31.44
    assert result["kpis"]["projectsImprovements"]["status"] == "within_target"
    assert result["rules"]["targets"]["configuration"]["projectsImprovements"]["target"] == "31.44"
    assert result["metadata"]["targetsVersion"] == "general-indicators-target-periods-v1"


def test_target_period_migration_creates_seed_periods() -> None:
    migration = (
        Path(__file__).parents[1]
        / "migrations"
        / "0014_general_indicator_target_periods.sql"
    ).read_text(encoding="utf-8")

    assert "general_indicator_target_periods" in migration
    assert "'2025-01-01', '2025-12-31', 31.44, 10.16" in migration
    assert "'2026-01-01', '2026-12-31', 40.00, 10.00" in migration
