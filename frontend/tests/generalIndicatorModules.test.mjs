import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDisregardedModulesPresentation } from "../src/utils/disregardedModulesPresentation.ts";

const page = readFileSync(new URL("../src/pages/GeneralIndicatorModulesSettingsPage.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/services/generalIndicatorModulesService.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/components/AppShell.tsx", import.meta.url), "utf8");
const results = readFileSync(new URL("../src/components/general-indicators/GeneralIndicatorFinalizedPanel.tsx", import.meta.url), "utf8");

test("menu expõe Módulos dentro de Configurações", () => {
  assert.match(shell, /onSectionChange\("indicator-modules"\)/);
  assert.match(shell, /<span>Módulos<\/span>/);
});

test("tela possui resumo, busca, filtros, switch e confirmação", () => {
  assert.match(page, /Total de módulos/);
  assert.match(page, /Módulos ativos/);
  assert.match(page, /Módulos inativos/);
  assert.match(page, /Buscar módulo\.\.\./);
  assert.match(page, /Todos/);
  assert.match(page, /Ativos/);
  assert.match(page, /Inativos/);
  assert.match(page, /type="checkbox"/);
  assert.match(page, /ModuleConfirmationModal/);
});

test("service usa endpoints de listagem, atualização e sincronização", () => {
  assert.match(service, /\/settings\/modules"/);
  assert.match(service, /\/settings\/modules\/\$\{id\}/);
  assert.match(service, /\/settings\/modules\/sync/);
});

test("resultado informa módulos desconsiderados sem criar gráfico", () => {
  assert.match(results, /Módulos desconsiderados nesta consulta/);
  assert.match(results, /disregardedModules/);
});

test("resumo ordena por impacto, ignora horas zeradas e calcula os totais", () => {
  const result = buildDisregardedModulesPresentation([
    { tagName: "1-BI", hours: 207.72, launchCount: 2 },
    { tagName: "1-Zerado", hours: 0, launchCount: 1 },
    { tagName: "1-Spider", hours: 2082.28, launchCount: 10 },
    { tagName: "1-Banco", hours: 1534.08, launchCount: 6 },
  ]);

  assert.deepEqual(result.modules.map((item) => item.tagName), ["1-Spider", "1-Banco", "1-BI"]);
  assert.equal(result.moduleCount, 3);
  assert.equal(result.totalHours, 3824.08);
});

test("card possui resumo único e não repete total no final da lista", () => {
  assert.match(results, /general-indicator-summary-grid disregarded-modules-cards/);
  assert.match(results, /<span>Módulos desconsiderados<\/span>/);
  assert.doesNotMatch(results, /className="total"/);
});
