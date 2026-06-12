from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log
from app.repositories.analytics_repository import AnalyticsRepository
from app.services.analytics_service import (
    generate_and_persist_operational_insights,
    list_persisted_operational_insights,
    update_operational_insight_status,
)

router = APIRouter()


class GenerateInsightsPayload(BaseModel):
    importacao_id: int


class UpdateInsightStatusPayload(BaseModel):
    status: str
    usuario: str = "sistema"


@router.get("/insights")
def get_operational_insights(
    importacao_id: int | None = None,
    import_id: int | None = Query(None, alias="importId"),
    insight_type: str | None = Query(None, alias="type"),
    tipo: str | None = None,
    severity: str | None = None,
    severidade: str | None = None,
    status: str | None = None,
) -> dict:
    with get_connection() as connection:
        repository = AnalyticsRepository(connection)
        return list_persisted_operational_insights(
            repository,
            import_id=importacao_id or import_id,
            insight_type=tipo or insight_type,
            severity=severidade or severity,
            status=status,
        )


@router.post("/insights/generate")
def generate_operational_insights(payload: GenerateInsightsPayload) -> dict:
    with get_connection() as connection:
        repository = AnalyticsRepository(connection)
        return generate_and_persist_operational_insights(repository, import_id=payload.importacao_id)


@router.patch("/insights/{insight_id}/status")
def update_insight_status(insight_id: int, payload: UpdateInsightStatusPayload) -> dict:
    with get_connection() as connection:
        repository = AnalyticsRepository(connection)
        try:
            updated, before = update_operational_insight_status(
                repository,
                insight_id=insight_id,
                status=payload.status,
                user=payload.usuario,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if payload.status in {"revisado", "ignorado"}:
            insert_audit_log(
                connection,
                entity="analytics_insight",
                record_id=insight_id,
                action=f"status_{payload.status}",
                user=payload.usuario or "sistema",
                before={"status": before["status"], "usuario_revisao": before["usuario_revisao"]},
                after={"status": updated["status"], "usuario_revisao": updated["reviewUser"]},
            )

    return updated
