from __future__ import annotations

import hashlib
import re
from collections.abc import Callable
from contextlib import AbstractContextManager
from dataclasses import dataclass
from pathlib import Path

from psycopg import Connection

from app.db import get_connection


MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"
_MIGRATION_NAME = re.compile(r"^(?P<version>\d{4})_(?P<name>[a-z0-9_]+)\.sql$")
_LOCK_NAME = "alfred_schema_migrations"


class DatabaseMigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class DatabaseMigration:
    version: str
    name: str
    checksum: str
    sql: str
    path: Path


def discover_database_migrations(migrations_dir: Path = MIGRATIONS_DIR) -> list[DatabaseMigration]:
    if not migrations_dir.is_dir():
        raise DatabaseMigrationError(f"Diretório de migrations não encontrado: {migrations_dir}")
    migrations: list[DatabaseMigration] = []
    versions: set[str] = set()
    for path in sorted(migrations_dir.glob("*.sql")):
        match = _MIGRATION_NAME.fullmatch(path.name)
        if match is None:
            raise DatabaseMigrationError(f"Nome de migration inválido: {path.name}")
        version = match.group("version")
        if version in versions:
            raise DatabaseMigrationError(f"Versão de migration duplicada: {version}")
        sql = path.read_text(encoding="utf-8").strip()
        if not sql:
            raise DatabaseMigrationError(f"Migration vazia: {path.name}")
        versions.add(version)
        migrations.append(
            DatabaseMigration(
                version=version,
                name=match.group("name"),
                checksum=hashlib.sha256(sql.encode("utf-8")).hexdigest(),
                sql=sql,
                path=path,
            )
        )
    return migrations


def run_database_migrations(
    migrations_dir: Path = MIGRATIONS_DIR,
    connection_factory: Callable[[], AbstractContextManager[Connection]] = get_connection,
) -> list[str]:
    migrations = discover_database_migrations(migrations_dir)
    applied_now: list[str] = []
    with connection_factory() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(20) PRIMARY KEY,
                    name VARCHAR(180) NOT NULL,
                    checksum CHAR(64) NOT NULL,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (_LOCK_NAME,))
            cursor.execute("SELECT version, name, checksum FROM schema_migrations ORDER BY version")
            applied = {str(row["version"]): row for row in cursor.fetchall()}
            for migration in migrations:
                previous = applied.get(migration.version)
                if previous is not None:
                    if str(previous["checksum"]) != migration.checksum:
                        raise DatabaseMigrationError(
                            f"A migration {migration.version} já foi aplicada com conteúdo diferente."
                        )
                    continue
                cursor.execute(migration.sql, prepare=False)
                cursor.execute(
                    """
                    INSERT INTO schema_migrations (version, name, checksum)
                    VALUES (%s, %s, %s)
                    """,
                    (migration.version, migration.name, migration.checksum),
                )
                applied_now.append(migration.version)
    return applied_now
