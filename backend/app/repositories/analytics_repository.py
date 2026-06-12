from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from psycopg import Connection


def project_name_from_filename(filename: str) -> str:
    return Path(filename).stem.strip()


class AnalyticsRepository:
    def __init__(self, connection: Connection) -> None:
        self.connection = connection

    def list_imports(self) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    i.id,
                    i.nome_arquivo,
                    i.status,
                    i.data_importacao,
                    i.total_registros,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    COUNT(l.id) AS total_records
                FROM importacoes i
                LEFT JOIN lancamentos_horas l ON l.importacao_id = i.id
                GROUP BY i.id, i.nome_arquivo, i.status, i.data_importacao, i.total_registros
                ORDER BY i.data_importacao DESC, i.id DESC
                """
            )
            rows = cursor.fetchall()

        return [
            {
                **row,
                "project_name": project_name_from_filename(row["nome_arquivo"]),
            }
            for row in rows
        ]

    def get_category_metrics(self, import_id: int) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COALESCE(c.nome, 'Nao classificado') AS category,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    COUNT(l.id) AS total_records
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                WHERE l.importacao_id = %s
                GROUP BY COALESCE(c.nome, 'Nao classificado')
                ORDER BY total_seconds DESC, category
                """,
                (import_id,),
            )
            return cursor.fetchall()

    def get_collaborator_metrics(self, import_id: int) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    l.login_usuario,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    COUNT(l.id) AS total_records
                FROM lancamentos_horas l
                WHERE l.importacao_id = %s
                GROUP BY l.login_usuario
                ORDER BY total_seconds DESC, l.login_usuario
                """,
                (import_id,),
            )
            return cursor.fetchall()

    def get_low_confidence_stats(self, import_id: int, threshold: float = 0.9) -> dict[str, Any]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_classifications,
                    COUNT(*) FILTER (WHERE COALESCE(ct.confianca, 0) < %s) AS low_confidence_count,
                    COALESCE(AVG(ct.confianca), 0) AS average_confidence
                FROM classificacoes_task ct
                JOIN lancamentos_horas l ON l.id = ct.lancamento_id
                WHERE l.importacao_id = %s
                """,
                (threshold, import_id),
            )
            row = cursor.fetchone()
        return row or {"total_classifications": 0, "low_confidence_count": 0, "average_confidence": 0}

    def get_pending_reviews_stats(self, import_id: int) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    tipo,
                    status,
                    COUNT(*) AS total
                FROM pending_reviews
                WHERE importacao_id = %s
                GROUP BY tipo, status
                ORDER BY tipo, status
                """,
                (import_id,),
            )
            return cursor.fetchall()

    def get_unresolved_alert_stats(self, import_id: int) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    tipo_erro,
                    severidade,
                    COUNT(*) AS total
                FROM erros_importacao
                WHERE importacao_id = %s
                  AND COALESCE(resolvido, FALSE) = FALSE
                GROUP BY tipo_erro, severidade
                ORDER BY severidade DESC, tipo_erro
                """,
                (import_id,),
            )
            return cursor.fetchall()

    def get_excessive_duration_records(self, import_id: int, threshold_seconds: int = 12 * 60 * 60) -> list[dict[str, Any]]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id_lancamento,
                    login_usuario,
                    titulo_task,
                    duracao_segundos
                FROM lancamentos_horas
                WHERE importacao_id = %s
                  AND duracao_segundos > %s
                ORDER BY duracao_segundos DESC
                LIMIT 20
                """,
                (import_id, threshold_seconds),
            )
            return cursor.fetchall()

    def get_generic_title_records(self, import_id: int) -> list[dict[str, Any]]:
        generic_titles = ["ajuste", "ajustes", "correcao", "correção", "melhoria", "teste", "desenvolvimento"]
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    id_task,
                    titulo_task,
                    COUNT(*) AS total_records,
                    COALESCE(SUM(duracao_segundos), 0) AS total_seconds
                FROM lancamentos_horas
                WHERE importacao_id = %s
                  AND LOWER(BTRIM(titulo_task)) = ANY(%s)
                GROUP BY id_task, titulo_task
                ORDER BY total_records DESC, titulo_task
                LIMIT 20
                """,
                (import_id, generic_titles),
            )
            return cursor.fetchall()

    def save_insight(self, insight: dict[str, Any]) -> dict[str, Any]:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO analytics_insights (
                    importacao_id,
                    tipo,
                    severidade,
                    titulo,
                    descricao,
                    recomendacao,
                    metricas_json,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, 'novo')
                ON CONFLICT (importacao_id, tipo, titulo, descricao)
                DO UPDATE SET
                    severidade = EXCLUDED.severidade,
                    recomendacao = EXCLUDED.recomendacao,
                    metricas_json = EXCLUDED.metricas_json
                RETURNING id
                """,
                (
                    insight["importId"],
                    insight["tipo"],
                    insight["severidade"],
                    insight["titulo"],
                    insight["descricao"],
                    insight.get("recomendacao"),
                    json.dumps(insight.get("metadata") or {}, default=str),
                ),
            )
            row = cursor.fetchone()
        return self.get_saved_insight(row["id"])

    def list_saved_insights(
        self,
        *,
        import_id: int | None = None,
        insight_type: str | None = None,
        severity: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []

        if import_id is not None:
            clauses.append("ai.importacao_id = %s")
            params.append(import_id)
        if insight_type:
            clauses.append("ai.tipo = %s")
            params.append(insight_type)
        if severity:
            clauses.append("ai.severidade = %s")
            params.append(severity)
        if status:
            clauses.append("ai.status = %s")
            params.append(status)

        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self.connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    ai.*,
                    i.nome_arquivo
                FROM analytics_insights ai
                JOIN importacoes i ON i.id = ai.importacao_id
                {where_clause}
                ORDER BY
                    CASE ai.severidade
                        WHEN 'alta' THEN 1
                        WHEN 'media' THEN 2
                        ELSE 3
                    END,
                    ai.gerado_em DESC,
                    ai.id DESC
                """,
                params,
            )
            return cursor.fetchall()

    def get_saved_insight(self, insight_id: int) -> dict[str, Any] | None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    ai.*,
                    i.nome_arquivo
                FROM analytics_insights ai
                JOIN importacoes i ON i.id = ai.importacao_id
                WHERE ai.id = %s
                """,
                (insight_id,),
            )
            return cursor.fetchone()

    def update_insight_status(self, insight_id: int, *, status: str, user: str) -> dict[str, Any] | None:
        with self.connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE analytics_insights
                SET
                    status = %s,
                    revisado_em = CASE WHEN %s IN ('revisado', 'ignorado') THEN NOW() ELSE NULL END,
                    usuario_revisao = CASE WHEN %s IN ('revisado', 'ignorado') THEN %s ELSE NULL END
                WHERE id = %s
                RETURNING id
                """,
                (status, status, status, user, insight_id),
            )
            row = cursor.fetchone()
        if not row:
            return None
        return self.get_saved_insight(row["id"])
