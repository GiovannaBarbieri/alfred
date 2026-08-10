from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Iterable

from app.services.general_indicators_rules import canonical_category, normalize_text, parse_duration_seconds

_TAG_PATTERN = re.compile(r"^\s*([123])\s*-\s*(.*?)\s*$", re.IGNORECASE)
_UPDATE_SYSTEM_MODULE = "atualizacao do sistema"
HIERARCHY_CONTRACT_VERSION = 2
_SUPPORTED_PARENT_TYPES = {"bug", "pbi", "product backlog item"}
_FEATURE_TYPE = "feature"
_REMOVED_STATE = "removed"
WORK_ITEM_REMOVED_REASON = "work_item_removed"


def classify_general_indicator_launches(
    launches: Iterable[dict[str, Any]],
    task_hierarchies: Iterable[dict[str, Any]],
    feature_metadata: Iterable[dict[str, Any]],
    *,
    start_date: date,
    end_date: date,
    nonparticipating_logins: Iterable[str] = (),
) -> dict[str, Any]:
    source_rows = list(launches)
    unique_launches, duplicate_diagnostics = _deduplicate_with_evidence(source_rows)
    hierarchies_by_task = _group_hierarchies(task_hierarchies)
    features_by_id = {
        _clean_id(_get(item, "ID", "Id", "id")): item
        for item in feature_metadata
        if _clean_id(_get(item, "ID", "Id", "id"))
    }
    excluded_logins = {str(value or "").strip().casefold() for value in nonparticipating_logins}

    classified: list[dict[str, Any]] = []
    unresolved_tasks: set[str] = set()
    unresolved_parents: set[str] = set()
    unresolved_features: set[str] = set()

    for row, occurrence_count, duplicate_conflict, duplicate_source_rows in unique_launches:
        launch_id = _clean_id(_get(row, "IdLancamento", "id_lancamento")) or None
        task_id = _clean_id(_get(row, "IdTask", "Task", "id_task"))
        candidates = hierarchies_by_task.get(task_id, [])
        hierarchy = candidates[0] if len(candidates) == 1 else None

        parent_id = _clean_id(_get(hierarchy or {}, "IdParent", "id_parent"))
        task_type = _get(hierarchy or {}, "TaskWorkItemType", "task_work_item_type")
        task_state = _get(hierarchy or {}, "TaskState", "task_state")
        task_title = _get(hierarchy or {}, "TaskTitle", "task_title")
        parent_type = _get(hierarchy or {}, "ParentWorkItemType", "parent_work_item_type")
        parent_state = _get(hierarchy or {}, "ParentState", "parent_state")
        parent_title = _get(hierarchy or {}, "ParentTitle", "parent_title")
        parent_depth = _get(hierarchy or {}, "ParentDepth", "parent_depth")
        feature_id = _clean_id(_get(hierarchy or {}, "IdFeat", "id_feat"))
        feature_type = _get(hierarchy or {}, "FeatureWorkItemType", "feature_work_item_type")
        feature_state = _get(hierarchy or {}, "FeatureState", "feature_state")
        feature_title = _get(hierarchy or {}, "FeatureTitle", "feature_title")
        epic_id = _clean_id(_get(hierarchy or {}, "IdEpic", "id_epic"))
        epic_type = _get(hierarchy or {}, "EpicWorkItemType", "epic_work_item_type")
        epic_state = _get(hierarchy or {}, "EpicState", "epic_state")
        epic_title = _get(hierarchy or {}, "EpicTitle", "epic_title")
        parent_type_normalized = normalize_text(parent_type)
        feature_type_normalized = normalize_text(feature_type)
        feature = features_by_id.get(feature_id) if feature_id and feature_type_normalized == _FEATURE_TYPE else None
        feature_metadata_type = _get(feature or {}, "WorkItemType", "work_item_type", "Type")
        if feature is not None and normalize_text(feature_metadata_type) != _FEATURE_TYPE:
            feature = None
        feature_tags_raw = _get(feature or {}, "Tags", "tags")
        tag_analysis = analyze_feature_indicator_tags(feature_tags_raw)
        tag_values = tag_analysis["values"]
        tag1 = _single_tag(tag_values["1"])
        tag2 = _single_tag(tag_values["2"])
        tag3 = _single_tag(tag_values["3"])
        is_bug = parent_type_normalized == "bug"
        has_supported_parent = parent_type_normalized in _SUPPORTED_PARENT_TYPES
        has_real_feature = bool(feature_id and feature_type_normalized == _FEATURE_TYPE and feature is not None)
        resolved_feature_id = feature_id if feature_type_normalized == _FEATURE_TYPE else ""

        if not task_id or not candidates:
            classification_state = "hierarchy_pending"
            if task_id:
                unresolved_tasks.add(task_id)
        elif len(candidates) > 1:
            classification_state = "hierarchy_ambiguous"
        elif not parent_id or not parent_type:
            classification_state = "parent_pending"
            if parent_id:
                unresolved_parents.add(parent_id)
        elif not has_supported_parent:
            classification_state = "parent_pending"
            if parent_id:
                unresolved_parents.add(parent_id)
        elif feature_id and feature_type_normalized != _FEATURE_TYPE:
            classification_state = "feature_type_invalid"
            unresolved_features.add(feature_id)
        elif not has_real_feature:
            classification_state = "feature_pending"
            if feature_id:
                unresolved_features.add(feature_id)
        elif is_bug:
            classification_state = "classified"
        elif tag2 is None:
            classification_state = "feature_tags_pending"
        else:
            classification_state = "classified"

        category = "Bug" if is_bug and has_real_feature else canonical_category(_tag_content(tag2)) if tag2 and has_real_feature else None
        is_update_system = bool(
            not is_bug and tag1 and normalize_text(_tag_content(tag1)) == _UPDATE_SYSTEM_MODULE
        )
        duration_original = _get(row, "TempoDuracao", "Duracao", "duracao")
        duration_seconds = parse_duration_seconds(duration_original)
        created_at = _parse_datetime(_get(row, "DataHoraCadastro", "data_hora_cadastro"))

        user = _get(row, "LoginUsuario", "login_usuario")
        participates = str(user or "").strip().casefold() not in excluded_logins
        removed_levels = _removed_work_item_levels(
            task={"id": task_id or None, "type": task_type, "state": task_state, "title": task_title},
            parent={"id": parent_id or None, "type": parent_type, "state": parent_state, "title": parent_title, "depth": parent_depth},
            feature={"id": feature_id or None, "type": feature_type, "state": feature_state, "title": feature_title},
            epic={"id": epic_id or None, "type": epic_type, "state": epic_state, "title": epic_title},
        )
        removed_by_work_item = bool(removed_levels)
        classified.append(
            {
                "idLancamento": launch_id,
                "launchDate": created_at.isoformat() if created_at else None,
                "durationOriginal": duration_original,
                "durationSeconds": duration_seconds,
                "durationHours": round(duration_seconds / 3600, 4) if duration_seconds is not None else None,
                "user": user,
                "participatesInGeneralIndicators": participates,
                "disregardedFromGeneralIndicators": not participates or removed_by_work_item,
                "disregardedReasons": [
                    *([] if participates else ["nonparticipating_collaborator"]),
                    *([WORK_ITEM_REMOVED_REASON] if removed_by_work_item else []),
                ],
                "removedByWorkItemState": removed_by_work_item,
                "workItemRemovedReason": WORK_ITEM_REMOVED_REASON if removed_by_work_item else None,
                "removedWorkItems": removed_levels,
                "idTask": task_id or None,
                "taskWorkItemType": task_type,
                "taskState": task_state,
                "taskTitle": task_title,
                "idParent": parent_id or None,
                "parentItemId": parent_id or None,
                "parentWorkItemType": parent_type,
                "parentItemType": parent_type,
                "parentState": parent_state,
                "parentTitle": parent_title,
                "parentItemTitle": parent_title,
                "idFeature": resolved_feature_id or None,
                "featureId": resolved_feature_id or None,
                "featureWorkItemType": feature_type if resolved_feature_id else None,
                "featureState": feature_state if resolved_feature_id else None,
                "featureTitle": feature_title if resolved_feature_id else None,
                "featureTags": feature_tags_raw,
                "idEpic": epic_id or None,
                "epicWorkItemType": epic_type,
                "epicState": epic_state,
                "epicTitle": epic_title,
                "tag1": tag1,
                "tag2": tag2,
                "tag3": tag3,
                "finalCategory": category,
                "isBug": is_bug,
                "isUpdateSystem": is_update_system,
                "monthYear": created_at.strftime("%Y-%m") if created_at else None,
                "quarter": ((created_at.month - 1) // 3) + 1 if created_at else None,
                "year": created_at.year if created_at else None,
                "validationState": "pending",
                "classificationState": classification_state,
                "trace": {
                    "classificationSource": "parent_work_item_type" if is_bug and has_real_feature else "feature_tag_2" if tag2 and has_real_feature else None,
                    "featureTagsSourceId": resolved_feature_id if has_real_feature else None,
                    "hierarchyContractVersion": HIERARCHY_CONTRACT_VERSION,
                    "sourceOccurrenceCount": occurrence_count,
                    "duplicateConflict": duplicate_conflict,
                    "duplicateSourceRows": duplicate_source_rows if occurrence_count > 1 else [],
                    "hierarchyCandidateCount": len(candidates),
                    "hierarchyCandidates": candidates if len(candidates) != 1 else [],
                    "hierarchy": {
                        "task": {"id": task_id or None, "type": task_type, "state": task_state, "title": task_title},
                        "parent": {"id": parent_id or None, "type": parent_type, "state": parent_state, "title": parent_title, "depth": parent_depth},
                        "feature": {"id": feature_id or None, "type": feature_type, "state": feature_state, "title": feature_title},
                        "epic": {"id": epic_id or None, "type": epic_type, "state": epic_state, "title": epic_title},
                    },
                    "removedWorkItems": removed_levels,
                    "featureMetadataFound": feature is not None,
                    "featureTypeValidated": has_real_feature,
                    "featureCandidateId": feature_id or None,
                    "featureCandidateType": feature_type,
                    "featureCandidateTitle": feature_title,
                    "featureTagsRaw": feature_tags_raw,
                    "featureTagCounts": {prefix: len(values) for prefix, values in tag_values.items()},
                    "featureTagValues": tag_values,
                    "invalidFeatureTagParts": tag_analysis["invalidParts"],
                    "emptyFeatureTagPrefixes": tag_analysis["emptyPrefixes"],
                    "normalizedFeatureTagParts": tag_analysis["normalizedParts"],
                },
            }
        )

    classified_count = sum(item["classificationState"] == "classified" for item in classified)
    disregarded = [item for item in classified if item["disregardedFromGeneralIndicators"]]
    considered = [item for item in classified if not item["disregardedFromGeneralIndicators"]]
    removed = [item for item in classified if item.get("removedByWorkItemState")]
    return {
        "stage": "consultation_classified",
        "nextStage": "validation",
        "period": {"startDate": start_date.isoformat(), "endDate": end_date.isoformat()},
        "summary": {
            "sourceRowCount": len(source_rows),
            "uniqueLaunchCount": len(classified),
            "classifiedCount": classified_count,
            "pendingClassificationCount": len(classified) - classified_count,
            "duplicateIdCount": len(duplicate_diagnostics),
            "consideredLaunchCount": len(considered),
            "disregardedLaunchCount": len(disregarded),
            "removedLaunchCount": len(removed),
            "removedHours": round(
                sum(float(item.get("durationHours") or 0) for item in removed),
                4,
            ),
            "excludedCollaboratorCount": len(
                {
                    str(item.get("user") or "").strip().casefold()
                    for item in disregarded
                    if not item.get("participatesInGeneralIndicators", True)
                }
            ),
            "hierarchyContractVersion": HIERARCHY_CONTRACT_VERSION,
            "taskCount": len({item.get("idTask") for item in classified if item.get("idTask")}),
            "pbiParentCount": len({item.get("idParent") for item in classified if normalize_text(item.get("parentWorkItemType")) in {"pbi", "product backlog item"}}),
            "bugParentCount": len({item.get("idParent") for item in classified if normalize_text(item.get("parentWorkItemType")) == "bug"}),
            "realFeatureCount": len({item.get("idFeature") for item in classified if item.get("trace", {}).get("featureTypeValidated")}),
            "launchesWithoutFeatureCount": sum(not item.get("trace", {}).get("featureTypeValidated") for item in classified),
        },
        "launches": classified,
        "diagnostics": {
            "duplicates": duplicate_diagnostics,
            "unresolvedTaskIds": sorted(unresolved_tasks),
            "unresolvedParentIds": sorted(unresolved_parents),
            "unresolvedFeatureIds": sorted(unresolved_features),
            "removedWorkItems": [
                {
                    "idLancamento": item.get("idLancamento"),
                    "durationHours": item.get("durationHours"),
                    "removedWorkItems": item.get("removedWorkItems", []),
                }
                for item in removed
            ],
        },
    }


def extract_feature_indicator_tags(value: Any) -> dict[str, list[str]]:
    return analyze_feature_indicator_tags(value)["values"]


def analyze_feature_indicator_tags(value: Any) -> dict[str, Any]:
    parsed: dict[str, list[str]] = {"1": [], "2": [], "3": []}
    invalid_parts: list[str] = []
    empty_prefixes: list[str] = []
    normalized_parts: list[dict[str, str]] = []
    for raw_part in str(value or "").split(";"):
        candidate = raw_part.strip()
        if not candidate:
            continue
        match = _TAG_PATTERN.fullmatch(candidate)
        if not match:
            empty_match = re.match(r"^\s*([123])\s*-\s*$", candidate, re.IGNORECASE)
            if empty_match:
                empty_prefixes.append(empty_match.group(1))
            elif re.match(r"^\s*[123](?:\s|[-_:])", candidate, re.IGNORECASE):
                invalid_parts.append(candidate)
            continue
        prefix, content = match.groups()
        normalized_content = " ".join(content.strip().split())
        if normalized_content:
            normalized_value = f"{prefix}-{normalized_content}"
            parsed[prefix].append(normalized_value)
            if candidate != normalized_value:
                normalized_parts.append({"original": candidate, "normalized": normalized_value})
        else:
            empty_prefixes.append(prefix)
    return {
        "values": parsed,
        "invalidParts": invalid_parts,
        "emptyPrefixes": empty_prefixes,
        "normalizedParts": normalized_parts,
    }


def _group_hierarchies(rows: Iterable[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    seen: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    fields = (
        "IdTask",
        "TaskWorkItemType",
        "TaskState",
        "TaskTitle",
        "IdParent",
        "ParentWorkItemType",
        "ParentState",
        "ParentTitle",
        "ParentDepth",
        "IdFeat",
        "FeatureWorkItemType",
        "FeatureState",
        "FeatureTitle",
        "IdEpic",
        "EpicWorkItemType",
        "EpicState",
        "EpicTitle",
    )
    for row in rows:
        task_id = _clean_id(_get(row, "IdTask", "id_task"))
        if not task_id:
            continue
        candidate = {field: _get(row, field) for field in fields}
        signature = tuple(str(candidate[field] or "").strip() for field in fields)
        if signature not in seen[task_id]:
            seen[task_id].add(signature)
            grouped[task_id].append(candidate)
    return grouped


def _deduplicate_with_evidence(
    rows: list[dict[str, Any]],
) -> tuple[list[tuple[dict[str, Any], int, bool, list[dict[str, Any]]]], list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    order: list[str] = []
    for index, row in enumerate(rows):
        launch_id = _clean_id(_get(row, "IdLancamento", "id_lancamento"))
        key = launch_id or f"__missing_id_{index}"
        if key not in grouped:
            order.append(key)
        grouped[key].append(row)

    unique: list[tuple[dict[str, Any], int, bool, list[dict[str, Any]]]] = []
    diagnostics: list[dict[str, Any]] = []
    for key in order:
        occurrences = grouped[key]
        signatures = {_row_signature(row) for row in occurrences}
        conflict = len(signatures) > 1
        unique.append((occurrences[0], len(occurrences), conflict, occurrences))
        if len(occurrences) > 1:
            diagnostics.append(
                {
                    "idLancamento": _clean_id(_get(occurrences[0], "IdLancamento", "id_lancamento")) or None,
                    "occurrences": len(occurrences),
                    "conflict": conflict,
                    "sourceRows": occurrences,
                }
            )
    return unique, diagnostics


def _removed_work_item_levels(
    *,
    task: dict[str, Any],
    parent: dict[str, Any],
    feature: dict[str, Any],
    epic: dict[str, Any],
) -> list[dict[str, Any]]:
    levels = [
        ("Task", task),
        ("PBI/Bug", parent),
        ("Feature", feature),
        ("Epic", epic),
    ]
    return [
        {
            "level": level,
            "id": item.get("id"),
            "type": item.get("type"),
            "state": item.get("state"),
            "title": item.get("title"),
        }
        for level, item in levels
        if item.get("id") is not None and normalize_text(item.get("state")) == _REMOVED_STATE
    ]


def _single_tag(values: list[str]) -> str | None:
    return values[0] if len(values) == 1 else None


def _tag_content(value: str | None) -> str:
    return value.split("-", 1)[1].strip() if value and "-" in value else ""


def _row_signature(row: dict[str, Any]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((normalize_text(key), str(value or "").strip()) for key, value in row.items()))


def _clean_id(value: Any) -> str:
    text = str(value or "").strip()
    return text[:-2] if text.endswith(".0") and text[:-2].isdigit() else text


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
