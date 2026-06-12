from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.repositories.analytics_repository import AnalyticsRepository

InsightType = Literal["anomalia", "tendencia", "concentracao", "qualidade", "risco"]
InsightSeverity = Literal["baixa", "media", "alta"]
VALID_STATUSES = {"novo", "revisado", "ignorado"}


@dataclass(frozen=True)
class OperationalInsight:
    id: int
    tipo: InsightType
    severidade: InsightSeverity
    titulo: str
    descricao: str
    recomendacao: str
    importId: int
    projectName: str
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tipo": self.tipo,
            "severidade": self.severidade,
            "titulo": self.titulo,
            "descricao": self.descricao,
            "recomendacao": self.recomendacao,
            "importId": self.importId,
            "projectName": self.projectName,
            "metadata": self.metadata,
        }


def build_operational_insights(
    repository: AnalyticsRepository,
    *,
    import_id: int | None = None,
    project_name: str | None = None,
    insight_type: str | None = None,
    severity: str | None = None,
) -> dict[str, Any]:
    imports = repository.list_imports()
    current_import = _select_current_import(imports, import_id=import_id, project_name=project_name)

    if not current_import:
        return {
            "summary": _summary([]),
            "context": None,
            "filters": _filter_options(imports),
            "insights": [],
        }

    same_project_imports = [
        row
        for row in imports
        if _normalize_project(row["project_name"]) == _normalize_project(current_import["project_name"])
    ]
    previous_import = _previous_import(same_project_imports, current_import)
    insights = _generate_insights(repository, current_import, previous_import)

    if insight_type:
        insights = [insight for insight in insights if insight.tipo == insight_type]
    if severity:
        insights = [insight for insight in insights if insight.severidade == severity]

    return {
        "summary": _summary(insights),
        "context": {
            "importId": current_import["id"],
            "projectName": current_import["project_name"],
            "filename": current_import["nome_arquivo"],
            "importedAt": current_import["data_importacao"].isoformat(),
            "totalHours": _hours(current_import["total_seconds"]),
            "totalRecords": int(current_import["total_records"] or 0),
            "previousImportId": previous_import["id"] if previous_import else None,
        },
        "filters": _filter_options(imports),
        "insights": [insight.to_dict() for insight in insights],
    }


def list_persisted_operational_insights(
    repository: AnalyticsRepository,
    *,
    import_id: int | None = None,
    insight_type: str | None = None,
    severity: str | None = None,
    status: str | None = None,
) -> dict[str, Any]:
    imports = repository.list_imports()
    saved_rows = repository.list_saved_insights(
        import_id=import_id,
        insight_type=insight_type,
        severity=severity,
        status=status,
    )
    insights = [_saved_insight_to_dict(row) for row in saved_rows]
    context_import = _select_current_import(imports, import_id=import_id, project_name=None)

    return {
        "summary": _saved_summary(insights),
        "context": _context_from_import(context_import, previous_import=None) if context_import else None,
        "filters": _filter_options(imports),
        "insights": insights,
    }


def generate_and_persist_operational_insights(
    repository: AnalyticsRepository,
    *,
    import_id: int,
) -> dict[str, Any]:
    generated = build_operational_insights(repository, import_id=import_id)
    saved_rows = [repository.save_insight(insight) for insight in generated["insights"]]
    insights = [_saved_insight_to_dict(row) for row in saved_rows]

    return {
        "summary": _saved_summary(insights),
        "context": generated["context"],
        "filters": generated["filters"],
        "insights": insights,
    }


def update_operational_insight_status(
    repository: AnalyticsRepository,
    *,
    insight_id: int,
    status: str,
    user: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if status not in VALID_STATUSES:
        raise ValueError("Status de insight invalido.")

    before = repository.get_saved_insight(insight_id)
    if not before:
        raise ValueError("Insight operacional nao encontrado.")
    before_snapshot = dict(before)

    updated = repository.update_insight_status(insight_id, status=status, user=user or "sistema")
    if not updated:
        raise ValueError("Insight operacional nao encontrado.")

    return _saved_insight_to_dict(updated), before_snapshot


def _generate_insights(
    repository: AnalyticsRepository,
    current_import: dict[str, Any],
    previous_import: dict[str, Any] | None,
) -> list[OperationalInsight]:
    insights: list[OperationalInsight] = []
    next_id = 1

    def add(
        tipo: InsightType,
        severidade: InsightSeverity,
        titulo: str,
        descricao: str,
        recomendacao: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        nonlocal next_id
        insights.append(
            OperationalInsight(
                id=next_id,
                tipo=tipo,
                severidade=severidade,
                titulo=titulo,
                descricao=descricao,
                recomendacao=recomendacao,
                importId=int(current_import["id"]),
                projectName=current_import["project_name"],
                metadata=metadata or {},
            )
        )
        next_id += 1

    import_id = int(current_import["id"])
    current_categories = repository.get_category_metrics(import_id)

    if previous_import:
        previous_categories = repository.get_category_metrics(int(previous_import["id"]))
        for change in _category_changes(current_categories, previous_categories):
            direction = "aumentou" if change["variation"] > 0 else "reduziu"
            severity_value: InsightSeverity = "alta" if abs(change["variation"]) >= 50 else "media"
            add(
                "tendencia",
                severity_value,
                f"{change['category']} {direction} {abs(change['variation']):.0f}%",
                (
                    f"A categoria {change['category']} {direction} {abs(change['variation']):.1f}% "
                    "em relacao a importacao anterior do mesmo projeto."
                ),
                "Avaliar se a variacao representa mudanca esperada de escopo, fase do projeto ou risco operacional.",
                change,
            )

        total_variation = _percentage_change(current_import["total_seconds"], previous_import["total_seconds"])
        record_variation = _percentage_change(current_import["total_records"], previous_import["total_records"])
        if total_variation is not None and abs(total_variation) > 20:
            add(
                "tendencia",
                "alta" if abs(total_variation) >= 50 else "media",
                "Variacao relevante de horas do projeto",
                (
                    f"As horas totais variaram {total_variation:.1f}% em relacao a versao anterior "
                    f"do projeto ({_hours(previous_import['total_seconds'])}h -> {_hours(current_import['total_seconds'])}h)."
                ),
                "Comparar o escopo entre as importacoes e confirmar se a alteracao de esforco era esperada.",
                {"variation": round(total_variation, 2), "metric": "total_hours"},
            )
        if record_variation is not None and abs(record_variation) > 20:
            add(
                "tendencia",
                "media",
                "Variacao relevante na quantidade de lancamentos",
                (
                    f"A quantidade de lancamentos variou {record_variation:.1f}% em relacao a importacao anterior."
                ),
                "Verificar se houve mudanca de periodo, carga importada ou atualizacao significativa da planilha.",
                {"variation": round(record_variation, 2), "metric": "records"},
            )

    collaborators = repository.get_collaborator_metrics(import_id)
    total_seconds = int(current_import["total_seconds"] or 0)
    for collaborator in collaborators:
        percentage = (int(collaborator["total_seconds"] or 0) / total_seconds) * 100 if total_seconds else 0
        if percentage > 50:
            add(
                "concentracao",
                "alta",
                "Concentracao de horas em um colaborador",
                (
                    f"{collaborator['login_usuario']} concentra {percentage:.1f}% das horas do projeto "
                    f"({_hours(collaborator['total_seconds'])}h)."
                ),
                "Avaliar dependencia operacional, distribuicao de conhecimento e risco de gargalo.",
                {"user": collaborator["login_usuario"], "percentage": round(percentage, 2)},
            )

    confidence_stats = repository.get_low_confidence_stats(import_id)
    low_confidence_count = int(confidence_stats["low_confidence_count"] or 0)
    total_classifications = int(confidence_stats["total_classifications"] or 0)
    low_confidence_percentage = (low_confidence_count / total_classifications) * 100 if total_classifications else 0
    if low_confidence_percentage > 10:
        add(
            "qualidade",
            "media" if low_confidence_percentage < 25 else "alta",
            "Classificacoes com baixa confianca",
            (
                f"{low_confidence_percentage:.1f}% das classificacoes ficaram abaixo de 90% de confianca "
                f"({low_confidence_count} de {total_classifications})."
            ),
            "Revisar titulos fora do padrao [Categoria] e perfis operacionais dos colaboradores.",
            {
                "lowConfidenceCount": low_confidence_count,
                "totalClassifications": total_classifications,
                "percentage": round(low_confidence_percentage, 2),
            },
        )

    pending_stats = repository.get_pending_reviews_stats(import_id)
    for row in pending_stats:
        if row["status"] != "pendente":
            continue
        total = int(row["total"] or 0)
        if total <= 0:
            continue
        pending_severity = _pending_severity(row["tipo"])
        add(
            "risco",
            pending_severity,
            "Pendencias operacionais abertas",
            f"Existem {total} pendencia(s) aberta(s) do tipo {row['tipo']}.",
            "Finalizar a revisao das pendencias antes de usar a importacao como base executiva.",
            {"type": row["tipo"], "total": total},
        )

    for row in repository.get_unresolved_alert_stats(import_id):
        total = int(row["total"] or 0)
        if total <= 0:
            continue
        add(
            "risco",
            "media" if row["severidade"] == "alerta" else "alta",
            "Alertas de importacao sem resolucao",
            f"Existem {total} alerta(s) nao resolvido(s) do tipo {row['tipo_erro']}.",
            "Revisar os alertas para reduzir risco de interpretacao incorreta dos relatorios.",
            {"code": row["tipo_erro"], "severity": row["severidade"], "total": total},
        )

    excessive_records = repository.get_excessive_duration_records(import_id)
    if excessive_records:
        add(
            "anomalia",
            "alta",
            "Lancamentos com duracao excessiva",
            f"Foram encontrados {len(excessive_records)} lancamento(s) com duracao superior a 12 horas.",
            "Validar se os apontamentos representam uma atividade real ou erro de preenchimento.",
            {
                "total": len(excessive_records),
                "examples": [
                    {
                        "idLancamento": item["id_lancamento"],
                        "user": item["login_usuario"],
                        "hours": _hours(item["duracao_segundos"]),
                    }
                    for item in excessive_records[:5]
                ],
            },
        )

    generic_titles = repository.get_generic_title_records(import_id)
    if generic_titles:
        add(
            "qualidade",
            "media",
            "Titulos genericos nas atividades",
            f"Foram encontrados {len(generic_titles)} grupo(s) de Task com titulo generico ou pouco descritivo.",
            "Melhorar o titulo das Tasks para tornar os relatorios mais explicativos e reduzir reclassificacoes.",
            {
                "total": len(generic_titles),
                "examples": [
                    {
                        "idTask": item["id_task"],
                        "title": item["titulo_task"],
                        "records": item["total_records"],
                    }
                    for item in generic_titles[:5]
                ],
            },
        )

    return insights


def _select_current_import(
    imports: list[dict[str, Any]],
    *,
    import_id: int | None,
    project_name: str | None,
) -> dict[str, Any] | None:
    if import_id is not None:
        return next((row for row in imports if int(row["id"]) == import_id), None)
    if project_name:
        candidates = [row for row in imports if _normalize_project(row["project_name"]) == _normalize_project(project_name)]
        return candidates[0] if candidates else None
    return imports[0] if imports else None


def _previous_import(imports: list[dict[str, Any]], current_import: dict[str, Any]) -> dict[str, Any] | None:
    older = [
        row
        for row in imports
        if row["data_importacao"] < current_import["data_importacao"]
        or (row["data_importacao"] == current_import["data_importacao"] and int(row["id"]) < int(current_import["id"]))
    ]
    older.sort(key=lambda item: (item["data_importacao"], item["id"]), reverse=True)
    return older[0] if older else None


def _category_changes(current: list[dict[str, Any]], previous: list[dict[str, Any]]) -> list[dict[str, Any]]:
    current_by_category = {row["category"]: int(row["total_seconds"] or 0) for row in current}
    previous_by_category = {row["category"]: int(row["total_seconds"] or 0) for row in previous}
    categories = sorted(set(current_by_category) | set(previous_by_category))
    changes = []
    for category in categories:
        previous_seconds = previous_by_category.get(category, 0)
        current_seconds = current_by_category.get(category, 0)
        variation = _percentage_change(current_seconds, previous_seconds)
        if variation is None or abs(variation) <= 20:
            continue
        changes.append(
            {
                "category": category,
                "previousHours": _hours(previous_seconds),
                "currentHours": _hours(current_seconds),
                "variation": round(variation, 2),
            }
        )
    return changes


def _percentage_change(current_value: int | float, previous_value: int | float) -> float | None:
    current = float(current_value or 0)
    previous = float(previous_value or 0)
    if previous == 0:
        if current == 0:
            return None
        return 100.0
    return ((current - previous) / previous) * 100


def _pending_severity(pending_type: str) -> InsightSeverity:
    if pending_type == "unclassified":
        return "alta"
    if pending_type == "low_confidence":
        return "media"
    return "baixa"


def _summary(insights: list[OperationalInsight]) -> dict[str, int]:
    return {
        "total": len(insights),
        "alta": sum(1 for insight in insights if insight.severidade == "alta"),
        "media": sum(1 for insight in insights if insight.severidade == "media"),
        "baixa": sum(1 for insight in insights if insight.severidade == "baixa"),
        "novo": len(insights),
        "revisado": 0,
        "ignorado": 0,
        "tendencia": sum(1 for insight in insights if insight.tipo == "tendencia"),
        "anomalia": sum(1 for insight in insights if insight.tipo == "anomalia"),
        "concentracao": sum(1 for insight in insights if insight.tipo == "concentracao"),
        "qualidade": sum(1 for insight in insights if insight.tipo == "qualidade"),
        "risco": sum(1 for insight in insights if insight.tipo == "risco"),
    }


def _saved_summary(insights: list[dict[str, Any]]) -> dict[str, int]:
    return {
        "total": len(insights),
        "alta": sum(1 for insight in insights if insight["severidade"] == "alta"),
        "media": sum(1 for insight in insights if insight["severidade"] == "media"),
        "baixa": sum(1 for insight in insights if insight["severidade"] == "baixa"),
        "novo": sum(1 for insight in insights if insight["status"] == "novo"),
        "revisado": sum(1 for insight in insights if insight["status"] == "revisado"),
        "ignorado": sum(1 for insight in insights if insight["status"] == "ignorado"),
        "tendencia": sum(1 for insight in insights if insight["tipo"] == "tendencia"),
        "anomalia": sum(1 for insight in insights if insight["tipo"] == "anomalia"),
        "concentracao": sum(1 for insight in insights if insight["tipo"] == "concentracao"),
        "qualidade": sum(1 for insight in insights if insight["tipo"] == "qualidade"),
        "risco": sum(1 for insight in insights if insight["tipo"] == "risco"),
    }


def _saved_insight_to_dict(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "tipo": row["tipo"],
        "severidade": row["severidade"],
        "titulo": row["titulo"],
        "descricao": row["descricao"],
        "recomendacao": row["recomendacao"] or "",
        "importId": row["importacao_id"],
        "projectName": _project_name_from_row(row),
        "metadata": row["metricas_json"] or {},
        "status": row["status"],
        "generatedAt": row["gerado_em"].isoformat() if row.get("gerado_em") else None,
        "reviewedAt": row["revisado_em"].isoformat() if row.get("revisado_em") else None,
        "reviewUser": row["usuario_revisao"],
    }


def _context_from_import(import_row: dict[str, Any], previous_import: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "importId": import_row["id"],
        "projectName": import_row["project_name"],
        "filename": import_row["nome_arquivo"],
        "importedAt": import_row["data_importacao"].isoformat(),
        "totalHours": _hours(import_row["total_seconds"]),
        "totalRecords": int(import_row["total_records"] or 0),
        "previousImportId": previous_import["id"] if previous_import else None,
    }


def _project_name_from_row(row: dict[str, Any]) -> str:
    from app.repositories.analytics_repository import project_name_from_filename

    return project_name_from_filename(row["nome_arquivo"])


def _filter_options(imports: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    projects = sorted({_normalize_project(row["project_name"]): row["project_name"] for row in imports}.values())
    return {
        "projects": [{"value": project, "label": project} for project in projects],
        "imports": [
            {
                "value": row["id"],
                "label": row["nome_arquivo"],
                "projectName": row["project_name"],
                "importedAt": row["data_importacao"].isoformat(),
            }
            for row in imports
        ],
    }


def _normalize_project(project_name: str) -> str:
    return project_name.strip().lower()


def _hours(seconds: int | float) -> float:
    return round(float(seconds or 0) / 3600, 2)
