from __future__ import annotations

import json
from typing import Any

from psycopg import Connection


def insert_audit_log(
    connection: Connection,
    *,
    entity: str,
    action: str,
    record_id: str | int | None = None,
    user: str = "sistema",
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO audit_log (
                entidade,
                registro_id,
                acao,
                usuario,
                antes,
                depois
            )
            VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb)
            """,
            (
                entity,
                str(record_id) if record_id is not None else None,
                action,
                user,
                json.dumps(before, default=str) if before is not None else None,
                json.dumps(after, default=str) if after is not None else None,
            ),
        )


def list_audit_logs(
    connection: Connection,
    *,
    entity: str | None = None,
    action: str | None = None,
    search: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []

    if entity:
        clauses.append("entidade = %s")
        params.append(entity)
    if action:
        clauses.append("acao = %s")
        params.append(action)
    if search:
        clauses.append("(registro_id ILIKE %s OR usuario ILIKE %s OR entidade ILIKE %s OR acao ILIKE %s)")
        like = f"%{search}%"
        params.extend([like, like, like, like])

    where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.append(max(1, min(limit, 500)))

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT
                id,
                entidade,
                registro_id,
                acao,
                usuario,
                antes,
                depois,
                criado_em
            FROM audit_log
            {where_clause}
            ORDER BY criado_em DESC, id DESC
            LIMIT %s
            """,
            params,
        )
        return cursor.fetchall()
