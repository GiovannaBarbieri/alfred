from __future__ import annotations

import unittest

from app.services.classification_service import ClassificationRule, classify_title, matched_category_count


SETTINGS = (
    {
        "desenvolvimento": "Desenvolvimento",
        "analise/definicao": "Analise/Definição",
        "homologacao": "Homologacao",
        "retrabalho": "Retrabalho/Bugs",
    },
    {
        "back": "Back",
        "front": "Front",
        "qa": "QA",
        "nao aplicavel": "Nao aplicavel",
    },
    {
        "Desenvolvimento": ["desenvolver", "integracao", "servico"],
        "Analise/Definição": ["analise", "definicao", "levantamento"],
        "Homologacao": ["validar", "teste"],
        "Retrabalho/Bugs": ["corrigir", "bug", "ajuste"],
    },
    [
        ClassificationRule(1, "Desenvolvimento", "Desenvolvimento", None, ["desenvolver", "integracao", "servico"], 10, "1.0.0"),
        ClassificationRule(4, "Analise/Definição", "Analise/Definição", None, ["analise", "definicao", "levantamento"], 10, "1.0.0"),
        ClassificationRule(2, "Homologacao", "Homologacao", None, ["validar", "teste"], 10, "1.0.0"),
        ClassificationRule(3, "Retrabalho/Bugs", "Retrabalho/Bugs", None, ["corrigir", "bug", "ajuste"], 10, "1.0.0"),
    ],
)


class ClassificationServiceTest(unittest.TestCase):
    def test_uses_category_prefix_as_primary_classification(self) -> None:
        suggestion, issue = classify_title(
            "[Desenvolvimento] Criar servico de integracao",
            2,
            "henrique.maltauro",
            "123",
            settings=SETTINGS,
            collaborator_subcategories={"henrique.maltauro": "Back"},
        )

        self.assertIsNone(issue)
        self.assertEqual(suggestion.category, "Desenvolvimento")
        self.assertEqual(suggestion.subcategory, "Back")
        self.assertEqual(suggestion.origin, "padrao_titulo_categoria")
        self.assertEqual(suggestion.confidenceLevel, "alta")
        self.assertGreaterEqual(suggestion.confidence, 0.9)

    def test_uses_category_prefix_alias_from_active_category_name(self) -> None:
        suggestion, issue = classify_title(
            "[Definição] Analise dos layouts e levantamento de ajustes",
            2,
            "willian.botini",
            "172865",
            settings=SETTINGS,
            collaborator_subcategories={"willian.botini": "Analista"},
        )

        self.assertIsNone(issue)
        self.assertEqual(suggestion.category, "Analise/Definição")
        self.assertEqual(suggestion.subcategory, "Analista")
        self.assertEqual(suggestion.origin, "padrao_titulo_categoria")
        self.assertEqual(suggestion.confidenceLevel, "alta")

    def test_flags_unknown_category_prefix(self) -> None:
        suggestion, issue = classify_title(
            "[Categoria Nova] - Criar servico de integracao",
            3,
            "dev.back",
            "124",
            settings=SETTINGS,
            collaborator_subcategories={"dev.back": "Back"},
        )

        self.assertEqual(suggestion.category, "Nao classificado")
        self.assertEqual(suggestion.subcategory, "Back")
        self.assertEqual(suggestion.origin, "pendente")
        self.assertIsNotNone(issue)
        self.assertEqual(issue.code, "unknown_title_category")

    def test_marks_outside_pattern_as_pending(self) -> None:
        suggestion, issue = classify_title(
            "Criar servico de integracao",
            4,
            "dev.back",
            "125",
            settings=SETTINGS,
            collaborator_subcategories={"dev.back": "Back"},
        )

        self.assertEqual(suggestion.category, "Nao classificado")
        self.assertEqual(suggestion.subcategory, "Back")
        self.assertEqual(suggestion.origin, "pendente")
        self.assertIsNotNone(issue)
        self.assertEqual(issue.code, "title_outside_pattern")

    def test_conflict_check_ignores_category_prefix(self) -> None:
        count = matched_category_count("[Desenvolvimento] - Corrigir bug na integracao", settings=SETTINGS)

        self.assertEqual(count, 0)


if __name__ == "__main__":
    unittest.main()
