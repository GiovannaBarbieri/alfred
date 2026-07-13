import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analytics, audit, dashboard, exports, imports, reports, settings as settings_routes
from app.core.config import settings
from app.services.schema_service import ensure_runtime_schema
from app.services.session_cleanup_service import cleanup_old_import_sessions


logger = logging.getLogger(__name__)


app = FastAPI(
    title="ADVISE Gerenciador de horas",
    version="0.1.0",
    description="API para importacao, validacao e analise de horas lancadas no TFS.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(imports.router, prefix="/api/imports", tags=["imports"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(exports.router, prefix="/api/exports", tags=["exports"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])


@app.on_event("startup")
def startup() -> None:
    ensure_runtime_schema()
    try:
        deleted_sessions = cleanup_old_import_sessions()
        if deleted_sessions:
            logger.info("Sessoes temporarias antigas removidas: %s", deleted_sessions)
    except Exception:
        logger.exception("Falha ao limpar sessoes temporarias antigas.")


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
