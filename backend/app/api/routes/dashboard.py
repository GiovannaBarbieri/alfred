from datetime import date
from pathlib import Path

from fastapi import APIRouter
from fastapi import Query

from app.api.routes.filter_utils import build_filter_clause
from app.db import get_connection

router = APIRouter()


@router.get("/overview")
def get_dashboard_overview(
    start_date: date | None = Query(None, alias="startDate"),
    end_date: date | None = Query(None, alias="endDate"),
    user: str | None = None,
    epic_id: str | None = Query(None, alias="epicId"),
    category: str | None = None,
) -> dict:
    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        user=user,
        epic_id=epic_id,
        category=category,
    )
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH filtered_lancamentos AS (
                    SELECT
                        l.*,
                        COALESCE(c.nome, 'Nao classificado') AS categoria_nome
                    FROM lancamentos_horas l
                    LEFT JOIN categorias c ON c.id = l.categoria_id
                    {where_sql}
                ),
                filtered_imports AS (
                    SELECT DISTINCT importacao_id
                    FROM filtered_lancamentos
                ),
                unresolved_alerts AS (
                    SELECT COUNT(*) AS total
                    FROM erros_importacao e
                    JOIN filtered_imports fi ON fi.importacao_id = e.importacao_id
                    WHERE e.severidade = 'alerta'
                      AND COALESCE(e.resolvido, FALSE) = FALSE
                )
                SELECT
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    COUNT(DISTINCT l.importacao_id) AS projects_count,
                    COUNT(l.id) AS total_records,
                    COUNT(DISTINCT l.login_usuario) AS collaborators_count,
                    (SELECT total FROM unresolved_alerts) AS pending_alerts
                FROM filtered_lancamentos l
                """,
                params,
            )
            summary_row = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    i.id AS import_id,
                    i.nome_arquivo,
                    i.data_importacao,
                    i.status,
                    i.total_registros,
                    i.registros_com_alerta,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    COUNT(l.id) AS records_count,
                    COUNT(DISTINCT l.login_usuario) AS collaborators_count,
                    COALESCE(SUM(l.duracao_segundos) FILTER (WHERE c.nome = 'Retrabalho'), 0) AS rework_seconds
                FROM importacoes i
                LEFT JOIN lancamentos_horas l ON l.importacao_id = i.id
                LEFT JOIN categorias c ON c.id = l.categoria_id
                GROUP BY i.id, i.nome_arquivo, i.data_importacao, i.status, i.total_registros, i.registros_com_alerta
                ORDER BY i.data_importacao DESC, i.id DESC
                LIMIT 5
                """
            )
            recent_rows = cursor.fetchall()

            cursor.execute(
                f"""
                WITH filtered_lancamentos AS (
                    SELECT
                        l.*,
                        COALESCE(c.nome, 'Nao classificado') AS categoria_nome
                    FROM lancamentos_horas l
                    LEFT JOIN categorias c ON c.id = l.categoria_id
                    {where_sql}
                ),
                filtered_imports AS (
                    SELECT DISTINCT importacao_id
                    FROM filtered_lancamentos
                ),
                unclassified AS (
                    SELECT COALESCE(pr.status, 'pendente') AS status, COUNT(*) AS total
                    FROM (
                        SELECT DISTINCT l.id_task, l.login_usuario, l.importacao_id
                        FROM filtered_lancamentos l
                        WHERE l.categoria_nome = 'Nao classificado'
                    ) l
                    LEFT JOIN pending_reviews pr
                      ON pr.importacao_id = l.importacao_id
                     AND pr.tipo = 'unclassified'
                     AND pr.chave = CONCAT(l.id_task, '|', l.login_usuario)
                    GROUP BY COALESCE(pr.status, 'pendente')
                ),
                low_confidence AS (
                    SELECT COALESCE(pr.status, 'pendente') AS status, COUNT(*) AS total
                    FROM (
                        SELECT DISTINCT l.id_task, l.login_usuario, l.importacao_id
                        FROM filtered_lancamentos l
                        JOIN classificacoes_task ct ON ct.lancamento_id = l.id
                        WHERE COALESCE(ct.nivel_confianca, '') = 'baixa'
                    ) l
                    LEFT JOIN pending_reviews pr
                      ON pr.importacao_id = l.importacao_id
                     AND pr.tipo = 'low_confidence'
                     AND pr.chave = CONCAT(l.id_task, '|', l.login_usuario)
                    GROUP BY COALESCE(pr.status, 'pendente')
                ),
                zero_duration AS (
                    SELECT COALESCE(pr.status, 'pendente') AS status, COUNT(*) AS total
                    FROM filtered_lancamentos l
                    LEFT JOIN pending_reviews pr
                      ON pr.importacao_id = l.importacao_id
                     AND pr.tipo = 'zero_duration'
                     AND pr.chave = l.id_lancamento
                    WHERE l.duracao_segundos = 0
                    GROUP BY COALESCE(pr.status, 'pendente')
                ),
                alerts AS (
                    SELECT
                        CASE WHEN COALESCE(e.resolvido, FALSE) THEN 'revisado' ELSE 'pendente' END AS status,
                        COUNT(*) AS total
                    FROM erros_importacao e
                    JOIN filtered_imports fi ON fi.importacao_id = e.importacao_id
                    WHERE e.severidade = 'alerta'
                    GROUP BY CASE WHEN COALESCE(e.resolvido, FALSE) THEN 'revisado' ELSE 'pendente' END
                ),
                missing_profiles AS (
                    SELECT COUNT(DISTINCT l.login_usuario) AS total
                    FROM filtered_lancamentos l
                    LEFT JOIN perfis_colaborador p
                      ON LOWER(p.login_usuario) = LOWER(l.login_usuario)
                     AND p.ativo = TRUE
                    LEFT JOIN colaboradores_ignorados ci
                      ON LOWER(ci.login_usuario) = LOWER(l.login_usuario)
                     AND ci.ativo = TRUE
                    WHERE p.id IS NULL
                      AND ci.id IS NULL
                      AND COALESCE(l.login_usuario, '') <> ''
                )
                SELECT
                    COALESCE((SELECT SUM(total) FROM unclassified WHERE status = 'pendente'), 0) AS classification_pending,
                    COALESCE((SELECT SUM(total) FROM low_confidence WHERE status = 'pendente'), 0) AS low_confidence,
                    COALESCE((SELECT total FROM missing_profiles), 0) AS collaborators_without_profile,
                    COALESCE((SELECT SUM(total) FROM zero_duration WHERE status = 'pendente'), 0) +
                    COALESCE((SELECT SUM(total) FROM alerts WHERE status = 'pendente'), 0) AS alerts_pending
                """
                ,
                params,
            )
            pending_row = cursor.fetchone()

            cursor.execute(
                f"""
                WITH category_totals AS (
                    SELECT
                        CASE
                            WHEN c.nome IN ('Acompanhamento', 'Definição', 'Desenvolvimento', 'Homologação', 'Impedimento', 'Retrabalho')
                                THEN c.nome
                            ELSE 'Outros'
                        END AS category,
                        COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds
                    FROM lancamentos_horas l
                    LEFT JOIN categorias c ON c.id = l.categoria_id
                    {where_sql}
                    GROUP BY
                        CASE
                            WHEN c.nome IN ('Acompanhamento', 'Definição', 'Desenvolvimento', 'Homologação', 'Impedimento', 'Retrabalho')
                                THEN c.nome
                            ELSE 'Outros'
                        END
                ),
                categories(category, sort_order) AS (
                    VALUES
                        ('Acompanhamento', 1),
                        ('Definição', 2),
                        ('Desenvolvimento', 3),
                        ('Homologação', 4),
                        ('Impedimento', 5),
                        ('Retrabalho', 6),
                        ('Outros', 7)
                ),
                totals AS (
                    SELECT COALESCE(SUM(total_seconds), 0) AS grand_total_seconds
                    FROM category_totals
                )
                SELECT
                    categories.category,
                    COALESCE(category_totals.total_seconds, 0) AS total_seconds,
                    CASE
                        WHEN totals.grand_total_seconds = 0 THEN 0
                        ELSE ROUND((COALESCE(category_totals.total_seconds, 0)::numeric / totals.grand_total_seconds) * 100, 2)
                    END AS percentage
                FROM categories
                LEFT JOIN category_totals ON category_totals.category = categories.category
                CROSS JOIN totals
                ORDER BY categories.sort_order
                """,
                params,
            )
            category_rows = cursor.fetchall()

            cursor.execute(
                f"""
                SELECT
                    DATE(l.data_hora_cadastro) AS period,
                    ROUND((SUM(l.duracao_segundos)::numeric / 3600), 2) AS horas
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                {where_sql}
                GROUP BY DATE(l.data_hora_cadastro)
                ORDER BY period
                """,
                params,
            )
            timeline_rows = cursor.fetchall()

            cursor.execute(
                f"""
                WITH filtered_lancamentos AS (
                    SELECT l.*
                    FROM lancamentos_horas l
                    LEFT JOIN categorias c ON c.id = l.categoria_id
                    {where_sql}
                ),
                collaborator_totals AS (
                    SELECT
                        l.login_usuario,
                        COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds
                    FROM filtered_lancamentos l
                    WHERE COALESCE(l.login_usuario, '') <> ''
                    GROUP BY l.login_usuario
                ),
                totals AS (
                    SELECT COALESCE(SUM(total_seconds), 0) AS grand_total_seconds
                    FROM collaborator_totals
                )
                SELECT
                    collaborator_totals.login_usuario,
                    collaborator_totals.total_seconds,
                    CASE
                        WHEN totals.grand_total_seconds = 0 THEN 0
                        ELSE ROUND((collaborator_totals.total_seconds::numeric / totals.grand_total_seconds) * 100, 2)
                    END AS percentage
                FROM collaborator_totals
                CROSS JOIN totals
                ORDER BY collaborator_totals.total_seconds DESC, collaborator_totals.login_usuario
                LIMIT 5
                """,
                params,
            )
            collaborator_rows = cursor.fetchall()

    return {
            "summary": {
                "totalHours": round(int(summary_row["total_seconds"]) / 3600, 2),
                "projectsCount": summary_row["projects_count"],
                "totalRecords": summary_row["total_records"],
                "collaboratorsCount": summary_row["collaborators_count"],
                "pendingAlerts": summary_row["pending_alerts"],
            },
        "recentProjects": [
            {
                "importId": row["import_id"],
                "projectName": Path(row["nome_arquivo"]).stem,
                "filename": row["nome_arquivo"],
                "importedAt": row["data_importacao"].isoformat(),
                "totalHours": round(int(row["total_seconds"]) / 3600, 2),
                "recordsCount": row["records_count"] or row["total_registros"],
                "collaboratorsCount": row["collaborators_count"] or 0,
                "alertsCount": row["registros_com_alerta"],
                "reworkHours": round(int(row["rework_seconds"]) / 3600, 2),
                "status": _display_status(row["status"]),
            }
            for row in recent_rows
        ],
        "pendingItems": {
            "classificationPending": int(pending_row["classification_pending"] or 0),
            "lowConfidence": int(pending_row["low_confidence"] or 0),
            "collaboratorsWithoutProfile": int(pending_row["collaborators_without_profile"] or 0),
            "alertsPending": int(pending_row["alerts_pending"] or 0),
        },
        "categorySummary": [
            {
                "category": row["category"],
                "hours": round(int(row["total_seconds"]) / 3600, 2),
                "percentage": float(row["percentage"]),
            }
            for row in category_rows
        ],
        "collaboratorSummary": [
            {
                "loginUsuario": row["login_usuario"],
                "hours": round(int(row["total_seconds"]) / 3600, 2),
                "percentage": float(row["percentage"]),
            }
            for row in collaborator_rows
        ],
        "timeline": [{"period": row["period"].isoformat(), "horas": float(row["horas"])} for row in timeline_rows],
    }


def _display_status(status: str) -> str:
    if status == "concluida":
        return "Concluido"
    if status == "cancelada":
        return "Cancelado"
    if status == "reprocessada":
        return "Reprocessado"
    return status.capitalize()


@router.get("/summary")
def get_summary(
    start_date: date | None = Query(None, alias="startDate"),
    end_date: date | None = Query(None, alias="endDate"),
    user: str | None = None,
    epic_id: str | None = Query(None, alias="epicId"),
    category: str | None = None,
) -> dict:
    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        user=user,
        epic_id=epic_id,
        category=category,
    )
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    COALESCE(SUM(duracao_segundos), 0) AS total_seconds,
                    COUNT(*) AS total_records,
                    COUNT(DISTINCT login_usuario) AS total_users,
                    COUNT(DISTINCT id_epic) AS total_epics,
                    COUNT(*) FILTER (WHERE status_validacao = 'alerta') AS pending_alerts
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                {where_sql}
                """,
                params,
            )
            row = cursor.fetchone()

    total_seconds = int(row["total_seconds"])
    return {
        "totalHours": round(total_seconds / 3600, 2),
        "totalRecords": row["total_records"],
        "totalUsers": row["total_users"],
        "totalEpics": row["total_epics"],
        "pendingAlerts": row["pending_alerts"],
    }


@router.get("/timeline")
def get_timeline(
    start_date: date | None = Query(None, alias="startDate"),
    end_date: date | None = Query(None, alias="endDate"),
    user: str | None = None,
    epic_id: str | None = Query(None, alias="epicId"),
    category: str | None = None,
) -> list[dict]:
    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        user=user,
        epic_id=epic_id,
        category=category,
    )
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    DATE(l.data_hora_cadastro) AS period,
                    ROUND((SUM(l.duracao_segundos)::numeric / 3600), 2) AS horas
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                {where_sql}
                GROUP BY DATE(l.data_hora_cadastro)
                ORDER BY period
                """,
                params,
            )
            rows = cursor.fetchall()

    return [{"period": row["period"].isoformat(), "horas": float(row["horas"])} for row in rows]
