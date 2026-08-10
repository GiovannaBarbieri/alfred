from __future__ import annotations

from collections import Counter, defaultdict
from copy import deepcopy
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.services.general_indicators_rules import (
    canonical_category,
    normalize_distribution_configuration,
    normalize_text,
)

BLOCKING = "IMPEDITIVA"
AUTO_TREATED = "TRATADA_AUTOMATICAMENTE"

OFFICIAL_INDICATOR_CATEGORIES = (
    "Atendimento ao usuário",
    "Bug",
    "Coordenação",
    "Empresa",
    "Erro terceiros",
    "Erro TI",
    "Gerência Projeto",
    "Ineficiência Operacional",
    "Manutenção",
    "Melhoria",
    "Novo projeto",
    "Outros",
    "Pesquisa",
    "Publicação",
    "Relatório",
    "Treinamento",
)

_OFFICIAL_CATEGORY_BY_NORMALIZED = {
    normalize_text(category): category for category in OFFICIAL_INDICATOR_CATEGORIES
}
_SUPPORTED_PARENT_TYPES = {"bug", "product backlog item", "pbi"}
NONPARTICIPATION_REASON = "Colaborador configurado como n\u00e3o participante dos Indicadores Gerais."

_ROOT_CAUSE_PRIORITY = {
    "task_not_found": 1,
    "parent_not_found": 2,
    "parent_type_not_identified": 3,
    "parent_type_unsupported": 3,
    "hierarchy_ambiguous": 3,
    "feature_type_invalid": 4,
    "feature_not_found": 5,
    "tag_empty": 6,
    "tag_1_missing": 6,
    "tag_2_missing": 6,
    "tag_3_missing": 6,
    "tag_1_multiple": 6,
    "tag_2_multiple": 6,
    "tag_3_multiple": 6,
    "tag_invalid": 6,
    "category_unrecognized": 6,
}
_DERIVED_ISSUE_TYPES = {"classification_impossible"}


def validate_general_indicator_consultation(
    consultation: dict[str, Any],
    *,
    distribution_configuration: dict[str, Any] | None = None,
) -> dict[str, Any]:
    period = consultation["period"]
    start_date = date.fromisoformat(period["startDate"])
    end_date = date.fromisoformat(period["endDate"])
    launches = deepcopy(consultation.get("launches", []))
    issues: list[dict[str, Any]] = []
    direct_launch_issues: dict[int, list[dict[str, Any]]] = {}
    disregarded_launch_ids = {
        str(item.get("idLancamento"))
        for item in launches
        if item.get("disregardedFromGeneralIndicators") and item.get("idLancamento") is not None
    }

    for duplicate in consultation.get("diagnostics", {}).get("duplicates", []):
        if str(duplicate.get("idLancamento")) in disregarded_launch_ids:
            continue
        conflict = bool(duplicate.get("conflict"))
        issues.append(
            _issue(
                "duplicate_id_conflict" if conflict else "duplicate_id_identical",
                BLOCKING if conflict else AUTO_TREATED,
                "launch",
                id_launch=duplicate.get("idLancamento"),
                original_text=str(duplicate.get("idLancamento") or ""),
                message=(
                    "IdLancamento duplicado com dados divergentes."
                    if conflict
                    else "Linha duplicada idêntica reduzida automaticamente a um lançamento."
                ),
                treatment=None if conflict else "deduplicated",
                details={
                    "occurrences": duplicate.get("occurrences", 0),
                    "sourceRows": duplicate.get("sourceRows", []),
                },
            )
        )

    launches_by_feature: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for launch in launches:
        if launch.get("disregardedFromGeneralIndicators"):
            direct_launch_issues[id(launch)] = []
            continue
        feature_id = str(launch.get("idFeature") or "").strip()
        if feature_id and launch.get("trace", {}).get("featureTypeValidated"):
            launches_by_feature[feature_id].append(launch)
        launch_issues = _validate_launch(launch, start_date=start_date, end_date=end_date)
        direct_launch_issues[id(launch)] = launch_issues
        issues.extend(launch_issues)

    for feature_id, feature_launches in launches_by_feature.items():
        if not any(bool(item.get("trace", {}).get("featureMetadataFound")) for item in feature_launches):
            continue
        issues.extend(_validate_feature_tags(feature_id, feature_launches))

    issues.extend(
        _validate_monthly_distribution(
            launches,
            issues,
            distribution_configuration=distribution_configuration,
        )
    )
    _relate_issue_causes(issues, consultation)

    issues_by_launch_id: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for issue in issues:
        affected_ids = {
            str(value)
            for value in [issue.get("idLancamento"), *issue.get("affectedLaunchIds", [])]
            if value is not None and str(value).strip()
        }
        for affected_id in affected_ids:
            issues_by_launch_id[affected_id].append(issue)

    blocking_launch_ids: set[str] = set()
    auto_launch_ids: set[str] = set()
    for issue in issues:
        affected_ids = set(issue.get("affectedLaunchIds", []))
        if issue.get("idLancamento"):
            affected_ids.add(str(issue["idLancamento"]))
        if issue["severity"] == BLOCKING:
            blocking_launch_ids.update(affected_ids)
        else:
            auto_launch_ids.update(affected_ids)

    for launch in launches:
        launch_id = str(launch.get("idLancamento") or "")
        if launch.get("disregardedFromGeneralIndicators"):
            launch["validationState"] = "disregarded"
        elif not launch_id or launch_id in blocking_launch_ids:
            launch["validationState"] = "blocking"
        elif launch_id in auto_launch_ids:
            launch["validationState"] = "auto_treated"
        else:
            launch["validationState"] = "valid"
        launch["validatedCategory"] = _validated_category(launch)
        related_candidates = [
            *direct_launch_issues.get(id(launch), []),
            *issues_by_launch_id.get(launch_id, []),
        ]
        related_issues = list({id(issue): issue for issue in related_candidates}.values())
        blocking_messages = [issue["message"] for issue in related_issues if issue.get("severity") == BLOCKING]
        launch["auditIssues"] = [_audit_issue_summary(issue) for issue in related_issues]
        launch["eligibleForOfficialCalculation"] = launch["validationState"] not in {"blocking", "disregarded"}
        if launch.get("removedByWorkItemState"):
            launch["exclusionReason"] = launch.get("workItemRemovedReason") or "work_item_removed"
        elif launch.get("moduleExclusionReason"):
            launch["exclusionReason"] = launch.get("moduleExclusionReason")
        elif launch["validationState"] == "disregarded":
            launch["exclusionReason"] = NONPARTICIPATION_REASON
        else:
            launch["exclusionReason"] = " | ".join(dict.fromkeys(blocking_messages)) or None

    considered_launches = [item for item in launches if item["validationState"] != "disregarded"]
    disregarded_launches = [item for item in launches if item["validationState"] == "disregarded"]
    valid_launches = [item for item in considered_launches if item["validationState"] != "blocking"]
    affected_launches = [item for item in launches if item["validationState"] == "blocking"]
    removed_launches = [item for item in launches if item.get("removedByWorkItemState")]
    blocking_issues = [issue for issue in issues if issue["severity"] == BLOCKING]
    operational_pending_count = len(
        {
            issue.get("details", {}).get("displayGroupKey") or _technical_issue_key(issue, consultation)
            for issue in blocking_issues
            if not issue.get("details", {}).get("isDerived")
        }
    )
    status = "COM_INCONSISTENCIAS" if blocking_issues else "PRONTA_PARA_FINALIZAR"
    counts = Counter(issue["type"] for issue in issues)
    affected_features = {
        str(issue["idFeature"])
        for issue in blocking_issues
        if issue.get("idFeature") is not None
    }
    blocking_launch_ids = {
        str(value)
        for issue in blocking_issues
        for value in [issue.get("idLancamento"), *issue.get("affectedLaunchIds", [])]
        if value is not None
    }
    reconcilable_launches = [
        item
        for item in considered_launches
        if str(item.get("idLancamento") or "") not in blocking_launch_ids
    ]
    classified_bug_count = sum(item.get("validatedCategory") == "Bug" for item in reconcilable_launches)
    classified_pbi_count = sum(
        bool(item.get("validatedCategory")) and item.get("validatedCategory") != "Bug"
        for item in reconcilable_launches
    )
    feature_issue_ids = {
        prefix: {
            str(issue["idFeature"])
            for issue in issues
            if issue.get("type") == f"tag_{prefix}_missing" and issue.get("idFeature")
        }
        for prefix in ("1", "2", "3")
    }

    return {
        **consultation,
        "stage": "validation_completed",
        "nextStage": "correction" if blocking_issues else "finalization",
        "status": status,
        "canFinalize": not blocking_issues,
        "summary": {
            **consultation.get("summary", {}),
            "validLaunchCount": len(valid_launches),
            "consideredLaunchCount": len(considered_launches),
            "disregardedLaunchCount": len(disregarded_launches),
            "removedLaunchCount": len(removed_launches),
            "removedHours": _sum_hours(removed_launches),
            "excludedCollaboratorCount": len(
                {
                    str(item.get("user") or "").strip().casefold()
                    for item in disregarded_launches
                    if not item.get("participatesInGeneralIndicators", True)
                }
            ),
            "affectedLaunchCount": len(affected_launches),
            "inconsistencyCount": len(issues),
            "pendingCount": operational_pending_count,
            "blockingInconsistencyCount": len(blocking_issues),
            "autoTreatedInconsistencyCount": len(issues) - len(blocking_issues),
            "inconsistencyCountsByType": dict(sorted(counts.items())),
            "affectedFeatureCount": len(affected_features),
            "validHours": _sum_hours(valid_launches),
            "grossHours": _sum_hours(launches),
            "consideredHours": _sum_hours(considered_launches),
            "disregardedHours": _sum_hours(disregarded_launches),
            "affectedHours": _sum_hours(affected_launches),
            "featuresWithoutTag1Count": len(feature_issue_ids["1"]),
            "featuresWithoutTag2Count": len(feature_issue_ids["2"]),
            "featuresWithoutTag3Count": len(feature_issue_ids["3"]),
            "classifiedPbiLaunchCount": classified_pbi_count,
            "classifiedBugLaunchCount": classified_bug_count,
            "unclassifiedLaunchCount": len(considered_launches) - classified_pbi_count - classified_bug_count,
            "reconciliation": {
                "consideredLaunchCount": len(considered_launches),
                "classifiedPbiLaunchCount": classified_pbi_count,
                "classifiedBugLaunchCount": classified_bug_count,
                "blockingLaunchCount": len(blocking_launch_ids),
                "balanced": len(considered_launches)
                == classified_pbi_count + classified_bug_count + len(blocking_launch_ids),
            },
        },
        "launches": launches,
        "inconsistencies": {
            "items": issues,
            "byFeature": _group_feature_issues(issues),
            "byLaunch": _group_launch_issues(issues),
        },
        "validatedAt": datetime.now().astimezone().isoformat(),
    }


def _relate_issue_causes(issues: list[dict[str, Any]], consultation: dict[str, Any]) -> None:
    """Relaciona causas e consequências sem remover registros técnicos da auditoria."""
    for issue in issues:
        details = issue.setdefault("details", {})
        technical_key = _technical_issue_key(issue, consultation)
        details.update(
            {
                "technicalIssueKey": technical_key,
                "rootCauseId": technical_key,
                "parentInconsistencyId": None,
                "isRootCause": True,
                "isDerived": False,
                "derivedFromType": None,
                "displayGroupKey": _display_group_key(issue, consultation),
            }
        )

    root_candidates = [
        issue
        for issue in issues
        if issue.get("blocking") and issue.get("type") in _ROOT_CAUSE_PRIORITY
    ]
    for derived in [issue for issue in issues if issue.get("type") in _DERIVED_ISSUE_TYPES]:
        matching_roots = [root for root in root_candidates if _issues_share_context(root, derived)]
        if not matching_roots:
            continue
        root = min(
            matching_roots,
            key=lambda item: (
                _ROOT_CAUSE_PRIORITY.get(str(item.get("type")), 999),
                str(item.get("details", {}).get("technicalIssueKey") or ""),
            ),
        )
        root_details = root["details"]
        derived_details = derived["details"]
        derived_types = list(root_details.get("derivedIssueTypes", []))
        if derived.get("type") not in derived_types:
            derived_types.append(derived["type"])
        root_details["derivedIssueTypes"] = derived_types
        derived_details.update(
            {
                "rootCauseId": root_details["technicalIssueKey"],
                "parentInconsistencyId": root_details["technicalIssueKey"],
                "isRootCause": False,
                "isDerived": True,
                "derivedFromType": root.get("type"),
                "displayGroupKey": root_details["displayGroupKey"],
            }
        )


def _issues_share_context(root: dict[str, Any], derived: dict[str, Any]) -> bool:
    root_launch_ids = _issue_launch_ids(root)
    derived_launch_ids = _issue_launch_ids(derived)
    if root_launch_ids and derived_launch_ids and root_launch_ids.intersection(derived_launch_ids):
        return True
    root_details = root.get("details", {})
    derived_details = derived.get("details", {})
    for keys in (
        (("idTask",), ("idTask",)),
        (("featureId",), ("featureId",)),
        (("featureCandidateId",), ("featureCandidateId",)),
    ):
        root_value = _first_detail(root_details, *keys[0])
        derived_value = _first_detail(derived_details, *keys[1])
        if root_value and root_value == derived_value:
            return True
    root_feature = str(root.get("idFeature") or root_details.get("featureId") or "").strip()
    derived_feature = str(derived.get("idFeature") or derived_details.get("featureId") or "").strip()
    return bool(root_feature and root_feature == derived_feature)


def _display_group_key(issue: dict[str, Any], consultation: dict[str, Any]) -> str:
    details = issue.get("details", {})
    execution_id = str(
        consultation.get("executionId") or consultation.get("consultationId") or "unpersisted"
    )
    task_id = _first_detail(details, "idTask", "taskId")
    parent_id = _first_detail(details, "parentItemId", "idParent", "immediateParentId")
    upper_id = _first_detail(details, "featureCandidateId", "upperParentId")
    feature_id = str(issue.get("idFeature") or _first_detail(details, "featureId") or "").strip()
    context = [
        f"execution:{execution_id}",
        f"cause:{issue.get('type')}",
        f"task:{task_id or '-'}",
        f"parent:{parent_id or '-'}",
        f"upper:{upper_id or '-'}",
        f"feature:{feature_id or '-'}",
    ]
    if not any((task_id, parent_id, upper_id, feature_id)):
        context.append(f"launches:{','.join(sorted(_issue_launch_ids(issue))) or '-'}")
    return "|".join(context)


def _technical_issue_key(issue: dict[str, Any], consultation: dict[str, Any]) -> str:
    return "|".join(
        [
            _display_group_key(issue, consultation),
            f"launches:{','.join(sorted(_issue_launch_ids(issue))) or '-'}",
            f"technicalType:{issue.get('type')}",
        ]
    )


def _issue_launch_ids(issue: dict[str, Any]) -> set[str]:
    return {
        str(value).strip()
        for value in [issue.get("idLancamento"), *issue.get("affectedLaunchIds", [])]
        if value is not None and str(value).strip()
    }


def _first_detail(details: dict[str, Any], *keys: str) -> str:
    return next(
        (str(details.get(key)).strip() for key in keys if details.get(key) is not None and str(details.get(key)).strip()),
        "",
    )


def _validate_launch(launch: dict[str, Any], *, start_date: date, end_date: date) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    launch_id = launch.get("idLancamento")
    feature_id = launch.get("idFeature")
    if launch_id is None or not str(launch_id).strip():
        issues.append(
            _launch_issue(
                "launch_id_missing",
                launch,
                "O lançamento não possui IdLancamento e não pode ser contabilizado.",
            )
        )
    original_duration = launch.get("durationOriginal")
    duration_text = str(original_duration or "").strip()
    if not duration_text:
        issues.append(_launch_issue("duration_empty", launch, "Duração não informada."))
    elif duration_text.startswith("-") or (isinstance(original_duration, (int, float)) and original_duration < 0):
        issues.append(_launch_issue("duration_negative", launch, "Duração negativa não é permitida."))
    elif launch.get("durationHours") is None:
        issues.append(
            _launch_issue(
                "duration_invalid",
                launch,
                "Duração fora do formato esperado.",
                original_text=duration_text,
            )
        )

    launch_date = _parse_iso_datetime(launch.get("launchDate"))
    if launch_date is None:
        issues.append(_launch_issue("date_invalid", launch, "Data do lançamento inválida ou ausente."))
    elif launch_date.date() < start_date or launch_date.date() > end_date:
        issues.append(
            _launch_issue(
                "date_outside_period",
                launch,
                "Data do lançamento fora do período consultado.",
                original_text=launch.get("launchDate"),
            )
        )

    classification_state = launch.get("classificationState")
    if not launch.get("idTask") or classification_state == "hierarchy_pending":
        issues.append(_launch_issue("task_not_found", launch, "Task não localizada no TFS."))
    elif classification_state == "hierarchy_ambiguous":
        issues.append(_launch_issue("hierarchy_ambiguous", launch, "A Task possui mais de uma hierarquia possível."))
    elif not launch.get("idParent"):
        issues.append(_launch_issue("parent_not_found", launch, "Item pai da Task não localizado."))
    elif not launch.get("parentWorkItemType"):
        issues.append(_launch_issue("parent_type_not_identified", launch, "Tipo real do pai da Task não identificado."))
    elif normalize_text(launch.get("parentWorkItemType")) not in _SUPPORTED_PARENT_TYPES:
        issues.append(
            _launch_issue(
                "parent_type_unsupported",
                launch,
                "Tipo do pai da Task não é PBI nem Bug.",
                original_text=launch.get("parentWorkItemType"),
            )
        )
    elif classification_state == "feature_type_invalid":
        candidate_id = launch.get("trace", {}).get("featureCandidateId")
        candidate_type = launch.get("trace", {}).get("featureCandidateType")
        issues.append(
            _launch_issue(
                "feature_type_invalid",
                launch,
                "O pai superior do PBI/Bug não é uma Feature.",
                original_text=f"{candidate_id} — {candidate_type}",
            )
        )
    elif not launch.get("idFeature") or not launch.get("trace", {}).get("featureMetadataFound"):
        issues.append(_launch_issue("feature_not_found", launch, "Feature relacionada não localizada no TFS."))

    if _validated_category(launch) is None:
        issues.append(_launch_issue("classification_impossible", launch, "Não foi possível determinar a classificação."))
    return issues


def _validate_monthly_distribution(
    launches: list[dict[str, Any]],
    current_issues: list[dict[str, Any]],
    *,
    distribution_configuration: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Impede a finalização quando há Atualização do sistema sem base mensal válida."""
    blocked_ids = {
        str(launch_id)
        for issue in current_issues
        if issue.get("severity") == BLOCKING
        for launch_id in [issue.get("idLancamento"), *issue.get("affectedLaunchIds", [])]
        if launch_id is not None
    }
    eligible_by_month: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for launch in launches:
        if launch.get("disregardedFromGeneralIndicators"):
            continue
        launch_id = str(launch.get("idLancamento") or "").strip()
        month = str(launch.get("monthYear") or "").strip()
        if not launch_id or launch_id in blocked_ids or not month or launch.get("durationSeconds") is None:
            continue
        eligible_by_month[month].append(launch)

    issues: list[dict[str, Any]] = []
    active_categories = {
        category
        for category, settings in normalize_distribution_configuration(distribution_configuration).items()
        if settings["active"]
    }
    for month, month_launches in sorted(eligible_by_month.items()):
        update_launches = [item for item in month_launches if item.get("isUpdateSystem")]
        update_seconds = sum(
            (Decimal(str(item.get("durationSeconds") or 0)) for item in update_launches),
            Decimal(0),
        )
        if update_seconds <= 0:
            continue
        base_seconds = sum(
            (
                Decimal(str(item.get("durationSeconds") or 0))
                for item in month_launches
                if not item.get("isUpdateSystem")
                and canonical_category(item.get("finalCategory")) in active_categories
            ),
            Decimal(0),
        )
        if base_seconds != 0:
            continue
        affected_ids = [str(item["idLancamento"]) for item in update_launches]
        issues.append(
            _issue(
                "distribution_impossible",
                BLOCKING,
                "launch",
                id_launch=affected_ids[0] if affected_ids else None,
                id_feature=update_launches[0].get("idFeature") if update_launches else None,
                message=(
                    f"Não foi possível distribuir as horas de Atualização do sistema em {month}: "
                    "a base mensal é igual a zero."
                ),
                affected_launch_ids=affected_ids,
                details={
                    "month": month,
                    "updateHours": float(update_seconds / Decimal(3600)),
                    "distributionBaseHours": 0,
                },
            )
        )
    return issues


def _validate_feature_tags(feature_id: str, launches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sample_trace = launches[0].get("trace", {})
    counts = sample_trace.get("featureTagCounts", {})
    values = sample_trace.get("featureTagValues", {})
    empty_prefixes = set(sample_trace.get("emptyFeatureTagPrefixes", []))
    affected_ids = [str(item["idLancamento"]) for item in launches if item.get("idLancamento") is not None]
    parent_ids = {str(item["idParent"]) for item in launches if item.get("idParent") is not None}
    pbi_parent_ids = sorted({str(item["idParent"]) for item in launches if item.get("idParent") is not None and not item.get("isBug")})
    bug_parent_ids = sorted({str(item["idParent"]) for item in launches if item.get("idParent") is not None and item.get("isBug")})
    bug_count = sum(bool(item.get("isBug")) for item in launches)
    details = {
        "featureTitle": next((item.get("featureTitle") for item in launches if item.get("featureTitle")), None),
        "affectedLaunchCount": len(launches),
        "affectedLaunchIds": affected_ids,
        "parentCount": len(parent_ids),
        "bugLaunchCount": bug_count,
        "pbiLaunchCount": len(launches) - bug_count,
        "pbiParentIds": pbi_parent_ids,
        "bugParentIds": bug_parent_ids,
        "pbiParentIds": pbi_parent_ids,
        "bugParentIds": bug_parent_ids,
        "affectedHours": _sum_hours(launches),
    }
    issues: list[dict[str, Any]] = []

    for prefix in ("1", "2", "3"):
        count = int(counts.get(prefix, 0))
        if prefix in empty_prefixes:
            issues.append(
                _feature_issue(
                    "tag_empty",
                    feature_id,
                    launches,
                    f"TAG {prefix}- está vazia.",
                    original_text=f"{prefix}-",
                    details={**details, "tagLevel": prefix},
                )
            )
        elif count == 0:
            issues.append(
                _feature_issue(
                    f"tag_{prefix}_missing",
                    feature_id,
                    launches,
                    f"Feature sem TAG obrigatória {prefix}-.",
                    details={**details, "tagLevel": prefix},
                )
            )
        elif count > 1:
            issues.append(
                _feature_issue(
                    f"tag_{prefix}_multiple",
                    feature_id,
                    launches,
                    f"Feature possui mais de uma TAG {prefix}-.",
                    original_text="; ".join(values.get(prefix, [])),
                    details={**details, "tagLevel": prefix, "values": values.get(prefix, [])},
                )
            )

    invalid_parts = sample_trace.get("invalidFeatureTagParts", [])
    if invalid_parts:
        issues.append(
            _feature_issue(
                "tag_invalid",
                feature_id,
                launches,
                "Feature possui TAG de indicador fora do padrão.",
                original_text="; ".join(invalid_parts),
                details={**details, "invalidParts": invalid_parts},
            )
        )

    category_values = values.get("2", [])
    if len(category_values) == 1:
        original_category = _tag_content(category_values[0])
        official_category = _OFFICIAL_CATEGORY_BY_NORMALIZED.get(normalize_text(original_category))
        if official_category is None:
            issues.append(
                _feature_issue(
                    "category_unrecognized",
                    feature_id,
                    launches,
                    "Categoria da TAG 2- não está cadastrada como categoria oficial.",
                    original_text=original_category,
                    details={**details, "acceptedCategories": list(OFFICIAL_INDICATOR_CATEGORIES)},
                )
            )
        elif original_category != official_category:
            issues.append(
                _feature_issue(
                    "category_normalized",
                    feature_id,
                    launches,
                    "Categoria reconhecida por normalização técnica.",
                    severity=AUTO_TREATED,
                    original_text=original_category,
                    treatment=f"recognized_as:{official_category}",
                    details={**details, "officialCategory": official_category},
                )
            )

    normalized_parts = sample_trace.get("normalizedFeatureTagParts", [])
    if normalized_parts:
        issues.append(
            _feature_issue(
                "tag_format_normalized",
                feature_id,
                launches,
                "Espaços excedentes da TAG foram normalizados tecnicamente.",
                severity=AUTO_TREATED,
                original_text="; ".join(item["original"] for item in normalized_parts),
                treatment="whitespace_normalized",
                details={**details, "normalizedParts": normalized_parts},
            )
        )
    return issues


def _validated_category(launch: dict[str, Any]) -> str | None:
    if launch.get("isBug"):
        return "Bug"
    tag2 = launch.get("tag2")
    if not tag2:
        return None
    return _OFFICIAL_CATEGORY_BY_NORMALIZED.get(normalize_text(_tag_content(tag2)))


def _launch_issue(
    issue_type: str,
    launch: dict[str, Any],
    message: str,
    *,
    original_text: Any = None,
) -> dict[str, Any]:
    return _issue(
        issue_type,
        BLOCKING,
        "launch",
        id_launch=launch.get("idLancamento"),
        id_feature=launch.get("idFeature"),
        original_text=None if original_text is None else str(original_text),
        message=message,
        affected_launch_ids=[str(launch["idLancamento"])] if launch.get("idLancamento") is not None else [],
        details={
            "idTask": launch.get("idTask"),
            "taskTitle": launch.get("taskTitle"),
            "idParent": launch.get("idParent"),
            "parentItemId": launch.get("idParent"),
            "parentItemType": launch.get("parentWorkItemType"),
            "parentItemTitle": launch.get("parentTitle"),
            "featureId": launch.get("idFeature"),
            "featureType": launch.get("featureWorkItemType"),
            "featureTitle": launch.get("featureTitle"),
            "featureCandidateId": launch.get("trace", {}).get("featureCandidateId"),
            "featureCandidateType": launch.get("trace", {}).get("featureCandidateType"),
            "featureCandidateTitle": launch.get("trace", {}).get("featureCandidateTitle"),
            "hierarchyCandidates": launch.get("trace", {}).get("hierarchyCandidates", []),
            "affectedLaunchCount": 1 if launch.get("idLancamento") is not None else 0,
            "affectedHours": float(launch.get("durationHours") or 0),
            "launchDate": launch.get("launchDate"),
            "durationOriginal": launch.get("durationOriginal"),
            "user": launch.get("user"),
        },
    )


def _feature_issue(
    issue_type: str,
    feature_id: str,
    launches: list[dict[str, Any]],
    message: str,
    *,
    severity: str = BLOCKING,
    original_text: Any = None,
    treatment: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return _issue(
        issue_type,
        severity,
        "feature",
        id_feature=feature_id,
        original_text=None if original_text is None else str(original_text),
        message=message,
        treatment=treatment,
        affected_launch_ids=[str(item["idLancamento"]) for item in launches if item.get("idLancamento") is not None],
        details=details,
    )


def _issue(
    issue_type: str,
    severity: str,
    scope: str,
    *,
    id_launch: Any = None,
    id_feature: Any = None,
    original_text: str | None = None,
    message: str,
    treatment: str | None = None,
    affected_launch_ids: list[str] | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "type": issue_type,
        "severity": severity,
        "scope": scope,
        "idLancamento": None if id_launch is None else str(id_launch),
        "idFeature": None if id_feature is None else str(id_feature),
        "originalText": original_text,
        "message": message,
        "blocking": severity == BLOCKING,
        "treatment": treatment,
        "status": "TRATADA" if severity == AUTO_TREATED else "ABERTA",
        "affectedLaunchIds": affected_launch_ids or [],
        "details": details or {},
    }


def _audit_issue_summary(issue: dict[str, Any]) -> dict[str, Any]:
    details = issue.get("details", {})
    return {
        "type": issue.get("type"),
        "severity": issue.get("severity"),
        "status": issue.get("status"),
        "message": issue.get("message"),
        "treatment": issue.get("treatment"),
        "originalText": issue.get("originalText"),
        "rootCauseId": details.get("rootCauseId"),
        "parentInconsistencyId": details.get("parentInconsistencyId"),
        "isRootCause": details.get("isRootCause"),
        "isDerived": details.get("isDerived"),
        "derivedFromType": details.get("derivedFromType"),
        "displayGroupKey": details.get("displayGroupKey"),
    }


def _group_feature_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for issue in issues:
        if issue["scope"] == "feature" and issue.get("idFeature"):
            grouped[str(issue["idFeature"])].append(issue)
    return [
        {
            "idFeature": feature_id,
            "issues": feature_issues,
            "affectedLaunchIds": sorted({item for issue in feature_issues for item in issue["affectedLaunchIds"]}),
            "blocking": any(issue["blocking"] for issue in feature_issues),
        }
        for feature_id, feature_issues in sorted(grouped.items())
    ]


def _group_launch_issues(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for issue in issues:
        if issue["scope"] == "launch" and issue.get("idLancamento"):
            grouped[str(issue["idLancamento"])].append(issue)
    return [
        {
            "idLancamento": launch_id,
            "issues": launch_issues,
            "blocking": any(issue["blocking"] for issue in launch_issues),
        }
        for launch_id, launch_issues in sorted(grouped.items())
    ]


def _sum_hours(launches: list[dict[str, Any]]) -> float:
    seconds = sum(int(item["durationSeconds"]) for item in launches if item.get("durationSeconds") is not None)
    return round(seconds / 3600, 4)


def _parse_iso_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _tag_content(value: str) -> str:
    return value.split("-", 1)[1].strip() if "-" in value else value.strip()
