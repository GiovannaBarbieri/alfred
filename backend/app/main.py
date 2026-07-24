import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.api.routes import analytics, audit, dashboard, exports, general_indicators, imports, reports, settings as settings_routes
from app.core.config import settings
from app.services.migration_service import run_database_migrations
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
app.add_middleware(GZipMiddleware, minimum_size=1_000, compresslevel=5)

app.include_router(imports.router, prefix="/api/imports", tags=["imports"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(exports.router, prefix="/api/exports", tags=["exports"])
app.include_router(settings_routes.router, prefix="/api/settings", tags=["settings"])
app.include_router(audit.router, prefix="/api/audit", tags=["audit"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(general_indicators.router, prefix="/api/general-indicators", tags=["general-indicators"])


@app.on_event("startup")
def startup() -> None:
    run_database_migrations()
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
