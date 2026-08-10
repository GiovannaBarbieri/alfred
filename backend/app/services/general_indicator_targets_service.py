from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import HTTPException

from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log
from app.repositories.general_indicator_targets_repository import (
    delete_target_period,
    find_target_periods_covering,
    get_target_period,
    has_overlapping_target_period,
    insert_target_period,
    list_target_periods,
    update_target_period,
)
from app.schemas.general_indicator_targets import (
    GeneralIndicatorTargetPeriodListResponse,
    GeneralIndicatorTargetPeriodPayload,
    GeneralIndicatorTargetPeriodResponse,
    GeneralIndicatorTargetPeriodUpdatePayload,
)


TARGET_CONFIGURATION_VERSION = "general-indicators-target-periods-v1"


class GeneralIndicatorTargetConfigurationError(ValueError):
    pass


def _normalized_user(user: str | None) -> str:
    return user.strip()[:255] if user and user.strip() else "sistema"


def _response(row: dict[str, Any]) -> GeneralIndicatorTargetPeriodResponse:
    return GeneralIndicatorTargetPeriodResponse(
        id=int(row["id"]),
        startDate=row["start_date"],
        endDate=row["end_date"],
        projectsTarget=Decimal(str(row["projects_target"])),
        errorsLimit=Decimal(str(row["errors_limit"])),
        createdAt=row["created_at"],
        createdBy=row["created_by"],
        updatedAt=row["updated_at"],
        updatedBy=row["updated_by"],
    )


def _snapshot(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(row["id"]),
        "version": TARGET_CONFIGURATION_VERSION,
        "startDate": row["start_date"].isoformat(),
        "endDate": row["end_date"].isoformat(),
        "projectsImprovements": {
            "target": str(Decimal(str(row["projects_target"])).quantize(Decimal("0.01"))),
            "direction": "higher_is_better",
        },
        "errorsBugs": {
            "limit": str(Decimal(str(row["errors_limit"])).quantize(Decimal("0.01"))),
            "direction": "lower_is_better",
        },
        "updatedAt": row["updated_at"].isoformat() if row.get("updated_at") else None,
        "updatedBy": row.get("updated_by"),
    }


def list_general_indicator_target_periods() -> GeneralIndicatorTargetPeriodListResponse:
    with get_connection() as connection:
        rows = list_target_periods(connection)
    return GeneralIndicatorTargetPeriodListResponse(items=[_response(row) for row in rows])


def create_general_indicator_target_period(
    payload: GeneralIndicatorTargetPeriodPayload,
    *,
    user: str | None = None,
) -> GeneralIndicatorTargetPeriodResponse:
    _validate_dates(payload.startDate, payload.endDate)
    changed_by = _normalized_user(user)
    with get_connection() as connection:
        if has_overlapping_target_period(
            connection,
            start_date=payload.startDate,
            end_date=payload.endDate,
        ):
            raise HTTPException(status_code=400, detail="Já existe uma vigência de metas sobreposta a este período.")
        row = insert_target_period(
            connection,
            start_date=payload.startDate,
            end_date=payload.endDate,
            projects_target=payload.projectsTarget,
            errors_limit=payload.errorsLimit,
            user=changed_by,
        )
        insert_audit_log(
            connection,
            entity="general_indicator_target_periods",
            record_id=str(row["id"]),
            action="created",
            user=changed_by,
            before=None,
            after=_snapshot(row),
        )
    return _response(row)


def update_general_indicator_target_period(
    period_id: int,
    payload: GeneralIndicatorTargetPeriodUpdatePayload,
    *,
    user: str | None = None,
) -> GeneralIndicatorTargetPeriodResponse:
    changed_by = _normalized_user(user)
    with get_connection() as connection:
        before = get_target_period(connection, period_id)
        if before is None:
            raise HTTPException(status_code=404, detail="Vigência de metas não encontrada.")
        start_date = payload.startDate or before["start_date"]
        end_date = payload.endDate or before["end_date"]
        projects_target = payload.projectsTarget if payload.projectsTarget is not None else before["projects_target"]
        errors_limit = payload.errorsLimit if payload.errorsLimit is not None else before["errors_limit"]
        _validate_dates(start_date, end_date)
        if has_overlapping_target_period(
            connection,
            start_date=start_date,
            end_date=end_date,
            excluding_id=period_id,
        ):
            raise HTTPException(status_code=400, detail="Já existe uma vigência de metas sobreposta a este período.")
        row = update_target_period(
            connection,
            period_id,
            start_date=start_date,
            end_date=end_date,
            projects_target=projects_target,
            errors_limit=errors_limit,
            user=changed_by,
        )
        if row is None:
            raise HTTPException(status_code=404, detail="Vigência de metas não encontrada.")
        insert_audit_log(
            connection,
            entity="general_indicator_target_periods",
            record_id=str(period_id),
            action="updated",
            user=changed_by,
            before=_snapshot(before),
            after=_snapshot(row),
        )
    return _response(row)


def delete_general_indicator_target_period(
    period_id: int,
    *,
    user: str | None = None,
) -> None:
    changed_by = _normalized_user(user)
    with get_connection() as connection:
        before = delete_target_period(connection, period_id)
        if before is None:
            raise HTTPException(status_code=404, detail="Vigência de metas não encontrada.")
        insert_audit_log(
            connection,
            entity="general_indicator_target_periods",
            record_id=str(period_id),
            action="deleted",
            user=changed_by,
            before=_snapshot(before),
            after=None,
        )


def target_configuration_for_period(start_date: date, end_date: date) -> dict[str, Any]:
    _validate_dates(start_date, end_date)
    with get_connection() as connection:
        rows = find_target_periods_covering(connection, start_date=start_date, end_date=end_date)
    covering = [
        row
        for row in rows
        if row["start_date"] <= start_date and row["end_date"] >= end_date
    ]
    if len(covering) == 1:
        return _snapshot(covering[0])
    if len(covering) > 1:
        raise GeneralIndicatorTargetConfigurationError(
            "Existem múltiplas configurações de metas aplicáveis ao período selecionado."
        )
    if rows:
        raise GeneralIndicatorTargetConfigurationError(
            "O período selecionado atravessa mais de uma vigência de metas. Ajuste o intervalo ou cadastre uma vigência única."
        )
    raise GeneralIndicatorTargetConfigurationError(
        "Não existe configuração de metas aplicável ao período selecionado."
    )


def _validate_dates(start_date: date, end_date: date) -> None:
    if end_date < start_date:
        raise HTTPException(status_code=400, detail="A data final não pode ser anterior à data inicial.")
