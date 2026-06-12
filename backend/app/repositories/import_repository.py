from __future__ import annotations

from pathlib import Path
from typing import Any

from psycopg import Connection


def get_lookup_id(connection: Connection, table: str, name: str) -> int | None:
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT id FROM {table} WHERE nome = %s", (name,))
        row = cursor.fetchone()
        return int(row["id"]) if row else None


def create_import(
    connection: Connection,
    *,
    filename: str,
    file_hash: str,
    status: str,
    total_rows: int,
    valid_rows: int,
    alert_rows: int,
    blocked_rows: int,
    classifier_version: str = "1.0.0",
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO importacoes (
                nome_arquivo,
                hash_arquivo,
                status,
                total_registros,
                registros_validos,
                registros_com_alerta,
                registros_bloqueados,
                versao_classificador
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (filename, file_hash, status, total_rows, valid_rows, alert_rows, blocked_rows, classifier_version),
        )
        return int(cursor.fetchone()["id"])


def insert_issue(connection: Connection, import_id: int, issue: dict[str, Any]) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO erros_importacao (
                importacao_id,
                linha,
                campo,
                valor_encontrado,
                tipo_erro,
                severidade,
                mensagem
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                import_id,
                issue.get("line"),
                issue["field"],
                issue.get("value"),
                issue["code"],
                issue["severity"],
                issue["message"],
            ),
        )


def insert_lancamento(
    connection: Connection,
    *,
    import_id: int,
    record: dict[str, Any],
    category_id: int | None,
    subcategory_id: int | None,
    classification_status: str,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO lancamentos_horas (
                importacao_id,
                id_lancamento,
                data_hora_cadastro,
                task,
                login_usuario,
                duracao_original,
                duracao_segundos,
                id_epic,
                titulo_epic,
                id_feat,
                titulo_feat,
                id_pbi,
                titulo_pbi,
                id_task,
                titulo_task,
                categoria_id,
                subcategoria_id,
                status_validacao,
                status_classificacao
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            RETURNING id
            """,
            (
                import_id,
                record["IdLancamento"],
                record["DataHoraCadastro"],
                record["Task"],
                record["LoginUsuario"],
                record["Duracao"],
                record["DuracaoSegundos"],
                record["IdEpic"],
                record["TituloEpic"],
                record["IdFeat"],
                record["TituloFeat"],
                record["IdPBI"],
                record["TituloPBI"],
                record["IdTask"],
                record["TituloTask"],
                category_id,
                subcategory_id,
                record["StatusValidacao"],
                classification_status,
            ),
        )
        return int(cursor.fetchone()["id"])


def insert_classification(
    connection: Connection,
    *,
    lancamento_id: int,
    title: str,
    category_id: int | None,
    subcategory_id: int | None,
    origin: str,
    confidence: float,
    confidence_level: str,
    classifier_version: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO classificacoes_task (
                lancamento_id,
                titulo_task,
                categoria_sugerida_id,
                subcategoria_sugerida_id,
                categoria_final_id,
                subcategoria_final_id,
                origem_classificacao,
                confianca,
                nivel_confianca,
                versao_classificador,
                aprovado_por_usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                lancamento_id,
                title,
                category_id,
                subcategory_id,
                category_id,
                subcategory_id,
                origin,
                confidence,
                confidence_level,
                classifier_version,
                origin in {"padrao_titulo", "padrao_titulo_categoria"},
            ),
        )


def insert_duplicate_resolution(
    connection: Connection,
    *,
    import_id: int,
    id_lancamento: str,
    lines: list[int],
    kept_line: int,
    kept_record_id: int | None,
) -> None:
    removed_lines = [line for line in lines if line != kept_line]
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO duplicidades_importacao (
                importacao_id,
                id_lancamento,
                linhas_envolvidas,
                registro_mantido_id,
                registros_removidos,
                resolvido,
                data_resolucao
            )
            VALUES (%s, %s, %s::jsonb, %s, %s::jsonb, TRUE, NOW())
            """,
            (
                import_id,
                id_lancamento,
                json_dumps(lines),
                kept_record_id,
                json_dumps(removed_lines),
            ),
        )


def json_dumps(value: Any) -> str:
    import json

    return json.dumps(value)


def list_imports(connection: Connection) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                i.id,
                i.nome_arquivo,
                i.status,
                i.data_importacao,
                i.total_registros,
                i.registros_validos,
                i.registros_com_alerta,
                i.registros_bloqueados,
                i.versao_classificador,
                COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds
            FROM importacoes i
            LEFT JOIN lancamentos_horas l ON l.importacao_id = i.id
            GROUP BY
                i.id,
                i.nome_arquivo,
                i.status,
                i.data_importacao,
                i.total_registros,
                i.registros_validos,
                i.registros_com_alerta,
                i.registros_bloqueados,
                i.versao_classificador
            ORDER BY i.data_importacao DESC, i.id DESC
            """
        )
        return list(cursor.fetchall())


def list_imports_for_file_history(connection: Connection, filename: str, file_hash: str) -> list[dict[str, Any]]:
    project_name = _project_name(filename)
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                i.id,
                i.nome_arquivo,
                i.hash_arquivo,
                i.data_importacao,
                i.total_registros,
                COALESCE(SUM(l.duracao_segundos), 0) AS total_seconds
            FROM importacoes i
            LEFT JOIN lancamentos_horas l ON l.importacao_id = i.id
            WHERE i.hash_arquivo = %s
               OR LOWER(REGEXP_REPLACE(i.nome_arquivo, '\\.[^.]+$', '')) = LOWER(%s)
            GROUP BY i.id, i.nome_arquivo, i.hash_arquivo, i.data_importacao, i.total_registros
            ORDER BY i.data_importacao DESC, i.id DESC
            """,
            (file_hash, project_name),
        )
        return list(cursor.fetchall())


def list_import_record_ids(connection: Connection, import_id: int) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT id_lancamento
            FROM lancamentos_horas
            WHERE importacao_id = %s
              AND COALESCE(id_lancamento, '') <> ''
            """,
            (import_id,),
        )
        return {str(row["id_lancamento"]).strip() for row in cursor.fetchall() if str(row["id_lancamento"]).strip()}


def get_import_detail(connection: Connection, import_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                nome_arquivo,
                status,
                data_importacao,
                total_registros,
                registros_validos,
                registros_com_alerta,
                registros_bloqueados,
                versao_classificador
            FROM importacoes
            WHERE id = %s
            """,
            (import_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        cursor.execute(
            """
            SELECT
                l.id_lancamento,
                l.data_hora_cadastro,
                l.login_usuario,
                l.duracao_original,
                l.duracao_segundos,
                l.titulo_epic,
                l.titulo_feat,
                l.titulo_pbi,
                l.titulo_task,
                l.status_validacao,
                l.status_classificacao,
                ct.versao_classificador,
                ct.nivel_confianca,
                ct.confianca,
                c.nome AS categoria,
                s.nome AS subcategoria
            FROM lancamentos_horas l
            LEFT JOIN classificacoes_task ct ON ct.lancamento_id = l.id
            LEFT JOIN categorias c ON c.id = l.categoria_id
            LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
            WHERE l.importacao_id = %s
            ORDER BY l.data_hora_cadastro, l.id
            LIMIT 100
            """,
            (import_id,),
        )
        row["lancamentos"] = list(cursor.fetchall())

        cursor.execute(
            """
            SELECT
                linha,
                campo,
                valor_encontrado,
                tipo_erro,
                severidade,
                mensagem,
                resolvido
            FROM erros_importacao
            WHERE importacao_id = %s
            ORDER BY severidade, linha NULLS FIRST, id
            """,
            (import_id,),
        )
        row["erros"] = list(cursor.fetchall())

        cursor.execute(
            """
            SELECT
                id_lancamento,
                linhas_envolvidas,
                registro_mantido_id,
                registros_removidos,
                resolvido,
                data_resolucao
            FROM duplicidades_importacao
            WHERE importacao_id = %s
            ORDER BY id
            """,
            (import_id,),
        )
        row["duplicidades"] = list(cursor.fetchall())
        return row


def _project_name(filename: str) -> str:
    return Path(filename).stem.strip()


def get_import_reprocess_source(connection: Connection, import_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                id,
                nome_arquivo,
                versao_classificador
            FROM importacoes
            WHERE id = %s
            """,
            (import_id,),
        )
        import_row = cursor.fetchone()
        if not import_row:
            return None

        cursor.execute(
            """
            SELECT
                l.id,
                ROW_NUMBER() OVER (ORDER BY l.data_hora_cadastro, l.id) AS linha_reprocessamento,
                l.id_lancamento,
                l.login_usuario,
                l.id_task,
                l.titulo_task,
                l.titulo_pbi,
                l.titulo_feat,
                l.titulo_epic,
                COALESCE(c.nome, 'Nao classificado') AS categoria,
                COALESCE(s.nome, 'Nao classificado') AS subcategoria,
                COALESCE(ct.confianca, 0) AS confianca,
                COALESCE(ct.nivel_confianca, 'baixa') AS nivel_confianca,
                COALESCE(ct.versao_classificador, i.versao_classificador, '1.0.0') AS versao_classificador
            FROM lancamentos_horas l
            JOIN importacoes i ON i.id = l.importacao_id
            LEFT JOIN classificacoes_task ct ON ct.lancamento_id = l.id
            LEFT JOIN categorias c ON c.id = l.categoria_id
            LEFT JOIN subcategorias s ON s.id = l.subcategoria_id
            WHERE l.importacao_id = %s
            ORDER BY l.data_hora_cadastro, l.id
            """,
            (import_id,),
        )
        import_row["lancamentos"] = list(cursor.fetchall())
        return import_row


def apply_reprocessed_classification(
    connection: Connection,
    *,
    import_id: int,
    record_id: int,
    category_id: int | None,
    subcategory_id: int | None,
    category_name: str,
    subcategory_name: str,
    confidence: float,
    confidence_level: str,
    classifier_version: str,
    origin: str,
    current_category: str,
    current_subcategory: str,
    current_confidence: float,
    current_confidence_level: str,
    current_classifier_version: str,
    confidence_factors: list[str],
    user: str = "sistema",
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE lancamentos_horas
            SET
                categoria_id = %s,
                subcategoria_id = %s,
                status_classificacao = 'reprocessada'
            WHERE id = %s AND importacao_id = %s
            """,
            (category_id, subcategory_id, record_id, import_id),
        )
        cursor.execute(
            """
            UPDATE classificacoes_task
            SET
                categoria_sugerida_id = %s,
                subcategoria_sugerida_id = %s,
                categoria_final_id = %s,
                subcategoria_final_id = %s,
                origem_classificacao = %s,
                confianca = %s,
                nivel_confianca = %s,
                versao_classificador = %s,
                aprovado_por_usuario = FALSE
            WHERE lancamento_id = %s
            """,
            (
                category_id,
                subcategory_id,
                category_id,
                subcategory_id,
                origin,
                confidence,
                confidence_level,
                classifier_version,
                record_id,
            ),
        )
        cursor.execute(
            """
            INSERT INTO classification_reprocess_history (
                importacao_id,
                lancamento_id,
                categoria_anterior,
                subcategoria_anterior,
                categoria_nova,
                subcategoria_nova,
                confianca_anterior,
                confianca_nova,
                nivel_confianca_anterior,
                nivel_confianca_novo,
                versao_anterior,
                versao_nova,
                origem_nova,
                fatores_confianca,
                motivo,
                usuario
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
            """,
            (
                import_id,
                record_id,
                current_category,
                current_subcategory,
                category_name,
                subcategory_name,
                current_confidence,
                confidence,
                current_confidence_level,
                confidence_level,
                current_classifier_version,
                classifier_version,
                origin,
                json_dumps(confidence_factors),
                "Reprocessamento confirmado pelo usuario",
                user,
            ),
        )


def update_import_classifier_version(connection: Connection, import_id: int, classifier_version: str) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE importacoes
            SET versao_classificador = %s
            WHERE id = %s
            """,
            (classifier_version, import_id),
        )


def list_reprocess_history(connection: Connection, import_id: int, limit: int = 80) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                h.id,
                h.lancamento_id,
                l.id_lancamento,
                l.id_task,
                l.titulo_task,
                l.login_usuario,
                h.categoria_anterior,
                h.subcategoria_anterior,
                h.categoria_nova,
                h.subcategoria_nova,
                h.confianca_anterior,
                h.confianca_nova,
                h.nivel_confianca_anterior,
                h.nivel_confianca_novo,
                h.versao_anterior,
                h.versao_nova,
                h.origem_nova,
                h.motivo,
                h.usuario,
                h.criado_em
            FROM classification_reprocess_history h
            JOIN lancamentos_horas l ON l.id = h.lancamento_id
            WHERE h.importacao_id = %s
            ORDER BY h.criado_em DESC, h.id DESC
            LIMIT %s
            """,
            (import_id, max(1, min(limit, 300))),
        )
        return list(cursor.fetchall())
