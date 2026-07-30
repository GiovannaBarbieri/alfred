from __future__ import annotations

import threading
from decimal import Decimal
from typing import Any, Iterable

from fastapi import HTTPException

from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log
from app.repositories.general_indicator_modules_repository import (
    get_general_indicator_module,
    insert_new_general_indicator_modules,
    list_general_indicator_modules,
    update_general_indicator_module_status,
)
from app.schemas.general_indicator_modules import (
    GeneralIndicatorModuleListResponse,
    GeneralIndicatorModuleResponse,
    GeneralIndicatorModuleSyncResponse,
)
from app.services.sqlserver_service import query_tfs_general_indicator_module_tags

MODULE_EXCLUSION_REASON = "Módulo inativo na configuração dos Indicadores Gerais."
_sync_lock = threading.Lock()


def extract_level_one_tags(raw_tags: Any) -> list[str]:
    values: list[str] = []
    seen: set[str] = set()
    for raw_value in str(raw_tags or "").split(";"):
        value = raw_value.strip()
        if value.startswith("1-") and value not in seen:
            seen.add(value)
            values.append(value)
    return values


def get_general_indicator_modules() -> GeneralIndicatorModuleListResponse:
    with get_connection() as connection:
        rows = list_general_indicator_modules(connection)
    return _list_response(rows)


def set_general_indicator_module_status(
    module_id: int,
    *,
    active: bool,
    user: str | None,
) -> GeneralIndicatorModuleResponse:
    changed_by = user.strip()[:255] if user and user.strip() else "sistema"
    with get_connection() as connection:
        before = get_general_indicator_module(connection, module_id, for_update=True)
        if before is None:
            raise HTTPException(status_code=404, detail="Módulo não encontrado.")
        updated = update_general_indicator_module_status(connection, module_id, active=active)
        assert updated is not None
        insert_audit_log(
            connection,
            entity="general_indicator_module",
            record_id=module_id,
            action="activated" if active else "deactivated",
            user=changed_by,
            before=_audit_item(before),
            after=_audit_item(updated),
        )
    return _response_item(updated)


def sync_general_indicator_modules(*, user: str | None) -> GeneralIndicatorModuleSyncResponse:
    if not _sync_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A atualização de módulos já está em andamento.")
    try:
        changed_by = user.strip()[:255] if user and user.strip() else "sistema"
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT pg_try_advisory_xact_lock(hashtext(%s)) AS acquired",
                    ("general_indicator_modules_sync",),
                )
                if not bool(cursor.fetchone()["acquired"]):
                    raise HTTPException(status_code=409, detail="A atualização de módulos já está em andamento.")
            discovered = sorted(
                {
                    tag.strip()
                    for tag in query_tfs_general_indicator_module_tags()
                    if tag and tag.strip().startswith("1-")
                }
            )
            before = list_general_indicator_modules(connection)
            created_count = insert_new_general_indicator_modules(connection, discovered)
            rows = list_general_indicator_modules(connection)
            insert_audit_log(
                connection,
                entity="general_indicator_modules",
                record_id="sync",
                action="synchronized",
                user=changed_by,
                before={"total": len(before)},
                after={
                    "total": len(rows),
                    "discoveredCount": len(discovered),
                    "createdCount": created_count,
                },
            )
        response = _list_response(rows)
        return GeneralIndicatorModuleSyncResponse(
            **response.model_dump(),
            discoveredCount=len(discovered),
            createdCount=created_count,
        )
    finally:
        _sync_lock.release()


def apply_general_indicator_module_configuration(
    consultation: dict[str, Any],
    modules: Iterable[dict[str, Any]],
) -> dict[str, Any]:
    """Aplica a configuração somente à elegibilidade; os lançamentos permanecem no snapshot técnico."""
    configuration = {str(item["tag_name"]): bool(item["active"]) for item in modules}
    launches = list(consultation.get("launches") or [])
    inactive_hours: dict[str, Decimal] = {}
    inactive_launches: dict[str, int] = {}

    for launch in launches:
        module_tags = extract_level_one_tags(launch.get("trace", {}).get("featureTagsRaw"))
        module_tag = module_tags[0] if module_tags else None
        module_active = configuration.get(module_tag, True) if module_tag else True
        launch["moduleTag"] = module_tag
        launch["moduleActive"] = module_active
        launch["excludedByModule"] = not module_active
        if not module_active:
            launch["disregardedFromGeneralIndicators"] = True
            launch["moduleExclusionReason"] = MODULE_EXCLUSION_REASON
            duration = launch.get("durationSeconds")
            inactive_hours[module_tag] = inactive_hours.get(module_tag, Decimal(0)) + Decimal(str(duration or 0))
            inactive_launches[module_tag] = inactive_launches.get(module_tag, 0) + 1

    summary = consultation.setdefault("summary", {})
    summary["moduleConfiguration"] = [
        {"tagName": tag_name, "active": active}
        for tag_name, active in sorted(configuration.items())
    ]
    summary["disregardedModules"] = [
        {
            "tagName": tag_name,
            "hours": float((seconds / Decimal(3600)).quantize(Decimal("0.0001"))),
            "launchCount": inactive_launches[tag_name],
        }
        for tag_name, seconds in sorted(inactive_hours.items())
    ]
    summary["disregardedModuleHours"] = round(
        sum((item["hours"] for item in summary["disregardedModules"]), 0.0),
        4,
    )
    return consultation


def _response_item(row: dict[str, Any]) -> GeneralIndicatorModuleResponse:
    return GeneralIndicatorModuleResponse(
        id=int(row["id"]),
        tagName=str(row["tag_name"]),
        active=bool(row["active"]),
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
    )


def _list_response(rows: list[dict[str, Any]]) -> GeneralIndicatorModuleListResponse:
    items = [_response_item(row) for row in rows]
    active_count = sum(item.active for item in items)
    return GeneralIndicatorModuleListResponse(
        items=items,
        total=len(items),
        activeCount=active_count,
        inactiveCount=len(items) - active_count,
    )


def _audit_item(row: dict[str, Any]) -> dict[str, Any]:
    return {"id": int(row["id"]), "tagName": str(row["tag_name"]), "active": bool(row["active"])}
