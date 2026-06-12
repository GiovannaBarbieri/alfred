from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from app.db import get_connection
from app.repositories.audit_repository import list_audit_logs

router = APIRouter()


@router.get("")
def get_audit_logs(
    entity: str | None = Query(None),
    action: str | None = Query(None),
    search: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = list_audit_logs(
            connection,
            entity=entity,
            action=action,
            search=search,
            limit=limit,
        )

    return [
        {
            "id": row["id"],
            "entity": row["entidade"],
            "recordId": row["registro_id"],
            "action": row["acao"],
            "user": row["usuario"],
            "before": row["antes"],
            "after": row["depois"],
            "createdAt": row["criado_em"].isoformat(),
        }
        for row in rows
    ]
