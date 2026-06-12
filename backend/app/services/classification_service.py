from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass

from app.db import get_connection
from app.importers.spreadsheet_importer import normalize_text
from app.schemas.imports import ClassificationSuggestion, ImportIssue


CATEGORIES = {
    "desenvolvimento": "Desenvolvimento",
    "reuniao": "Reuniao",
    "alinhamento": "Alinhamento",
    "definicao": "Definicao",
    "homologacao": "Homologacao",
    "testes cruzados": "Testes cruzados",
    "retrabalho": "Retrabalho",
    "analise": "Analise",
}

SUBCATEGORIES = {
    "back": "Back",
    "front": "Front",
    "qa": "QA",
}

TITLE_PATTERN = re.compile(r"^\s*\[([^\]]+)\]\s*(.*)$")
CLASSIFIER_VERSION = "1.0.0"


@dataclass(frozen=True)
class ClassificationRule:
    id: int
    name: str
    category: str
    subcategory: str | None
    keywords: list[str]
    priority: int
    version: str


def classify_title(
    title: str,
    line_number: int,
    login_usuario: str = "",
    id_task: str = "",
    titulo_pbi: str = "",
    titulo_feature: str = "",
    titulo_epic: str = "",
    task_occurrences: int = 1,
    settings: tuple[dict[str, str], dict[str, str], dict[str, list[str]], list[ClassificationRule]] | None = None,
    collaborator_subcategories: dict[str, str] | None = None,
) -> tuple[ClassificationSuggestion, ImportIssue | None]:
    categories, _, _, _ = settings or load_classification_settings()
    pattern_match = TITLE_PATTERN.match(title)

    if pattern_match:
        category_raw = normalize_text(pattern_match.group(1))
        bracket_category = _resolve_title_category(category_raw, categories)
        if bracket_category:
            return _classify_by_title_category(
                title=title,
                line_number=line_number,
                login_usuario=login_usuario,
                id_task=id_task,
                category=bracket_category,
                collaborator_subcategories=collaborator_subcategories,
            ), None
        return _unclassified_suggestion(
            title=title,
            line_number=line_number,
            login_usuario=login_usuario,
            id_task=id_task,
            collaborator_subcategories=collaborator_subcategories,
        ), _unknown_title_category_issue(line_number, title)

    return _unclassified_suggestion(
        title=title,
        line_number=line_number,
        login_usuario=login_usuario,
        id_task=id_task,
        collaborator_subcategories=collaborator_subcategories,
    ), _title_outside_pattern_issue(line_number, title)


def confidence_level(score: float, matched_categories: int = 1) -> str:
    if matched_categories > 1 or score < 0.7:
        return "baixa"
    if score < 0.85:
        return "media"
    return "alta"


def matched_category_count(
    title: str,
    settings: tuple[dict[str, str], dict[str, str], dict[str, list[str]], list[ClassificationRule]] | None = None,
) -> int:
    return 0


def load_classification_settings() -> tuple[dict[str, str], dict[str, str], dict[str, list[str]], list[ClassificationRule]]:
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT nome FROM categorias WHERE ativa = TRUE")
                categories = {normalize_text(row["nome"]): row["nome"] for row in cursor.fetchall()}

                cursor.execute("SELECT nome FROM subcategorias WHERE ativa = TRUE")
                subcategories = {normalize_text(row["nome"]): row["nome"] for row in cursor.fetchall()}

                cursor.execute(
                    """
                    SELECT
                        r.id,
                        r.nome,
                        c.nome AS categoria,
                        s.nome AS subcategoria,
                        r.palavras_chave,
                        r.prioridade,
                        r.versao
                    FROM classification_rules r
                    JOIN categorias c ON c.id = r.categoria_id
                    LEFT JOIN subcategorias s ON s.id = r.subcategoria_id
                    WHERE r.ativa = TRUE AND c.ativa = TRUE
                    ORDER BY r.prioridade DESC, r.nome
                    """
                )
                rules: list[ClassificationRule] = []
                for row in cursor.fetchall():
                    keywords_value = row["palavras_chave"] or []
                    rules.append(
                        ClassificationRule(
                            id=row["id"],
                            name=row["nome"],
                            category=row["categoria"],
                            subcategory=row["subcategoria"],
                            keywords=[str(keyword) for keyword in keywords_value if str(keyword).strip()],
                            priority=row["prioridade"],
                            version=row["versao"],
                        )
                    )

                if rules:
                    keywords = defaultdict(list)
                    for rule in rules:
                        keywords[rule.category].extend(rule.keywords)
                    return categories, subcategories, dict(keywords), rules

                cursor.execute(
                    """
                    SELECT c.nome AS categoria, p.palavra
                    FROM palavras_chave_categoria p
                    JOIN categorias c ON c.id = p.categoria_id
                    WHERE p.ativa = TRUE AND c.ativa = TRUE
                    ORDER BY c.nome, p.palavra
                    """
                )
                keywords: dict[str, list[str]] = defaultdict(list)
                for row in cursor.fetchall():
                    keywords[row["categoria"]].append(row["palavra"])

        return categories, subcategories, dict(keywords), []
    except Exception:
        pass

    return CATEGORIES, SUBCATEGORIES, {}, []


def _classify_by_title_category(
    *,
    title: str,
    line_number: int,
    login_usuario: str,
    id_task: str,
    category: str,
    collaborator_subcategories: dict[str, str] | None,
) -> ClassificationSuggestion:
    collaborator_subcategories = collaborator_subcategories or _load_collaborator_subcategories()
    normalized_login = normalize_text(login_usuario)
    profile_subcategory = collaborator_subcategories.get(normalized_login)
    subcategory = profile_subcategory or "Nao aplicavel"

    confidence = 0.98
    confidence_factors = ["categoria capturada no primeiro colchete do titulo"]
    if profile_subcategory:
        confidence_factors.append("perfil operacional do colaborador aplicado")
    else:
        confidence = 0.95
        confidence_factors.append("sem perfil operacional de colaborador")

    return ClassificationSuggestion(
        line=line_number,
        idTask=id_task,
        loginUsuario=login_usuario,
        tituloTask=title,
        category=category,
        subcategory=subcategory,
        origin="padrao_titulo_categoria",
        confidence=round(confidence, 2),
        confidenceLevel=confidence_level(confidence),
        classifierVersion=CLASSIFIER_VERSION,
        confidenceFactors=confidence_factors,
        matchedKeywords=[],
    )


def _unclassified_suggestion(
    *,
    title: str,
    line_number: int,
    login_usuario: str,
    id_task: str,
    collaborator_subcategories: dict[str, str] | None,
) -> ClassificationSuggestion:
    collaborator_subcategories = collaborator_subcategories or _load_collaborator_subcategories()
    subcategory = collaborator_subcategories.get(normalize_text(login_usuario)) or "Nao aplicavel"
    confidence_factors = ["categoria nao encontrada no primeiro colchete"]
    if subcategory != "Nao aplicavel":
        confidence_factors.append("perfil operacional do colaborador aplicado")
    return ClassificationSuggestion(
        line=line_number,
        idTask=id_task,
        loginUsuario=login_usuario,
        tituloTask=title,
        category="Nao classificado",
        subcategory=subcategory,
        origin="pendente",
        confidence=0.0,
        confidenceLevel="baixa",
        classifierVersion=CLASSIFIER_VERSION,
        confidenceFactors=confidence_factors,
        matchedKeywords=[],
    )


def _resolve_title_category(category_raw: str, categories: dict[str, str]) -> str | None:
    exact_match = categories.get(category_raw)
    if exact_match:
        return exact_match

    if len(category_raw) < 4:
        return None

    for normalized_name, category_name in categories.items():
        parts = [part.strip() for part in re.split(r"[/|,;]+|\s+e\s+", normalized_name) if part.strip()]
        if category_raw in parts:
            return category_name

    for normalized_name, category_name in categories.items():
        if category_raw in normalized_name:
            return category_name

    return None


def _title_outside_pattern_issue(line_number: int, title: str) -> ImportIssue:
    return ImportIssue(
        line=line_number,
        field="TituloTask",
        value=title,
        severity="alerta",
        code="title_outside_pattern",
        message="TituloTask fora do padrao [Categoria] Titulo.",
    )


def _unknown_title_category_issue(line_number: int, title: str) -> ImportIssue:
    return ImportIssue(
        line=line_number,
        field="TituloTask",
        value=title,
        severity="alerta",
        code="unknown_title_category",
        message="Categoria informada no titulo nao esta cadastrada ou esta inativa.",
    )


def _title_without_category_prefix(title: str) -> str:
    pattern_match = TITLE_PATTERN.match(title)
    if not pattern_match:
        return title
    return pattern_match.group(2)


def _load_collaborator_subcategories() -> dict[str, str]:
    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT p.login_usuario, s.nome AS subcategoria
                    FROM perfis_colaborador p
                    JOIN subcategorias s ON s.id = p.subcategoria_id
                    WHERE p.ativo = TRUE AND s.ativa = TRUE
                    """
                )
                return {
                    normalize_text(row["login_usuario"]): row["subcategoria"]
                    for row in cursor.fetchall()
                }
    except Exception:
        return {}


def load_collaborator_subcategories() -> dict[str, str]:
    return _load_collaborator_subcategories()
