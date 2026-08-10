from __future__ import annotations

from datetime import date
from typing import Any

from psycopg import Connection


def list_target_periods(connection: Connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                start_date,
                end_date,
                projects_target,
                errors_limit,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM general_indicator_target_periods
            ORDER BY start_date DESC, end_date DESC, id DESC
            """
        )
        return list(cursor.fetchall())


def get_target_period(connection: Connection, period_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                start_date,
                end_date,
                projects_target,
                errors_limit,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM general_indicator_target_periods
            WHERE id = %s
            """,
            (period_id,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def find_target_periods_covering(
    connection: Connection,
    *,
    start_date: date,
    end_date: date,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                start_date,
                end_date,
                projects_target,
                errors_limit,
                created_at,
                created_by,
                updated_at,
                updated_by
            FROM general_indicator_target_periods
            WHERE start_date <= %s AND end_date >= %s
            ORDER BY start_date, end_date, id
            """,
            (end_date, start_date),
        )
        return list(cursor.fetchall())


def has_overlapping_target_period(
    connection: Connection,
    *,
    start_date: date,
    end_date: date,
    excluding_id: int | None = None,
) -> bool:
    params: list[Any] = [start_date, end_date]
    sql = """
        SELECT 1
        FROM general_indicator_target_periods
        WHERE start_date <= %s
          AND end_date >= %s
    """
    if excluding_id is not None:
        sql += " AND id <> %s"
        params.append(excluding_id)
    sql += " LIMIT 1"
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.fetchone() is not None


def insert_target_period(
    connection: Connection,
    *,
    start_date: date,
    end_date: date,
    projects_target: Any,
    errors_limit: Any,
    user: str,
) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO general_indicator_target_periods (
                start_date,
                end_date,
                projects_target,
                errors_limit,
                created_by,
                updated_by
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING
                id,
                start_date,
                end_date,
                projects_target,
                errors_limit,
                created_at,
                created_by,
                updated_at,
                updated_by
            """,
            (start_date, end_date, projects_target, errors_limit, user, user),
        )
        return dict(cursor.fetchone())


def update_target_period(
    connection: Connection,
    period_id: int,
    *,
    start_date: date,
    end_date: date,
    projects_target: Any,
    errors_limit: Any,
    user: str,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_target_periods
            SET
                start_date = %s,
                end_date = %s,
                projects_target = %s,
                errors_limit = %s,
                updated_at = NOW(),
                updated_by = %s
            WHERE id = %s
            RETURNING
                id,
                start_date,
                end_date,
                projects_target,
                errors_limit,
                created_at,
                created_by,
                updated_at,
                updated_by
            """,
            (start_date, end_date, projects_target, errors_limit, user, period_id),
        )
        row = cursor.fetchone()
        return dict(row) if row else None


def delete_target_period(connection: Connection, period_id: int) -> dict[str, Any] | None:
    before = get_target_period(connection, period_id)
    if before is None:
        return None
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM general_indicator_target_periods WHERE id = %s", (period_id,))
    return before
