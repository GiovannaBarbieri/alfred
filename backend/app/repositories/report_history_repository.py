from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from psycopg import Connection


GENERAL_INDICATORS_REPORT_TYPE = "GENERAL_INDICATORS"
PROCESSING_CONSULTATION_STATUSES = {
    "CONSULTANDO",
    "ATUALIZANDO_PENDENCIAS",
    "REFAZENDO_CONSULTA",
    "FINALIZANDO",
}

_SUMMARY_COLUMNS = """
    History.id,
    History.source_consultation_id,
    History.report_type,
    History.period_key,
    History.display_name,
    History.version_number,
    History.report_status,
    History.is_current,
    History.superseded_by_id,
    (
        SELECT Previous.id
        FROM report_history AS Previous
        WHERE Previous.superseded_by_id = History.id
        ORDER BY Previous.version_number DESC
        LIMIT 1
    ) AS supersedes_id,
    History.superseded_at,
    History.archived_at,
    History.archived_by,
    History.period_start,
    History.period_end,
    History.created_at,
    History.finalized_at,
    History.created_by,
    History.finalized_by,
    History.current_selected_at,
    History.current_selected_by,
    History.total_hours,
    History.considered_launch_count,
    History.excluded_collaborator_count,
    History.projects_improvements_percentage,
    History.projects_improvements_status,
    History.errors_bugs_percentage,
    History.errors_bugs_status,
    History.snapshot_contract_version,
    History.result_hash
"""


def _register_legacy_annual_general_indicator_report(
    connection: Connection,
    *,
    consultation: dict[str, Any],
    result: dict[str, Any],
) -> dict[str, Any]:
    start_date = consultation["data_inicial"]
    end_date = consultation["data_final"]
    report_year = start_date.year
    period_key = f"{GENERAL_INDICATORS_REPORT_TYPE}:{report_year}"
    summary = dict(result.get("summary") or {})
    kpis = dict(result.get("kpis") or {})
    projects_kpi = dict(kpis.get("projectsImprovements") or {})
    errors_kpi = dict(kpis.get("errorsBugs") or {})
    metadata = dict(result.get("metadata") or {})
    integrity = dict(result.get("integrity") or {})

    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (period_key,))
        cursor.execute(
            """
            SELECT id, current_revision_id, current_period_end
            FROM general_indicator_annual_reports
            WHERE (
                %s::BIGINT IS NOT NULL AND id = %s::BIGINT
            ) OR (
                %s::BIGINT IS NULL AND report_type = %s AND report_year = %s
            )
            FOR UPDATE
            """,
            (
                consultation.get("annual_report_id"),
                consultation.get("annual_report_id"),
                consultation.get("annual_report_id"),
                GENERAL_INDICATORS_REPORT_TYPE,
                report_year,
            ),
        )
        annual = cursor.fetchone()
        if annual is None:
            cursor.execute(
                """
                INSERT INTO general_indicator_annual_reports (
                    report_type, report_year, display_name,
                    current_period_start, current_period_end,
                    created_at, updated_at, created_by, last_updated_by
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, current_revision_id, current_period_end
                """,
                (
                    GENERAL_INDICATORS_REPORT_TYPE,
                    report_year,
                    general_indicator_display_name(start_date, end_date),
                    date(report_year, 1, 1),
                    end_date,
                    consultation["criado_em"],
                    consultation["finalizado_em"],
                    consultation.get("iniciado_por") or metadata.get("initiatedBy"),
                    consultation.get("finalizado_por") or metadata.get("finalizedBy"),
                ),
            )
            annual = cursor.fetchone()
        elif end_date <= annual["current_period_end"]:
            raise ValueError("A nova data final deve ser posterior ao período atual do relatório anual.")

        annual_report_id = int(annual["id"])
        current_revision_id = annual.get("current_revision_id")
        cursor.execute(
            """
            SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
            FROM report_history
            WHERE annual_report_id = %s
            """,
            (annual_report_id,),
        )
        version_number = int(cursor.fetchone()["next_version"])
        if current_revision_id:
            cursor.execute(
                """
                UPDATE report_history
                SET report_status = 'SUPERSEDED',
                    is_current = FALSE,
                    superseded_at = %s
                WHERE id = %s
                """,
                (consultation["finalizado_em"], current_revision_id),
            )
        cursor.execute(
            """
            INSERT INTO report_history (
                report_type, source_consultation_id, period_start, period_end, period_key,
                display_name, version_number, report_status, is_current,
                created_at, finalized_at, created_by, finalized_by,
                total_hours, considered_launch_count, excluded_collaborator_count,
                projects_improvements_percentage, projects_improvements_status,
                errors_bugs_percentage, errors_bugs_status,
                snapshot_contract_version, result_hash,
                annual_report_id, previous_revision_id
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, %s, 'CURRENT', TRUE,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                GENERAL_INDICATORS_REPORT_TYPE,
                consultation["id"],
                start_date,
                end_date,
                period_key,
                f"Indicadores Gerais — {report_year}",
                version_number,
                consultation["criado_em"],
                consultation["finalizado_em"],
                consultation.get("iniciado_por") or metadata.get("initiatedBy"),
                consultation.get("finalizado_por") or metadata.get("finalizedBy"),
                Decimal(str(result.get("totalHours") or 0)),
                int(summary.get("consideredLaunchCount") or result.get("recordCount") or 0),
                int(summary.get("excludedCollaboratorCount") or 0),
                _decimal_or_none(projects_kpi.get("percentage")),
                projects_kpi.get("status"),
                _decimal_or_none(errors_kpi.get("percentage")),
                errors_kpi.get("status"),
                int(result.get("contractVersion") or metadata.get("resultContractVersion") or 1),
                integrity.get("resultHash"),
                annual_report_id,
                current_revision_id,
            ),
        )
        report_id = int(cursor.fetchone()["id"])
        if current_revision_id:
            cursor.execute(
                "UPDATE report_history SET superseded_by_id = %s WHERE id = %s",
                (report_id, current_revision_id),
            )
        cursor.execute(
            """
            UPDATE general_indicator_annual_reports
            SET current_revision_id = %s,
                active_consultation_id = NULL,
                current_period_end = %s,
                updated_at = %s,
                last_updated_by = %s
            WHERE id = %s
            """,
            (
                report_id,
                end_date,
                consultation["finalizado_em"],
                consultation.get("finalizado_por") or metadata.get("finalizedBy"),
                annual_report_id,
            ),
        )
        cursor.execute(
            "UPDATE general_indicator_consultations SET annual_report_id = %s WHERE id = %s",
            (annual_report_id, consultation["id"]),
        )
    report = get_report_history_detail(connection, report_id)
    if report is None:
        raise RuntimeError("O relatório finalizado não pôde ser registrado no histórico.")
    return report


def register_finalized_general_indicator_report(
    connection: Connection,
    *,
    consultation: dict[str, Any],
    result: dict[str, Any],
    report_name: str | None = None,
) -> dict[str, Any]:
    """Persist one immutable saved report for one finalized consultation."""
    start_date = consultation["data_inicial"]
    end_date = consultation["data_final"]
    report_year = start_date.year
    report_name = report_name or general_indicator_display_name(start_date, end_date)
    period_key = f"{GENERAL_INDICATORS_REPORT_TYPE}:consultation:{consultation['id']}"
    summary = dict(result.get("summary") or {})
    kpis = dict(result.get("kpis") or {})
    projects_kpi = dict(kpis.get("projectsImprovements") or {})
    errors_kpi = dict(kpis.get("errorsBugs") or {})
    metadata = dict(result.get("metadata") or {})
    integrity = dict(result.get("integrity") or {})

    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (period_key,))
        cursor.execute(
            """
            INSERT INTO general_indicator_annual_reports (
                report_type, report_year, display_name,
                current_period_start, current_period_end,
                created_at, updated_at, created_by, last_updated_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                GENERAL_INDICATORS_REPORT_TYPE,
                report_year,
                report_name,
                start_date,
                end_date,
                consultation["criado_em"],
                consultation["finalizado_em"],
                consultation.get("iniciado_por") or metadata.get("initiatedBy"),
                consultation.get("finalizado_por") or metadata.get("finalizedBy"),
            ),
        )
        saved_report_id = int(cursor.fetchone()["id"])
        cursor.execute(
            """
            INSERT INTO report_history (
                report_type, source_consultation_id, period_start, period_end, period_key,
                display_name, version_number, report_status, is_current,
                created_at, finalized_at, created_by, finalized_by,
                total_hours, considered_launch_count, excluded_collaborator_count,
                projects_improvements_percentage, projects_improvements_status,
                errors_bugs_percentage, errors_bugs_status,
                snapshot_contract_version, result_hash,
                annual_report_id, previous_revision_id
            )
            VALUES (
                %s, %s, %s, %s, %s,
                %s, 1, 'CURRENT', TRUE,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, NULL
            )
            RETURNING id
            """,
            (
                GENERAL_INDICATORS_REPORT_TYPE,
                consultation["id"],
                start_date,
                end_date,
                period_key,
                report_name,
                consultation["criado_em"],
                consultation["finalizado_em"],
                consultation.get("iniciado_por") or metadata.get("initiatedBy"),
                consultation.get("finalizado_por") or metadata.get("finalizedBy"),
                Decimal(str(result.get("totalHours") or 0)),
                int(summary.get("consideredLaunchCount") or result.get("recordCount") or 0),
                int(summary.get("excludedCollaboratorCount") or 0),
                _decimal_or_none(projects_kpi.get("percentage")),
                projects_kpi.get("status"),
                _decimal_or_none(errors_kpi.get("percentage")),
                errors_kpi.get("status"),
                int(result.get("contractVersion") or metadata.get("resultContractVersion") or 1),
                integrity.get("resultHash"),
                saved_report_id,
            ),
        )
        history_id = int(cursor.fetchone()["id"])
        cursor.execute(
            """
            UPDATE general_indicator_annual_reports
            SET current_revision_id = %s
            WHERE id = %s
            """,
            (history_id, saved_report_id),
        )
        cursor.execute(
            "UPDATE general_indicator_consultations SET annual_report_id = %s WHERE id = %s",
            (saved_report_id, consultation["id"]),
        )

    report = get_report_history_detail(connection, history_id)
    if report is None:
        raise RuntimeError("O relatório finalizado não pôde ser registrado no histórico.")
    return {**report, "annual_report_id": saved_report_id}


def list_report_history(
    connection: Connection,
    *,
    report_type: str,
    report_status: str,
    year: int | None,
    start_date: date | None,
    end_date: date | None,
    search: str | None,
    generated_from: date | None,
    generated_to: date | None,
    offset: int,
    limit: int,
) -> tuple[list[dict[str, Any]], int]:
    conditions = ["History.report_type = %s"]
    params: list[Any] = [report_type]
    if report_status != "ALL":
        conditions.append("History.report_status = %s")
        params.append(report_status)
    if year is not None:
        conditions.append("History.period_start <= %s AND History.period_end >= %s")
        params.extend((date(year, 12, 31), date(year, 1, 1)))
    if start_date is not None:
        conditions.append("History.period_start >= %s")
        params.append(start_date)
    if end_date is not None:
        conditions.append("History.period_end <= %s")
        params.append(end_date)
    if search:
        conditions.append("History.display_name ILIKE %s")
        params.append(f"%{search.strip()}%")
    if generated_from is not None:
        conditions.append("History.finalized_at::date >= %s")
        params.append(generated_from)
    if generated_to is not None:
        conditions.append("History.finalized_at::date <= %s")
        params.append(generated_to)
    where = " AND ".join(conditions)
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) AS total FROM report_history AS History WHERE {where}", params)
        total = int(cursor.fetchone()["total"])
        cursor.execute(
            f"""
            SELECT {_SUMMARY_COLUMNS}
            FROM report_history AS History
            WHERE {where}
            ORDER BY
                CASE WHEN History.is_current THEN 0 ELSE 1 END,
                History.finalized_at DESC,
                History.period_end DESC,
                History.id DESC
            OFFSET %s LIMIT %s
            """,
            [*params, offset, limit],
        )
        return list(cursor.fetchall()), total


def get_report_history_detail(connection: Connection, report_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT {_SUMMARY_COLUMNS}, Consultation.resultado AS snapshot,
                   Consultation.status AS consultation_status
            FROM report_history AS History
            INNER JOIN general_indicator_consultations AS Consultation
                ON Consultation.id = History.source_consultation_id
            WHERE History.id = %s
            FOR SHARE OF History, Consultation
            """,
            (report_id,),
        )
        return cursor.fetchone()


def delete_report_history(
    connection: Connection,
    report_id: int,
) -> dict[str, Any] | None:
    """Remove uma versão e toda a consulta de origem, sem promover outra versão."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT period_key
            FROM report_history
            WHERE id = %s
            """,
            (report_id,),
        )
        located = cursor.fetchone()
        if located is None:
            return None

        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (located["period_key"],))
        cursor.execute(
            """
            SELECT
                History.id,
                History.source_consultation_id,
                History.report_type,
                History.period_key,
                History.period_start,
                History.period_end,
                History.version_number,
                History.report_status,
                History.is_current,
                History.superseded_by_id,
                History.finalized_at,
                Consultation.status AS consultation_status
            FROM report_history AS History
            INNER JOIN general_indicator_consultations AS Consultation
                ON Consultation.id = History.source_consultation_id
            WHERE History.report_type = %s
              AND History.period_start = (
                  SELECT period_start FROM report_history WHERE id = %s
              )
              AND History.period_end = (
                  SELECT period_end FROM report_history WHERE id = %s
              )
            ORDER BY History.version_number
            FOR UPDATE OF History, Consultation
            """,
            (GENERAL_INDICATORS_REPORT_TYPE, report_id, report_id),
        )
        versions = list(cursor.fetchall())
        target = next((row for row in versions if int(row["id"]) == report_id), None)
        if target is None:
            return None
        consultation_status = str(target["consultation_status"])
        if consultation_status in PROCESSING_CONSULTATION_STATUSES:
            raise ValueError("A análise não pode ser excluída enquanto a consulta estiver em processamento.")
        if consultation_status != "FINALIZADA":
            raise ValueError("Somente análises finalizadas podem ser excluídas.")

        successor_id = target.get("superseded_by_id")
        valid_successor_ids = {
            int(row["id"])
            for row in versions
            if int(row["id"]) != report_id
            and int(row["version_number"]) > int(target["version_number"])
        }
        if successor_id is None or int(successor_id) not in valid_successor_ids:
            successor_id = None
        else:
            successor_id = int(successor_id)

        cursor.execute(
            """
            UPDATE report_history
            SET superseded_by_id = %s,
                superseded_at = CASE
                    WHEN %s::BIGINT IS NULL THEN NULL
                    ELSE (SELECT finalized_at FROM report_history WHERE id = %s::BIGINT)
                END
            WHERE superseded_by_id = %s
            """,
            (successor_id, successor_id, successor_id, report_id),
        )
        cursor.execute("DELETE FROM report_history WHERE id = %s", (report_id,))
        cursor.execute(
            """
            DELETE FROM audit_log
            WHERE (
                entidade = 'general_indicator_consultation'
                AND registro_id = %s
            )
               OR (
                    entidade IN ('general_indicator_report', 'report_history')
                    AND registro_id = %s
               )
            """,
            (str(target["source_consultation_id"]), str(report_id)),
        )
        cursor.execute(
            "DELETE FROM general_indicator_consultations WHERE id = %s",
            (target["source_consultation_id"],),
        )

    previous_versions = [
        {
            "id": int(row["id"]),
            "version_number": int(row["version_number"]),
            "report_status": row["report_status"],
            "finalized_at": row["finalized_at"],
        }
        for row in versions
        if int(row["id"]) != report_id
        and int(row["version_number"]) < int(target["version_number"])
    ]
    return {
        "id": report_id,
        "source_consultation_id": int(target["source_consultation_id"]),
        "report_type": target["report_type"],
        "period_start": target["period_start"],
        "period_end": target["period_end"],
        "version_number": int(target["version_number"]),
        "was_current": bool(target["is_current"]),
        "previous_versions": previous_versions,
        "deleted_at": datetime.now(timezone.utc),
    }


def make_report_history_current(
    connection: Connection,
    report_id: int,
    *,
    actor: str | None,
) -> dict[str, Any] | None:
    report = get_report_history_detail(connection, report_id)
    if report is None:
        return None
    if report["consultation_status"] != "FINALIZADA":
        raise ValueError("Somente análises finalizadas podem se tornar vigentes.")
    if report["report_status"] == "ARCHIVED":
        raise ValueError("Uma análise arquivada não pode se tornar vigente.")
    if report["is_current"]:
        return report
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (report["period_key"],))
        cursor.execute(
            """
            SELECT id, report_status, is_current, archived_at
            FROM report_history
            WHERE report_type = %s AND period_start = %s AND period_end = %s
            FOR UPDATE
            """,
            (report["report_type"], report["period_start"], report["period_end"]),
        )
        locked_versions = cursor.fetchall()
        locked_target = next((item for item in locked_versions if int(item["id"]) == report_id), None)
        if locked_target is None:
            return None
        if locked_target["report_status"] == "ARCHIVED" or locked_target["archived_at"] is not None:
            raise ValueError("Uma análise arquivada não pode se tornar vigente.")
        if locked_target["is_current"]:
            return get_report_history_detail(connection, report_id)
        cursor.execute(
            """
            UPDATE report_history
            SET superseded_by_id = NULL, superseded_at = NULL
            WHERE id = %s AND archived_at IS NULL
            """,
            (report_id,),
        )
        cursor.execute(
            """
            UPDATE report_history
            SET report_status = 'SUPERSEDED', is_current = FALSE,
                superseded_by_id = %s, superseded_at = NOW()
            WHERE report_type = %s AND period_start = %s AND period_end = %s
              AND is_current = TRUE AND archived_at IS NULL AND id <> %s
            """,
            (report_id, report["report_type"], report["period_start"], report["period_end"], report_id),
        )
        cursor.execute(
            """
            UPDATE report_history
            SET report_status = 'CURRENT', is_current = TRUE,
                superseded_by_id = NULL, superseded_at = NULL,
                current_selected_at = NOW(), current_selected_by = %s
            WHERE id = %s AND archived_at IS NULL
            """,
            (actor, report_id),
        )
    return get_report_history_detail(connection, report_id)


def archive_report_history(
    connection: Connection,
    report_id: int,
    *,
    actor: str | None,
) -> dict[str, Any] | None:
    report = get_report_history_detail(connection, report_id)
    if report is None:
        return None
    if report["report_status"] == "ARCHIVED":
        return report
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (report["period_key"],))
        cursor.execute(
            """
            UPDATE report_history
            SET report_status = 'ARCHIVED', is_current = FALSE,
                archived_at = NOW(), archived_by = %s
            WHERE id = %s AND archived_at IS NULL
            """,
            (actor, report_id),
        )
    return get_report_history_detail(connection, report_id)


_ANNUAL_REPORT_COLUMNS = """
    Annual.id,
    Annual.report_type,
    Annual.report_year,
    Annual.display_name,
    Annual.current_revision_id,
    Annual.active_consultation_id,
    Annual.current_period_start,
    Annual.current_period_end,
    Annual.created_at,
    Annual.updated_at,
    Annual.created_by,
    Annual.last_updated_by,
    Revision.source_consultation_id,
    Revision.version_number,
    Revision.previous_revision_id,
    Revision.finalized_at,
    Revision.total_hours,
    Revision.considered_launch_count,
    Revision.excluded_collaborator_count,
    Revision.projects_improvements_percentage,
    Revision.projects_improvements_status,
    Revision.errors_bugs_percentage,
    Revision.errors_bugs_status,
    Revision.snapshot_contract_version,
    Revision.result_hash,
    Active.status AS active_status,
    Active.data_final AS requested_period_end,
    Active.criado_em AS update_created_at,
    Active.iniciado_por AS update_created_by,
    COALESCE((
        SELECT COUNT(*)
        FROM general_indicator_inconsistencies AS Issue
        WHERE Issue.consulta_id = Active.id
          AND Issue.ativa = TRUE
          AND Issue.impeditiva = TRUE
          AND Issue.status = 'ABERTA'
    ), 0) AS inconsistencies_count
"""


def list_annual_reports(
    connection: Connection,
    *,
    report_type: str,
    year: int | None,
    search: str | None,
    offset: int,
    limit: int,
) -> tuple[list[dict[str, Any]], int]:
    conditions = ["Annual.report_type = %s", "Annual.current_revision_id IS NOT NULL"]
    params: list[Any] = [report_type]
    if year is not None:
        conditions.append(
            "Revision.period_start <= make_date(%s, 12, 31) "
            "AND Revision.period_end >= make_date(%s, 1, 1)"
        )
        params.extend([year, year])
    if search:
        conditions.append("Annual.display_name ILIKE %s")
        params.append(f"%{search.strip()}%")
    where = " AND ".join(conditions)
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT COUNT(*) AS total
            FROM general_indicator_annual_reports AS Annual
            INNER JOIN report_history AS Revision ON Revision.id = Annual.current_revision_id
            WHERE {where}
            """,
            params,
        )
        total = int(cursor.fetchone()["total"])
        cursor.execute(
            f"""
            SELECT {_ANNUAL_REPORT_COLUMNS}
            FROM general_indicator_annual_reports AS Annual
            INNER JOIN report_history AS Revision ON Revision.id = Annual.current_revision_id
            LEFT JOIN general_indicator_consultations AS Active ON Active.id = Annual.active_consultation_id
            WHERE {where}
            ORDER BY Revision.finalized_at DESC, Annual.id DESC
            OFFSET %s LIMIT %s
            """,
            [*params, offset, limit],
        )
        return list(cursor.fetchall()), total


def get_annual_report_detail(connection: Connection, report_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT {_ANNUAL_REPORT_COLUMNS},
                   CurrentConsultation.resultado - 'audit' AS snapshot,
                   COALESCE(
                       jsonb_array_length(CurrentConsultation.resultado -> 'audit'),
                       0
                   ) AS audit_total,
                   (
                       SELECT COUNT(*)
                       FROM report_history AS History
                       WHERE History.annual_report_id = Annual.id
                   ) AS revision_count
            FROM general_indicator_annual_reports AS Annual
            INNER JOIN report_history AS Revision ON Revision.id = Annual.current_revision_id
            INNER JOIN general_indicator_consultations AS CurrentConsultation
                ON CurrentConsultation.id = Revision.source_consultation_id
            LEFT JOIN general_indicator_consultations AS Active ON Active.id = Annual.active_consultation_id
            WHERE Annual.id = %s
            FOR SHARE OF Annual, Revision, CurrentConsultation
            """,
            (report_id,),
        )
        return cursor.fetchone()


def get_annual_report_period_analysis_source(
    connection: Connection,
    report_id: int,
) -> dict[str, Any] | None:
    """Load the immutable current snapshot only for server-side period analysis."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                Annual.id,
                Annual.display_name,
                Revision.period_start,
                Revision.period_end,
                Revision.source_consultation_id,
                CurrentConsultation.resultado AS snapshot
            FROM general_indicator_annual_reports AS Annual
            INNER JOIN report_history AS Revision ON Revision.id = Annual.current_revision_id
            INNER JOIN general_indicator_consultations AS CurrentConsultation
                ON CurrentConsultation.id = Revision.source_consultation_id
            WHERE Annual.id = %s
            FOR SHARE OF Annual, Revision, CurrentConsultation
            """,
            (report_id,),
        )
        return cursor.fetchone()


def begin_annual_report_update(
    connection: Connection,
    report_id: int,
    *,
    new_period_end: date,
    actor: str | None,
    hierarchy_contract_version: int,
) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
            (f"{GENERAL_INDICATORS_REPORT_TYPE}:annual:{report_id}",),
        )
        cursor.execute(
            """
            SELECT id, report_year, current_period_start, current_period_end, active_consultation_id
            FROM general_indicator_annual_reports
            WHERE id = %s
            FOR UPDATE
            """,
            (report_id,),
        )
        annual = cursor.fetchone()
        if annual is None:
            return None
        if new_period_end.year != int(annual["report_year"]):
            raise ValueError("A nova data final deve pertencer ao mesmo ano do relatório.")
        if new_period_end <= annual["current_period_end"]:
            raise ValueError("A nova data final deve ser posterior ao período atual do relatório anual.")
        if annual.get("active_consultation_id"):
            cursor.execute(
                "SELECT status FROM general_indicator_consultations WHERE id = %s FOR UPDATE",
                (annual["active_consultation_id"],),
            )
            active = cursor.fetchone()
            if active and active["status"] not in {"FINALIZADA", "ERRO"}:
                raise ValueError("Já existe uma atualização em andamento para este relatório anual.")
        cursor.execute(
            """
            INSERT INTO general_indicator_consultations (
                data_inicial, data_final, status, hierarchy_contract_version,
                annual_report_id, iniciado_por
            )
            VALUES (%s, %s, 'CONSULTANDO', %s, %s, %s)
            RETURNING id, criado_em
            """,
            (
                annual["current_period_start"],
                new_period_end,
                hierarchy_contract_version,
                report_id,
                actor,
            ),
        )
        consultation = cursor.fetchone()
        cursor.execute(
            """
            UPDATE general_indicator_annual_reports
            SET active_consultation_id = %s
            WHERE id = %s
            """,
            (consultation["id"], report_id),
        )
        return {
            "report_id": report_id,
            "consultation_id": int(consultation["id"]),
            "period_start": annual["current_period_start"],
            "period_end": new_period_end,
            "created_at": consultation["criado_em"],
        }


def get_annual_report_update(connection: Connection, report_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                Annual.id,
                Annual.current_period_end,
                Consultation.id AS consultation_id,
                Consultation.status,
                Consultation.data_final AS requested_period_end,
                Consultation.criado_em,
                Consultation.iniciado_por,
                COALESCE((
                    SELECT COUNT(*)
                    FROM general_indicator_inconsistencies AS Issue
                    WHERE Issue.consulta_id = Consultation.id
                      AND Issue.ativa = TRUE
                      AND Issue.impeditiva = TRUE
                      AND Issue.status = 'ABERTA'
                ), 0) AS inconsistencies_count
            FROM general_indicator_annual_reports AS Annual
            LEFT JOIN general_indicator_consultations AS Consultation
                ON Consultation.id = Annual.active_consultation_id
            WHERE Annual.id = %s
            """,
            (report_id,),
        )
        return cursor.fetchone()


def list_annual_report_revisions(connection: Connection, report_id: int) -> list[dict[str, Any]] | None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT id FROM general_indicator_annual_reports WHERE id = %s", (report_id,))
        if cursor.fetchone() is None:
            return None
        cursor.execute(
            """
            SELECT id, source_consultation_id, version_number, period_start, period_end,
                   finalized_at, COALESCE(finalized_by, created_by) AS created_by,
                   previous_revision_id
            FROM report_history
            WHERE annual_report_id = %s
            ORDER BY version_number DESC
            """,
            (report_id,),
        )
        return list(cursor.fetchall())


def delete_annual_report(connection: Connection, report_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, report_type, report_year, active_consultation_id
            FROM general_indicator_annual_reports
            WHERE id = %s
            FOR UPDATE
            """,
            (report_id,),
        )
        annual = cursor.fetchone()
        if annual is None:
            return None
        cursor.execute(
            """
            SELECT id, status
            FROM general_indicator_consultations
            WHERE annual_report_id = %s
            FOR UPDATE
            """,
            (report_id,),
        )
        consultations = list(cursor.fetchall())
        if any(row["status"] in PROCESSING_CONSULTATION_STATUSES for row in consultations):
            raise ValueError("O relatório não pode ser excluído enquanto existe uma atualização em processamento.")
        consultation_ids = [int(row["id"]) for row in consultations]
        cursor.execute(
            "SELECT COUNT(*) AS total FROM report_history WHERE annual_report_id = %s",
            (report_id,),
        )
        revision_count = int(cursor.fetchone()["total"])
        cursor.execute(
            """
            UPDATE general_indicator_annual_reports
            SET current_revision_id = NULL, active_consultation_id = NULL
            WHERE id = %s
            """,
            (report_id,),
        )
        cursor.execute(
            """
            DELETE FROM audit_log
            WHERE (
                entidade IN ('general_indicator_report', 'report_history')
                AND registro_id IN (
                    SELECT id::TEXT FROM report_history WHERE annual_report_id = %s
                )
            ) OR (
                entidade = 'general_indicator_consultation'
                AND registro_id IN (
                    SELECT id::TEXT FROM general_indicator_consultations WHERE annual_report_id = %s
                )
            )
            """,
            (report_id, report_id),
        )
        cursor.execute("DELETE FROM report_history WHERE annual_report_id = %s", (report_id,))
        cursor.execute("DELETE FROM general_indicator_consultations WHERE annual_report_id = %s", (report_id,))
        cursor.execute("DELETE FROM general_indicator_annual_reports WHERE id = %s", (report_id,))
    return {
        "id": report_id,
        "report_type": annual["report_type"],
        "report_year": int(annual["report_year"]),
        "revision_count": revision_count,
        "consultation_count": len(consultation_ids),
        "deleted_at": datetime.now(timezone.utc),
    }


def general_indicator_display_name(start_date: date, end_date: date) -> str:
    return f"Indicadores Gerais — {start_date.year}"


def _period_key(report_type: str, start_date: date, end_date: date) -> str:
    return f"{report_type}:{start_date.isoformat()}:{end_date.isoformat()}"


def _decimal_or_none(value: Any) -> Decimal | None:
    return Decimal(str(value)) if value is not None else None
