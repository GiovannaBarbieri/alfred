from __future__ import annotations

from app.core.config import settings
from app.db import get_connection
from app.repositories.staging_repository import delete_old_import_sessions


def cleanup_old_import_sessions(retention_days: int | None = None) -> int:
    days = settings.import_session_retention_days if retention_days is None else retention_days
    if days <= 0:
        return 0

    with get_connection() as connection:
        return delete_old_import_sessions(connection, days)
