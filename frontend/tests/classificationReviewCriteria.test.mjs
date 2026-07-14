import assert from "node:assert/strict";
import { test } from "node:test";

import { reviewReasonsForClassification } from "../src/utils/classificationReviewCriteria.ts";

const baseClassification = {
  line: 1,
  idTask: "123",
  loginUsuario: "ana.silva",
  tituloTask: "Implementar fluxo",
  category: "Desenvolvimento",
  subcategory: "Back",
  origin: "regra",
  confidence: 0,
  confidenceLevel: "",
  classifierVersion: "test",
  confidenceFactors: [],
  matchedKeywords: ["implementar"],
};

function reasons(overrides = {}, options = {}) {
  return reviewReasonsForClassification({ ...baseClassification, ...overrides }, options);
}

test("atividade sem categoria entra na revisão", () => {
  assert.deepEqual(reasons({ category: "Nao classificado" }), ["Sem categoria"]);
});

test("atividade sem subcategoria entra na revisão", () => {
  assert.deepEqual(reasons({ subcategory: "" }), ["Sem subcategoria"]);
});

test("categoria fora das regras entra na revisão", () => {
  assert.deepEqual(reasons({ category: "Categoria X" }, { categoryOptions: ["Desenvolvimento"] }), [
    "Categoria não encontrada nas regras",
  ]);
});

test("subcategoria fora das regras entra na revisão", () => {
  assert.deepEqual(reasons({ subcategory: "Mobile" }, { subcategoryOptions: ["Back", "Front"] }), [
    "Subcategoria não encontrada nas regras",
  ]);
});

test("conflito entre regras entra na revisão", () => {
  assert.deepEqual(reasons({ confidenceFactors: ["multiplas categorias candidatas"] }), ["Conflito entre regras"]);
});

test("classificação por fallback entra na revisão", () => {
  assert.deepEqual(reasons({ origin: "padrao_titulo_categoria" }), ["Classificação padrão aplicada"]);
});

test("regra não encontrada entra na revisão", () => {
  assert.deepEqual(reasons({ origin: "pendente" }), ["Regra de classificação não encontrada"]);
});

test("atividade válida não entra na revisão", () => {
  assert.deepEqual(
    reasons(
      {},
      {
        categoryOptions: ["Desenvolvimento"],
        subcategoryOptions: ["Back"],
      },
    ),
    [],
  );
});

test("ausência do campo de confiança não invalida os critérios objetivos", () => {
  const { confidence, confidenceLevel, ...classificationWithoutConfidence } = baseClassification;
  assert.deepEqual(reviewReasonsForClassification(classificationWithoutConfidence), []);
});

test("alerta de perfil operacional envia para revisão", () => {
  assert.deepEqual(
    reasons(
      {},
      {
        issues: [
          {
            line: 1,
            field: "LoginUsuario",
            value: "ana.silva",
            severity: "alerta",
            code: "missing_technical_profile",
            message: "Colaborador sem perfil operacional.",
          },
        ],
      },
    ),
    ["Sem subcategoria"],
  );
});
