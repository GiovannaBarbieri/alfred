from __future__ import annotations

import json
from typing import Any

from psycopg import Connection


def create_import_session(
    connection: Connection,
    *,
    filename: str,
    file_hash: str,
    content: bytes,
    total_rows: int,
    valid_rows: int,
    alert_rows: int,
    blocked_rows: int,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO import_sessions (
                nome_arquivo,
                hash_arquivo,
                conteudo_arquivo,
                status,
                total_registros,
                registros_validos,
                registros_com_alerta,
                registros_bloqueados
            )
            VALUES (%s, %s, %s, 'VALIDADO', %s, %s, %s, %s)
            RETURNING id
            """,
            (filename, file_hash, content, total_rows, valid_rows, alert_rows, blocked_rows),
        )
        return int(cursor.fetchone()["id"])


def update_import_session_summary(
    connection: Connection,
    session_id: int,
    *,
    status: str,
    total_rows: int,
    valid_rows: int,
    alert_rows: int,
    blocked_rows: int,
    import_id: int | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE import_sessions
            SET
                status = %s,
                total_registros = %s,
                registros_validos = %s,
                registros_com_alerta = %s,
                registros_bloqueados = %s,
                importacao_final_id = COALESCE(%s, importacao_final_id),
                atualizado_em = NOW()
            WHERE id = %s
            """,
            (status, total_rows, valid_rows, alert_rows, blocked_rows, import_id, session_id),
        )


def get_import_session(connection: Connection, session_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                nome_arquivo,
                hash_arquivo,
                conteudo_arquivo,
                status,
                total_registros,
                registros_validos,
                registros_com_alerta,
                registros_bloqueados,
                importacao_final_id,
                criado_em,
                atualizado_em
            FROM import_sessions
            WHERE id = %s
            """,
            (session_id,),
        )
        return cursor.fetchone()


def clear_staging_rows(connection: Connection, session_id: int) -> None:
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM staging_rows WHERE session_id = %s", (session_id,))


def list_staging_rows(connection: Connection, session_id: int) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                linha,
                id_lancamento,
                id_task,
                login_usuario,
                titulo_task,
                dados_originais,
                categoria_sugerida,
                subcategoria_sugerida,
                origem_classificacao,
                confianca,
                nivel_confianca
            FROM staging_rows
            WHERE session_id = %s
            ORDER BY linha
            """,
            (session_id,),
        )
        return list(cursor.fetchall())


def insert_staging_rows(connection: Connection, session_id: int, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    with connection.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO staging_rows (
                session_id,
                linha,
                id_lancamento,
                id_task,
                login_usuario,
                titulo_task,
                dados_originais,
                categoria_sugerida,
                subcategoria_sugerida,
                origem_classificacao,
                confianca,
                nivel_confianca
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s)
            ON CONFLICT (session_id, linha) DO UPDATE SET
                id_lancamento = EXCLUDED.id_lancamento,
                id_task = EXCLUDED.id_task,
                login_usuario = EXCLUDED.login_usuario,
                titulo_task = EXCLUDED.titulo_task,
                dados_originais = EXCLUDED.dados_originais,
                categoria_sugerida = EXCLUDED.categoria_sugerida,
                subcategoria_sugerida = EXCLUDED.subcategoria_sugerida,
                origem_classificacao = EXCLUDED.origem_classificacao,
                confianca = EXCLUDED.confianca,
                nivel_confianca = EXCLUDED.nivel_confianca
            """,
            [
                (
                    session_id,
                    row["line"],
                    row.get("idLancamento"),
                    row.get("idTask"),
                    row.get("loginUsuario"),
                    row.get("tituloTask"),
                    json.dumps(row.get("raw", {}), default=str),
                    row.get("category"),
                    row.get("subcategory"),
                    row.get("origin"),
                    row.get("confidence"),
                    row.get("confidenceLevel"),
                )
                for row in rows
            ],
        )


def cancel_import_session(connection: Connection, session_id: int) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE import_sessions
            SET status = 'CANCELADO', atualizado_em = NOW()
            WHERE id = %s AND status <> 'CONFIRMADO'
            """,
            (session_id,),
        )


def insert_import_log(
    connection: Connection,
    *,
    stage: str,
    event: str,
    level: str = "info",
    message: str | None = None,
    metrics: dict[str, Any] | None = None,
    session_id: int | None = None,
    import_id: int | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO import_logs (
                session_id,
                importacao_id,
                etapa,
                nivel,
                evento,
                mensagem,
                metricas
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                session_id,
                import_id,
                stage,
                level,
                event,
                message,
                json.dumps(metrics or {}, default=str),
            ),
        )
