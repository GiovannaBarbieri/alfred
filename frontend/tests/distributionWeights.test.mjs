import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  distributionWeightInfluence,
  displayDistributionCategory,
  hasActiveDistributionCategory,
  isAllowedDistributionWeight,
} from "../src/utils/distributionWeights.ts";

const pageSource = readFileSync(
  new URL("../src/pages/DistributionWeightsSettingsPage.tsx", import.meta.url),
  "utf8",
);
const serviceSource = readFileSync(
  new URL("../src/services/distributionWeightsService.ts", import.meta.url),
  "utf8",
);

test("influência acompanha os cinco pesos permitidos", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(distributionWeightInfluence),
    ["Baixa", "Moderadamente baixa", "Média", "Alta", "Muito alta"],
  );
});

test("peso aceita somente inteiros entre um e cinco", () => {
  assert.equal(isAllowedDistributionWeight(1), true);
  assert.equal(isAllowedDistributionWeight(5), true);
  assert.equal(isAllowedDistributionWeight(0), false);
  assert.equal(isAllowedDistributionWeight(6), false);
  assert.equal(isAllowedDistributionWeight(2.5), false);
});

test("é obrigatório manter ao menos uma categoria participante", () => {
  assert.equal(hasActiveDistributionCategory([{ active: false }, { active: false }]), false);
  assert.equal(hasActiveDistributionCategory([{ active: false }, { active: true }]), true);
});

test("nome técnico de Novo projeto é apresentado como Novo Projeto", () => {
  assert.equal(displayDistributionCategory("Novo projeto"), "Novo Projeto");
  assert.equal(displayDistributionCategory("Bug"), "Bug");
});

test("tela usa select, participação e confirmação de restauração", () => {
  assert.match(pageSource, /<select/);
  assert.match(pageSource, /type="checkbox"/);
  assert.match(pageSource, /window\.confirm/);
  assert.match(pageSource, /Pesos padrão restaurados|Restaurar padrão/);
});

test("service implementa carregamento, salvamento e restauração", () => {
  assert.match(serviceSource, /getDistributionWeights/);
  assert.match(serviceSource, /method: "PUT"/);
  assert.match(serviceSource, /restore-defaults/);
});
