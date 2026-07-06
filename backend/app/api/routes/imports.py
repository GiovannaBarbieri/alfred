import hashlib
import json
import logging
from collections import Counter

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log
from app.repositories.import_repository import (
    apply_reprocessed_classification,
    create_import,
    get_import_detail,
    get_import_reprocess_source,
    get_lookup_id,
    insert_classification,
    insert_duplicate_resolution,
    insert_issue,
    insert_lancamento,
    list_reprocess_history,
    list_imports,
    update_import_classifier_version,
)
from app.schemas.imports import ImportCompleteResponse, ImportDetail, ImportReprocessApplyRequest, ImportReprocessApplyResponse, ImportReprocessPreview, ImportSummary, ImportValidationResponse, ReprocessHistoryItem
from app.schemas.imports import CompleteSessionRequest, ImportSessionResponse, ImportSessionSummary
from app.schemas.imports import SQLServerConnectionStatus, SQLServerImportRequest
from app.services.classification_service import classify_title, load_classification_settings, load_collaborator_subcategories
from app.services.import_pipeline import (
    cancel_staged_import,
    complete_staged_import,
    create_staged_import,
    create_staged_import_from_dataframe,
    reprocess_staged_import,
)
from app.services.import_service import build_import_records, validate_import_file
from app.services.sqlserver_service import (
    SQLServerAmbiguousIdError,
    SQLServerConfigurationError,
    SQLServerConnectionError,
    SQLServerEmptyResultError,
    SQLServerIdNotFoundError,
    SQLServerInvalidIdError,
    SQLServerIntegrationError,
    SQLServerQueryError,
    SQLServerTimeoutError,
    dataframe_to_import_content,
    query_import_dataframe,
    test_sqlserver_connection,
)
from app.services.validation_service import REQUIRED_COLUMNS

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/validate", response_model=ImportValidationResponse)
async def validate_import(file: UploadFile = File(...)) -> ImportValidationResponse:
    filename, content = await _read_import_file(file)
    logger.info("Iniciando validacao da importacao: %s", filename)
    validation = validate_import_file(filename=filename, content=content)
    logger.info(
        "Validacao finalizada: arquivo=%s total=%s validos=%s bloqueados=%s alertas=%s pode_concluir=%s",
        filename,
        validation.totalRows,
        validation.validRows,
        validation.blockedRows,
        validation.alertRows,
        validation.canComplete,
    )
    return validation


@router.post("/complete", response_model=ImportCompleteResponse)
async def complete_import(
    file: UploadFile = File(...),
    duplicate_keep_lines: str | None = Form(None, alias="duplicateKeepLines"),
    classification_overrides: str | None = Form(None, alias="classificationOverrides"),
) -> ImportCompleteResponse:
    filename, content = await _read_import_file(file)
    logger.info("Iniciando conclusao da importacao: %s", filename)
    keep_lines = _parse_duplicate_keep_lines(duplicate_keep_lines)
    overrides = _parse_classification_overrides(classification_overrides)
    validation = validate_import_file(filename=filename, content=content, duplicate_keep_lines=keep_lines)
    if not validation.canComplete:
        logger.warning(
            "Conclusao bloqueada: arquivo=%s bloqueados=%s alertas=%s",
            filename,
            validation.blockedRows,
            validation.alertRows,
        )
        raise HTTPException(
            status_code=422,
            detail="A importacao possui bloqueios. Corrija os erros antes de concluir.",
        )

    records = build_import_records(
        filename=filename,
        content=content,
        duplicate_keep_lines=keep_lines,
        classification_overrides=overrides,
    )
    file_hash = hashlib.sha256(content).hexdigest()

    with get_connection() as connection:
        import_id = create_import(
            connection,
            filename=filename,
            file_hash=file_hash,
            status="concluida",
            total_rows=validation.totalRows,
            valid_rows=validation.validRows,
            alert_rows=validation.alertRows,
            blocked_rows=validation.blockedRows,
            classifier_version=_classifier_version_from_records(records),
        )

        for issue in validation.issues:
            insert_issue(connection, import_id, issue.model_dump())

        saved_rows = 0
        saved_record_ids_by_line: dict[int, int] = {}
        for record in records:
            category_id = get_lookup_id(connection, "categorias", record["Categoria"])
            subcategory_id = get_lookup_id(connection, "subcategorias", record["Subcategoria"])
            lancamento_id = insert_lancamento(
                connection,
                import_id=import_id,
                record=record,
                category_id=category_id,
                subcategory_id=subcategory_id,
                classification_status=_classification_status(record["OrigemClassificacao"]),
            )
            saved_record_ids_by_line[record["Line"]] = lancamento_id
            insert_classification(
                connection,
                lancamento_id=lancamento_id,
                title=record["TituloTask"],
                category_id=category_id,
                subcategory_id=subcategory_id,
                origin=record["OrigemClassificacao"],
                confidence=record["ConfiancaClassificacao"],
                confidence_level=record["NivelConfianca"],
                classifier_version=record["VersaoClassificador"],
            )
            saved_rows += 1

        if keep_lines:
            for duplicate in validation.duplicates:
                kept_line = next((line for line in duplicate.lines if line in keep_lines), None)
                if kept_line is not None:
                    insert_duplicate_resolution(
                        connection,
                        import_id=import_id,
                        id_lancamento=duplicate.idLancamento,
                        lines=duplicate.lines,
                        kept_line=kept_line,
                        kept_record_id=saved_record_ids_by_line.get(kept_line),
                    )

    logger.info(
        "Importacao concluida: id=%s arquivo=%s linhas_salvas=%s alertas=%s",
        import_id,
        filename,
        saved_rows,
        validation.alertRows,
    )
    return ImportCompleteResponse(
        importId=import_id,
        filename=filename,
        status="concluida",
        totalRows=validation.totalRows,
        validRows=validation.validRows,
        alertRows=validation.alertRows,
        blockedRows=validation.blockedRows,
        savedRows=saved_rows,
    )


@router.post("/sessions", response_model=ImportSessionResponse)
async def create_import_session(file: UploadFile = File(...)) -> ImportSessionResponse:
    filename, content = await _read_import_file(file)
    logger.info("Criando sessao temporaria de importacao: %s", filename)
    try:
        return create_staged_import(filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/reprocess", response_model=ImportSessionResponse)
def reprocess_import_session(session_id: int) -> ImportSessionResponse:
    logger.info("Reprocessando sessao temporaria de importacao: %s", session_id)
    try:
        return reprocess_staged_import(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/complete", response_model=ImportCompleteResponse)
def complete_import_session(session_id: int, payload: CompleteSessionRequest) -> ImportCompleteResponse:
    logger.info("Concluindo sessao temporaria de importacao: %s", session_id)
    keep_lines = set(payload.duplicateKeepLines) if payload.duplicateKeepLines else None
    overrides = _classification_overrides_from_list(payload.classificationOverrides)
    try:
        return complete_staged_import(
            session_id,
            duplicate_keep_lines=keep_lines,
            classification_overrides=overrides,
        )
    except ValueError as exc:
        status_code = 422 if "bloqueios" in str(exc) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@router.delete("/sessions/{session_id}", response_model=ImportSessionSummary)
def cancel_import_session(session_id: int) -> ImportSessionSummary:
    logger.info("Cancelando sessao temporaria de importacao: %s", session_id)
    try:
        return cancel_staged_import(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sqlserver/test-connection", response_model=SQLServerConnectionStatus)
@router.post("/sqlserver/test-connection", response_model=SQLServerConnectionStatus)
def test_import_sqlserver_connection() -> SQLServerConnectionStatus:
    logger.info("Testando conexao com SQL Server para importacao.")
    try:
        test_sqlserver_connection()
    except SQLServerIntegrationError as exc:
        _raise_sqlserver_http_error(exc)
    return SQLServerConnectionStatus(ok=True, message="Conexao com SQL Server realizada com sucesso.")


@router.post("/sqlserver/preview", response_model=ImportSessionResponse)
def create_sqlserver_import_session(payload: SQLServerImportRequest) -> ImportSessionResponse:
    logger.info(
        "Criando sessao temporaria via SQL Server. total_ids=%s tipo=%s",
        len(payload.ids),
        payload.idType,
    )
    try:
        dataframe = query_import_dataframe(
            ids=payload.ids,
            id_type=payload.idType,
        )
        filename = _sqlserver_import_filename(payload)
        return create_staged_import_from_dataframe(
            filename=filename,
            dataframe=dataframe,
            column_lookup={column: column for column in REQUIRED_COLUMNS},
            content=dataframe_to_import_content(dataframe),
        )
    except SQLServerIntegrationError as exc:
        _raise_sqlserver_http_error(exc)


@router.get("", response_model=list[ImportSummary])
def get_imports() -> list[ImportSummary]:
    with get_connection() as connection:
        rows = list_imports(connection)

    return [
        ImportSummary(
            id=row["id"],
            filename=row["nome_arquivo"],
            status=row["status"],
            importedAt=row["data_importacao"].isoformat(),
            totalRows=row["total_registros"],
            validRows=row["registros_validos"],
            alertRows=row["registros_com_alerta"],
            blockedRows=row["registros_bloqueados"],
            classifierVersion=row["versao_classificador"],
            totalHours=round(int(row["total_seconds"]) / 3600, 2),
        )
        for row in rows
    ]


@router.get("/{import_id}/reprocess-preview", response_model=ImportReprocessPreview)
def get_import_reprocess_preview(import_id: int) -> ImportReprocessPreview:
    with get_connection() as connection:
        return _build_import_reprocess_preview(connection, import_id, item_limit=200)


@router.post("/{import_id}/reprocess-apply", response_model=ImportReprocessApplyResponse)
def apply_import_reprocess(import_id: int, payload: ImportReprocessApplyRequest | None = None) -> ImportReprocessApplyResponse:
    with get_connection() as connection:
        preview = _build_import_reprocess_preview(connection, import_id, item_limit=None)
        if preview.changedRecords == 0:
            return ImportReprocessApplyResponse(
                importId=preview.importId,
                filename=preview.filename,
                status="sem_alteracoes",
                appliedRecords=0,
                changedTasks=0,
                classifierVersion=preview.newClassifierVersion,
                message="Nenhuma mudanca encontrada para aplicar.",
            )
        selected_task_keys = set(payload.selectedTaskKeys) if payload and payload.selectedTaskKeys is not None else None
        if selected_task_keys is not None and not selected_task_keys:
            raise HTTPException(status_code=422, detail="Selecione pelo menos uma Task para aplicar.")
        items_to_apply = [
            item
            for item in preview.items
            if selected_task_keys is None or item.taskKey in selected_task_keys
        ]
        if not items_to_apply:
            raise HTTPException(status_code=422, detail="Nenhuma mudanca encontrada para as Tasks selecionadas.")

        applied_records = 0
        applied_task_keys = set()
        for item in items_to_apply:
            category_id = get_lookup_id(connection, "categorias", item.newCategory)
            subcategory_id = get_lookup_id(connection, "subcategorias", item.newSubcategory)
            apply_reprocessed_classification(
                connection,
                import_id=preview.importId,
                record_id=item.recordId,
                category_id=category_id,
                subcategory_id=subcategory_id,
                category_name=item.newCategory,
                subcategory_name=item.newSubcategory,
                confidence=item.newConfidence,
                confidence_level=item.newConfidenceLevel,
                classifier_version=item.newClassifierVersion,
                origin=item.newOrigin,
                current_category=item.currentCategory,
                current_subcategory=item.currentSubcategory,
                current_confidence=item.currentConfidence,
                current_confidence_level=item.currentConfidenceLevel,
                current_classifier_version=item.currentClassifierVersion,
                confidence_factors=item.confidenceFactors,
                user="usuario_local",
            )
            applied_records += 1
            applied_task_keys.add(item.taskKey)

        is_full_reprocess = selected_task_keys is None or applied_records == preview.changedRecords
        applied_classifier_version = preview.newClassifierVersion if is_full_reprocess else "multi"
        update_import_classifier_version(connection, preview.importId, applied_classifier_version)
        insert_audit_log(
            connection,
            entity="importacao",
            action="reprocessamento_aplicado",
            record_id=preview.importId,
            before={
                "classifierVersion": preview.currentClassifierVersion,
                "averageConfidence": preview.averageCurrentConfidence,
            },
            after={
                "classifierVersion": preview.newClassifierVersion,
                "averageConfidence": preview.averageNewConfidence,
                "appliedRecords": applied_records,
                "changedTasks": len(applied_task_keys),
                "selectionMode": "todas" if selected_task_keys is None else "parcial",
            },
            user="usuario_local",
        )

    return ImportReprocessApplyResponse(
        importId=preview.importId,
        filename=preview.filename,
        status="aplicado",
        appliedRecords=applied_records,
        changedTasks=len(applied_task_keys),
        classifierVersion=applied_classifier_version,
        message=f"{applied_records} classificacao(oes) reprocessada(s) com sucesso.",
    )


@router.get("/{import_id}/reprocess-history", response_model=list[ReprocessHistoryItem])
def get_import_reprocess_history(import_id: int) -> list[ReprocessHistoryItem]:
    with get_connection() as connection:
        rows = list_reprocess_history(connection, import_id)

    return [
        ReprocessHistoryItem(
            id=row["id"],
            recordId=row["lancamento_id"],
            idLancamento=str(row["id_lancamento"] or ""),
            idTask=str(row["id_task"] or ""),
            tituloTask=row["titulo_task"] or "",
            loginUsuario=row["login_usuario"] or "",
            previousCategory=row["categoria_anterior"],
            previousSubcategory=row["subcategoria_anterior"],
            newCategory=row["categoria_nova"],
            newSubcategory=row["subcategoria_nova"],
            previousConfidence=float(row["confianca_anterior"]) if row["confianca_anterior"] is not None else None,
            newConfidence=float(row["confianca_nova"]) if row["confianca_nova"] is not None else None,
            previousConfidenceLevel=row["nivel_confianca_anterior"],
            newConfidenceLevel=row["nivel_confianca_novo"],
            previousVersion=row["versao_anterior"],
            newVersion=row["versao_nova"],
            origin=row["origem_nova"],
            reason=row["motivo"],
            user=row["usuario"],
            createdAt=row["criado_em"].isoformat(),
        )
        for row in rows
    ]


def _build_import_reprocess_preview(
    connection,
    import_id: int,
    *,
    item_limit: int | None,
) -> ImportReprocessPreview:
    row = get_import_reprocess_source(connection, import_id)
    if not row:
        raise HTTPException(status_code=404, detail="Importacao nao encontrada.")

    records = row["lancamentos"]
    task_occurrences = Counter(str(record["id_task"] or "") for record in records)
    settings = load_classification_settings()
    collaborator_subcategories = load_collaborator_subcategories()
    items = []
    task_groups: dict[str, dict] = {}
    changed_tasks = set()
    category_changes: Counter[tuple[str, str]] = Counter()
    changed_count = 0
    confidence_improved = 0
    confidence_reduced = 0
    current_confidence_total = 0.0
    new_confidence_total = 0.0
    classifier_versions = set()

    for record in records:
        suggestion, _issue = classify_title(
            title=record["titulo_task"] or "",
            line_number=int(record["linha_reprocessamento"]),
            login_usuario=record["login_usuario"] or "",
            id_task=str(record["id_task"] or ""),
            titulo_pbi=record["titulo_pbi"] or "",
            titulo_feature=record["titulo_feat"] or "",
            titulo_epic=record["titulo_epic"] or "",
            task_occurrences=task_occurrences.get(str(record["id_task"] or ""), 1),
            settings=settings,
            collaborator_subcategories=collaborator_subcategories,
        )
        classifier_versions.add(suggestion.classifierVersion)
        current_confidence = float(record["confianca"] or 0)
        confidence_delta = round(suggestion.confidence - current_confidence, 2)
        current_category = record["categoria"] or "Nao classificado"
        current_subcategory = record["subcategoria"] or "Nao classificado"
        changed = (
            current_category != suggestion.category
            or current_subcategory != suggestion.subcategory
            or record["nivel_confianca"] != suggestion.confidenceLevel
            or record["versao_classificador"] != suggestion.classifierVersion
        )

        current_confidence_total += current_confidence
        new_confidence_total += suggestion.confidence
        if confidence_delta > 0:
            confidence_improved += 1
        elif confidence_delta < 0:
            confidence_reduced += 1

        if changed:
            changed_count += 1
            task_key = str(record["id_task"] or record["id_lancamento"])
            changed_tasks.add(task_key)
            if current_category != suggestion.category:
                category_changes[(current_category, suggestion.category)] += 1
            group = task_groups.setdefault(
                task_key,
                {
                    "taskKey": task_key,
                    "idTask": str(record["id_task"] or ""),
                    "tituloTask": record["titulo_task"] or "",
                    "firstLine": int(record["linha_reprocessamento"]),
                    "totalRecords": 0,
                    "collaborators": set(),
                    "currentCategories": set(),
                    "currentSubcategories": set(),
                    "newCategories": set(),
                    "newSubcategories": set(),
                    "currentConfidenceTotal": 0.0,
                    "newConfidenceTotal": 0.0,
                    "confidenceFactors": [],
                },
            )
            group["firstLine"] = min(group["firstLine"], int(record["linha_reprocessamento"]))
            group["totalRecords"] += 1
            if record["login_usuario"]:
                group["collaborators"].add(record["login_usuario"])
            group["currentCategories"].add(current_category)
            group["currentSubcategories"].add(current_subcategory)
            group["newCategories"].add(suggestion.category)
            group["newSubcategories"].add(suggestion.subcategory)
            group["currentConfidenceTotal"] += current_confidence
            group["newConfidenceTotal"] += suggestion.confidence
            for factor in suggestion.confidenceFactors:
                if factor not in group["confidenceFactors"] and len(group["confidenceFactors"]) < 3:
                    group["confidenceFactors"].append(factor)

        should_include_item = changed and (item_limit is None or len(items) < item_limit)
        if should_include_item:
            items.append(
                {
                    "recordId": record["id"],
                    "taskKey": str(record["id_task"] or record["id_lancamento"]),
                    "line": int(record["linha_reprocessamento"]),
                    "idLancamento": str(record["id_lancamento"]),
                    "idTask": str(record["id_task"] or ""),
                    "tituloTask": record["titulo_task"] or "",
                    "loginUsuario": record["login_usuario"] or "",
                    "currentCategory": current_category,
                    "currentSubcategory": current_subcategory,
                    "currentConfidence": current_confidence,
                    "currentConfidenceLevel": record["nivel_confianca"] or "baixa",
                    "currentClassifierVersion": record["versao_classificador"] or row["versao_classificador"],
                    "newCategory": suggestion.category,
                    "newSubcategory": suggestion.subcategory,
                    "newConfidence": suggestion.confidence,
                    "newConfidenceLevel": suggestion.confidenceLevel,
                    "newClassifierVersion": suggestion.classifierVersion,
                    "newOrigin": suggestion.origin,
                    "changed": changed,
                    "confidenceDelta": confidence_delta,
                    "confidenceFactors": suggestion.confidenceFactors,
                    "matchedKeywords": suggestion.matchedKeywords,
                }
            )

    total_records = len(records)
    effective_item_limit = item_limit if item_limit is not None else changed_count
    task_group_items = []
    for group in task_groups.values():
        total_group_records = group["totalRecords"] or 1
        average_current = round(group["currentConfidenceTotal"] / total_group_records, 2)
        average_new = round(group["newConfidenceTotal"] / total_group_records, 2)
        task_group_items.append(
            {
                "taskKey": group["taskKey"],
                "idTask": group["idTask"],
                "tituloTask": group["tituloTask"],
                "firstLine": group["firstLine"],
                "totalRecords": group["totalRecords"],
                "collaborators": sorted(group["collaborators"]),
                "currentCategory": _single_or_mixed(group["currentCategories"]),
                "currentSubcategory": _single_or_mixed(group["currentSubcategories"]),
                "newCategory": _single_or_mixed(group["newCategories"]),
                "newSubcategory": _single_or_mixed(group["newSubcategories"]),
                "averageCurrentConfidence": average_current,
                "averageNewConfidence": average_new,
                "confidenceDelta": round(average_new - average_current, 2),
                "confidenceFactors": group["confidenceFactors"],
            }
        )
    task_group_items.sort(key=lambda item: (-item["totalRecords"], item["firstLine"], item["tituloTask"]))

    return ImportReprocessPreview(
        importId=row["id"],
        filename=row["nome_arquivo"],
        currentClassifierVersion=row["versao_classificador"],
        newClassifierVersion=_classifier_version_from_values(classifier_versions),
        totalRecords=total_records,
        changedRecords=changed_count,
        unchangedRecords=max(total_records - changed_count, 0),
        changedTasks=len(changed_tasks),
        confidenceImproved=confidence_improved,
        confidenceReduced=confidence_reduced,
        averageCurrentConfidence=round(current_confidence_total / total_records, 2) if total_records else 0,
        averageNewConfidence=round(new_confidence_total / total_records, 2) if total_records else 0,
        categoryChanges=[
            {
                "fromCategory": from_category,
                "toCategory": to_category,
                "totalRecords": total,
            }
            for (from_category, to_category), total in category_changes.most_common()
        ],
        taskGroups=task_group_items,
        items=items,
        itemLimit=effective_item_limit,
    )


@router.get("/{import_id}", response_model=ImportDetail)
def get_import(import_id: int) -> ImportDetail:
    with get_connection() as connection:
        row = get_import_detail(connection, import_id)

    if not row:
        raise HTTPException(status_code=404, detail="Importacao nao encontrada.")

    return ImportDetail(
        id=row["id"],
        filename=row["nome_arquivo"],
        status=row["status"],
        importedAt=row["data_importacao"].isoformat(),
        totalRows=row["total_registros"],
        validRows=row["registros_validos"],
        alertRows=row["registros_com_alerta"],
        blockedRows=row["registros_bloqueados"],
        classifierVersion=row["versao_classificador"],
        records=[
            {
                "idLancamento": record["id_lancamento"],
                "dataHoraCadastro": record["data_hora_cadastro"].isoformat(),
                "loginUsuario": record["login_usuario"],
                "duracao": record["duracao_original"],
                "duracaoSegundos": record["duracao_segundos"],
                "epic": record["titulo_epic"],
                "feature": record["titulo_feat"],
                "pbi": record["titulo_pbi"],
                "task": record["titulo_task"],
                "categoria": record["categoria"],
                "subcategoria": record["subcategoria"],
                "statusValidacao": record["status_validacao"],
                "statusClassificacao": record["status_classificacao"],
                "classifierVersion": record["versao_classificador"],
                "confidenceLevel": record["nivel_confianca"],
                "confidence": float(record["confianca"]) if record["confianca"] is not None else 0,
            }
            for record in row["lancamentos"]
        ],
        issues=[
            {
                "line": issue["linha"],
                "field": issue["campo"],
                "value": issue["valor_encontrado"],
                "code": issue["tipo_erro"],
                "severity": issue["severidade"],
                "message": issue["mensagem"],
                "resolved": issue["resolvido"],
            }
            for issue in row["erros"]
        ],
        duplicates=[
            {
                "idLancamento": duplicate["id_lancamento"],
                "lines": duplicate["linhas_envolvidas"],
                "keptRecordId": duplicate["registro_mantido_id"],
                "removedLines": duplicate["registros_removidos"],
                "resolved": duplicate["resolvido"],
                "resolvedAt": duplicate["data_resolucao"].isoformat() if duplicate["data_resolucao"] else None,
            }
            for duplicate in row["duplicidades"]
        ],
    )


async def _read_import_file(file: UploadFile) -> tuple[str, bytes]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo nao informado.")

    extension = file.filename.lower().rsplit(".", 1)[-1]
    if extension not in {"xlsx", "csv"}:
        raise HTTPException(status_code=400, detail="Formato invalido. Envie .xlsx ou .csv.")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    return file.filename, content


def _classification_status(origin: str) -> str:
    if origin in {"padrao_titulo", "padrao_titulo_categoria"}:
        return "automatica"
    if origin == "manual":
        return "alterada"
    if origin == "pendente":
        return "nao_classificada"
    return "sugerida"


def _classifier_version_from_records(records: list[dict]) -> str:
    versions = [str(record.get("VersaoClassificador", "")).strip() for record in records]
    versions = [version for version in versions if version]
    if not versions:
        return "1.0.0"
    unique_versions = sorted(set(versions))
    return unique_versions[0] if len(unique_versions) == 1 else "multi"


def _classifier_version_from_values(values: set[str]) -> str:
    versions = sorted(str(value).strip() for value in values if str(value).strip())
    if not versions:
        return "1.0.0"
    return versions[0] if len(versions) == 1 else "multi"


def _single_or_mixed(values: set[str]) -> str:
    cleaned = sorted(value for value in values if value)
    if not cleaned:
        return "Nao classificado"
    return cleaned[0] if len(cleaned) == 1 else "Multiplos"


def _sqlserver_import_filename(payload: SQLServerImportRequest) -> str:
    ids_label = "-".join(str(item).strip() for item in payload.ids[:5])
    suffix = "mais" if len(payload.ids) > 5 else ""
    parts = ["sqlserver", payload.idType, ids_label, suffix]
    return "-".join(part for part in parts if part) + ".csv"


def _raise_sqlserver_http_error(exc: SQLServerIntegrationError) -> None:
    if isinstance(exc, SQLServerConfigurationError):
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerConnectionError):
        raise HTTPException(status_code=503, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerTimeoutError):
        raise HTTPException(status_code=504, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerInvalidIdError):
        raise HTTPException(status_code=400, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerAmbiguousIdError):
        raise HTTPException(status_code=409, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerIdNotFoundError):
        raise HTTPException(status_code=404, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerEmptyResultError):
        raise HTTPException(status_code=422, detail=exc.user_message) from exc
    if isinstance(exc, SQLServerQueryError):
        raise HTTPException(status_code=400, detail=exc.user_message) from exc
    raise HTTPException(status_code=500, detail=exc.user_message) from exc


def _parse_duplicate_keep_lines(raw_value: str | None) -> set[int] | None:
    if not raw_value:
        return None

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Resolucao de duplicidades invalida.") from exc

    if not isinstance(parsed, list) or not all(isinstance(item, int) for item in parsed):
        raise HTTPException(status_code=400, detail="Resolucao de duplicidades deve ser uma lista de linhas.")

    return set(parsed)


def _parse_classification_overrides(raw_value: str | None) -> dict[int, dict[str, str]]:
    if not raw_value:
        return {}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Revisao de categorias invalida.") from exc

    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="Revisao de categorias deve ser uma lista.")

    return _classification_overrides_from_list(parsed)


def _classification_overrides_from_list(parsed: list) -> dict[int, dict[str, str]]:
    overrides: dict[int, dict[str, str]] = {}
    for item in parsed:
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail="Item de revisao de categoria invalido.")

        line = item.get("line")
        category = item.get("category")
        subcategory = item.get("subcategory")
        if not isinstance(line, int) or not isinstance(category, str) or not isinstance(subcategory, str):
            raise HTTPException(status_code=400, detail="Revisao de categoria deve conter linha, categoria e subcategoria.")

        overrides[line] = {"category": category, "subcategory": subcategory}

    return overrides
