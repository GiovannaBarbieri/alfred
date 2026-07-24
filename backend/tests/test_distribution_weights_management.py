from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.schemas.distribution_weights import (
    DistributionWeightItem,
    DistributionWeightUpdateRequest,
)
from app.services.distribution_weights_service import (
    get_distribution_weight_configuration,
    reset_distribution_weight_configuration,
    save_distribution_weight_configuration,
)


NOW = datetime(2026, 7, 24, 12, 0, tzinfo=timezone.utc)


def _rows() -> list[dict]:
    defaults = [
        ("Novo projeto", 5),
        ("Melhoria", 5),
        ("Erro TI", 3),
        ("Bug", 4),
        ("Manutenção", 1),
    ]
    return [
        {
            "category_name": category,
            "distribution_weight": weight,
            "default_weight": weight,
            "active": True,
            "updated_at": NOW,
            "updated_by": "sistema",
        }
        for category, weight in defaults
    ]


def _connection_context() -> tuple[MagicMock, MagicMock]:
    context = MagicMock()
    return context, context.__enter__.return_value


@patch("app.services.distribution_weights_service.list_distribution_weights")
@patch("app.services.distribution_weights_service.get_connection")
def test_loads_persisted_distribution_weights(get_connection, list_weights) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context
    list_weights.return_value = _rows()

    result = get_distribution_weight_configuration()

    assert [item.weight for item in result.items] == [5, 5, 3, 4, 1]
    assert all(item.active for item in result.items)


def test_schema_rejects_empty_out_of_range_and_decimal_weights() -> None:
    for invalid in (0, 6, 2.5, None):
        with pytest.raises(ValidationError):
            DistributionWeightUpdateRequest(
                items=[{"category": "Bug", "weight": invalid, "active": True}]
            )


def test_save_rejects_configuration_without_active_category() -> None:
    items = [
        DistributionWeightItem(category=row["category_name"], weight=row["distribution_weight"], active=False)
        for row in _rows()
    ]
    with pytest.raises(HTTPException) as exc_info:
        save_distribution_weight_configuration(items)
    assert exc_info.value.detail == "Pelo menos uma categoria deve participar da distribuição."


@patch("app.services.distribution_weights_service.insert_audit_log")
@patch("app.services.distribution_weights_service.update_distribution_weights")
@patch("app.services.distribution_weights_service.list_distribution_weights")
@patch("app.services.distribution_weights_service.get_connection")
def test_save_persists_all_items_and_audits_before_and_after(
    get_connection,
    list_weights,
    update_weights,
    insert_audit,
) -> None:
    context, connection = _connection_context()
    get_connection.return_value = context
    before = _rows()
    after = [{**row, "distribution_weight": 2, "updated_by": "giovanna"} for row in before]
    list_weights.return_value = before
    update_weights.return_value = after
    items = [
        DistributionWeightItem(category=row["category_name"], weight=2, active=True)
        for row in before
    ]

    result = save_distribution_weight_configuration(items, user="giovanna")

    assert all(item.weight == 2 for item in result.items)
    update_weights.assert_called_once()
    insert_audit.assert_called_once()
    audit_kwargs = insert_audit.call_args.kwargs
    assert audit_kwargs["user"] == "giovanna"
    assert audit_kwargs["before"]["items"][0]["weight"] == 5
    assert audit_kwargs["after"]["items"][0]["weight"] == 2
    assert audit_kwargs["entity"] == "general_indicator_distribution_weights"
    assert insert_audit.call_args.args == (connection,)


@patch("app.services.distribution_weights_service.insert_audit_log")
@patch("app.services.distribution_weights_service.restore_default_distribution_weights")
@patch("app.services.distribution_weights_service.list_distribution_weights")
@patch("app.services.distribution_weights_service.get_connection")
def test_restore_defaults_activates_categories_and_audits(
    get_connection,
    list_weights,
    restore_weights,
    insert_audit,
) -> None:
    context, _connection = _connection_context()
    get_connection.return_value = context
    before = [{**row, "distribution_weight": 2, "active": False} for row in _rows()]
    after = _rows()
    list_weights.return_value = before
    restore_weights.return_value = after

    result = reset_distribution_weight_configuration(user="admin")

    assert [item.weight for item in result.items] == [5, 5, 3, 4, 1]
    assert all(item.active for item in result.items)
    assert insert_audit.call_args.kwargs["action"] == "restored_defaults"
    assert insert_audit.call_args.kwargs["user"] == "admin"


def test_management_migration_contains_defaults_constraints_and_audit_user() -> None:
    migration = (
        Path(__file__).parents[1]
        / "migrations"
        / "0010_distribution_weights_management.sql"
    ).read_text(encoding="utf-8")

    assert "default_weight" in migration
    assert "updated_by" in migration
    assert "distribution_weight BETWEEN 1 AND 5" in migration
    assert "WHEN 'Novo projeto' THEN 5" in migration
    assert "WHEN 'Bug' THEN 4" in migration
    assert "active = TRUE" in migration

