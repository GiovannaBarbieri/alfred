from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.db import get_connection
from app.repositories.audit_repository import insert_audit_log

router = APIRouter()


class NamePayload(BaseModel):
    name: str


class SettingUpdatePayload(BaseModel):
    name: str | None = None
    active: bool | None = None


class KeywordPayload(BaseModel):
    categoryId: int
    keyword: str


class KeywordUpdatePayload(BaseModel):
    categoryId: int | None = None
    keyword: str | None = None
    active: bool | None = None


class CollaboratorProfilePayload(BaseModel):
    loginUsuario: str
    subcategoryId: int


class CollaboratorProfileUpdatePayload(BaseModel):
    loginUsuario: str | None = None
    subcategoryId: int | None = None
    active: bool | None = None


class IgnoredCollaboratorPayload(BaseModel):
    loginUsuario: str


class ClassificationRulePayload(BaseModel):
    name: str
    categoryId: int
    subcategoryId: int | None = None
    keywords: list[str]
    priority: int = 0
    version: str = "1.0.0"


class ClassificationRuleUpdatePayload(BaseModel):
    name: str | None = None
    categoryId: int | None = None
    subcategoryId: int | None = None
    keywords: list[str] | None = None
    priority: int | None = None
    active: bool | None = None
    version: str | None = None


def _setting_response(row: dict) -> dict:
    return {"id": row["id"], "name": row["nome"], "active": row["ativa"]}


def _keyword_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "categoryId": row["categoria_id"],
        "keyword": row["palavra"],
        "active": row["ativa"],
        "category": row.get("categoria", ""),
    }


def _collaborator_profile_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "loginUsuario": row["login_usuario"],
        "subcategoryId": row["subcategoria_id"],
        "subcategory": row.get("subcategoria", ""),
        "active": row["ativo"],
    }


def _ignored_collaborator_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "loginUsuario": row["login_usuario"],
        "active": row["ativo"],
    }


def _classification_rule_response(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["nome"],
        "categoryId": row["categoria_id"],
        "category": row.get("categoria", ""),
        "subcategoryId": row["subcategoria_id"],
        "subcategory": row.get("subcategoria"),
        "keywords": row["palavras_chave"] or [],
        "priority": row["prioridade"],
        "active": row["ativa"],
        "version": row["versao"],
    }


@router.get("/categories")
def list_categories() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, nome, ativa FROM categorias ORDER BY nome")
            return [_setting_response(row) for row in cursor.fetchall()]


@router.post("/categories")
def create_category(payload: NamePayload) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome da categoria e obrigatorio.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO categorias (nome)
                VALUES (%s)
                ON CONFLICT (nome) DO UPDATE SET ativa = TRUE
                RETURNING id, nome, ativa
                """,
                (name,),
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="category",
                record_id=row["id"],
                action="created",
                after=_setting_response(row),
            )
            return _setting_response(row)


@router.patch("/categories/{category_id}")
def update_category(category_id: int, payload: SettingUpdatePayload) -> dict:
    name = payload.name.strip() if payload.name is not None else None
    if payload.name is not None and not name:
        raise HTTPException(status_code=400, detail="Nome da categoria e obrigatorio.")
    if name is None and payload.active is None:
        raise HTTPException(status_code=400, detail="Informe nome ou status para atualizar.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, nome, ativa FROM categorias WHERE id = %s", (category_id,))
            before = cursor.fetchone()
            if not before:
                raise HTTPException(status_code=404, detail="Categoria nao encontrada.")

            cursor.execute(
                """
                UPDATE categorias
                SET
                    nome = COALESCE(%s, nome),
                    ativa = COALESCE(%s, ativa)
                WHERE id = %s
                RETURNING id, nome, ativa
                """,
                (name, payload.active, category_id),
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="category",
                record_id=category_id,
                action="updated",
                before=_setting_response(before),
                after=_setting_response(row),
            )
            return _setting_response(row)


@router.get("/subcategories")
def list_subcategories() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, nome, ativa FROM subcategorias ORDER BY nome")
            return [_setting_response(row) for row in cursor.fetchall()]


@router.post("/subcategories")
def create_subcategory(payload: NamePayload) -> dict:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome da subcategoria e obrigatorio.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO subcategorias (nome)
                VALUES (%s)
                ON CONFLICT (nome) DO UPDATE SET ativa = TRUE
                RETURNING id, nome, ativa
                """,
                (name,),
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="subcategory",
                record_id=row["id"],
                action="created",
                after=_setting_response(row),
            )
            return _setting_response(row)


@router.patch("/subcategories/{subcategory_id}")
def update_subcategory(subcategory_id: int, payload: SettingUpdatePayload) -> dict:
    name = payload.name.strip() if payload.name is not None else None
    if payload.name is not None and not name:
        raise HTTPException(status_code=400, detail="Nome da subcategoria e obrigatorio.")
    if name is None and payload.active is None:
        raise HTTPException(status_code=400, detail="Informe nome ou status para atualizar.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, nome, ativa FROM subcategorias WHERE id = %s", (subcategory_id,))
            before = cursor.fetchone()
            if not before:
                raise HTTPException(status_code=404, detail="Subcategoria nao encontrada.")

            cursor.execute(
                """
                UPDATE subcategorias
                SET
                    nome = COALESCE(%s, nome),
                    ativa = COALESCE(%s, ativa)
                WHERE id = %s
                RETURNING id, nome, ativa
                """,
                (name, payload.active, subcategory_id),
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="subcategory",
                record_id=subcategory_id,
                action="updated",
                before=_setting_response(before),
                after=_setting_response(row),
            )
            return _setting_response(row)


@router.get("/keywords")
def list_keywords() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    p.id,
                    p.palavra,
                    p.ativa,
                    c.id AS categoria_id,
                    c.nome AS categoria
                FROM palavras_chave_categoria p
                JOIN categorias c ON c.id = p.categoria_id
                ORDER BY c.nome, p.palavra
                """
            )
            return [_keyword_response(row) for row in cursor.fetchall()]


@router.post("/keywords")
def create_keyword(payload: KeywordPayload) -> dict:
    keyword = payload.keyword.strip().lower()
    if not keyword:
        raise HTTPException(status_code=400, detail="Palavra-chave e obrigatoria.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id, ativa FROM categorias WHERE id = %s", (payload.categoryId,))
            category = cursor.fetchone()
            if not category:
                raise HTTPException(status_code=404, detail="Categoria nao encontrada.")
            if not category["ativa"]:
                raise HTTPException(status_code=400, detail="Categoria inativa nao pode receber palavra-chave.")

            cursor.execute(
                """
                INSERT INTO palavras_chave_categoria (categoria_id, palavra)
                VALUES (%s, %s)
                ON CONFLICT (categoria_id, palavra) DO UPDATE SET ativa = TRUE
                RETURNING id, categoria_id, palavra, ativa
                """,
                (payload.categoryId, keyword),
            )
            row = cursor.fetchone()
            insert_audit_log(
                connection,
                entity="keyword",
                record_id=row["id"],
                action="created",
                after=_keyword_response({**row, "categoria": ""}),
            )
            return _keyword_response({**row, "categoria": ""})


@router.patch("/keywords/{keyword_id}")
def update_keyword(keyword_id: int, payload: KeywordUpdatePayload) -> dict:
    keyword = payload.keyword.strip().lower() if payload.keyword is not None else None
    if payload.keyword is not None and not keyword:
        raise HTTPException(status_code=400, detail="Palavra-chave e obrigatoria.")
    if payload.categoryId is None and keyword is None and payload.active is None:
        raise HTTPException(status_code=400, detail="Informe categoria, palavra-chave ou status para atualizar.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    p.id,
                    p.categoria_id,
                    p.palavra,
                    p.ativa,
                    c.nome AS categoria
                FROM palavras_chave_categoria p
                JOIN categorias c ON c.id = p.categoria_id
                WHERE p.id = %s
                """,
                (keyword_id,),
            )
            before = cursor.fetchone()
            if not before:
                raise HTTPException(status_code=404, detail="Palavra-chave nao encontrada.")

            if payload.categoryId is not None:
                cursor.execute("SELECT id, ativa FROM categorias WHERE id = %s", (payload.categoryId,))
                category = cursor.fetchone()
                if not category:
                    raise HTTPException(status_code=404, detail="Categoria nao encontrada.")
                if not category["ativa"]:
                    raise HTTPException(status_code=400, detail="Categoria inativa nao pode receber palavra-chave.")

            cursor.execute(
                """
                UPDATE palavras_chave_categoria
                SET
                    categoria_id = COALESCE(%s, categoria_id),
                    palavra = COALESCE(%s, palavra),
                    ativa = COALESCE(%s, ativa)
                WHERE id = %s
                RETURNING id, categoria_id, palavra, ativa
                """,
                (payload.categoryId, keyword, payload.active, keyword_id),
            )
            row = cursor.fetchone()
            cursor.execute("SELECT nome FROM categorias WHERE id = %s", (row["categoria_id"],))
            category = cursor.fetchone()
            response = _keyword_response({**row, "categoria": category["nome"] if category else ""})
            insert_audit_log(
                connection,
                entity="keyword",
                record_id=keyword_id,
                action="updated",
                before=_keyword_response(before),
                after=response,
            )
            return response


@router.get("/collaborator-profiles")
def list_collaborator_profiles() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    p.id,
                    p.login_usuario,
                    p.subcategoria_id,
                    p.ativo,
                    s.nome AS subcategoria
                FROM perfis_colaborador p
                JOIN subcategorias s ON s.id = p.subcategoria_id
                ORDER BY p.login_usuario
                """
            )
            return [_collaborator_profile_response(row) for row in cursor.fetchall()]


@router.post("/collaborator-profiles")
def create_collaborator_profile(payload: CollaboratorProfilePayload) -> dict:
    login_usuario = payload.loginUsuario.strip().lower()
    if not login_usuario:
        raise HTTPException(status_code=400, detail="Login do colaborador e obrigatorio.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM subcategorias WHERE id = %s", (payload.subcategoryId,))
            if not cursor.fetchone():
                raise HTTPException(status_code=404, detail="Subcategoria nao encontrada.")

            cursor.execute(
                """
                INSERT INTO perfis_colaborador (login_usuario, subcategoria_id)
                VALUES (%s, %s)
                ON CONFLICT (login_usuario)
                DO UPDATE SET subcategoria_id = EXCLUDED.subcategoria_id, ativo = TRUE
                RETURNING id, login_usuario, subcategoria_id, ativo
                """,
                (login_usuario, payload.subcategoryId),
            )
            row = cursor.fetchone()
            cursor.execute("SELECT nome FROM subcategorias WHERE id = %s", (row["subcategoria_id"],))
            subcategory = cursor.fetchone()
            response = _collaborator_profile_response(
                {**row, "subcategoria": subcategory["nome"] if subcategory else ""}
            )
            insert_audit_log(
                connection,
                entity="collaborator_profile",
                record_id=row["id"],
                action="created",
                after=response,
            )
            return response


@router.patch("/collaborator-profiles/{profile_id}")
def update_collaborator_profile(profile_id: int, payload: CollaboratorProfileUpdatePayload) -> dict:
    login_usuario = payload.loginUsuario.strip().lower() if payload.loginUsuario is not None else None
    if payload.loginUsuario is not None and not login_usuario:
        raise HTTPException(status_code=400, detail="Login do colaborador e obrigatorio.")
    if login_usuario is None and payload.subcategoryId is None and payload.active is None:
        raise HTTPException(status_code=400, detail="Informe login, subcategoria ou status para atualizar.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    p.id,
                    p.login_usuario,
                    p.subcategoria_id,
                    p.ativo,
                    s.nome AS subcategoria
                FROM perfis_colaborador p
                JOIN subcategorias s ON s.id = p.subcategoria_id
                WHERE p.id = %s
                """,
                (profile_id,),
            )
            before = cursor.fetchone()
            if not before:
                raise HTTPException(status_code=404, detail="Perfil de colaborador nao encontrado.")

            if payload.subcategoryId is not None:
                cursor.execute("SELECT id FROM subcategorias WHERE id = %s", (payload.subcategoryId,))
                if not cursor.fetchone():
                    raise HTTPException(status_code=404, detail="Subcategoria nao encontrada.")

            cursor.execute(
                """
                UPDATE perfis_colaborador
                SET
                    login_usuario = COALESCE(%s, login_usuario),
                    subcategoria_id = COALESCE(%s, subcategoria_id),
                    ativo = COALESCE(%s, ativo)
                WHERE id = %s
                RETURNING id, login_usuario, subcategoria_id, ativo
                """,
                (login_usuario, payload.subcategoryId, payload.active, profile_id),
            )
            row = cursor.fetchone()
            cursor.execute("SELECT nome FROM subcategorias WHERE id = %s", (row["subcategoria_id"],))
            subcategory = cursor.fetchone()
            response = _collaborator_profile_response(
                {**row, "subcategoria": subcategory["nome"] if subcategory else ""}
            )
            insert_audit_log(
                connection,
                entity="collaborator_profile",
                record_id=profile_id,
                action="updated",
                before=_collaborator_profile_response(before),
                after=response,
            )
            return response


@router.get("/ignored-collaborators")
def list_ignored_collaborators() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, login_usuario, ativo
                FROM colaboradores_ignorados
                WHERE ativo = TRUE
                ORDER BY login_usuario
                """
            )
            return [_ignored_collaborator_response(row) for row in cursor.fetchall()]


@router.post("/ignored-collaborators")
def create_ignored_collaborator(payload: IgnoredCollaboratorPayload) -> dict:
    login_usuario = payload.loginUsuario.strip().lower()
    if not login_usuario:
        raise HTTPException(status_code=400, detail="Login do colaborador e obrigatorio.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO colaboradores_ignorados (login_usuario)
                VALUES (%s)
                ON CONFLICT (login_usuario)
                DO UPDATE SET ativo = TRUE
                RETURNING id, login_usuario, ativo
                """,
                (login_usuario,),
            )
            row = cursor.fetchone()
            response = _ignored_collaborator_response(row)
            insert_audit_log(
                connection,
                entity="ignored_collaborator",
                record_id=row["id"],
                action="created",
                after=response,
            )
            return response


@router.delete("/ignored-collaborators/{ignored_id}")
def delete_ignored_collaborator(ignored_id: int) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE colaboradores_ignorados
                SET ativo = FALSE
                WHERE id = %s
                RETURNING id, login_usuario, ativo
                """,
                (ignored_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Colaborador ignorado nao encontrado.")
            response = _ignored_collaborator_response(row)
            insert_audit_log(
                connection,
                entity="ignored_collaborator",
                record_id=ignored_id,
                action="updated",
                after=response,
            )
            return response


@router.get("/classification-rules")
def list_classification_rules() -> list[dict]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    r.id,
                    r.nome,
                    r.categoria_id,
                    c.nome AS categoria,
                    r.subcategoria_id,
                    s.nome AS subcategoria,
                    r.palavras_chave,
                    r.prioridade,
                    r.ativa,
                    r.versao
                FROM classification_rules r
                JOIN categorias c ON c.id = r.categoria_id
                LEFT JOIN subcategorias s ON s.id = r.subcategoria_id
                ORDER BY r.ativa DESC, r.prioridade DESC, r.nome
                """
            )
            return [_classification_rule_response(row) for row in cursor.fetchall()]


@router.post("/classification-rules")
def create_classification_rule(payload: ClassificationRulePayload) -> dict:
    name = payload.name.strip()
    keywords = _clean_keywords(payload.keywords)
    version = payload.version.strip() or "1.0.0"
    if not name:
        raise HTTPException(status_code=400, detail="Nome da regra e obrigatorio.")
    if not keywords:
        raise HTTPException(status_code=400, detail="Informe ao menos uma palavra-chave.")

    with get_connection() as connection:
        with connection.cursor() as cursor:
            _ensure_active_category(cursor, payload.categoryId)
            if payload.subcategoryId is not None:
                _ensure_active_subcategory(cursor, payload.subcategoryId)

            cursor.execute(
                """
                INSERT INTO classification_rules (
                    nome,
                    categoria_id,
                    subcategoria_id,
                    palavras_chave,
                    prioridade,
                    versao
                )
                VALUES (%s, %s, %s, %s::jsonb, %s, %s)
                RETURNING id
                """,
                (name, payload.categoryId, payload.subcategoryId, _json_keywords(keywords), payload.priority, version),
            )
            rule_id = cursor.fetchone()["id"]
            response = _get_classification_rule(cursor, rule_id)
            insert_audit_log(
                connection,
                entity="classification_rule",
                record_id=rule_id,
                action="created",
                after=response,
            )
            return response


@router.patch("/classification-rules/{rule_id}")
def update_classification_rule(rule_id: int, payload: ClassificationRuleUpdatePayload) -> dict:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            before = _get_classification_rule(cursor, rule_id)
            if not before:
                raise HTTPException(status_code=404, detail="Regra de classificacao nao encontrada.")

            name = payload.name.strip() if payload.name is not None else None
            version = payload.version.strip() if payload.version is not None else None
            keywords = _clean_keywords(payload.keywords) if payload.keywords is not None else None
            if payload.name is not None and not name:
                raise HTTPException(status_code=400, detail="Nome da regra e obrigatorio.")
            if payload.keywords is not None and not keywords:
                raise HTTPException(status_code=400, detail="Informe ao menos uma palavra-chave.")
            if payload.categoryId is not None:
                _ensure_active_category(cursor, payload.categoryId)
            if payload.subcategoryId is not None:
                _ensure_active_subcategory(cursor, payload.subcategoryId)

            cursor.execute(
                """
                UPDATE classification_rules
                SET
                    nome = COALESCE(%s, nome),
                    categoria_id = COALESCE(%s, categoria_id),
                    subcategoria_id = %s,
                    palavras_chave = COALESCE(%s::jsonb, palavras_chave),
                    prioridade = COALESCE(%s, prioridade),
                    ativa = COALESCE(%s, ativa),
                    versao = COALESCE(%s, versao),
                    atualizado_em = NOW()
                WHERE id = %s
                """,
                (
                    name,
                    payload.categoryId,
                    payload.subcategoryId if payload.subcategoryId is not None else before["subcategoryId"],
                    _json_keywords(keywords) if keywords is not None else None,
                    payload.priority,
                    payload.active,
                    version,
                    rule_id,
                ),
            )
            response = _get_classification_rule(cursor, rule_id)
            insert_audit_log(
                connection,
                entity="classification_rule",
                record_id=rule_id,
                action="updated",
                before=before,
                after=response,
            )
            return response


def _get_classification_rule(cursor, rule_id: int) -> dict | None:
    cursor.execute(
        """
        SELECT
            r.id,
            r.nome,
            r.categoria_id,
            c.nome AS categoria,
            r.subcategoria_id,
            s.nome AS subcategoria,
            r.palavras_chave,
            r.prioridade,
            r.ativa,
            r.versao
        FROM classification_rules r
        JOIN categorias c ON c.id = r.categoria_id
        LEFT JOIN subcategorias s ON s.id = r.subcategoria_id
        WHERE r.id = %s
        """,
        (rule_id,),
    )
    row = cursor.fetchone()
    return _classification_rule_response(row) if row else None


def _clean_keywords(keywords: list[str]) -> list[str]:
    cleaned = []
    for keyword in keywords:
        value = keyword.strip().lower()
        if value and value not in cleaned:
            cleaned.append(value)
    return cleaned


def _json_keywords(keywords: list[str]) -> str:
    import json

    return json.dumps(keywords, ensure_ascii=False)


def _ensure_active_category(cursor, category_id: int) -> None:
    cursor.execute("SELECT id, ativa FROM categorias WHERE id = %s", (category_id,))
    category = cursor.fetchone()
    if not category:
        raise HTTPException(status_code=404, detail="Categoria nao encontrada.")
    if not category["ativa"]:
        raise HTTPException(status_code=400, detail="Categoria inativa nao pode ser usada em regra.")


def _ensure_active_subcategory(cursor, subcategory_id: int) -> None:
    cursor.execute("SELECT id, ativa FROM subcategorias WHERE id = %s", (subcategory_id,))
    subcategory = cursor.fetchone()
    if not subcategory:
        raise HTTPException(status_code=404, detail="Subcategoria nao encontrada.")
    if not subcategory["ativa"]:
        raise HTTPException(status_code=400, detail="Subcategoria inativa nao pode ser usada em regra.")
