from __future__ import annotations

from typing import Any

from psycopg import Connection


def list_distribution_weights(connection: Connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                category_name,
                distribution_weight,
                default_weight,
                active,
                updated_at,
                updated_by
            FROM general_indicator_distribution_weights
            ORDER BY
                CASE category_name
                    WHEN 'Novo projeto' THEN 1
                    WHEN 'Melhoria' THEN 2
                    WHEN 'Erro TI' THEN 3
                    WHEN 'Bug' THEN 4
                    WHEN 'Manutenção' THEN 5
                    ELSE 99
                END,
                category_name
            """
        )
        return list(cursor.fetchall())


def update_distribution_weights(
    connection: Connection,
    *,
    items: list[dict[str, Any]],
    user: str,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        for item in items:
            cursor.execute(
                """
                UPDATE general_indicator_distribution_weights
                SET
                    distribution_weight = %s,
                    active = %s,
                    updated_at = NOW(),
                    updated_by = %s
                WHERE category_name = %s
                """,
                (item["weight"], item["active"], user, item["category"]),
            )
    return list_distribution_weights(connection)


def restore_default_distribution_weights(
    connection: Connection,
    *,
    user: str,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_distribution_weights
            SET
                distribution_weight = default_weight,
                active = TRUE,
                updated_at = NOW(),
                updated_by = %s
            """,
            (user,),
        )
    return list_distribution_weights(connection)

