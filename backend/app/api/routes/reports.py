from datetime import date
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.routes.filter_utils import build_filter_clause
from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log

router = APIRouter()

ReportGroup = Literal["user", "epic", "feature", "pbi", "task", "category", "subcategory"]
TimelinePeriod = Literal["day", "week", "month"]
TimelineSeries = Literal["user", "category"]


class PendingAlertReviewPayload(BaseModel):
    resolved: bool = True


class PendingReviewPayload(BaseModel):
    importId: int
    type: Literal["unclassified", "low_confidence", "zero_duration"]
    key: str
    status: Literal["pendente", "revisado", "ignorado"]


class SavedProjectComparisonPayload(BaseModel):
    name: str
    importIds: list[int]


GROUP_CONFIG = {
    "user": {
        "key": "l.login_usuario",
        "label": "l.login_usuario",
    },
    "epic": {
        "key": "l.id_epic",
        "label": "l.titulo_epic",
    },
    "feature": {
        "key": "l.id_feat",
        "label": "l.titulo_feat",
    },
    "pbi": {
        "key": "l.id_pbi",
        "label": "l.titulo_pbi",
    },
    "task": {
        "key": "l.id_task",
        "label": "l.titulo_task",
    },
    "category": {
        "key": "COALESCE(c.nome, 'Nao classificado')",
        "label": "COALESCE(c.nome, 'Nao classificado')",
    },
    "subcategory": {
        "key": "COALESCE(s.nome, 'Nao classificado')",
        "label": "COALESCE(s.nome, 'Nao classificado')",
    },
}


@router.get("/hours")
def get_hours_report(
    group_by: ReportGroup = Query(..., alias="groupBy"),
    limit: int = Query(20, ge=1, le=100),
    start_date: date | None = Query(None, alias="startDate"),
    end_date: date | None = Query(None, alias="endDate"),
    user: str | None = None,
    epic_id: str | None = Query(None, alias="epicId"),
    category: str | None = None,
    import_id: int | None = Query(None, alias="importId"),
) -> list[dict]:
    return _query_hours_report(
        group_by=group_by,
        limit=limit,
        start_date=start_date,
        end_date=end_date,
        user=user,
        epic_id=epic_id,
        category=category,
        import_id=import_id,
    )


def _query_hours_report(
    *,
    group_by: ReportGroup,
    limit: int,
    start_date: date | None = None,
    end_date: date | None = None,
    user: str | None = None,
    epic_id: str | None = None,
    category: str | None = None,
    import_id: int | None = None,
) -> list[dict]:
    config = GROUP_CONFIG.get(group_by)
    if not config:
        raise HTTPException(status_code=400, detail="Agrupamento invalido.")

    key_expr = config["key"]
    label_expr = config["label"]
    where_sql, params = build_filter_clause(
        start_date=start_date,
        end_date=end_date,
        user=user,
        epic_id=epic_id,
        category=category,
        import_id=import_id,
    )

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH grouped AS (
                    SELECT
                        {key_expr} AS key,
                        {label_expr} AS label,
                        SUM(l.duracao_segundos) AS total_seconds,
                        COUNT(*) AS total_records
                    FROM lancamentos_horas l
                    LEFT JOIN categorias c ON c.id = l.categoria_id
                    LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
                    {where_sql}
                    GROUP BY {key_expr}, {label_expr}
                ),
                totals AS (
                    SELECT COALESCE(SUM(total_seconds), 0) AS grand_total_seconds
                    FROM grouped
                )
                SELECT
                    grouped.key,
                    grouped.label,
                    grouped.total_seconds,
                    ROUND((grouped.total_seconds::numeric / 3600), 2) AS total_hours,
                    grouped.total_records,
                    CASE
                        WHEN totals.grand_total_seconds = 0 THEN 0
                        ELSE ROUND((grouped.total_seconds::numeric / totals.grand_total_seconds) * 100, 2)
                    END AS percentage
                FROM grouped
                CROSS JOIN totals
                ORDER BY grouped.total_seconds DESC, grouped.label
                LIMIT %s
                """,
                [*params, limit],
            )
            rows = cursor.fetchall()

    return [
        {
            "key": row["key"],
            "label": row["label"],
            "totalSeconds": int(row["total_seconds"]),
            "totalHours": float(row["total_hours"]),
            "totalRecords": row["total_records"],
            "percentage": float(row["percentage"]),
        }
        for row in rows
    ]


@router.get("/overview")
def get_reports_overview(
    start_date: date | None = Query(None, alias="startDate"),
    end_date: date | None = Query(None, alias="endDate"),
    user: str | None = None,
    epic_id: str | None = Query(None, alias="epicId"),
    category: str | None = None,
    import_id: int | None = Query(None, alias="importId"),
) -> dict[str, list[dict]]:
    groups: list[ReportGroup] = ["user", "epic", "feature", "pbi", "task", "category", "subcategory"]
    return {
        group: _query_hours_report(
            group_by=group,
            limit=10,
            start_date=start_date,
            end_date=end_date,
            user=user,
            epic_id=epic_id,
            category=category,
            import_id=import_id,
        )
        for group in groups
    }


@router.get("/project-timelines")
def get_project_timelines(import_id: int = Query(..., alias="importId")) -> dict:
    return {
        "dailyTotal": _query_project_timeline(import_id=import_id, period="day"),
        "dailyByUser": _query_project_timeline(import_id=import_id, period="day", series="user"),
        "weeklyByUser": _query_project_timeline(import_id=import_id, period="week", series="user"),
        "dailyByCategory": _query_project_timeline(import_id=import_id, period="day", series="category"),
        "monthlyByCategory": _query_project_timeline(import_id=import_id, period="month", series="category"),
        "weeklyByCategory": _query_project_timeline(import_id=import_id, period="week", series="category"),
    }


@router.get("/project-comparison")
def get_project_comparison(import_ids: list[int] = Query(..., alias="importIds")) -> dict:
    return build_project_comparison(import_ids)


@router.get("/project-evolution-options")
def get_project_evolution_options() -> list[dict]:
    grouped: dict[str, list[dict]] = {}
    for row in _query_import_metrics():
        grouped.setdefault(project_title_from_filename(row["nome_arquivo"]), []).append(row)

    options = []
    for project_name, rows in grouped.items():
        if len(rows) < 2:
            continue
        latest = max(rows, key=lambda item: item["data_importacao"])
        total_seconds = sum(int(item["total_seconds"] or 0) for item in rows)
        options.append(
            {
                "projectName": project_name,
                "importsCount": len(rows),
                "latestImportedAt": latest["data_importacao"].isoformat(),
                "totalHours": round(total_seconds / 3600, 2),
            }
        )

    return sorted(options, key=lambda item: item["latestImportedAt"], reverse=True)


@router.get("/project-evolution")
def get_project_evolution(project_name: str = Query(..., alias="projectName")) -> dict:
    requested_name = project_name.strip()
    if not requested_name:
        raise HTTPException(status_code=400, detail="Informe o projeto para analisar a evolucao.")

    rows = [
        row
        for row in _query_import_metrics()
        if project_title_from_filename(row["nome_arquivo"]).lower() == requested_name.lower()
    ]
    rows.sort(key=lambda item: (item["data_importacao"], item["id"]))
    if len(rows) < 2:
        raise HTTPException(status_code=404, detail="Projeto sem importacoes suficientes para evolucao.")

    points = []
    previous = None
    for row in rows:
        records_count = int(row["records_count"] or 0)
        total_hours = float(row["total_hours"] or 0)
        pending_counts = _query_project_pending_counts(int(row["id"]))
        open_pendings = pending_counts["totals"]["open"]
        pending_rate = round((open_pendings / records_count) * 100, 2) if records_count else 0
        attention_level, attention_label = project_attention_status(open_pendings, pending_rate)
        point = {
            "importId": int(row["id"]),
            "filename": row["nome_arquivo"],
            "importedAt": row["data_importacao"].isoformat(),
            "status": row["status"],
            "totalHours": total_hours,
            "recordsCount": records_count,
            "openPendings": open_pendings,
            "pendingRate": pending_rate,
            "attentionLevel": attention_level,
            "attentionLabel": attention_label,
            "hoursDelta": round(total_hours - previous["totalHours"], 2) if previous else 0,
            "recordsDelta": records_count - previous["recordsCount"] if previous else 0,
            "pendingsDelta": open_pendings - previous["openPendings"] if previous else 0,
            "attentionChanged": attention_level != previous["attentionLevel"] if previous else False,
        }
        points.append(point)
        previous = point

    first = points[0]
    latest = points[-1]
    pendings_delta = latest["openPendings"] - first["openPendings"]
    hours_delta = round(latest["totalHours"] - first["totalHours"], 2)
    records_delta = latest["recordsCount"] - first["recordsCount"]
    if pendings_delta < 0:
        trend_label = "Melhorou"
    elif pendings_delta > 0:
        trend_label = "Piorou"
    else:
        trend_label = "Estavel"

    return {
        "projectName": requested_name,
        "importsCount": len(points),
        "firstImportedAt": first["importedAt"],
        "latestImportedAt": latest["importedAt"],
        "summary": {
            "hoursDelta": hours_delta,
            "recordsDelta": records_delta,
            "pendingsDelta": pendings_delta,
            "firstAttention": first["attentionLabel"],
            "latestAttention": latest["attentionLabel"],
            "trendLabel": trend_label,
        },
        "insights": build_project_evolution_insights(first, latest),
        "points": points,
    }


@router.get("/project-comparisons")
def list_saved_project_comparisons() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    c.id,
                    c.nome,
                    c.criado_em,
                    c.atualizado_em,
                    ARRAY_AGG(ci.importacao_id ORDER BY ci.ordem, ci.id) AS import_ids,
                    COUNT(ci.importacao_id) AS projects_count
                FROM comparativos_projetos c
                JOIN comparativos_projetos_importacoes ci ON ci.comparativo_id = c.id
                GROUP BY c.id, c.nome, c.criado_em, c.atualizado_em
                ORDER BY c.atualizado_em DESC, c.id DESC
                """
            )
            rows = cursor.fetchall()

    items = []
    for row in rows:
        import_ids = list(row["import_ids"] or [])
        comparison = build_project_comparison(import_ids) if len(import_ids) >= 2 else None
        items.append(
            {
                "id": row["id"],
                "name": row["nome"],
                "createdAt": row["criado_em"].isoformat(),
                "updatedAt": row["atualizado_em"].isoformat(),
                "importIds": import_ids,
                "projectsCount": int(row["projects_count"] or 0),
                "totalHours": comparison["summary"]["totalHours"] if comparison else 0,
                "openPendings": comparison["summary"]["openPendings"] if comparison else 0,
                "highAttentionProjects": comparison["summary"]["highAttentionProjects"] if comparison else 0,
            }
        )
    return items


@router.post("/project-comparisons")
def create_saved_project_comparison(payload: SavedProjectComparisonPayload) -> dict:
    name = payload.name.strip()
    selected_ids = list(dict.fromkeys(payload.importIds))
    if not name:
        raise HTTPException(status_code=400, detail="Informe um nome para o comparativo.")
    if len(selected_ids) < 2:
        raise HTTPException(status_code=400, detail="Selecione pelo menos dois projetos para salvar.")

    comparison = build_project_comparison(selected_ids)
    if len(comparison["projects"]) < 2:
        raise HTTPException(status_code=400, detail="Os projetos selecionados nao foram encontrados.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO comparativos_projetos (nome)
                VALUES (%s)
                RETURNING id, nome, criado_em, atualizado_em
                """,
                [name],
            )
            row = cursor.fetchone()
            for index, import_id in enumerate(selected_ids):
                cursor.execute(
                    """
                    INSERT INTO comparativos_projetos_importacoes (comparativo_id, importacao_id, ordem)
                    VALUES (%s, %s, %s)
                    """,
                    [row["id"], import_id, index],
                )

    return {
        "id": row["id"],
        "name": row["nome"],
        "createdAt": row["criado_em"].isoformat(),
        "updatedAt": row["atualizado_em"].isoformat(),
        "importIds": selected_ids,
        "projectsCount": len(comparison["projects"]),
        "totalHours": comparison["summary"]["totalHours"],
        "openPendings": comparison["summary"]["openPendings"],
        "highAttentionProjects": comparison["summary"]["highAttentionProjects"],
    }


@router.get("/project-comparisons/{comparison_id}")
def get_saved_project_comparison(comparison_id: int) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, nome, criado_em, atualizado_em
                FROM comparativos_projetos
                WHERE id = %s
                """,
                [comparison_id],
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Comparativo nao encontrado.")

            cursor.execute(
                """
                SELECT importacao_id
                FROM comparativos_projetos_importacoes
                WHERE comparativo_id = %s
                ORDER BY ordem, id
                """,
                [comparison_id],
            )
            import_ids = [item["importacao_id"] for item in cursor.fetchall()]

    return {
        "id": row["id"],
        "name": row["nome"],
        "createdAt": row["criado_em"].isoformat(),
        "updatedAt": row["atualizado_em"].isoformat(),
        "importIds": import_ids,
        "comparison": build_project_comparison(import_ids),
    }


@router.delete("/project-comparisons/{comparison_id}")
def delete_saved_project_comparison(comparison_id: int) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM comparativos_projetos WHERE id = %s RETURNING id", [comparison_id])
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Comparativo nao encontrado.")
    return {"id": comparison_id, "deleted": True}


def build_project_comparison(import_ids: list[int]) -> dict:
    selected_ids = list(dict.fromkeys(import_ids))
    if len(selected_ids) < 2:
        raise HTTPException(status_code=400, detail="Selecione pelo menos dois projetos para comparar.")

    placeholders = ", ".join(["%s"] * len(selected_ids))
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    i.id,
                    i.nome_arquivo,
                    i.status,
                    i.data_importacao,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    ROUND((COALESCE(SUM(l.duracao_segundos), 0)::numeric / 3600), 2) AS total_hours,
                    COUNT(l.id) AS records_count,
                    COUNT(DISTINCT l.login_usuario) AS collaborators_count,
                    COUNT(DISTINCT l.id_task) AS tasks_count
                FROM importacoes i
                LEFT JOIN lancamentos_horas l ON l.importacao_id = i.id
                WHERE i.id IN ({placeholders})
                GROUP BY i.id, i.nome_arquivo, i.status, i.data_importacao
                """,
                selected_ids,
            )
            project_rows = {int(row["id"]): row for row in cursor.fetchall()}

    projects = []
    for import_id in selected_ids:
        row = project_rows.get(import_id)
        if not row:
            continue

        top_category = _query_project_rank(import_id=import_id, group_by="category", limit=1)
        top_user = _query_project_rank(import_id=import_id, group_by="user", limit=1)
        pending_counts = _query_project_pending_counts(import_id)
        records_count = int(row["records_count"] or 0)
        open_pendings = pending_counts["totals"]["open"]
        pending_rate = round((open_pendings / records_count) * 100, 2) if records_count else 0
        attention_level, attention_label = project_attention_status(open_pendings, pending_rate)

        projects.append(
            {
                "importId": import_id,
                "projectName": project_title_from_filename(row["nome_arquivo"]),
                "filename": row["nome_arquivo"],
                "importedAt": row["data_importacao"].isoformat(),
                "status": row["status"],
                "totalSeconds": int(row["total_seconds"] or 0),
                "totalHours": float(row["total_hours"] or 0),
                "recordsCount": records_count,
                "collaboratorsCount": int(row["collaborators_count"] or 0),
                "tasksCount": int(row["tasks_count"] or 0),
                "openPendings": open_pendings,
                "reviewedPendings": pending_counts["totals"]["reviewed"],
                "ignoredPendings": pending_counts["totals"]["ignored"],
                "pendingRate": pending_rate,
                "attentionLevel": attention_level,
                "attentionLabel": attention_label,
                "topCategory": top_category[0]["label"] if top_category else "Sem dados",
                "topCategoryPercentage": top_category[0]["percentage"] if top_category else 0,
                "topCollaborator": top_user[0]["label"] if top_user else "Sem dados",
                "topCollaboratorPercentage": top_user[0]["percentage"] if top_user else 0,
            }
        )

    return {
        "summary": {
            "projectsCount": len(projects),
            "totalHours": round(sum(project["totalHours"] for project in projects), 2),
            "recordsCount": sum(project["recordsCount"] for project in projects),
            "openPendings": sum(project["openPendings"] for project in projects),
            "highAttentionProjects": sum(1 for project in projects if project["attentionLevel"] == "alta"),
        },
        "projects": projects,
    }


def _query_import_metrics() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    i.id,
                    i.nome_arquivo,
                    i.status,
                    i.data_importacao,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    ROUND((COALESCE(SUM(l.duracao_segundos), 0)::numeric / 3600), 2) AS total_hours,
                    COUNT(l.id) AS records_count
                FROM importacoes i
                LEFT JOIN lancamentos_horas l ON l.importacao_id = i.id
                GROUP BY i.id, i.nome_arquivo, i.status, i.data_importacao
                ORDER BY i.data_importacao ASC, i.id ASC
                """
            )
            return list(cursor.fetchall())


def build_project_evolution_insights(first: dict, latest: dict) -> list[dict]:
    insights = []
    pendings_delta = latest["openPendings"] - first["openPendings"]
    hours_delta = round(latest["totalHours"] - first["totalHours"], 2)
    records_delta = latest["recordsCount"] - first["recordsCount"]
    base_pendings = max(first["openPendings"], 1)
    pendings_percent = round((pendings_delta / base_pendings) * 100, 2)

    if pendings_delta > 0 and pendings_percent >= 30:
        insights.append(
            {
                "priority": "alta",
                "title": "Pendencias cresceram de forma relevante",
                "reason": f"As pendencias abertas variaram {pendings_delta:+d}, equivalente a {pendings_percent:.2f}% desde a primeira importacao.",
                "action": "Priorize a revisao da fila de pendencias antes de usar esta importacao como referencia gerencial.",
                "source": "pendencias",
            }
        )
    elif pendings_delta < 0:
        insights.append(
            {
                "priority": "baixa",
                "title": "Pendencias reduziram",
                "reason": f"As pendencias abertas cairam {abs(pendings_delta)} em relacao a primeira importacao.",
                "action": "Use a importacao mais recente como base principal e mantenha o acompanhamento nas proximas cargas.",
                "source": "pendencias",
            }
        )

    if first["attentionLevel"] != latest["attentionLevel"]:
        priority = "alta" if latest["attentionLevel"] == "alta" else "media"
        insights.append(
            {
                "priority": priority,
                "title": "Nivel de atencao mudou",
                "reason": f"O projeto saiu de {first['attentionLabel']} para {latest['attentionLabel']}.",
                "action": "Abra a importacao mais recente e revise as pendencias que puxaram esta mudanca.",
                "source": "atencao",
            }
        )

    if abs(hours_delta) < 0.01 and records_delta == 0 and pendings_delta > 0:
        insights.append(
            {
                "priority": "media",
                "title": "Volume igual com mais pendencias",
                "reason": "Horas e registros ficaram estaveis, mas as pendencias aumentaram.",
                "action": "Verifique se regras de classificacao, perfis ou alertas mudaram entre as importacoes.",
                "source": "consistencia",
            }
        )

    if not insights:
        insights.append(
            {
                "priority": "baixa",
                "title": "Evolucao sem alerta relevante",
                "reason": "Nao foram encontrados sinais fortes de piora ou melhora pelas regras atuais.",
                "action": "Use a linha historica como acompanhamento gerencial complementar.",
                "source": "geral",
            }
        )

    priority_order = {"alta": 0, "media": 1, "baixa": 2}
    return sorted(insights, key=lambda item: priority_order.get(item["priority"], 9))


@router.get("/project-summary")
def get_project_summary(import_id: int = Query(..., alias="importId")) -> dict:
    top_users = _query_project_rank(import_id=import_id, group_by="user", limit=5)
    top_tasks = _query_project_rank(import_id=import_id, group_by="task", limit=5)
    categories = _query_project_rank(import_id=import_id, group_by="category", limit=6)
    pending_counts = _query_project_pending_counts(import_id)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(DISTINCT l.login_usuario) AS collaborators_count,
                    COUNT(DISTINCT l.id_task) AS tasks_count,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds
                FROM lancamentos_horas l
                WHERE l.importacao_id = %s
                """,
                [import_id],
            )
            metrics = cursor.fetchone()

    total_seconds = int(metrics["total_seconds"] or 0)
    return {
        "metrics": {
            "totalDuration": seconds_to_hhmmss(total_seconds),
            "totalHours": round(total_seconds / 3600, 2),
            "collaboratorsCount": int(metrics["collaborators_count"] or 0),
            "tasksCount": int(metrics["tasks_count"] or 0),
        },
        "topUsers": top_users,
        "topTasks": top_tasks,
        "categories": categories,
        "pending": {
            "unclassifiedTasks": pending_counts["open"]["unclassifiedTasks"],
            "lowConfidence": pending_counts["open"]["lowConfidence"],
            "zeroDuration": pending_counts["open"]["zeroDuration"],
            "alerts": pending_counts["open"]["alerts"],
            "open": pending_counts["totals"]["open"],
            "reviewed": pending_counts["totals"]["reviewed"],
            "ignored": pending_counts["totals"]["ignored"],
            "total": pending_counts["totals"]["total"],
        },
    }


def _query_project_rank(*, import_id: int, group_by: ReportGroup, limit: int) -> list[dict]:
    return _query_hours_report(group_by=group_by, limit=limit, import_id=import_id)


def _query_project_pending_counts(import_id: int) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH unclassified AS (
                    SELECT
                        COALESCE(pr.status, 'pendente') AS status,
                        COUNT(*) AS total
                    FROM (
                        SELECT DISTINCT l.id_task, l.login_usuario, l.importacao_id
                        FROM lancamentos_horas l
                        LEFT JOIN categorias c ON c.id = l.categoria_id
                        WHERE l.importacao_id = %s
                          AND COALESCE(c.nome, 'Nao classificado') = 'Nao classificado'
                    ) l
                    LEFT JOIN pending_reviews pr
                      ON pr.importacao_id = l.importacao_id
                     AND pr.tipo = 'unclassified'
                     AND pr.chave = CONCAT(l.id_task, '|', l.login_usuario)
                    GROUP BY COALESCE(pr.status, 'pendente')
                ),
                low_confidence AS (
                    SELECT
                        COALESCE(pr.status, 'pendente') AS status,
                        COUNT(*) AS total
                    FROM (
                        SELECT DISTINCT l.id_task, l.login_usuario, l.importacao_id
                        FROM lancamentos_horas l
                        JOIN classificacoes_task ct ON ct.lancamento_id = l.id
                        WHERE l.importacao_id = %s
                          AND COALESCE(ct.nivel_confianca, '') = 'baixa'
                    ) l
                    LEFT JOIN pending_reviews pr
                      ON pr.importacao_id = l.importacao_id
                     AND pr.tipo = 'low_confidence'
                     AND pr.chave = CONCAT(l.id_task, '|', l.login_usuario)
                    GROUP BY COALESCE(pr.status, 'pendente')
                ),
                zero_duration AS (
                    SELECT
                        COALESCE(pr.status, 'pendente') AS status,
                        COUNT(*) AS total
                    FROM lancamentos_horas l
                    LEFT JOIN pending_reviews pr
                      ON pr.importacao_id = l.importacao_id
                     AND pr.tipo = 'zero_duration'
                     AND pr.chave = l.id_lancamento
                    WHERE l.importacao_id = %s
                      AND l.duracao_segundos = 0
                    GROUP BY COALESCE(pr.status, 'pendente')
                ),
                alerts AS (
                    SELECT
                        CASE WHEN COALESCE(resolvido, FALSE) THEN 'revisado' ELSE 'pendente' END AS status,
                        COUNT(*) AS total
                    FROM erros_importacao
                    WHERE importacao_id = %s
                      AND severidade = 'alerta'
                    GROUP BY CASE WHEN COALESCE(resolvido, FALSE) THEN 'revisado' ELSE 'pendente' END
                )
                SELECT 'unclassified' AS type, status, total FROM unclassified
                UNION ALL
                SELECT 'low_confidence' AS type, status, total FROM low_confidence
                UNION ALL
                SELECT 'zero_duration' AS type, status, total FROM zero_duration
                UNION ALL
                SELECT 'alerts' AS type, status, total FROM alerts
                """,
                [import_id, import_id, import_id, import_id],
            )
            rows = cursor.fetchall()

    open_counts = {"unclassifiedTasks": 0, "lowConfidence": 0, "zeroDuration": 0, "alerts": 0}
    totals = {"open": 0, "reviewed": 0, "ignored": 0, "total": 0}
    type_map = {
        "unclassified": "unclassifiedTasks",
        "low_confidence": "lowConfidence",
        "zero_duration": "zeroDuration",
        "alerts": "alerts",
    }
    for row in rows:
        total = int(row["total"] or 0)
        status = row["status"]
        totals["total"] += total
        if status == "pendente":
            totals["open"] += total
            open_counts[type_map[row["type"]]] += total
        elif status == "revisado":
            totals["reviewed"] += total
        elif status == "ignorado":
            totals["ignored"] += total

    return {"open": open_counts, "totals": totals}


@router.get("/project-pending-items")
def get_project_pending_items(import_id: int = Query(..., alias="importId")) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    l.id_task,
                    l.titulo_task,
                    l.login_usuario,
                    SUM(l.duracao_segundos) AS total_seconds,
                    COUNT(*) AS total_records,
                    CONCAT(l.id_task, '|', l.login_usuario) AS review_key,
                    COALESCE(pr.status, 'pendente') AS review_status
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                LEFT JOIN pending_reviews pr
                  ON pr.importacao_id = l.importacao_id
                 AND pr.tipo = 'unclassified'
                 AND pr.chave = CONCAT(l.id_task, '|', l.login_usuario)
                WHERE l.importacao_id = %s
                  AND COALESCE(c.nome, 'Nao classificado') = 'Nao classificado'
                GROUP BY l.id_task, l.titulo_task, l.login_usuario, pr.status
                ORDER BY total_seconds DESC, l.titulo_task
                LIMIT 50
                """,
                [import_id],
            )
            unclassified = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    l.id_task,
                    l.titulo_task,
                    l.login_usuario,
                    COALESCE(c.nome, 'Nao classificado') AS categoria,
                    MIN(COALESCE(ct.nivel_confianca, 'media')) AS nivel_confianca,
                    MIN(COALESCE(ct.confianca, 0)) AS confianca,
                    SUM(l.duracao_segundos) AS total_seconds,
                    COUNT(*) AS total_records,
                    CONCAT(l.id_task, '|', l.login_usuario) AS review_key,
                    COALESCE(pr.status, 'pendente') AS review_status
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                JOIN classificacoes_task ct ON ct.lancamento_id = l.id
                LEFT JOIN pending_reviews pr
                  ON pr.importacao_id = l.importacao_id
                 AND pr.tipo = 'low_confidence'
                 AND pr.chave = CONCAT(l.id_task, '|', l.login_usuario)
                WHERE l.importacao_id = %s
                  AND COALESCE(ct.nivel_confianca, '') = 'baixa'
                GROUP BY l.id_task, l.titulo_task, l.login_usuario, c.nome, pr.status
                ORDER BY total_seconds DESC, l.titulo_task
                LIMIT 50
                """,
                [import_id],
            )
            low_confidence = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    l.id_lancamento,
                    l.id_task,
                    l.titulo_task,
                    l.login_usuario,
                    l.data_hora_cadastro,
                    l.duracao_segundos,
                    l.id_lancamento AS review_key,
                    COALESCE(pr.status, 'pendente') AS review_status
                FROM lancamentos_horas l
                LEFT JOIN pending_reviews pr
                  ON pr.importacao_id = l.importacao_id
                 AND pr.tipo = 'zero_duration'
                 AND pr.chave = l.id_lancamento
                WHERE l.importacao_id = %s
                  AND l.duracao_segundos = 0
                ORDER BY l.data_hora_cadastro DESC, l.id DESC
                LIMIT 50
                """,
                [import_id],
            )
            zero_duration = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    id,
                    linha,
                    campo,
                    tipo_erro,
                    mensagem,
                    valor_encontrado,
                    0 AS total_seconds,
                    1 AS total_records
                FROM erros_importacao
                WHERE importacao_id = %s
                  AND severidade = 'alerta'
                  AND COALESCE(resolvido, FALSE) = FALSE
                ORDER BY linha NULLS LAST, id
                LIMIT 50
                """,
                [import_id],
            )
            alerts = cursor.fetchall()

    return {
        "unclassifiedTasks": [
            {
                "idTask": row["id_task"],
                "tituloTask": row["titulo_task"],
                "loginUsuario": row["login_usuario"],
                "impactSeconds": int(row["total_seconds"] or 0),
                "impactHours": round(int(row["total_seconds"] or 0) / 3600, 2),
                "totalDuration": seconds_to_hhmmss(int(row["total_seconds"])),
                "totalRecords": row["total_records"],
                "impactRecords": row["total_records"],
                "reviewKey": row["review_key"],
                "reviewStatus": row["review_status"],
            }
            for row in unclassified
        ],
        "lowConfidence": [
            {
                "idTask": row["id_task"],
                "tituloTask": row["titulo_task"],
                "loginUsuario": row["login_usuario"],
                "categoria": row["categoria"],
                "confidenceLevel": row["nivel_confianca"],
                "confidence": float(row["confianca"]),
                "impactSeconds": int(row["total_seconds"] or 0),
                "impactHours": round(int(row["total_seconds"] or 0) / 3600, 2),
                "impactDuration": seconds_to_hhmmss(int(row["total_seconds"] or 0)),
                "impactRecords": row["total_records"],
                "reviewKey": row["review_key"],
                "reviewStatus": row["review_status"],
            }
            for row in low_confidence
        ],
        "zeroDuration": [
            {
                "idLancamento": row["id_lancamento"],
                "idTask": row["id_task"],
                "tituloTask": row["titulo_task"],
                "loginUsuario": row["login_usuario"],
                "dataHoraCadastro": row["data_hora_cadastro"].isoformat(sep=" "),
                "impactSeconds": int(row["duracao_segundos"] or 0),
                "impactHours": round(int(row["duracao_segundos"] or 0) / 3600, 2),
                "impactDuration": seconds_to_hhmmss(int(row["duracao_segundos"] or 0)),
                "impactRecords": 1,
                "reviewKey": row["review_key"],
                "reviewStatus": row["review_status"],
            }
            for row in zero_duration
        ],
        "alerts": [
            {
                "id": row["id"],
                "line": row["linha"],
                "field": row["campo"],
                "code": row["tipo_erro"],
                "message": row["mensagem"],
                "value": row["valor_encontrado"],
                "impactSeconds": int(row["total_seconds"] or 0),
                "impactHours": 0,
                "impactDuration": seconds_to_hhmmss(0),
                "impactRecords": row["total_records"],
            }
            for row in alerts
        ],
    }


@router.patch("/project-pending-alerts/{alert_id}")
def update_project_pending_alert(alert_id: int, payload: PendingAlertReviewPayload) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, resolvido, importacao_id
                FROM erros_importacao
                WHERE id = %s
                  AND severidade = 'alerta'
                """,
                [alert_id],
            )
            previous = cursor.fetchone()
            if not previous:
                raise HTTPException(status_code=404, detail="Alerta nao encontrado.")
            cursor.execute(
                """
                UPDATE erros_importacao
                SET resolvido = %s
                WHERE id = %s
                  AND severidade = 'alerta'
                RETURNING id, resolvido
                """,
                [payload.resolved, alert_id],
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="pending_alert",
                record_id=alert_id,
                action="updated",
                before={"resolved": previous["resolvido"], "importId": previous["importacao_id"]},
                after={"resolved": row["resolvido"], "importId": previous["importacao_id"]},
            )
        connection.commit()

    return {"id": row["id"], "resolved": row["resolvido"]}


@router.patch("/project-pending-reviews")
def update_project_pending_review(payload: PendingReviewPayload) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, status
                FROM pending_reviews
                WHERE importacao_id = %s
                  AND tipo = %s
                  AND chave = %s
                """,
                [payload.importId, payload.type, payload.key],
            )
            previous = cursor.fetchone()
            cursor.execute(
                """
                INSERT INTO pending_reviews (importacao_id, tipo, chave, status, atualizado_em)
                VALUES (%s, %s, %s, %s, NOW())
                ON CONFLICT (importacao_id, tipo, chave)
                DO UPDATE SET status = EXCLUDED.status, atualizado_em = NOW()
                RETURNING id, importacao_id, tipo, chave, status
                """,
                [payload.importId, payload.type, payload.key, payload.status],
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="pending_review",
                record_id=row["id"],
                action="updated",
                before={
                    "importId": payload.importId,
                    "type": payload.type,
                    "key": payload.key,
                    "status": previous["status"] if previous else "pendente",
                },
                after={
                    "importId": row["importacao_id"],
                    "type": row["tipo"],
                    "key": row["chave"],
                    "status": row["status"],
                },
            )
        connection.commit()

    return {
        "id": row["id"],
        "importId": row["importacao_id"],
        "type": row["tipo"],
        "key": row["chave"],
        "status": row["status"],
    }


@router.get("/project-insights")
def get_project_insights(import_id: int = Query(..., alias="importId")) -> dict:
    top_users = _query_project_rank(import_id=import_id, group_by="user", limit=3)
    top_tasks = _query_project_rank(import_id=import_id, group_by="task", limit=3)
    top_categories = _query_project_rank(import_id=import_id, group_by="category", limit=3)

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    l.data_hora_cadastro::date AS period,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    ROUND((COALESCE(SUM(l.duracao_segundos), 0)::numeric / 3600), 2) AS total_hours
                FROM lancamentos_horas l
                WHERE l.importacao_id = %s
                GROUP BY l.data_hora_cadastro::date
                ORDER BY total_seconds DESC, period
                LIMIT 1
                """,
                [import_id],
            )
            peak_day = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    DATE_TRUNC('week', l.data_hora_cadastro)::date AS period,
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds,
                    ROUND((COALESCE(SUM(l.duracao_segundos), 0)::numeric / 3600), 2) AS total_hours
                FROM lancamentos_horas l
                WHERE l.importacao_id = %s
                GROUP BY DATE_TRUNC('week', l.data_hora_cadastro)::date
                ORDER BY total_seconds DESC, period
                LIMIT 1
                """,
                [import_id],
            )
            peak_week = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds
                FROM lancamentos_horas l
                WHERE l.importacao_id = %s
                """,
                [import_id],
            )
            metrics = cursor.fetchone()

    total_seconds = int(metrics["total_seconds"] or 0)
    top_user = top_users[0] if top_users else None
    top_task = top_tasks[0] if top_tasks else None
    top_category = top_categories[0] if top_categories else None

    cards = []
    if top_user:
        cards.append(
            {
                "kind": "concentration",
                "title": "Maior concentracao por colaborador",
                "value": top_user["label"],
                "detail": f"{top_user['totalHours']:.2f}h ({top_user['percentage']:.1f}% do projeto)",
                "tone": "warning" if top_user["percentage"] >= 45 else "info",
            }
        )
    if top_task:
        cards.append(
            {
                "kind": "top_task",
                "title": "Task com maior esforco",
                "value": f"{top_task['key']} - {top_task['label']}",
                "detail": f"{top_task['totalHours']:.2f}h ({top_task['percentage']:.1f}% do projeto)",
                "tone": "warning" if top_task["percentage"] >= 25 else "info",
            }
        )
    if peak_day:
        cards.append(
            {
                "kind": "peak_day",
                "title": "Dia com maior volume",
                "value": peak_day["period"].isoformat(),
                "detail": f"{float(peak_day['total_hours']):.2f}h apontadas",
                "tone": "info",
            }
        )
    if peak_week:
        cards.append(
            {
                "kind": "peak_week",
                "title": "Semana com maior volume",
                "value": peak_week["period"].isoformat(),
                "detail": f"{float(peak_week['total_hours']):.2f}h apontadas",
                "tone": "info",
            }
        )
    if top_category:
        cards.append(
            {
                "kind": "top_category",
                "title": "Categoria predominante",
                "value": top_category["label"],
                "detail": f"{top_category['totalHours']:.2f}h ({top_category['percentage']:.1f}% do projeto)",
                "tone": "success",
            }
        )

    return {
        "totalHours": round(total_seconds / 3600, 2),
        "cards": cards,
        "topUsers": top_users,
        "topTasks": top_tasks,
        "topCategories": top_categories,
    }


@router.get("/project-recommendations")
def get_project_recommendations(import_id: int = Query(..., alias="importId")) -> list[dict]:
    insights = get_project_insights(import_id)
    recommendations = []
    top_user = insights["topUsers"][0] if insights["topUsers"] else None
    top_task = insights["topTasks"][0] if insights["topTasks"] else None
    top_category = insights["topCategories"][0] if insights["topCategories"] else None
    pending_total = _query_project_pending_counts(import_id)["totals"]["open"]

    if pending_total > 0:
        recommendations.append(
            {
                "priority": "alta",
                "title": "Resolver pendencias antes de compartilhar",
                "reason": f"Existem {pending_total} itens pendentes ou alertas neste projeto.",
                "action": "Abra a secao de pendencias, corrija classificacoes e revise alertas operacionais.",
                "source": "pendencias",
            }
        )

    if top_user and top_user["percentage"] >= 45:
        recommendations.append(
            {
                "priority": "media",
                "title": "Revisar concentracao de esforco",
                "reason": f"{top_user['label']} concentra {top_user['percentage']:.1f}% das horas do projeto.",
                "action": "Verifique se a concentracao era esperada ou se indica dependencia operacional.",
                "source": "colaborador",
            }
        )

    if top_task and top_task["percentage"] >= 20:
        recommendations.append(
            {
                "priority": "media",
                "title": "Analisar task com esforco elevado",
                "reason": f"A task {top_task['key']} representa {top_task['percentage']:.1f}% das horas.",
                "action": "Confira se o escopo da task esta claro e se deveria ser quebrado em atividades menores.",
                "source": "task",
            }
        )

    if top_category and top_category["percentage"] >= 65:
        recommendations.append(
            {
                "priority": "baixa",
                "title": "Confirmar perfil predominante do projeto",
                "reason": f"A categoria {top_category['label']} representa {top_category['percentage']:.1f}% das horas.",
                "action": "Valide se esta distribuicao condiz com a fase do projeto e com o objetivo da analise.",
                "source": "categoria",
            }
        )

    if not recommendations:
        recommendations.append(
            {
                "priority": "baixa",
                "title": "Projeto sem recomendacoes criticas",
                "reason": "Nao foram encontrados sinais operacionais relevantes pelas regras atuais.",
                "action": "Use os graficos e as tasks para uma revisao gerencial complementar.",
                "source": "geral",
            }
        )

    return recommendations


@router.get("/project-collaborator-tasks")
def get_project_collaborator_tasks(
    import_id: int = Query(..., alias="importId"),
    user: str = Query(..., min_length=1),
) -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    l.id_task,
                    l.titulo_task,
                    COALESCE(c.nome, 'Nao classificado') AS categoria,
                    COALESCE(s.nome, 'Nao classificado') AS subcategoria,
                    SUM(l.duracao_segundos) AS total_seconds,
                    ROUND((SUM(l.duracao_segundos)::numeric / 3600), 2) AS total_hours,
                    COUNT(*) AS total_records,
                    MIN(l.data_hora_cadastro)::date AS first_worked_at,
                    MAX(l.data_hora_cadastro)::date AS last_worked_at
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
                WHERE l.importacao_id = %s
                  AND l.login_usuario = %s
                GROUP BY l.id_task, l.titulo_task, c.nome, s.nome
                ORDER BY total_seconds DESC, l.titulo_task
                """,
                [import_id, user],
            )
            rows = cursor.fetchall()

    return [
        {
            "idTask": row["id_task"],
            "tituloTask": row["titulo_task"],
            "categoria": row["categoria"],
            "subcategoria": row["subcategoria"],
            "totalSeconds": int(row["total_seconds"]),
            "totalDuration": seconds_to_hhmmss(int(row["total_seconds"])),
            "totalHours": float(row["total_hours"]),
            "totalRecords": row["total_records"],
            "firstWorkedAt": row["first_worked_at"].isoformat(),
            "lastWorkedAt": row["last_worked_at"].isoformat(),
        }
        for row in rows
    ]


def _query_project_timeline(
    *,
    import_id: int,
    period: TimelinePeriod,
    series: TimelineSeries | None = None,
) -> list[dict]:
    period_expr = {
        "day": "l.data_hora_cadastro::date",
        "week": "DATE_TRUNC('week', l.data_hora_cadastro)::date",
        "month": "DATE_TRUNC('month', l.data_hora_cadastro)::date",
    }[period]
    series_expr = {
        "user": "l.login_usuario",
        "category": "COALESCE(c.nome, 'Nao classificado')",
    }.get(series or "")

    select_series = f", {series_expr} AS series" if series_expr else ""
    group_series = f", {series_expr}" if series_expr else ""
    order_series = ", series" if series_expr else ""

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    {period_expr} AS period,
                    ROUND((SUM(l.duracao_segundos)::numeric / 3600), 2) AS horas
                    {select_series}
                FROM lancamentos_horas l
                LEFT JOIN categorias c ON c.id = l.categoria_id
                WHERE l.importacao_id = %s
                GROUP BY {period_expr}{group_series}
                ORDER BY period{order_series}
                """,
                [import_id],
            )
            rows = cursor.fetchall()

    return [
        {
            "period": row["period"].isoformat(),
            "horas": float(row["horas"]),
            **({"series": row["series"]} if series_expr else {}),
        }
        for row in rows
    ]


def seconds_to_hhmmss(total_seconds: int) -> str:
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def project_title_from_filename(filename: str) -> str:
    return Path(filename).stem


def project_attention_status(open_pendings: int, pending_rate: float) -> tuple[str, str]:
    if open_pendings >= 100 or pending_rate >= 25:
        return "alta", "Alta atencao"
    if open_pendings >= 20 or pending_rate >= 10:
        return "media", "Atencao media"
    return "baixa", "Estavel"


@router.get("/filters")
def get_report_filters() -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT login_usuario AS value, login_usuario AS label
                FROM lancamentos_horas
                ORDER BY login_usuario
                """
            )
            users = list(cursor.fetchall())

            cursor.execute(
                """
                SELECT DISTINCT id_epic AS value, titulo_epic AS label
                FROM lancamentos_horas
                ORDER BY titulo_epic
                """
            )
            epics = list(cursor.fetchall())

            cursor.execute(
                """
                SELECT DISTINCT c.nome AS value, c.nome AS label
                FROM lancamentos_horas l
                JOIN categorias c ON c.id = l.categoria_id
                ORDER BY c.nome
                """
            )
            categories = list(cursor.fetchall())

    return {"users": users, "epics": epics, "categories": categories}
