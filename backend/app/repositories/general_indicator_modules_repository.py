from __future__ import annotations

from typing import Any

from psycopg import Connection


def list_general_indicator_modules(connection: Connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, tag_name, active, created_at, updated_at
            FROM general_indicator_modules
            ORDER BY tag_name
            """
        )
        return list(cursor.fetchall())


def get_general_indicator_module(
    connection: Connection,
    module_id: int,
    *,
    for_update: bool = False,
) -> dict[str, Any] | None:
    suffix = " FOR UPDATE" if for_update else ""
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT id, tag_name, active, created_at, updated_at
            FROM general_indicator_modules
            WHERE id = %s{suffix}
            """,
            (module_id,),
        )
        return cursor.fetchone()

def insert_new_general_indicator_modules(
    connection: Connection,
    tag_names: list[str],
) -> int:
    if not tag_names:
        return 0
    created = 0
    with connection.cursor() as cursor:
        for tag_name in tag_names:
            cursor.execute(
                """
                INSERT INTO general_indicator_modules (tag_name, active)
                VALUES (%s, TRUE)
                ON CONFLICT (tag_name) DO NOTHING
                """,
                (tag_name,),
            )
            created += cursor.rowcount
    return created


def update_general_indicator_module_status(
    connection: Connection,
    module_id: int,
    *,
    active: bool,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_modules
            SET active = %s, updated_at = NOW()
            WHERE id = %s
            RETURNING id, tag_name, active, created_at, updated_at
            """,
            (active, module_id),
        )
        return cursor.fetchone()
