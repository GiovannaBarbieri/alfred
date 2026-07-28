from __future__ import annotations

import json
from datetime import date
from typing import Any

from psycopg import Connection

from app.core.config import settings
from app.repositories.report_history_repository import register_finalized_general_indicator_report


_PROCESSING_STATUSES = {"CONSULTANDO", "ATUALIZANDO_PENDENCIAS", "REFAZENDO_CONSULTA", "FINALIZANDO"}
HIERARCHY_CONTRACT_VERSION = 2


def list_general_indicator_distribution_weights(connection: Connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT category_name, distribution_weight, active
            FROM general_indicator_distribution_weights
            ORDER BY category_name
            """
        )
        return list(cursor.fetchall())


def list_nonparticipating_general_indicator_logins(connection: Connection) -> set[str]:
    """Retorna o snapshot configurado para exclusÃ£o da prÃ³xima consulta completa."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT login_usuario
            FROM perfis_colaborador
            WHERE ativo = TRUE AND participa_indicadores_gerais = FALSE
            """
        )
        return {
            str(row["login_usuario"] or "").strip().casefold()
            for row in cursor.fetchall()
            if str(row["login_usuario"] or "").strip()
        }


def create_general_indicator_consultation(
    connection: Connection,
    *,
    start_date: date,
    end_date: date,
    annual_report_id: int | None = None,
    actor: str | None = None,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO general_indicator_consultations (
                data_inicial, data_final, status, hierarchy_contract_version,
                annual_report_id, iniciado_por
            )
            VALUES (%s, %s, 'CONSULTANDO', %s, %s, %s)
            RETURNING id
            """,
            (start_date, end_date, HIERARCHY_CONTRACT_VERSION, annual_report_id, actor),
        )
        return int(cursor.fetchone()["id"])


def update_general_indicator_consultation_progress(
    connection: Connection,
    consultation_id: int,
    *,
    progress: dict[str, Any],
) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET resumo = COALESCE(resumo, '{}'::jsonb) || %s::jsonb,
                atualizado_em = NOW()
            WHERE id = %s AND status = 'CONSULTANDO'
            """,
            (json.dumps({"processing": progress}, ensure_ascii=False, default=str), consultation_id),
        )
        return cursor.rowcount == 1


def mark_stale_general_indicator_consultation_error(
    connection: Connection,
    consultation_id: int,
) -> bool:
    message = "A consulta assíncrona expirou antes de concluir. Execute uma nova consulta."
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = 'ERRO', mensagem_erro = %s, atualizado_em = NOW()
            WHERE id = %s
              AND status = 'CONSULTANDO'
              AND atualizado_em < NOW() - (%s * INTERVAL '1 second')
            """,
            (message, consultation_id, settings.general_indicator_processing_timeout_seconds),
        )
        return cursor.rowcount == 1


def save_general_indicator_validation(
    connection: Connection,
    consultation_id: int,
    validation: dict[str, Any],
) -> None:
    launches = validation.get("launches", [])
    issues = validation.get("inconsistencies", {}).get("items", [])
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT status
            FROM general_indicator_consultations
            WHERE id = %s
            FOR UPDATE
            """,
            (consultation_id,),
        )
        consultation = cursor.fetchone()
        if consultation is None:
            raise ValueError("Consulta de indicadores não encontrada.")
        if consultation["status"] == "FINALIZADA":
            raise ValueError("Uma consulta finalizada não pode ter seus lançamentos alterados.")
        cursor.execute(
            """
            UPDATE general_indicator_inconsistencies
            SET
                ativa = FALSE,
                status = CASE WHEN status = 'ABERTA' THEN 'SUPERADA' ELSE status END,
                ultima_validacao_em = NOW()
            WHERE consulta_id = %s AND ativa = TRUE
            """,
            (consultation_id,),
        )
        cursor.execute("DELETE FROM general_indicator_launches WHERE consulta_id = %s", (consultation_id,))
        if launches:
            cursor.executemany(
                """
                INSERT INTO general_indicator_launches (
                    consulta_id,
                    id_lancamento,
                    id_task,
                    id_pai,
                    tipo_pai,
                    id_feature,
                    categoria_validada,
                    estado_validacao,
                    duracao_horas,
                    dados_tecnicos
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                [
                    (
                        consultation_id,
                        launch.get("idLancamento"),
                        launch.get("idTask"),
                        launch.get("idParent"),
                        launch.get("parentWorkItemType"),
                        launch.get("idFeature"),
                        launch.get("validatedCategory"),
                        launch.get("validationState"),
                        launch.get("durationHours"),
                        json.dumps(launch, ensure_ascii=False, default=str),
                    )
                    for launch in launches
                ],
            )
        if issues:
            cursor.executemany(
                """
                INSERT INTO general_indicator_inconsistencies (
                    consulta_id,
                    id_lancamento,
                    id_feature,
                    tipo,
                    severidade,
                    escopo,
                    texto_original,
                    descricao,
                    impeditiva,
                    tratamento,
                    status,
                    ativa,
                    detalhes,
                    ultima_validacao_em
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s::jsonb, NOW())
                """,
                [
                    (
                        consultation_id,
                        issue.get("idLancamento"),
                        issue.get("idFeature"),
                        issue["type"],
                        issue["severity"],
                        issue["scope"],
                        issue.get("originalText"),
                        issue["message"],
                        bool(issue["blocking"]),
                        issue.get("treatment"),
                        issue["status"],
                        json.dumps(
                            {
                                **issue.get("details", {}),
                                "affectedLaunchIds": issue.get("affectedLaunchIds", []),
                            },
                            ensure_ascii=False,
                            default=str,
                        ),
                    )
                    for issue in issues
                ],
            )
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET
                status = %s,
                resumo = %s::jsonb,
                mensagem_erro = NULL,
                atualizado_em = NOW(),
                ultima_validacao_em = NOW(),
                hierarchy_contract_version = %s
            WHERE id = %s
            """,
            (
                validation["status"],
                json.dumps(validation.get("summary", {}), ensure_ascii=False, default=str),
                int(validation.get("summary", {}).get("hierarchyContractVersion", HIERARCHY_CONTRACT_VERSION)),
                consultation_id,
            ),
        )


def get_general_indicator_consultation(connection: Connection, consultation_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, data_inicial, data_final, status, resumo, resultado, mensagem_erro,
                   criado_em, atualizado_em, ultima_validacao_em, finalizado_em,
                   hierarchy_contract_version, resultado_versao, iniciado_por, finalizado_por,
                   calculo_versao, classificacao_versao, distribuicao_versao, metas_versao,
                   backend_build, snapshot_hash, resultado_hash,
                   annual_report_id
            FROM general_indicator_consultations
            WHERE id = %s
            """,
            (consultation_id,),
        )
        return cursor.fetchone()


def begin_general_indicator_finalization(connection: Connection, consultation_id: int) -> dict[str, Any]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, status, resultado, hierarchy_contract_version, annual_report_id,
                   atualizado_em < NOW() - (%s * INTERVAL '1 second') AS processing_expired
            FROM general_indicator_consultations
            WHERE id = %s
            FOR UPDATE
            """,
            (settings.general_indicator_processing_timeout_seconds, consultation_id),
        )
        consultation = cursor.fetchone()
        if consultation is None:
            return {"acquired": False, "reason": "not_found"}
        status = str(consultation["status"])
        if status in _PROCESSING_STATUSES and bool(consultation.get("processing_expired")):
            status = _recover_expired_general_indicator_processing(cursor, consultation_id, status)
        if status == "FINALIZADA":
            return {
                "acquired": False,
                "reason": "finalized",
                "result": consultation["resultado"],
                "reportId": consultation.get("annual_report_id"),
            }
        if status in _PROCESSING_STATUSES:
            return {"acquired": False, "reason": "concurrent"}
        if int(consultation.get("hierarchy_contract_version") or 1) < HIERARCHY_CONTRACT_VERSION:
            return {"acquired": False, "reason": "hierarchy_outdated"}
        if status != "PRONTA_PARA_FINALIZAR":
            return {"acquired": False, "reason": "not_ready"}
        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM general_indicator_inconsistencies
            WHERE consulta_id = %s AND ativa = TRUE AND impeditiva = TRUE AND status = 'ABERTA'
            """,
            (consultation_id,),
        )
        if int(cursor.fetchone()["total"]) > 0:
            return {"acquired": False, "reason": "not_ready"}
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = 'FINALIZANDO', mensagem_erro = NULL, atualizado_em = NOW()
            WHERE id = %s
            """,
            (consultation_id,),
        )
        return {"acquired": True}


def complete_general_indicator_finalization(
    connection: Connection,
    consultation_id: int,
    *,
    result: dict[str, Any],
    report_name: str = "Indicadores Gerais",
) -> int | None:
    metadata = dict(result.get("metadata") or {})
    integrity = dict(result.get("integrity") or {})
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = 'FINALIZADA', resultado = %s::jsonb, mensagem_erro = NULL,
                atualizado_em = NOW(), finalizado_em = NOW(),
                resultado_versao = %s,
                iniciado_por = COALESCE(iniciado_por, %s),
                finalizado_por = %s,
                calculo_versao = %s,
                classificacao_versao = %s,
                distribuicao_versao = %s,
                metas_versao = %s,
                backend_build = %s,
                snapshot_hash = %s,
                resultado_hash = %s
            WHERE id = %s AND status = 'FINALIZANDO' AND resultado IS NULL
            RETURNING id, data_inicial, data_final, criado_em, finalizado_em,
                      iniciado_por, finalizado_por, annual_report_id
            """,
            (
                json.dumps(result, ensure_ascii=False, default=str),
                int(result.get("contractVersion") or metadata.get("resultContractVersion") or 1),
                metadata.get("initiatedBy"),
                metadata.get("finalizedBy"),
                metadata.get("calculationVersion"),
                metadata.get("classificationVersion"),
                metadata.get("distributionRulesVersion"),
                metadata.get("targetsVersion"),
                metadata.get("backendBuild"),
                integrity.get("launchSnapshotHash"),
                integrity.get("resultHash"),
                consultation_id,
            ),
        )
        if cursor.rowcount != 1:
            return None
        consultation = cursor.fetchone()
    registered_report = register_finalized_general_indicator_report(
        connection,
        consultation=consultation,
        result=result,
        report_name=report_name,
    )
    return int(registered_report["annual_report_id"])


def fail_general_indicator_finalization(
    connection: Connection,
    consultation_id: int,
    *,
    message: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = 'PRONTA_PARA_FINALIZAR', mensagem_erro = %s, atualizado_em = NOW()
            WHERE id = %s AND status = 'FINALIZANDO'
            """,
            (message, consultation_id),
        )


def list_general_indicator_launches(connection: Connection, consultation_id: int) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT dados_tecnicos
            FROM general_indicator_launches
            WHERE consulta_id = %s
            ORDER BY id
            """,
            (consultation_id,),
        )
        return [dict(row["dados_tecnicos"]) for row in cursor.fetchall()]


def list_general_indicator_launches_page(
    connection: Connection,
    consultation_id: int,
    *,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT dados_tecnicos
            FROM general_indicator_launches
            WHERE consulta_id = %s
            ORDER BY id
            OFFSET %s LIMIT %s
            """,
            (consultation_id, offset, limit),
        )
        return [dict(row["dados_tecnicos"]) for row in cursor.fetchall()]


def list_general_indicator_inconsistency_history(
    connection: Connection,
    consultation_id: int,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, id_lancamento, id_feature, tipo, severidade, escopo, texto_original,
                   descricao, impeditiva, tratamento, status, ativa, detalhes,
                   criado_em, ultima_validacao_em
            FROM general_indicator_inconsistencies
            WHERE consulta_id = %s
            ORDER BY id
            """,
            (consultation_id,),
        )
        return [
            {
                "id": int(row["id"]),
                "idLancamento": row["id_lancamento"],
                "idFeature": row["id_feature"],
                "type": row["tipo"],
                "severity": row["severidade"],
                "scope": row["escopo"],
                "originalText": row["texto_original"],
                "message": row["descricao"],
                "blocking": bool(row["impeditiva"]),
                "treatment": row["tratamento"],
                "status": row["status"],
                "active": bool(row["ativa"]),
                "affectedLaunchIds": list((row["detalhes"] or {}).get("affectedLaunchIds", [])),
                "details": dict(row["detalhes"] or {}),
                "createdAt": row["criado_em"].isoformat(),
                "lastValidatedAt": row["ultima_validacao_em"].isoformat(),
            }
            for row in cursor.fetchall()
        ]


def list_active_blocking_inconsistencies(connection: Connection, consultation_id: int) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id_lancamento, id_feature, tipo, severidade, escopo, texto_original,
                   descricao, impeditiva, tratamento, status, detalhes
            FROM general_indicator_inconsistencies
            WHERE consulta_id = %s AND ativa = TRUE AND impeditiva = TRUE AND status = 'ABERTA'
            ORDER BY id
            """,
            (consultation_id,),
        )
        return [
            {
                "idLancamento": row["id_lancamento"],
                "idFeature": row["id_feature"],
                "type": row["tipo"],
                "severity": row["severidade"],
                "scope": row["escopo"],
                "originalText": row["texto_original"],
                "message": row["descricao"],
                "blocking": row["impeditiva"],
                "treatment": row["tratamento"],
                "status": row["status"],
                "affectedLaunchIds": list((row["detalhes"] or {}).get("affectedLaunchIds", [])),
                "details": dict(row["detalhes"] or {}),
            }
            for row in cursor.fetchall()
        ]


def list_active_general_indicator_inconsistencies(
    connection: Connection,
    consultation_id: int,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id_lancamento, id_feature, tipo, severidade, escopo, texto_original,
                   descricao, impeditiva, tratamento, status, detalhes
            FROM general_indicator_inconsistencies
            WHERE consulta_id = %s AND ativa = TRUE
            ORDER BY id
            """,
            (consultation_id,),
        )
        return [_inconsistency_row_to_payload(row) for row in cursor.fetchall()]


def begin_general_indicator_update(
    connection: Connection,
    consultation_id: int,
    *,
    update_type: str,
) -> dict[str, Any]:
    updating_status = "ATUALIZANDO_PENDENCIAS" if update_type == "SELETIVA" else "REFAZENDO_CONSULTA"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, status, hierarchy_contract_version,
                   atualizado_em < NOW() - (%s * INTERVAL '1 second') AS processing_expired
            FROM general_indicator_consultations
            WHERE id = %s
            FOR UPDATE
            """,
            (settings.general_indicator_processing_timeout_seconds, consultation_id),
        )
        consultation = cursor.fetchone()
        if consultation is None:
            return {"acquired": False, "reason": "not_found"}
        previous_status = str(consultation["status"])
        if previous_status in _PROCESSING_STATUSES and bool(consultation.get("processing_expired")):
            previous_status = _recover_expired_general_indicator_processing(
                cursor,
                consultation_id,
                previous_status,
            )
        if previous_status == "FINALIZADA":
            return {"acquired": False, "reason": "finalized", "previousStatus": previous_status}
        if previous_status in _PROCESSING_STATUSES:
            return {"acquired": False, "reason": "concurrent", "previousStatus": previous_status}
        if (
            update_type != "COMPLETA"
            and int(consultation.get("hierarchy_contract_version") or 1) < HIERARCHY_CONTRACT_VERSION
        ):
            return {"acquired": False, "reason": "hierarchy_outdated", "previousStatus": previous_status}
        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM general_indicator_inconsistencies
            WHERE consulta_id = %s AND ativa = TRUE AND impeditiva = TRUE AND status = 'ABERTA'
            """,
            (consultation_id,),
        )
        pending_before = int(cursor.fetchone()["total"])
        cursor.execute(
            """
            INSERT INTO general_indicator_updates (
                consulta_id, tipo, status, estado_anterior, pendencias_antes
            )
            VALUES (%s, %s, 'EM_EXECUCAO', %s, %s)
            RETURNING id
            """,
            (consultation_id, update_type, previous_status, pending_before),
        )
        update_id = int(cursor.fetchone()["id"])
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = %s, atualizado_em = NOW()
            WHERE id = %s
            """,
            (updating_status, consultation_id),
        )
        return {
            "acquired": True,
            "updateId": update_id,
            "previousStatus": previous_status,
            "pendingBefore": pending_before,
        }


def _recover_expired_general_indicator_processing(
    cursor: Any,
    consultation_id: int,
    expired_status: str,
) -> str:
    message = "O processamento anterior expirou e foi recuperado automaticamente."
    if expired_status == "FINALIZANDO":
        recovered_status = "PRONTA_PARA_FINALIZAR"
    elif expired_status in {"ATUALIZANDO_PENDENCIAS", "REFAZENDO_CONSULTA"}:
        cursor.execute(
            """
            SELECT id, estado_anterior
            FROM general_indicator_updates
            WHERE consulta_id = %s AND status = 'EM_EXECUCAO'
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
            """,
            (consultation_id,),
        )
        abandoned_update = cursor.fetchone()
        recovered_status = str(abandoned_update["estado_anterior"]) if abandoned_update else "ERRO"
        if abandoned_update:
            cursor.execute(
                """
                UPDATE general_indicator_updates
                SET status = 'ERRO', estado_resultante = %s, mensagem_erro = %s, finalizado_em = NOW()
                WHERE id = %s AND status = 'EM_EXECUCAO'
                """,
                (recovered_status, message, int(abandoned_update["id"])),
            )
    else:
        recovered_status = "ERRO"

    cursor.execute(
        """
        UPDATE general_indicator_consultations
        SET status = %s, mensagem_erro = %s, atualizado_em = NOW()
        WHERE id = %s AND status = %s
        """,
        (recovered_status, message, consultation_id, expired_status),
    )
    return recovered_status


def complete_general_indicator_update(
    connection: Connection,
    update_id: int,
    *,
    result: dict[str, Any],
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_updates
            SET
                status = 'CONCLUIDA',
                estado_resultante = %s,
                pendencias_resolvidas = %s,
                pendencias_abertas = %s,
                novas_inconsistencias = %s,
                features_reconsultadas = %s,
                lancamentos_revalidados = %s,
                resumo = %s::jsonb,
                finalizado_em = NOW()
            WHERE id = %s
            """,
            (
                result["status"],
                result["updateSummary"]["resolvedPendingCount"],
                result["updateSummary"]["remainingPendingCount"],
                result["updateSummary"]["newInconsistencyCount"],
                result["updateSummary"]["requeriedFeatureCount"],
                result["updateSummary"]["revalidatedLaunchCount"],
                json.dumps(result["updateSummary"], ensure_ascii=False, default=str),
                update_id,
            ),
        )


def is_general_indicator_update_active(
    connection: Connection,
    consultation_id: int,
    update_id: int,
) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT Atualizacao.id
            FROM general_indicator_updates AS Atualizacao
            INNER JOIN general_indicator_consultations AS Consulta
                ON Consulta.id = Atualizacao.consulta_id
            WHERE Atualizacao.id = %s
              AND Atualizacao.consulta_id = %s
              AND Atualizacao.status = 'EM_EXECUCAO'
              AND Consulta.status IN ('ATUALIZANDO_PENDENCIAS', 'REFAZENDO_CONSULTA')
            FOR UPDATE OF Atualizacao, Consulta
            """,
            (update_id, consultation_id),
        )
        return cursor.fetchone() is not None


def fail_general_indicator_update(
    connection: Connection,
    consultation_id: int,
    update_id: int,
    *,
    previous_status: str,
    message: str,
) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_updates
            SET status = 'ERRO', estado_resultante = %s, mensagem_erro = %s, finalizado_em = NOW()
            WHERE id = %s AND consulta_id = %s AND status = 'EM_EXECUCAO'
            """,
            (previous_status, message, update_id, consultation_id),
        )
        if cursor.rowcount != 1:
            return False
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = %s, mensagem_erro = %s, atualizado_em = NOW()
            WHERE id = %s AND status IN ('ATUALIZANDO_PENDENCIAS', 'REFAZENDO_CONSULTA')
            """,
            (previous_status, message, consultation_id),
        )
        return cursor.rowcount == 1


def mark_general_indicator_consultation_error(
    connection: Connection,
    consultation_id: int,
    *,
    message: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE general_indicator_consultations
            SET status = 'ERRO', mensagem_erro = %s, atualizado_em = NOW()
            WHERE id = %s
            """,
            (message, consultation_id),
        )


def _inconsistency_row_to_payload(row: dict[str, Any]) -> dict[str, Any]:
    details = dict(row["detalhes"] or {})
    return {
        "idLancamento": row["id_lancamento"],
        "idFeature": row["id_feature"],
        "type": row["tipo"],
        "severity": row["severidade"],
        "scope": row["escopo"],
        "originalText": row["texto_original"],
        "message": row["descricao"],
        "blocking": bool(row["impeditiva"]),
        "treatment": row["tratamento"],
        "status": row["status"],
        "affectedLaunchIds": list(details.get("affectedLaunchIds", [])),
        "details": details,
    }
