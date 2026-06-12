from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app.core.config import settings


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    database_url = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
    connection = psycopg.connect(database_url, row_factory=dict_row)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
