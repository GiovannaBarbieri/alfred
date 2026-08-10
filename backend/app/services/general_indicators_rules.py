from __future__ import annotations

import re
import unicodedata
import hashlib
import json
from calendar import monthrange
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal, getcontext
from typing import Any, Iterable

getcontext().prec = 28

RESULT_CONTRACT_VERSION = 2
CALCULATION_VERSION = "general-indicators-v1"
MODULE_FILTER_VERSION = "general-indicator-modules-v1"
CLASSIFICATION_VERSION = "hierarchy-tags-v2"
DISTRIBUTION_RULES_VERSION = "update-system-weighted-proportional-v2"
TARGET_RULES_VERSION = "general-indicators-targets-v1"

DEFAULT_DISTRIBUTION_CONFIGURATION = {
    "Novo projeto": {"weight": Decimal("1"), "active": True},
    "Melhoria": {"weight": Decimal("1"), "active": True},
    "Erro TI": {"weight": Decimal("1"), "active": True},
    "Bug": {"weight": Decimal("1"), "active": True},
    "Manutenção": {"weight": Decimal("1"), "active": True},
}

INDICATOR_RULES = {
    "distribution_categories": tuple(DEFAULT_DISTRIBUTION_CONFIGURATION),
    "update_system_module": "atualizacao do sistema",
    "projects_target": Decimal("40"),
    "projects_alert": Decimal("30"),
    "errors_limit": Decimal("10"),
    "errors_critical": Decimal("15"),
}

_DURATION_PATTERN = re.compile(r"^\s*(?:(\d+)d\s*)?(\d+):(\d{2}):(\d{2})\s*$", re.IGNORECASE)
_TAG_PATTERN = re.compile(r"^\s*([123])\s*-\s*(.*?)\s*$", re.IGNORECASE)
_CATEGORY_NAMES = {
    "manutencao": "Manutenção",
    "novo projeto": "Novo projeto",
    "melhoria": "Melhoria",
    "melhorias": "Melhoria",
    "erro ti": "Erro TI",
    "bug": "Bug",
}


def normalize_text(value: Any) -> str:
    text = " ".join(str(value or "").strip().split())
    return "".join(
        char for char in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(char)
    )


def parse_duration_seconds(value: Any) -> int | None:
    match = _DURATION_PATTERN.fullmatch(str(value or ""))
    if not match:
        return None
    days, hours, minutes, seconds = (int(part or 0) for part in match.groups())
    if minutes >= 60 or seconds >= 60:
        return None
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def parse_indicator_tags(value: Any) -> tuple[dict[str, str | None], str | None]:
    raw = str(value or "").strip()
    empty = {"module": None, "category": None, "demand": None}
    if not raw:
        return empty, "tag_missing"

    parsed: dict[str, str] = {}
    invalid_prefixed_part = False
    for part in raw.split(";"):
        candidate = part.strip()
        if not candidate:
            continue
        match = _TAG_PATTERN.fullmatch(candidate)
        if match:
            key, content = match.groups()
            if content.strip() and key not in parsed:
                parsed[key] = " ".join(content.strip().split())
            else:
                invalid_prefixed_part = True
        elif re.match(r"^\s*[123]\s*-", candidate, re.IGNORECASE):
            invalid_prefixed_part = True

    result = {"module": parsed.get("1"), "category": parsed.get("2"), "demand": parsed.get("3")}
    invalid = invalid_prefixed_part or any(result[key] is None for key in result)
    return result, "tag_invalid" if invalid else None


def canonical_category(value: Any) -> str:
    text = " ".join(str(value or "").strip().split())
    return _CATEGORY_NAMES.get(normalize_text(text), text or "Não classificado")


def normalize_distribution_configuration(
    configuration: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Normaliza pesos configuráveis sem acoplar o algoritmo às categorias participantes."""
    source = configuration or DEFAULT_DISTRIBUTION_CONFIGURATION
    normalized: dict[str, dict[str, Any]] = {}
    for raw_category, raw_settings in source.items():
        category = canonical_category(raw_category)
        settings = raw_settings if isinstance(raw_settings, dict) else {"weight": raw_settings, "active": True}
        weight = Decimal(str(settings.get("weight", 0)))
        if weight <= 0:
            raise ValueError(f"O peso de distribuição de {category} deve ser maior que zero.")
        normalized[category] = {
            "weight": weight,
            "active": bool(settings.get("active", True)),
        }
    return normalized


def distribution_configuration_snapshot(
    configuration: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    return {
        category: {"weight": str(settings["weight"]), "active": bool(settings["active"])}
        for category, settings in normalize_distribution_configuration(configuration).items()
    }


def classify_indicator(category_tag: Any, work_item_type: Any) -> str:
    if normalize_text(work_item_type) == "bug":
        return "Bug"
    return canonical_category(category_tag)


def deduplicate_launches(rows: Iterable[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    order: list[str] = []
    for row in rows:
        key = str(_get(row, "IdLancamento", "id_lancamento") or "").strip()
        if key not in grouped:
            order.append(key)
        grouped[key].append(row)

    unique: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    for key in order:
        occurrences = grouped[key]
        unique.append(occurrences[0])
        if len(occurrences) <= 1:
            continue
        conflict = any(_comparable_row(row) != _comparable_row(occurrences[0]) for row in occurrences[1:])
        issues.append(
            _issue(
                "duplicate_id",
                key or None,
                f"IdLancamento repetido {len(occurrences)} vezes" + (" com dados divergentes." if conflict else "."),
                {"occurrences": len(occurrences), "conflict": conflict},
            )
        )
    return unique, issues


def build_general_indicators(
    rows: Iterable[dict[str, Any]],
    tfs_items: Iterable[dict[str, Any]],
    *,
    start_date: date,
    end_date: date,
) -> dict[str, Any]:
    unique_rows, issues = deduplicate_launches(rows)
    metadata = {
        str(_get(item, "Id", "ID", "id") or "").strip(): item
        for item in tfs_items
        if str(_get(item, "Id", "ID", "id") or "").strip()
    }
    entries: list[dict[str, Any]] = []

    for row in unique_rows:
        launch_id = str(_get(row, "IdLancamento", "id_lancamento") or "").strip() or None
        feature_id = _clean_id(_get(row, "IdFeat", "id_feat"))
        parent_id = _clean_id(_get(row, "IdPBI", "id_pbi"))
        feature = metadata.get(feature_id) if feature_id else None
        parent = metadata.get(parent_id) if parent_id else None
        if feature_id and feature is None:
            issues.append(_issue("tfs_item_not_found", launch_id, f"Feature {feature_id} não encontrada no TFS."))
        if parent_id and parent is None:
            issues.append(_issue("tfs_item_not_found", launch_id, f"Item {parent_id} não encontrado no TFS."))

        tags, tag_issue = parse_indicator_tags(_get(feature or {}, "Tags", "tags"))
        if tag_issue == "tag_missing":
            issues.append(_issue("tag_missing", launch_id, "Feature sem TAGs de indicadores."))
        elif tag_issue == "tag_invalid":
            issues.append(_issue("tag_invalid", launch_id, "TAGs 1, 2 ou 3 ausentes ou inválidas."))

        category = classify_indicator(tags["category"], _get(parent or {}, "WorkItemType", "work_item_type", "Type"))
        duration = parse_duration_seconds(_get(row, "TempoDuracao", "Duracao", "duracao"))
        if duration is None:
            issues.append(_issue("invalid_duration", launch_id, "Duração ausente ou fora do formato esperado."))
        created_at = _parse_datetime(_get(row, "DataHoraCadastro", "data_hora_cadastro"))
        if created_at is None:
            issues.append(_issue("invalid_date", launch_id, "DataHoraCadastro inválida."))
        if duration is None or created_at is None:
            continue
        entries.append(
            {
                "id": launch_id,
                "seconds": Decimal(duration),
                "month": created_at.strftime("%Y-%m"),
                "module": tags["module"],
                "category": category,
                "is_update_system": normalize_text(tags["module"]) == INDICATOR_RULES["update_system_module"]
                and category != "Bug",
            }
        )

    months = []
    aggregate_original: dict[str, Decimal] = defaultdict(Decimal)
    aggregate_allocated: dict[str, Decimal] = defaultdict(Decimal)
    aggregate_adjusted: dict[str, Decimal] = defaultdict(Decimal)
    for month in _month_keys(start_date, end_date):
        month_entries = [entry for entry in entries if entry["month"] == month]
        result, month_issues = distribute_update_system(month_entries, period=month)
        issues.extend(month_issues)
        for category, value in result["original"].items():
            aggregate_original[category] += value
        for category, value in result["allocated"].items():
            aggregate_allocated[category] += value
        for category, value in result["adjusted"].items():
            aggregate_adjusted[category] += value
        total = sum(result["adjusted"].values(), Decimal(0))
        month_kpis = calculate_kpis(result["adjusted"], total)
        months.append(
            {
                "month": month,
                "label": _month_label(month),
                "totalHours": _hours(total),
                "projectsImprovementsPercentage": month_kpis["projectsImprovements"]["percentage"],
                "errorsBugsPercentage": month_kpis["errorsBugs"]["percentage"],
                "categories": {key: _hours(value) for key, value in sorted(result["adjusted"].items())},
            }
        )

    total_seconds = sum(aggregate_adjusted.values(), Decimal(0))
    kpis = calculate_kpis(aggregate_adjusted, total_seconds)
    category_names = sorted(set(aggregate_original) | set(aggregate_adjusted), key=_category_sort_key)
    categories = [
        {
            "category": category,
            "originalHours": _hours(aggregate_original[category]),
            "allocatedHours": _hours(aggregate_allocated[category]),
            "adjustedHours": _hours(aggregate_adjusted[category]),
            "percentage": _percentage(aggregate_adjusted[category], total_seconds),
        }
        for category in category_names
    ]
    counts = Counter(issue["type"] for issue in issues)
    quarter = ((start_date.month - 1) // 3) + 1 if start_date.year == end_date.year else None
    return {
        "period": {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
            "year": start_date.year if start_date.year == end_date.year else None,
            "quarter": quarter,
        },
        "totalHours": _hours(total_seconds),
        "recordCount": len(entries),
        "kpis": kpis,
        "categories": categories,
        "months": months,
        "inconsistencies": {"total": len(issues), "counts": dict(sorted(counts.items())), "items": issues},
    }


def build_finalized_general_indicators(
    launches: Iterable[dict[str, Any]],
    *,
    start_date: date,
    end_date: date,
    consultation_id: int,
    consulted_at: Any,
    finalized_at: Any,
    inconsistency_history: Iterable[dict[str, Any]] | None = None,
    consultation_summary: dict[str, Any] | None = None,
    validated_at: Any = None,
    initiated_by: str | None = None,
    finalized_by: str | None = None,
    backend_build: str | None = None,
    distribution_configuration: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Calcula o resultado oficial exclusivamente a partir do snapshot validado da consulta."""
    launch_items = deepcopy(list(launches))
    valid_launches = [
        dict(item)
        for item in launch_items
        if item.get(
            "eligibleForOfficialCalculation",
            item.get("validationState") != "blocking" and not item.get("disregardedFromGeneralIndicators"),
        )
        and item.get("validationState") != "blocking"
        and item.get("durationSeconds") is not None
    ]
    entries = [
        {
            "id": str(item.get("idLancamento") or ""),
            "seconds": Decimal(str(item["durationSeconds"])),
            "month": item.get("monthYear"),
            "category": item.get("validatedCategory") or item.get("finalCategory"),
            "is_update_system": bool(item.get("isUpdateSystem")),
            "launch": item,
        }
        for item in valid_launches
    ]

    aggregate_original: dict[str, Decimal] = defaultdict(Decimal)
    aggregate_allocated: dict[str, Decimal] = defaultdict(Decimal)
    aggregate_adjusted: dict[str, Decimal] = defaultdict(Decimal)
    allocated_hours_by_launch: dict[str, Decimal] = defaultdict(Decimal)
    months: list[dict[str, Any]] = []
    distribution: list[dict[str, Any]] = []
    normalized_distribution_configuration = normalize_distribution_configuration(distribution_configuration)
    active_distribution_categories = [
        category
        for category, settings in normalized_distribution_configuration.items()
        if settings["active"]
    ]

    for month in _month_keys(start_date, end_date):
        month_entries = [entry for entry in entries if entry["month"] == month]
        result, issues = distribute_update_system(
            month_entries,
            period=month,
            distribution_configuration=normalized_distribution_configuration,
        )
        if issues:
            raise ValueError(issues[0]["message"])
        for category, value in result["original"].items():
            aggregate_original[category] += value
        for category, value in result["allocated"].items():
            aggregate_allocated[category] += value
        for category, value in result["adjusted"].items():
            aggregate_adjusted[category] += value

        update_seconds = result["original"].get("Atualização do sistema", Decimal(0))
        base_seconds = sum(
            (result["original"].get(category, Decimal(0)) for category in active_distribution_categories),
            Decimal(0),
        )
        if update_seconds and base_seconds:
            month_allocated_by_launch: dict[str, Decimal] = {}
            for entry in month_entries:
                category = canonical_category(entry["category"])
                category_original = result["original"].get(category, Decimal(0))
                category_allocation = result["allocated"].get(category, Decimal(0))
                if (
                    not entry["is_update_system"]
                    and category in active_distribution_categories
                    and category_original > 0
                ):
                    share = category_allocation * entry["seconds"] / category_original
                    month_allocated_by_launch[entry["id"]] = share
            allocated_hours_by_launch.update(
                _balanced_hours_breakdown(month_allocated_by_launch, update_seconds)
            )

        total = sum(result["adjusted"].values(), Decimal(0))
        month_kpis = calculate_kpis(result["adjusted"], total)
        months.append(
            {
                "month": month,
                "label": _month_label(month),
                "competence": _month_competence(month, start_date, end_date),
                "totalHours": _hours(total),
                "projectsImprovements": month_kpis["projectsImprovements"],
                "errorsBugs": month_kpis["errorsBugs"],
                "categories": {key: _hours(value) for key, value in sorted(result["adjusted"].items())},
            }
        )
        distributed_seconds = sum(result["allocated"].values(), Decimal(0))
        displayed_allocations = _balanced_hours_breakdown(
            {
                category: result["allocated"].get(category, Decimal(0))
                for category in active_distribution_categories
            },
            update_seconds,
        )
        displayed_update_hours = (update_seconds / Decimal(3600)).quantize(Decimal("0.0001"))
        displayed_distributed_hours = sum(displayed_allocations.values(), Decimal(0))
        distribution.append(
            {
                "month": month,
                "label": _month_label(month),
                "competence": _month_competence(month, start_date, end_date),
                "updateSystemHours": _hours(update_seconds),
                "distributionBaseHours": _hours(base_seconds),
                "maintenanceHours": float(displayed_allocations.get("Manutenção", Decimal(0))),
                "newProjectHours": float(displayed_allocations.get("Novo projeto", Decimal(0))),
                "improvementHours": float(displayed_allocations.get("Melhoria", Decimal(0))),
                "itErrorHours": float(displayed_allocations.get("Erro TI", Decimal(0))),
                "bugHours": float(displayed_allocations.get("Bug", Decimal(0))),
                "distributedHours": float(displayed_distributed_hours),
                "isBalanced": (
                    abs(distributed_seconds - update_seconds) < Decimal("0.0001")
                    and displayed_distributed_hours == displayed_update_hours
                ),
            }
        )

    total_seconds = sum(aggregate_adjusted.values(), Decimal(0))
    kpis = calculate_kpis(aggregate_adjusted, total_seconds)
    category_names = sorted(set(aggregate_original) | set(aggregate_adjusted), key=_category_sort_key)
    categories = [
        {
            "category": category,
            "originalHours": _hours(aggregate_original[category]),
            "allocatedHours": _hours(aggregate_allocated[category]),
            "adjustedHours": _hours(aggregate_adjusted[category]),
            "percentage": _percentage(aggregate_adjusted[category], total_seconds),
        }
        for category in category_names
    ]
    history_items = [dict(item) for item in (inconsistency_history or [])]
    history_by_launch: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for history_item in history_items:
        affected_ids = {
            str(value)
            for value in [history_item.get("idLancamento"), *history_item.get("affectedLaunchIds", [])]
            if value is not None and str(value).strip()
        }
        for affected_id in affected_ids:
            history_by_launch[affected_id].append(history_item)

    audit = []
    for item in launch_items:
        launch_id = str(item.get("idLancamento") or "")
        category = item.get("validatedCategory") or item.get("finalCategory")
        included = bool(
            item.get(
                "eligibleForOfficialCalculation",
                item.get("validationState") != "blocking" and not item.get("disregardedFromGeneralIndicators"),
            )
        )
        participation = []
        if included and category in {"Novo projeto", "Melhoria"}:
            participation.append("Novos projetos e melhorias")
        if included and category in {"Erro TI", "Bug"}:
            participation.append("Erros TI e Bugs")
        audit.append(
            {
                "idLancamento": item.get("idLancamento"),
                "date": item.get("launchDate"),
                "collaborator": item.get("user"),
                "durationHours": item.get("durationHours"),
                "idTask": item.get("idTask"),
                "idParent": item.get("idParent"),
                "parentType": item.get("parentWorkItemType"),
                "idFeature": item.get("idFeature"),
                "originalTags": item.get("trace", {}).get("featureTagsRaw"),
                "tags": [value for value in (item.get("tag1"), item.get("tag2"), item.get("tag3")) if value],
                "originalCategory": "Atualização do sistema" if item.get("isUpdateSystem") else category,
                "finalCategory": category,
                "month": item.get("monthYear"),
                "kpiParticipation": participation,
                "allocatedHours": float(allocated_hours_by_launch[launch_id]),
                "isUpdateSystem": bool(item.get("isUpdateSystem")),
                "validationState": item.get("validationState"),
                "validationIssues": list(item.get("auditIssues", [])),
                "includedInOfficialCalculation": included,
                "participatesInGeneralIndicators": item.get("participatesInGeneralIndicators", True),
                "disregardedFromGeneralIndicators": item.get("disregardedFromGeneralIndicators", False),
                "exclusionReason": item.get("exclusionReason"),
                "disregardedReasons": list(item.get("disregardedReasons", [])),
                "removedByWorkItemState": bool(item.get("removedByWorkItemState")),
                "removedWorkItems": list(item.get("removedWorkItems", [])),
                "moduleTag": item.get("moduleTag"),
                "moduleActive": item.get("moduleActive", True),
                "excludedByModule": item.get("excludedByModule", False),
                "sourceOccurrenceCount": int(item.get("trace", {}).get("sourceOccurrenceCount", 1)),
                "sourceRows": list(item.get("trace", {}).get("duplicateSourceRows", [])),
                "validationHistory": history_by_launch.get(launch_id, []),
            }
        )

    summary = _build_finalized_summary(launch_items, consultation_summary or {})
    disregarded_modules = _build_disregarded_modules(launch_items)
    quarters = _build_quarterly_results(months, start_date=start_date, end_date=end_date)
    launch_snapshot_hash = _hash_payload(_launch_hash_projection(launch_items))
    rules = _official_rules_snapshot(normalized_distribution_configuration)
    rules["modules"] = {
        "version": MODULE_FILTER_VERSION,
        "identity": "Texto completo da TAG 1-",
        "configuration": list((consultation_summary or {}).get("moduleConfiguration", [])),
        "behavior": (
            "Módulos inativos permanecem na auditoria, mas não participam do cálculo oficial."
        ),
    }
    result = {
        "contractVersion": RESULT_CONTRACT_VERSION,
        "consultationId": consultation_id,
        "status": "FINALIZADA",
        "period": {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
        "consultedAt": _iso_datetime(consulted_at),
        "finalizedAt": _iso_datetime(finalized_at),
        "metadata": {
            "consultationId": consultation_id,
            "consultedAt": _iso_datetime(consulted_at),
            "validatedAt": _iso_datetime(validated_at) if validated_at else None,
            "finalizedAt": _iso_datetime(finalized_at),
            "initiatedBy": initiated_by,
            "finalizedBy": finalized_by,
            "resultContractVersion": RESULT_CONTRACT_VERSION,
            "calculationVersion": CALCULATION_VERSION,
            "classificationVersion": CLASSIFICATION_VERSION,
            "distributionRulesVersion": DISTRIBUTION_RULES_VERSION,
            "targetsVersion": TARGET_RULES_VERSION,
            "backendBuild": backend_build,
            "moduleFilterVersion": MODULE_FILTER_VERSION,
        },
        "summary": summary,
        "disregardedModules": disregarded_modules,
        "recordCount": len(entries),
        "totalHours": _hours(total_seconds),
        "kpis": kpis,
        "categories": categories,
        "distribution": distribution,
        "months": months,
        "quarters": quarters,
        "rules": rules,
        "integrity": {
            "algorithm": "SHA-256",
            "launchSnapshotHash": launch_snapshot_hash,
            "resultHash": None,
        },
        "audit": audit,
        "inconsistencyHistory": history_items,
    }
    result["integrity"]["resultHash"] = finalized_result_hash(result)
    return result


def finalized_result_hash(result: dict[str, Any]) -> str:
    payload = json.loads(json.dumps(result, ensure_ascii=False, default=str))
    integrity = payload.get("integrity")
    if isinstance(integrity, dict):
        integrity.pop("resultHash", None)
    return _hash_payload(payload)


def _build_finalized_summary(
    launches: list[dict[str, Any]],
    persisted_summary: dict[str, Any],
) -> dict[str, Any]:
    disregarded = [item for item in launches if item.get("disregardedFromGeneralIndicators")]
    considered = [item for item in launches if not item.get("disregardedFromGeneralIndicators")]
    removed = [item for item in launches if item.get("removedByWorkItemState")]
    excluded_collaborators = sorted(
        {
            str(item.get("user") or "").strip()
            for item in disregarded
            if str(item.get("user") or "").strip()
            and not item.get("participatesInGeneralIndicators", True)
        },
        key=str.casefold,
    )
    return {
        "foundLaunchCount": int(persisted_summary.get("sourceRowCount", len(launches))),
        "uniqueLaunchCount": int(persisted_summary.get("uniqueLaunchCount", len(launches))),
        "consideredLaunchCount": int(persisted_summary.get("consideredLaunchCount", len(considered))),
        "disregardedLaunchCount": int(persisted_summary.get("disregardedLaunchCount", len(disregarded))),
        "removedLaunchCount": int(persisted_summary.get("removedLaunchCount", len(removed))),
        "removedHours": _summary_hours(persisted_summary, "removedHours", removed),
        "excludedCollaboratorCount": int(
            persisted_summary.get("excludedCollaboratorCount", len(excluded_collaborators))
        ),
        "excludedCollaborators": excluded_collaborators,
        "grossHours": _summary_hours(persisted_summary, "grossHours", launches),
        "consideredHours": _summary_hours(persisted_summary, "consideredHours", considered),
        "disregardedHours": _summary_hours(persisted_summary, "disregardedHours", disregarded),
        "inconsistencyCount": int(persisted_summary.get("inconsistencyCount", 0)),
        "pendingCount": int(persisted_summary.get("pendingCount", 0)),
        "affectedLaunchCount": int(persisted_summary.get("affectedLaunchCount", 0)),
        "affectedHours": float(persisted_summary.get("affectedHours", 0) or 0),
    }


def _build_disregarded_modules(launches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped_seconds: dict[str, Decimal] = defaultdict(Decimal)
    grouped_launches: dict[str, int] = defaultdict(int)
    for launch in launches:
        if not launch.get("excludedByModule") or not launch.get("moduleTag"):
            continue
        tag_name = str(launch["moduleTag"])
        grouped_seconds[tag_name] += Decimal(str(launch.get("durationSeconds") or 0))
        grouped_launches[tag_name] += 1
    return [
        {
            "tagName": tag_name,
            "hours": _hours(grouped_seconds[tag_name]),
            "launchCount": grouped_launches[tag_name],
        }
        for tag_name in sorted(grouped_seconds)
    ]


def _summary_hours(summary: dict[str, Any], key: str, launches: list[dict[str, Any]]) -> float:
    if key in summary:
        return float(summary.get(key) or 0)
    return round(sum(float(item.get("durationHours") or 0) for item in launches), 4)


def _build_quarterly_results(
    months: list[dict[str, Any]],
    *,
    start_date: date,
    end_date: date,
) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for month in months:
        year_text, month_text = str(month["month"]).split("-", 1)
        month_number = int(month_text)
        quarter_number = ((month_number - 1) // 3) + 1
        key = f"{year_text}-T{quarter_number}"
        current = grouped.setdefault(
            key,
            {
                "quarter": key,
                "label": f"{quarter_number}º tri./{year_text}",
                "year": int(year_text),
                "quarterNumber": quarter_number,
                "totalHours": Decimal(0),
                "newProjectHours": Decimal(0),
                "improvementHours": Decimal(0),
                "itErrorHours": Decimal(0),
                "bugHours": Decimal(0),
            },
        )
        categories = month.get("categories", {})
        current["totalHours"] += Decimal(str(month.get("totalHours", 0)))
        current["newProjectHours"] += Decimal(str(categories.get("Novo projeto", 0)))
        current["improvementHours"] += Decimal(str(categories.get("Melhoria", 0)))
        current["itErrorHours"] += Decimal(str(categories.get("Erro TI", 0)))
        current["bugHours"] += Decimal(str(categories.get("Bug", 0)))

    quarters: list[dict[str, Any]] = []
    for key in sorted(grouped):
        item = grouped[key]
        categories = {
            "Novo projeto": item["newProjectHours"],
            "Melhoria": item["improvementHours"],
            "Erro TI": item["itErrorHours"],
            "Bug": item["bugHours"],
        }
        kpis = calculate_kpis(categories, item["totalHours"])
        quarter_start_month = (item["quarterNumber"] - 1) * 3 + 1
        quarter_start = date(item["year"], quarter_start_month, 1)
        quarter_end_month = quarter_start_month + 2
        quarter_end = date(item["year"], quarter_end_month, monthrange(item["year"], quarter_end_month)[1])
        quarters.append(
            {
                "quarter": item["quarter"],
                "label": item["label"],
                "competence": {
                    "startDate": max(start_date, quarter_start).isoformat(),
                    "endDate": min(end_date, quarter_end).isoformat(),
                },
                "totalHours": float(item["totalHours"]),
                "newProjectHours": float(item["newProjectHours"]),
                "improvementHours": float(item["improvementHours"]),
                "itErrorHours": float(item["itErrorHours"]),
                "bugHours": float(item["bugHours"]),
                "projectsImprovements": kpis["projectsImprovements"],
                "errorsBugs": kpis["errorsBugs"],
            }
        )
    return quarters


def _month_competence(month: str, start_date: date, end_date: date) -> dict[str, str]:
    year_text, month_text = month.split("-", 1)
    year = int(year_text)
    month_number = int(month_text)
    month_start = date(year, month_number, 1)
    month_end = date(year, month_number, monthrange(year, month_number)[1])
    return {
        "startDate": max(start_date, month_start).isoformat(),
        "endDate": min(end_date, month_end).isoformat(),
    }


def _official_rules_snapshot(
    distribution_configuration: dict[str, Any] | None = None,
) -> dict[str, Any]:
    configuration = normalize_distribution_configuration(distribution_configuration)
    return {
        "versions": {
            "calculation": CALCULATION_VERSION,
            "classification": CLASSIFICATION_VERSION,
            "distribution": DISTRIBUTION_RULES_VERSION,
            "targets": TARGET_RULES_VERSION,
        },
        "distribution": {
            "method": "Distribuição proporcional ponderada",
            "participatingCategories": [
                category for category, settings in configuration.items() if settings["active"]
            ],
            "configuration": distribution_configuration_snapshot(configuration),
            "sourceCategory": "Atualização do sistema",
            "formula": (
                "horas_atualizacao_mes * (horas_originais_categoria * peso_categoria) "
                "/ soma(horas_originais_categoria * peso_categoria)"
            ),
            "base": "Soma mensal dos valores ponderados das categorias ativas.",
            "rounding": (
                "Cálculo interno em Decimal; exibição em horas com 4 casas decimais; "
                "eventual resíduo é atribuído à maior participação ponderada."
            ),
        },
        "classification": {
            "bugTreatment": "Pai real do tipo Bug classifica o lançamento como Bug; demais itens usam a TAG 2- da Feature.",
            "launchUnit": "Cada IdLancamento é uma unidade independente.",
        },
        "targets": {
            "projectsImprovements": {
                "target": float(INDICATOR_RULES["projects_target"]),
                "attentionFrom": float(INDICATOR_RULES["projects_alert"]),
                "statuses": {
                    "within_target": "percentual >= 40",
                    "attention": "30 <= percentual < 40",
                    "alert": "percentual < 30",
                },
            },
            "errorsBugs": {
                "limit": float(INDICATOR_RULES["errors_limit"]),
                "criticalAbove": float(INDICATOR_RULES["errors_critical"]),
                "statuses": {
                    "within_target": "percentual <= 10",
                    "attention": "10 < percentual <= 15",
                    "critical": "percentual > 15",
                },
            },
        },
        "collaboratorExclusion": (
            "O perfil de participação é capturado na consulta completa; lançamentos de não participantes "
            "permanecem na auditoria e não entram no cálculo oficial."
        ),
        "internalPrecision": {
            "numericType": "Decimal",
            "decimalContextPrecision": getcontext().prec,
            "durationUnit": "seconds",
        },
    }


def _launch_hash_projection(launches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    projection = [
        {
            "idLancamento": item.get("idLancamento"),
            "durationSeconds": item.get("durationSeconds"),
            "date": item.get("launchDate"),
            "collaborator": item.get("user"),
            "idTask": item.get("idTask"),
            "idParent": item.get("idParent"),
            "parentType": item.get("parentWorkItemType"),
            "idFeature": item.get("idFeature"),
            "originalTags": item.get("trace", {}).get("featureTagsRaw"),
            "tags": [item.get("tag1"), item.get("tag2"), item.get("tag3")],
            "finalCategory": item.get("validatedCategory") or item.get("finalCategory"),
            "participatesInGeneralIndicators": item.get("participatesInGeneralIndicators", True),
            "disregardedFromGeneralIndicators": item.get("disregardedFromGeneralIndicators", False),
            "exclusionReason": item.get("exclusionReason"),
            "disregardedReasons": list(item.get("disregardedReasons", [])),
            "removedByWorkItemState": bool(item.get("removedByWorkItemState")),
            "removedWorkItems": list(item.get("removedWorkItems", [])),
            "moduleTag": item.get("moduleTag"),
            "moduleActive": item.get("moduleActive", True),
            "excludedByModule": item.get("excludedByModule", False),
        }
        for item in launches
    ]
    return sorted(
        projection,
        key=lambda item: (
            str(item.get("idLancamento") or ""),
            json.dumps(item, ensure_ascii=False, sort_keys=True, default=str),
        ),
    )


def _hash_payload(payload: Any) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def distribute_update_system(
    entries: Iterable[dict[str, Any]],
    *,
    period: str = "",
    distribution_configuration: dict[str, Any] | None = None,
) -> tuple[dict[str, dict[str, Decimal]], list[dict[str, Any]]]:
    """Distribui por (horas originais × peso) / soma dos valores ponderados ativos."""
    configuration = normalize_distribution_configuration(distribution_configuration)
    active_weights = {
        category: settings["weight"]
        for category, settings in configuration.items()
        if settings["active"]
    }
    original: dict[str, Decimal] = defaultdict(Decimal)
    adjusted: dict[str, Decimal] = defaultdict(Decimal)
    allocated: dict[str, Decimal] = defaultdict(Decimal)
    update_total = Decimal(0)
    for entry in entries:
        seconds = Decimal(entry["seconds"])
        if entry.get("is_update_system"):
            update_total += seconds
            original["Atualização do sistema"] += seconds
        else:
            category = canonical_category(entry.get("category"))
            original[category] += seconds
            adjusted[category] += seconds

    weighted_base = sum(
        (original[category] * weight for category, weight in active_weights.items()),
        Decimal(0),
    )
    issues: list[dict[str, Any]] = []
    if update_total and weighted_base == 0:
        adjusted["Atualização do sistema"] += update_total
        issues.append(
            _issue(
                "distribution_impossible",
                None,
                f"Não foi possível distribuir as horas de Atualização do sistema em {period}: base igual a zero.",
                {"period": period, "updateHours": _hours(update_total)},
            )
        )
    elif update_total:
        participants = [category for category in active_weights if original[category] > 0]
        shares = {
            category: update_total * original[category] * active_weights[category] / weighted_base
            for category in participants
        }
        residual = update_total - sum(shares.values(), Decimal(0))
        if participants and residual:
            largest_participation = max(
                participants,
                key=lambda category: (
                    original[category] * active_weights[category],
                    -list(active_weights).index(category),
                ),
            )
            shares[largest_participation] += residual
        for category, share in shares.items():
            allocated[category] += share
            adjusted[category] += share

    for category in original:
        adjusted.setdefault(category, Decimal(0))
        allocated.setdefault(category, Decimal(0))
    return {"original": dict(original), "allocated": dict(allocated), "adjusted": dict(adjusted)}, issues


def calculate_kpis(categories: dict[str, Decimal], total: Decimal) -> dict[str, Any]:
    projects_hours = categories.get("Novo projeto", Decimal(0)) + categories.get("Melhoria", Decimal(0))
    errors_hours = categories.get("Erro TI", Decimal(0)) + categories.get("Bug", Decimal(0))
    projects_percentage = _percentage_decimal(projects_hours, total)
    errors_percentage = _percentage_decimal(errors_hours, total)
    projects_status = (
        "within_target"
        if projects_percentage >= INDICATOR_RULES["projects_target"]
        else "alert"
        if projects_percentage < INDICATOR_RULES["projects_alert"]
        else "attention"
    )
    errors_status = (
        "within_target"
        if errors_percentage <= INDICATOR_RULES["errors_limit"]
        else "attention"
        if errors_percentage <= INDICATOR_RULES["errors_critical"]
        else "critical"
    )
    return {
        "projectsImprovements": {
            "hours": _hours(projects_hours),
            "percentage": float(projects_percentage.quantize(Decimal("0.01"))),
            "target": float(INDICATOR_RULES["projects_target"]),
            "difference": float((projects_percentage - INDICATOR_RULES["projects_target"]).quantize(Decimal("0.01"))),
            "status": projects_status,
        },
        "errorsBugs": {
            "hours": _hours(errors_hours),
            "percentage": float(errors_percentage.quantize(Decimal("0.01"))),
            "limit": float(INDICATOR_RULES["errors_limit"]),
            "difference": float((errors_percentage - INDICATOR_RULES["errors_limit"]).quantize(Decimal("0.01"))),
            "status": errors_status,
        },
    }


def _get(mapping: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in mapping:
            return mapping[key]
    normalized = {normalize_text(key).replace("_", ""): value for key, value in mapping.items()}
    for key in keys:
        candidate = normalize_text(key).replace("_", "")
        if candidate in normalized:
            return normalized[candidate]
    return None


def _clean_id(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _comparable_row(row: dict[str, Any]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((normalize_text(key), str(value or "").strip()) for key, value in row.items()))


def _parse_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        for pattern in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
            try:
                return datetime.strptime(text, pattern)
            except ValueError:
                continue
    return None


def _month_keys(start_date: date, end_date: date) -> list[str]:
    keys: list[str] = []
    current = date(start_date.year, start_date.month, 1)
    final = date(end_date.year, end_date.month, 1)
    while current <= final:
        keys.append(current.strftime("%Y-%m"))
        current = date(current.year + (1 if current.month == 12 else 0), 1 if current.month == 12 else current.month + 1, 1)
    return keys


def _month_label(month: str) -> str:
    names = ("Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez")
    year, number = month.split("-")
    return f"{names[int(number) - 1]} {year}"


def _percentage_decimal(value: Decimal, total: Decimal) -> Decimal:
    return value * Decimal(100) / total if total else Decimal(0)


def _percentage(value: Decimal, total: Decimal) -> float:
    return float(_percentage_decimal(value, total).quantize(Decimal("0.01")))


def _hours(seconds: Decimal) -> float:
    return float((seconds / Decimal(3600)).quantize(Decimal("0.0001")))


def _balanced_hours_breakdown(
    values_in_seconds: dict[str, Decimal],
    total_in_seconds: Decimal,
) -> dict[str, Decimal]:
    """Arredonda para exibição e aplica o resíduo visual à maior participação."""
    quantum = Decimal("0.0001")
    rounded = {
        key: (value / Decimal(3600)).quantize(quantum)
        for key, value in values_in_seconds.items()
    }
    target = (total_in_seconds / Decimal(3600)).quantize(quantum)
    residual = target - sum(rounded.values(), Decimal(0))
    positive_keys = [key for key, value in values_in_seconds.items() if value > 0]
    if residual and positive_keys:
        largest = max(positive_keys, key=lambda key: values_in_seconds[key])
        rounded[largest] += residual
    return rounded


def _iso_datetime(value: Any) -> str:
    parsed = _parse_datetime(value)
    return (parsed or datetime.now().astimezone()).astimezone().isoformat()


def _category_sort_key(category: str) -> tuple[int, str]:
    preferred = [*INDICATOR_RULES["distribution_categories"], "Atualização do sistema"]
    return (preferred.index(category) if category in preferred else len(preferred), normalize_text(category))


def _issue(issue_type: str, launch_id: str | None, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"type": issue_type, "idLancamento": launch_id, "message": message, "details": details or {}}
