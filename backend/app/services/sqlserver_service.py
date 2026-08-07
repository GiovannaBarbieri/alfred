from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from datetime import date, timedelta
from typing import Any, Literal

import pandas as pd

from app.core.config import settings
from app.services.validation_service import REQUIRED_COLUMNS

logger = logging.getLogger(__name__)

SQLServerIdType = Literal["auto", "epic", "feature"]
ResolvedSQLServerIdType = Literal["epic", "feature"]
_TFS_INDICATOR_BATCH_SIZE = 200
_TFS_HIERARCHY_BATCH_SIZE = 1000
_GENERAL_INDICATOR_RAW_REFRESH_BATCH_SIZE = 250
GENERAL_INDICATOR_FEATURE_BATCH_SIZE = _TFS_INDICATOR_BATCH_SIZE
GENERAL_INDICATOR_HIERARCHY_BATCH_SIZE = _TFS_HIERARCHY_BATCH_SIZE


class TFSHierarchyRows(list[dict[str, Any]]):
    def __init__(self, rows: Sequence[dict[str, Any]], *, query_count: int) -> None:
        super().__init__(rows)
        self.query_count = query_count

SQLSERVER_IMPORT_COLUMNS = [
    "IdLancamento",
    "DataHoraCadastro",
    "Task",
    "LoginUsuario",
    "DataHoraInicio",
    "DataHoraFim",
    "TempoDuracao",
    "Rev",
    "IdTask",
    "TituloTask",
    "IdPBI",
    "TituloPBI",
    "IdFeat",
    "TituloFeat",
    "IdEpic",
    "TituloEpic",
]


class SQLServerIntegrationError(Exception):
    user_message = "Não foi possível consultar o SQL Server."


class SQLServerConfigurationError(SQLServerIntegrationError):
    user_message = "Configuração do SQL Server incompleta."


class SQLServerConnectionError(SQLServerIntegrationError):
    user_message = "Não foi possível conectar ao SQL Server."


class SQLServerQueryError(SQLServerIntegrationError):
    user_message = "A consulta do SQL Server falhou."


class SQLServerTimeoutError(SQLServerIntegrationError):
    user_message = "A consulta ao SQL Server excedeu o tempo limite."


class SQLServerEmptyResultError(SQLServerIntegrationError):
    user_message = "A consulta ao SQL Server não retornou registros."


class SQLServerInvalidIdError(SQLServerIntegrationError):
    user_message = "Informe apenas IDs numéricos para consultar o SQL Server."


class SQLServerAmbiguousIdError(SQLServerIntegrationError):
    user_message = "Os IDs informados existem como Epic e Feature. Escolha manualmente o tipo do ID."


class SQLServerIdNotFoundError(SQLServerIntegrationError):
    user_message = "Nenhum ID foi localizado como Epic ou Feature no SQL Server."


def test_sqlserver_connection() -> None:
    pyodbc = _load_pyodbc()
    try:
        connection = pyodbc.connect(_connection_string(), timeout=settings.sqlserver_connection_timeout_seconds)
        connection.close()
    except SQLServerIntegrationError:
        raise
    except Exception as exc:
        logger.exception("Falha ao testar conexao com SQL Server.")
        raise _map_pyodbc_error(exc, fallback=SQLServerConnectionError) from exc


def query_import_dataframe(*, ids: Sequence[int | str], id_type: SQLServerIdType) -> pd.DataFrame:
    numeric_ids = validate_sqlserver_ids(ids)
    resolved_type = resolve_sqlserver_id_type(numeric_ids, id_type)
    filter_column = "TitEpic.ID" if resolved_type == "epic" else "TitFeat.ID"
    query = f"{_BASE_IMPORT_QUERY}\nWHERE {filter_column} IN ({_placeholders(numeric_ids)})"

    rows = _execute_query(query, list(numeric_ids))
    if not rows:
        raise SQLServerEmptyResultError("Consulta sem registros.")

    dataframe = normalize_sqlserver_rows(rows)
    if dataframe.empty:
        raise SQLServerEmptyResultError("Consulta sem registros normalizaveis.")
    return dataframe


def query_general_indicator_raw_launches(*, start_date: date, end_date: date) -> list[dict[str, Any]]:
    """Consulta uma linha de origem por lançamento, sem resolver a hierarquia do TFS."""
    exclusive_end = end_date + timedelta(days=1)
    return _execute_query(_GENERAL_INDICATOR_RAW_LAUNCHES_QUERY, [start_date.isoformat(), exclusive_end.isoformat()])


def query_general_indicator_raw_launches_by_ids(ids: Sequence[int | str]) -> list[dict[str, Any]]:
    numeric_ids = validate_sqlserver_ids(ids) if ids else []
    rows: list[dict[str, Any]] = []
    for offset in range(0, len(numeric_ids), _GENERAL_INDICATOR_RAW_REFRESH_BATCH_SIZE):
        batch = numeric_ids[offset : offset + _GENERAL_INDICATOR_RAW_REFRESH_BATCH_SIZE]
        query = _GENERAL_INDICATOR_RAW_LAUNCHES_BY_IDS_QUERY.replace("{id_placeholders}", _placeholders(batch))
        rows.extend(_execute_query(query, list(batch)))
    return rows


def query_tfs_task_hierarchies(ids: Sequence[int | str]) -> list[dict[str, Any]]:
    """Resolve em lote Task -> pai -> Feature -> Epic, preservando candidatos ambíguos."""
    numeric_ids = validate_sqlserver_ids(ids) if ids else []
    if not numeric_ids:
        return []

    cache: dict[int, list[dict[str, Any]]] = {}
    query_count = 0

    def load_direct_parents(item_ids: Sequence[int]) -> None:
        nonlocal query_count
        missing = sorted({item_id for item_id in item_ids if item_id not in cache})
        for offset in range(0, len(missing), _TFS_HIERARCHY_BATCH_SIZE):
            batch = missing[offset : offset + _TFS_HIERARCHY_BATCH_SIZE]
            query = _TFS_DIRECT_PARENTS_QUERY.replace("{id_placeholders}", _placeholders(batch))
            query_count += 1
            grouped = {item_id: [] for item_id in batch}
            for row in _execute_query(query, list(batch)):
                item_id = _numeric_id(row.get("IdItem"))
                if item_id is not None and item_id in grouped:
                    grouped[item_id].append(row)
            cache.update(grouped)

    load_direct_parents(numeric_ids)
    paths = [
        {"root": task_id, "current": task_id, "depth": 0, "visited": {task_id}, "task": cache[task_id][0]}
        for task_id in numeric_ids
        if cache.get(task_id)
    ]
    resolved_parents: list[dict[str, Any]] = []
    for _ in range(20):
        if not paths:
            break
        load_direct_parents([int(path["current"]) for path in paths])
        next_paths: list[dict[str, Any]] = []
        for path in paths:
            for edge in cache.get(int(path["current"]), []):
                parent_id = _numeric_id(edge.get("IdParent"))
                if parent_id is None or parent_id in path["visited"]:
                    continue
                parent_type = edge.get("ParentWorkItemType")
                depth = int(path["depth"]) + 1
                if _is_classification_parent_type(parent_type):
                    resolved_parents.append(
                        {
                            **path,
                            "parentId": parent_id,
                            "parentType": parent_type,
                            "parentTitle": edge.get("ParentTitle"),
                            "parentDepth": depth,
                        }
                    )
                else:
                    next_paths.append(
                        {
                            **path,
                            "current": parent_id,
                            "depth": depth,
                            "visited": {*path["visited"], parent_id},
                        }
                    )
        paths = next_paths

    load_direct_parents([int(path["parentId"]) for path in resolved_parents])
    feature_candidates: list[dict[str, Any]] = []
    for path in resolved_parents:
        for edge in cache.get(int(path["parentId"]), []) or [{}]:
            feature_candidates.append(
                {
                    **path,
                    "featureId": _numeric_id(edge.get("IdParent")),
                    "featureType": edge.get("ParentWorkItemType"),
                    "featureTitle": edge.get("ParentTitle"),
                }
            )

    load_direct_parents(
        [int(path["featureId"]) for path in feature_candidates if path.get("featureId") is not None]
    )
    result: list[dict[str, Any]] = []
    for path in feature_candidates:
        feature_id = path.get("featureId")
        epic_edges = cache.get(int(feature_id), []) if feature_id is not None else []
        for epic_edge in epic_edges or [{}]:
            task = path["task"]
            result.append(
                {
                    "IdTask": path["root"],
                    "TaskWorkItemType": task.get("ItemWorkItemType"),
                    "TaskTitle": task.get("ItemTitle"),
                    "IdParent": path["parentId"],
                    "ParentWorkItemType": path["parentType"],
                    "ParentTitle": path["parentTitle"],
                    "ParentDepth": path["parentDepth"],
                    "IdFeat": feature_id,
                    "FeatureWorkItemType": path.get("featureType"),
                    "FeatureTitle": path.get("featureTitle"),
                    "IdEpic": _numeric_id(epic_edge.get("IdParent")),
                    "EpicWorkItemType": epic_edge.get("ParentWorkItemType"),
                    "EpicTitle": epic_edge.get("ParentTitle"),
                }
            )
    resolved_root_ids = {int(path["root"]) for path in resolved_parents}
    for task_id in numeric_ids:
        if task_id in resolved_root_ids or not cache.get(task_id):
            continue
        task = cache[task_id][0]
        result.append(
            {
                "IdTask": task_id,
                "TaskWorkItemType": task.get("ItemWorkItemType"),
                "TaskTitle": task.get("ItemTitle"),
                "IdParent": None,
                "ParentWorkItemType": None,
                "ParentTitle": None,
                "ParentDepth": None,
                "IdFeat": None,
                "FeatureWorkItemType": None,
                "FeatureTitle": None,
                "IdEpic": None,
                "EpicWorkItemType": None,
                "EpicTitle": None,
            }
        )
    return TFSHierarchyRows(result, query_count=query_count)


def _numeric_id(value: Any) -> int | None:
    text = str(value or "").strip()
    return int(text) if text.isdigit() else None


def _is_classification_parent_type(value: Any) -> bool:
    return str(value or "").strip().casefold() in {"pbi", "product backlog item", "bug"}


def query_tfs_indicator_items(ids: Sequence[int | str]) -> list[dict[str, Any]]:
    numeric_ids = validate_sqlserver_ids(ids) if ids else []
    if not numeric_ids:
        return []

    rows: list[dict[str, Any]] = []
    for offset in range(0, len(numeric_ids), _TFS_INDICATOR_BATCH_SIZE):
        batch = numeric_ids[offset : offset + _TFS_INDICATOR_BATCH_SIZE]
        query = _TFS_INDICATOR_ITEMS_QUERY.replace("{id_placeholders}", _placeholders(batch))
        query = query.replace(
            "{artifact_placeholders}",
            ", ".join("CONVERT(binary(4), ?)" for _ in batch),
        )
        rows.extend(_execute_query(query, [*batch, *batch]))
    return rows


def query_tfs_general_indicator_module_tags() -> list[str]:
    """Lista TAGs 1- atualmente vinculadas a itens no TFS."""
    rows = _execute_query(_TFS_GENERAL_INDICATOR_MODULE_TAGS_QUERY, [])
    return [str(row.get("TagName") or "").strip() for row in rows if row.get("TagName")]


def validate_sqlserver_ids(ids: Sequence[int | str]) -> list[int]:
    numeric_ids: list[int] = []
    for raw_id in ids:
        value = str(raw_id).strip()
        if not value or not value.isdigit():
            raise SQLServerInvalidIdError("ID invalido.")
        numeric_ids.append(int(value))

    if not numeric_ids:
        raise SQLServerInvalidIdError("Nenhum ID informado.")
    return sorted(set(numeric_ids))


def resolve_sqlserver_id_type(ids: Sequence[int], id_type: SQLServerIdType) -> ResolvedSQLServerIdType:
    if id_type in {"epic", "feature"}:
        return id_type
    if id_type != "auto":
        raise SQLServerInvalidIdError("Tipo de ID invalido.")

    epic_ids = _find_existing_ids("IdEpic", ids)
    feature_ids = _find_existing_ids("IdFeat", ids)

    if epic_ids and not feature_ids:
        return "epic"
    if feature_ids and not epic_ids:
        return "feature"
    if epic_ids and feature_ids:
        raise SQLServerAmbiguousIdError("IDs encontrados como Epic e Feature.")
    raise SQLServerIdNotFoundError("IDs nao encontrados.")


def normalize_sqlserver_rows(rows: Sequence[dict[str, Any]]) -> pd.DataFrame:
    dataframe = pd.DataFrame(rows)
    if dataframe.empty:
        return pd.DataFrame(columns=SQLSERVER_IMPORT_COLUMNS)

    normalized_columns = {_normalize_key(column): column for column in dataframe.columns}
    rename_map: dict[str, str] = {}
    for target_column in SQLSERVER_IMPORT_COLUMNS:
        source_column = _find_source_column(target_column, normalized_columns)
        if source_column:
            rename_map[source_column] = target_column

    dataframe = dataframe.rename(columns=rename_map)
    for column in SQLSERVER_IMPORT_COLUMNS:
        if column not in dataframe.columns:
            dataframe[column] = ""

    if "Duracao" not in dataframe.columns:
        dataframe["Duracao"] = dataframe["TempoDuracao"]
    dataframe["Duracao"] = dataframe["Duracao"].map(_normalize_duration_value)

    return dataframe[[*SQLSERVER_IMPORT_COLUMNS, *[column for column in REQUIRED_COLUMNS if column not in SQLSERVER_IMPORT_COLUMNS]]].fillna("")


def dataframe_to_import_content(dataframe: pd.DataFrame) -> bytes:
    return dataframe.to_csv(index=False, lineterminator="\n").encode("utf-8")


def _normalize_duration_value(value: Any) -> str:
    raw_value = str(value or "").strip()
    match = re.fullmatch(r"(?:(\d+)d\s*)?(\d{1,2}):(\d{2}):(\d{2})", raw_value)
    if not match:
        return raw_value

    days = int(match.group(1) or 0)
    hours = int(match.group(2)) + days * 24
    minutes = int(match.group(3))
    seconds = int(match.group(4))
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _find_existing_ids(column: str, ids: Sequence[int]) -> set[int]:
    query = f"SELECT DISTINCT {column} AS IdEncontrado FROM ({_BASE_IMPORT_QUERY}) AS Base WHERE {column} IN ({_placeholders(ids)})"
    rows = _execute_query(query, list(ids))
    return {int(row["IdEncontrado"]) for row in rows if row.get("IdEncontrado") is not None}


def _execute_query(query: str, params: list[Any]) -> list[dict[str, Any]]:
    pyodbc = _load_pyodbc()
    logger.info("Executando consulta SQL Server. parametros=%s", _safe_param_summary(params))
    try:
        connection = pyodbc.connect(_connection_string(), timeout=settings.sqlserver_connection_timeout_seconds)
        try:
            if hasattr(connection, "timeout"):
                connection.timeout = settings.sqlserver_request_timeout_seconds
            cursor = connection.cursor()
            cursor.execute(query, params)
            columns = [column[0] for column in cursor.description or []]
            rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
            logger.info("Consulta SQL Server concluida. registros=%s", len(rows))
            return rows
        finally:
            connection.close()
    except SQLServerIntegrationError:
        raise
    except Exception as exc:
        logger.exception("Falha ao executar consulta SQL Server.")
        raise _map_pyodbc_error(exc, fallback=SQLServerQueryError) from exc


def _connection_string() -> str:
    auth_mode = settings.sqlserver_auth.strip().lower()
    required = {
        "SQLSERVER_HOST": settings.sqlserver_host,
        "SQLSERVER_DATABASE": settings.sqlserver_database,
    }
    if auth_mode == "sql":
        required["SQLSERVER_USER"] = settings.sqlserver_user
        required["SQLSERVER_PASSWORD"] = settings.sqlserver_password
    elif auth_mode != "windows":
        raise SQLServerConfigurationError("SQLSERVER_AUTH deve ser 'sql' ou 'windows'.")

    missing = [name for name, value in required.items() if not value]
    if missing:
        raise SQLServerConfigurationError(f"Variaveis ausentes: {', '.join(missing)}.")

    encrypt = "yes" if settings.sqlserver_encrypt else "no"
    trust_certificate = "yes" if settings.sqlserver_trust_cert else "no"
    authentication = (
        f"UID={settings.sqlserver_user};PWD={settings.sqlserver_password};"
        if auth_mode == "sql"
        else "Trusted_Connection=yes;"
    )
    driver = _resolve_sqlserver_driver()
    return (
        f"DRIVER={{{driver}}};"
        f"SERVER={settings.sqlserver_host},{settings.sqlserver_port};"
        f"DATABASE={settings.sqlserver_database};"
        f"{authentication}"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust_certificate};"
        f"Connection Timeout={settings.sqlserver_connection_timeout_seconds};"
    )


def _resolve_sqlserver_driver() -> str:
    configured_driver = settings.sqlserver_driver.strip()
    try:
        installed_drivers = [str(driver).strip() for driver in _load_pyodbc().drivers()]
    except Exception:
        # A enumeracao pode nao estar disponivel em todos os ambientes. Nesse caso,
        # preservamos o driver configurado e deixamos o pyodbc validar a conexao.
        return configured_driver

    installed_by_name = {driver.casefold(): driver for driver in installed_drivers}
    configured_installed = installed_by_name.get(configured_driver.casefold())
    if configured_installed:
        return configured_installed

    for fallback in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"):
        installed_fallback = installed_by_name.get(fallback.casefold())
        if installed_fallback:
            logger.warning(
                "Driver SQL Server configurado nao esta instalado; usando alternativa disponivel. "
                "configurado=%s selecionado=%s",
                configured_driver,
                installed_fallback,
            )
            return installed_fallback

    return configured_driver


def _placeholders(values: Sequence[int]) -> str:
    return ", ".join("?" for _ in values)


def _find_source_column(target_column: str, normalized_columns: dict[str, str]) -> str | None:
    candidates = _COLUMN_ALIASES.get(target_column, [])
    for candidate in [target_column, *candidates]:
        source_column = normalized_columns.get(_normalize_key(candidate))
        if source_column:
            return source_column
    return None


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _load_pyodbc():
    try:
        import pyodbc  # type: ignore

        return pyodbc
    except ModuleNotFoundError as exc:
        raise SQLServerConfigurationError(
            "Biblioteca pyodbc nao instalada. Instale as dependencias do backend novamente."
        ) from exc


def _map_pyodbc_error(exc: Exception, *, fallback: type[SQLServerIntegrationError]) -> SQLServerIntegrationError:
    message = str(exc).lower()
    sqlstate = str(exc.args[0]).upper() if getattr(exc, "args", None) else ""
    if sqlstate in {"HYT00", "HYT01"} or "query timeout" in message or "login timeout" in message or "timed out" in message:
        return SQLServerTimeoutError(str(exc))
    if sqlstate.startswith("08") or "login failed" in message or "network-related" in message or "connection refused" in message:
        return SQLServerConnectionError(str(exc))
    return fallback(str(exc))


def _safe_param_summary(params: Sequence[Any]) -> dict[str, int]:
    return {"total": len(params)}


_COLUMN_ALIASES: dict[str, list[str]] = {
    "IdLancamento": ["id_lancamento", "id_apontamento", "id_registro", "lancamento_id"],
    "DataHoraCadastro": ["data_hora_cadastro", "data_cadastro", "data", "created_at"],
    "Task": ["task", "work_item", "workitem", "atividade"],
    "LoginUsuario": ["login_usuario", "usuario", "login", "user_name"],
    "Duracao": ["duracao", "tempo", "tempo_duracao", "tempoduracao", "horas", "duration"],
    "TempoDuracao": ["tempo_duracao", "tempoduracao", "duracao"],
    "IdTask": ["id_task", "task_id", "id_atividade"],
    "TituloTask": ["titulo_task", "task_title", "titulo_atividade"],
    "IdPBI": ["id_pbi", "pbi_id"],
    "TituloPBI": ["titulo_pbi", "pbi_title"],
    "IdFeat": ["id_feat", "id_feature", "feature_id"],
    "TituloFeat": ["titulo_feat", "titulo_feature", "feature_title"],
    "IdEpic": ["id_epic", "epic_id"],
    "TituloEpic": ["titulo_epic", "epic_title"],
}


_BASE_IMPORT_QUERY = """
SELECT DISTINCT
  Lancamento.ID AS IdLancamento,
  Lancamento.DataHoraCadastro,
  Lancamento.TaskID AS Task,
  Lancamento.LoginUsuario,
  Lancamento.DataHoraInicio,
  Lancamento.DataHoraFim,
  Lancamento.TempoDuracao,
  TitTask.Rev,
  TitTask.ID AS IdTask,
  TitTask.Words AS TituloTask,
  TitPBI.ID AS IdPBI,
  TitPBI.Words AS TituloPBI,
  TitFeat.ID AS IdFeat,
  TitFeat.Words AS TituloFeat,
  TitEpic.ID AS IdEpic,
  TitEpic.Words AS TituloEpic
FROM advise.RegistroHorario AS Lancamento
LEFT JOIN WorkItemLONgTexts AS TitTask WITH (NOLOCK) ON TitTask.ID = Lancamento.TaskID
  AND TitTask.FldID = 1
  AND TitTask.Rev = (
    SELECT MAX(TitTask2.Rev)
    FROM WorkItemLONgTexts AS TitTask2 WITH (NOLOCK)
    WHERE TitTask2.ID = Lancamento.TaskID
      AND TitTask2.FldID = 1
  )
LEFT JOIN LinksAre AS PBI WITH (NOLOCK) ON PBI.TargetID = Lancamento.TaskID
  AND PBI.LinkType = 2
LEFT JOIN WorkItemLONgTexts AS TitPBI WITH (NOLOCK) ON TitPBI.ID = PBI.SourceID
  AND TitPBI.FldID = 1
  AND TitPBI.Rev = 1
LEFT JOIN LinksAre AS Feat WITH (NOLOCK) ON Feat.TargetID = PBI.SourceID
  AND Feat.LinkType = 2
LEFT JOIN WorkItemLONgTexts AS TitFeat WITH (NOLOCK) ON TitFeat.ID = Feat.SourceID
  AND TitFeat.FldID = 1
  AND TitFeat.Rev = 1
LEFT JOIN LinksAre AS Epic WITH (NOLOCK) ON Epic.TargetID = Feat.SourceID
  AND Epic.LinkType = 2
LEFT JOIN WorkItemLONgTexts AS TitEpic WITH (NOLOCK) ON TitEpic.ID = Epic.SourceID
  AND TitEpic.FldID = 1
  AND TitEpic.Rev = 1
""".strip()


_GENERAL_INDICATOR_RAW_LAUNCHES_QUERY = """
SELECT
  Lancamento.ID AS IdLancamento,
  Lancamento.DataHoraCadastro,
  Lancamento.TaskID AS Task,
  Lancamento.LoginUsuario,
  Lancamento.DataHoraInicio,
  Lancamento.DataHoraFim,
  Lancamento.TempoDuracao,
  Lancamento.TaskID AS IdTask
FROM advise.RegistroHorario AS Lancamento
WHERE Lancamento.DataHoraCadastro >= ?
  AND Lancamento.DataHoraCadastro < ?
ORDER BY Lancamento.DataHoraCadastro, Lancamento.ID
""".strip()


_GENERAL_INDICATOR_RAW_LAUNCHES_BY_IDS_QUERY = """
SELECT
  Lancamento.ID AS IdLancamento,
  Lancamento.DataHoraCadastro,
  Lancamento.TaskID AS Task,
  Lancamento.LoginUsuario,
  Lancamento.DataHoraInicio,
  Lancamento.DataHoraFim,
  Lancamento.TempoDuracao,
  Lancamento.TaskID AS IdTask
FROM advise.RegistroHorario AS Lancamento
WHERE Lancamento.ID IN ({id_placeholders})
ORDER BY Lancamento.ID
""".strip()


_TFS_DIRECT_PARENTS_QUERY = """
WITH LatestItems AS (
  SELECT
    Item.ID,
    Item.WorkItemType,
    ROW_NUMBER() OVER (PARTITION BY Item.ID ORDER BY Item.Rev DESC, Item.RevisedDate DESC) AS RowNumber
  FROM dbo.tbl_WorkItemCoreLatest AS Item
  WHERE Item.ID IN ({id_placeholders})
)
SELECT DISTINCT
  Item.ID AS IdItem,
  Item.WorkItemType AS ItemWorkItemType,
  ItemTitle.Title AS ItemTitle,
  ParentLink.SourceID AS IdParent,
  ParentItem.WorkItemType AS ParentWorkItemType,
  ParentTitle.Title AS ParentTitle
FROM LatestItems AS Item
OUTER APPLY (
  SELECT TOP (1) CONVERT(nvarchar(max), Title.Words) AS Title
  FROM dbo.WorkItemLONgTexts AS Title
  WHERE Title.ID = Item.ID AND Title.FldID = 1
  ORDER BY Title.Rev DESC
) AS ItemTitle
LEFT JOIN dbo.LinksAre AS ParentLink
  ON ParentLink.TargetID = Item.ID AND ParentLink.LinkType = 2
OUTER APPLY (
  SELECT TOP (1) Candidate.WorkItemType
  FROM dbo.tbl_WorkItemCoreLatest AS Candidate
  WHERE Candidate.ID = ParentLink.SourceID
  ORDER BY Candidate.Rev DESC, Candidate.RevisedDate DESC
) AS ParentItem
OUTER APPLY (
  SELECT TOP (1) CONVERT(nvarchar(max), Title.Words) AS Title
  FROM dbo.WorkItemLONgTexts AS Title
  WHERE Title.ID = ParentLink.SourceID AND Title.FldID = 1
  ORDER BY Title.Rev DESC
) AS ParentTitle
WHERE Item.RowNumber = 1
""".strip()


_TFS_TASK_HIERARCHIES_QUERY = """
WITH LatestTasks AS (
  SELECT
    Item.ID,
    Item.WorkItemType,
    ROW_NUMBER() OVER (PARTITION BY Item.ID ORDER BY Item.Rev DESC, Item.RevisedDate DESC) AS RowNumber
  FROM dbo.tbl_WorkItemCoreLatest AS Item
  WHERE Item.ID IN ({id_placeholders})
),
ParentPaths AS (
  SELECT
    Task.ID AS RootTaskID,
    Task.ID AS CurrentID,
    Task.WorkItemType AS CurrentWorkItemType,
    CONVERT(varchar(max), CONCAT('/', Task.ID, '/')) AS VisitedPath,
    0 AS Depth
  FROM LatestTasks AS Task
  WHERE Task.RowNumber = 1

  UNION ALL

  SELECT
    Path.RootTaskID,
    ParentLink.SourceID AS CurrentID,
    ParentItem.WorkItemType AS CurrentWorkItemType,
    CONVERT(varchar(max), CONCAT(Path.VisitedPath, ParentLink.SourceID, '/')) AS VisitedPath,
    Path.Depth + 1 AS Depth
  FROM ParentPaths AS Path
  INNER JOIN dbo.LinksAre AS ParentLink
    ON ParentLink.TargetID = Path.CurrentID
    AND ParentLink.LinkType = 2
  INNER JOIN dbo.tbl_WorkItemCoreLatest AS ParentItem
    ON ParentItem.ID = ParentLink.SourceID
  WHERE Path.Depth < 20
    AND LOWER(LTRIM(RTRIM(Path.CurrentWorkItemType))) NOT IN ('pbi', 'product backlog item', 'bug')
    AND CHARINDEX(CONCAT('/', ParentLink.SourceID, '/'), Path.VisitedPath) = 0
),
TypedPaths AS (
  SELECT
    Path.RootTaskID,
    Path.CurrentID,
    Path.Depth,
    Path.CurrentWorkItemType AS WorkItemType,
    DENSE_RANK() OVER (PARTITION BY Path.RootTaskID ORDER BY Path.Depth) AS CandidateDepth
  FROM ParentPaths AS Path
  WHERE Path.Depth > 0
    AND LOWER(LTRIM(RTRIM(Path.CurrentWorkItemType))) IN ('pbi', 'product backlog item', 'bug')
),
ClassificationParents AS (
  SELECT RootTaskID, CurrentID, Depth, WorkItemType
  FROM TypedPaths
  WHERE CandidateDepth = 1
)
SELECT DISTINCT
  Task.ID AS IdTask,
  Task.WorkItemType AS TaskWorkItemType,
  TaskTitle.Title AS TaskTitle,
  ClassificationParent.CurrentID AS IdParent,
  ClassificationParent.WorkItemType AS ParentWorkItemType,
  ParentTitle.Title AS ParentTitle,
  ClassificationParent.Depth AS ParentDepth,
  FeatureLink.SourceID AS IdFeat,
  FeatureItem.WorkItemType AS FeatureWorkItemType,
  FeatureTitle.Title AS FeatureTitle,
  EpicLink.SourceID AS IdEpic,
  EpicItem.WorkItemType AS EpicWorkItemType,
  EpicTitle.Title AS EpicTitle
FROM LatestTasks AS Task
OUTER APPLY (
  SELECT TOP (1) CONVERT(nvarchar(max), Title.Words) AS Title
  FROM dbo.WorkItemLONgTexts AS Title
  WHERE Title.ID = Task.ID AND Title.FldID = 1
  ORDER BY Title.Rev DESC
) AS TaskTitle
LEFT JOIN ClassificationParents AS ClassificationParent
  ON ClassificationParent.RootTaskID = Task.ID
OUTER APPLY (
  SELECT TOP (1) CONVERT(nvarchar(max), Title.Words) AS Title
  FROM dbo.WorkItemLONgTexts AS Title
  WHERE Title.ID = ClassificationParent.CurrentID AND Title.FldID = 1
  ORDER BY Title.Rev DESC
) AS ParentTitle
LEFT JOIN LinksAre AS FeatureLink
  ON FeatureLink.TargetID = ClassificationParent.CurrentID AND FeatureLink.LinkType = 2
OUTER APPLY (
  SELECT TOP (1) Item.WorkItemType
  FROM dbo.tbl_WorkItemCoreLatest AS Item
  WHERE Item.ID = FeatureLink.SourceID
  ORDER BY Item.Rev DESC, Item.RevisedDate DESC
) AS FeatureItem
OUTER APPLY (
  SELECT TOP (1) CONVERT(nvarchar(max), Title.Words) AS Title
  FROM dbo.WorkItemLONgTexts AS Title
  WHERE Title.ID = FeatureLink.SourceID AND Title.FldID = 1
  ORDER BY Title.Rev DESC
) AS FeatureTitle
LEFT JOIN LinksAre AS EpicLink
  ON EpicLink.TargetID = FeatureLink.SourceID AND EpicLink.LinkType = 2
OUTER APPLY (
  SELECT TOP (1) Item.WorkItemType
  FROM dbo.tbl_WorkItemCoreLatest AS Item
  WHERE Item.ID = EpicLink.SourceID
  ORDER BY Item.Rev DESC, Item.RevisedDate DESC
) AS EpicItem
OUTER APPLY (
  SELECT TOP (1) CONVERT(nvarchar(max), Title.Words) AS Title
  FROM dbo.WorkItemLONgTexts AS Title
  WHERE Title.ID = EpicLink.SourceID AND Title.FldID = 1
  ORDER BY Title.Rev DESC
) AS EpicTitle
WHERE Task.RowNumber = 1
OPTION (MAXRECURSION 20)
""".strip()


_TFS_INDICATOR_ITEMS_QUERY = """
WITH LatestItems AS (
  SELECT
    Item.ID,
    Item.WorkItemType,
    ROW_NUMBER() OVER (PARTITION BY Item.ID ORDER BY Item.Rev DESC, Item.RevisedDate DESC) AS RowNumber
  FROM dbo.tbl_WorkItemCoreLatest AS Item
  WHERE Item.ID IN ({id_placeholders})
),
TagHistory AS (
  SELECT
    CONVERT(int, Valor.ArtifactId) AS ID,
    Tag.Name AS TagName,
    Valor.IntValue,
    ROW_NUMBER() OVER (
      PARTITION BY Valor.ArtifactId, Valor.PropertyId
      ORDER BY Valor.Version DESC, Valor.ChangedDate DESC
    ) AS RowNumber
  FROM dbo.tbl_PropertyValue AS Valor
  INNER JOIN dbo.tbl_PropertyDefinition AS Propriedade
    ON Propriedade.PartitionId = Valor.PartitionId
    AND Propriedade.DataspaceId = Valor.DataspaceId
    AND Propriedade.PropertyId = Valor.PropertyId
  INNER JOIN dbo.tbl_TagDefinition AS Tag
    ON Tag.PartitionId = Valor.PartitionId
    AND CONVERT(nvarchar(36), Tag.TagId) = RIGHT(Propriedade.Name, 36)
  WHERE Valor.InternalKindId = 18
    AND Valor.PartitionId = 1
    AND Valor.ArtifactId IN ({artifact_placeholders})
),
LatestTags AS (
  SELECT ID, TagName
  FROM TagHistory
  WHERE RowNumber = 1 AND COALESCE(IntValue, 0) = 0
),
GroupedTags AS (
  SELECT DISTINCT Tags.ID,
    STUFF((
      SELECT '; ' + TagsInternas.TagName
      FROM LatestTags AS TagsInternas
      WHERE TagsInternas.ID = Tags.ID
      ORDER BY TagsInternas.TagName
      FOR XML PATH(''), TYPE
    ).value('.', 'nvarchar(max)'), 1, 2, '') AS Tags
  FROM LatestTags AS Tags
)
SELECT Item.ID, Item.WorkItemType, Tags.Tags
FROM LatestItems AS Item
LEFT JOIN GroupedTags AS Tags ON Tags.ID = Item.ID
WHERE Item.RowNumber = 1
""".strip()


_TFS_GENERAL_INDICATOR_MODULE_TAGS_QUERY = """
WITH TagHistory AS (
  SELECT
    Tag.Name AS TagName,
    Valor.IntValue,
    ROW_NUMBER() OVER (
      PARTITION BY Valor.ArtifactId, Valor.PropertyId
      ORDER BY Valor.Version DESC, Valor.ChangedDate DESC
    ) AS RowNumber
  FROM dbo.tbl_PropertyValue AS Valor WITH (NOLOCK)
  INNER JOIN dbo.tbl_PropertyDefinition AS Propriedade WITH (NOLOCK)
    ON Propriedade.PartitionId = Valor.PartitionId
    AND Propriedade.DataspaceId = Valor.DataspaceId
    AND Propriedade.PropertyId = Valor.PropertyId
  INNER JOIN dbo.tbl_TagDefinition AS Tag WITH (NOLOCK)
    ON Tag.PartitionId = Valor.PartitionId
    AND CONVERT(nvarchar(36), Tag.TagId) = RIGHT(Propriedade.Name, 36)
  WHERE Valor.InternalKindId = 18
    AND Valor.PartitionId = 1
    AND LTRIM(RTRIM(Tag.Name)) LIKE '1-%'
)
SELECT DISTINCT LTRIM(RTRIM(TagName)) AS TagName
FROM TagHistory
WHERE RowNumber = 1
  AND COALESCE(IntValue, 0) = 0
ORDER BY TagName
""".strip()
