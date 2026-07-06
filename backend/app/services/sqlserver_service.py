from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from typing import Any, Literal

import pandas as pd

from app.core.config import settings
from app.services.validation_service import REQUIRED_COLUMNS

logger = logging.getLogger(__name__)

SQLServerIdType = Literal["auto", "epic", "feature"]
ResolvedSQLServerIdType = Literal["epic", "feature"]

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
    user_message = "Nao foi possivel consultar o SQL Server."


class SQLServerConfigurationError(SQLServerIntegrationError):
    user_message = "Configuracao do SQL Server incompleta."


class SQLServerConnectionError(SQLServerIntegrationError):
    user_message = "Nao foi possivel conectar ao SQL Server."


class SQLServerQueryError(SQLServerIntegrationError):
    user_message = "A consulta do SQL Server falhou."


class SQLServerTimeoutError(SQLServerIntegrationError):
    user_message = "A consulta ao SQL Server excedeu o tempo limite."


class SQLServerEmptyResultError(SQLServerIntegrationError):
    user_message = "A consulta ao SQL Server nao retornou registros."


class SQLServerInvalidIdError(SQLServerIntegrationError):
    user_message = "Informe apenas IDs numericos para consultar o SQL Server."


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
    return (
        f"DRIVER={{{settings.sqlserver_driver}}};"
        f"SERVER={settings.sqlserver_host},{settings.sqlserver_port};"
        f"DATABASE={settings.sqlserver_database};"
        f"{authentication}"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust_certificate};"
        f"Connection Timeout={settings.sqlserver_connection_timeout_seconds};"
    )


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
    if "login" in message or "server" in message or "network" in message or "connection" in message:
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
FROM advise.RegistroHorario AS Lancamento WITH (NOLOCK)
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
