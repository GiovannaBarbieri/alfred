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

DEFAULT_KEYWORDS = {
    "Desenvolvimento": ["adicionando", "criando", "desenvolver", "endpoint", "integracao", "servico"],
    "Definicao": ["analise", "analisando", "definicao", "levantamento", "levantando", "regra"],
    "Homologacao": ["homologacao", "homologando", "validacao", "validando", "validar"],
    "Retrabalho": ["ajuste", "bug", "corrigir", "correcao", "retrabalho"],
    "Reuniao": ["reuniao"],
    "Alinhamento": ["alinhamento"],
    "Testes cruzados": ["teste cruzado", "testes cruzados"],
}

TITLE_PATTERN = re.compile(r"^\s*\[([^\]]+)\]\s*(.*)$")
LEADING_BRACKETS_PATTERN = re.compile(r"^\s*((?:\[[^\]]+\]\s*)+)")
BRACKET_VALUE_PATTERN = re.compile(r"\[([^\]]+)\]")
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
    categories, subcategories, keywords, rules = settings or load_classification_settings()
    bracket_values = _leading_bracket_values(title)

    if bracket_values:
        category_raw = normalize_text(bracket_values[0])
        bracket_category = _resolve_title_category(category_raw, categories)
        if bracket_category:
            bracket_subcategory = None
            if len(bracket_values) > 1:
                bracket_subcategory = subcategories.get(normalize_text(bracket_values[1]))
            return _classify_by_title_category(
                title=title,
                line_number=line_number,
                login_usuario=login_usuario,
                id_task=id_task,
                category=bracket_category,
                title_subcategory=bracket_subcategory,
                collaborator_subcategories=collaborator_subcategories,
            ), None
        return _unclassified_suggestion(
            title=title,
            line_number=line_number,
            login_usuario=login_usuario,
            id_task=id_task,
            collaborator_subcategories=collaborator_subcategories,
        ), _unknown_title_category_issue(line_number, title)

    keyword_suggestion = _classify_by_keywords(
        title=title,
        line_number=line_number,
        login_usuario=login_usuario,
        id_task=id_task,
        keywords=keywords,
        rules=rules,
        collaborator_subcategories=collaborator_subcategories,
    )
    if keyword_suggestion:
        return keyword_suggestion, None

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
    if _leading_bracket_values(title):
        return 0
    _, _, keywords, rules = settings or load_classification_settings()
    return len(_keyword_matches(title, keywords, rules))


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

    return CATEGORIES, SUBCATEGORIES, DEFAULT_KEYWORDS, []


def _classify_by_title_category(
    *,
    title: str,
    line_number: int,
    login_usuario: str,
    id_task: str,
    category: str,
    title_subcategory: str | None,
    collaborator_subcategories: dict[str, str] | None,
) -> ClassificationSuggestion:
    collaborator_subcategories = collaborator_subcategories or _load_collaborator_subcategories()
    normalized_login = normalize_text(login_usuario)
    profile_subcategory = collaborator_subcategories.get(normalized_login)
    subcategory = title_subcategory or profile_subcategory or "Nao aplicavel"

    confidence = 0.98
    confidence_factors = ["categoria capturada no primeiro colchete do titulo"]
    if title_subcategory:
        confidence_factors.append("subcategoria capturada no segundo colchete do titulo")
    elif profile_subcategory:
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


def _leading_bracket_values(title: str) -> list[str]:
    match = LEADING_BRACKETS_PATTERN.match(title)
    if not match:
        return []
    return [value.strip() for value in BRACKET_VALUE_PATTERN.findall(match.group(1)) if value.strip()]


def _classify_by_keywords(
    *,
    title: str,
    line_number: int,
    login_usuario: str,
    id_task: str,
    keywords: dict[str, list[str]],
    rules: list[ClassificationRule],
    collaborator_subcategories: dict[str, str] | None,
) -> ClassificationSuggestion | None:
    matches = _keyword_matches(title, keywords, rules)
    if not matches:
        return None

    category, matched_keywords, rule = matches[0]
    matched_categories = len(matches)
    confidence = 0.72 + min(len(matched_keywords), 3) * 0.06
    if matched_categories > 1:
        confidence = min(confidence, 0.68)

    collaborator_subcategories = collaborator_subcategories or _load_collaborator_subcategories()
    subcategory = rule.subcategory if rule and rule.subcategory else None
    subcategory = subcategory or collaborator_subcategories.get(normalize_text(login_usuario)) or "Nao aplicavel"

    return ClassificationSuggestion(
        line=line_number,
        idTask=id_task,
        loginUsuario=login_usuario,
        tituloTask=title,
        category=category,
        subcategory=subcategory,
        origin="regra",
        confidence=round(min(confidence, 0.9), 2),
        confidenceLevel=confidence_level(confidence, matched_categories),
        classifierVersion=rule.version if rule else CLASSIFIER_VERSION,
        confidenceFactors=["palavras-chave encontradas no titulo da Task"],
        matchedKeywords=matched_keywords,
    )


def _keyword_matches(
    title: str,
    keywords: dict[str, list[str]],
    rules: list[ClassificationRule],
) -> list[tuple[str, list[str], ClassificationRule | None]]:
    normalized_title = normalize_text(title)
    matches: list[tuple[str, list[str], ClassificationRule | None, int]] = []

    if rules:
        for rule in rules:
            matched_keywords = _matched_keywords(normalized_title, rule.keywords)
            if matched_keywords:
                matches.append((rule.category, matched_keywords, rule, rule.priority))
    else:
        for category, category_keywords in keywords.items():
            matched_keywords = _matched_keywords(normalized_title, category_keywords)
            if matched_keywords:
                matches.append((category, matched_keywords, None, 0))

    matches.sort(key=lambda item: (item[3], len(item[1]), item[0]), reverse=True)
    return [(category, matched_keywords, rule) for category, matched_keywords, rule, _ in matches]


def _matched_keywords(normalized_title: str, keywords: list[str]) -> list[str]:
    matched: list[str] = []
    for keyword in keywords:
        normalized_keyword = normalize_text(keyword)
        if normalized_keyword and normalized_keyword in normalized_title:
            matched.append(keyword)
    return matched


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
