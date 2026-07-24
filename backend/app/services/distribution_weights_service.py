from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log
from app.repositories.distribution_weights_repository import (
    list_distribution_weights,
    restore_default_distribution_weights,
    update_distribution_weights,
)
from app.schemas.distribution_weights import (
    DistributionWeightConfigurationResponse,
    DistributionWeightItem,
    DistributionWeightResponseItem,
)


def _response_item(row: dict[str, Any]) -> DistributionWeightResponseItem:
    return DistributionWeightResponseItem(
        category=row["category_name"],
        weight=int(row["distribution_weight"]),
        defaultWeight=int(row["default_weight"]),
        active=bool(row["active"]),
        updatedAt=row["updated_at"],
        updatedBy=row["updated_by"],
    )


def _configuration_response(rows: list[dict[str, Any]]) -> DistributionWeightConfigurationResponse:
    items = [_response_item(row) for row in rows]
    latest = max(items, key=lambda item: item.updatedAt, default=None)
    return DistributionWeightConfigurationResponse(
        items=items,
        updatedAt=latest.updatedAt if latest else None,
        updatedBy=latest.updatedBy if latest else None,
    )


def _audit_snapshot(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "items": [
            {
                "category": row["category_name"],
                "weight": int(row["distribution_weight"]),
                "active": bool(row["active"]),
            }
            for row in rows
        ]
    }


def _normalized_user(user: str | None) -> str:
    return user.strip()[:255] if user and user.strip() else "sistema"


def get_distribution_weight_configuration() -> DistributionWeightConfigurationResponse:
    with get_connection() as connection:
        rows = list_distribution_weights(connection)
    return _configuration_response(rows)


def save_distribution_weight_configuration(
    items: list[DistributionWeightItem],
    *,
    user: str | None = None,
) -> DistributionWeightConfigurationResponse:
    if not items:
        raise HTTPException(status_code=400, detail="Informe os pesos de distribuição.")
    if not any(item.active for item in items):
        raise HTTPException(
            status_code=400,
            detail="Pelo menos uma categoria deve participar da distribuição.",
        )
    categories = [item.category.strip() for item in items]
    if any(not category for category in categories):
        raise HTTPException(status_code=400, detail="Categoria inválida.")
    if len(set(categories)) != len(categories):
        raise HTTPException(status_code=400, detail="Não repita categorias na configuração.")

    changed_by = _normalized_user(user)
    with get_connection() as connection:
        before = list_distribution_weights(connection)
        existing_categories = {row["category_name"] for row in before}
        if set(categories) != existing_categories:
            raise HTTPException(
                status_code=400,
                detail="A configuração deve conter todas as categorias cadastradas.",
            )
        updated = update_distribution_weights(
            connection,
            items=[
                {"category": item.category.strip(), "weight": item.weight, "active": item.active}
                for item in items
            ],
            user=changed_by,
        )
        insert_audit_log(
            connection,
            entity="general_indicator_distribution_weights",
            record_id="global",
            action="updated",
            user=changed_by,
            before=_audit_snapshot(before),
            after=_audit_snapshot(updated),
        )
    return _configuration_response(updated)


def reset_distribution_weight_configuration(
    *,
    user: str | None = None,
) -> DistributionWeightConfigurationResponse:
    changed_by = _normalized_user(user)
    with get_connection() as connection:
        before = list_distribution_weights(connection)
        if not before:
            raise HTTPException(status_code=404, detail="Configuração de pesos não encontrada.")
        updated = restore_default_distribution_weights(connection, user=changed_by)
        insert_audit_log(
            connection,
            entity="general_indicator_distribution_weights",
            record_id="global",
            action="restored_defaults",
            user=changed_by,
            before=_audit_snapshot(before),
            after=_audit_snapshot(updated),
        )
    return _configuration_response(updated)

