import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  analysisReportActiveItem,
  isAnalysisReportSection,
  projectModuleActiveItem,
} from "../src/types/navigation.ts";
import {
  navigationGroupForSection,
  toggleNavigationGroup,
} from "../src/utils/navigationAccordion.ts";

const appShellSource = readFileSync(
  new URL("../src/components/AppShell.tsx", import.meta.url),
  "utf8",
);

test("telas do fluxo de projetos mantêm Projetos ativo", () => {
  for (const section of ["import", "validation", "reports", "history"]) {
    assert.equal(isAnalysisReportSection(section), true);
    assert.equal(analysisReportActiveItem(section), "import");
  }
});

test("Indicadores Gerais mantém o grupo e o submenu ativos", () => {
  assert.equal(isAnalysisReportSection("general-indicators"), true);
  assert.equal(analysisReportActiveItem("general-indicators"), "general-indicators");
});

test("Meus Relatórios mantém o grupo e o submenu ativos", () => {
  assert.equal(isAnalysisReportSection("my-reports"), true);
  assert.equal(analysisReportActiveItem("my-reports"), "my-reports");
});

test("Comparação de Relatórios mantém o grupo e o submenu próprios ativos", () => {
  assert.equal(isAnalysisReportSection("report-comparison"), true);
  assert.equal(analysisReportActiveItem("report-comparison"), "report-comparison");
});

test("Configurações fecha o grupo de análises", () => {
  assert.equal(isAnalysisReportSection("settings"), false);
  assert.equal(analysisReportActiveItem("settings"), null);
  assert.equal(isAnalysisReportSection("distribution-weights"), false);
  assert.equal(analysisReportActiveItem("distribution-weights"), null);
});

test("Configurações gerais preserva o acesso a categorias, cargos e colaboradores", () => {
  assert.match(appShellSource, /<span>Configurações gerais<\/span>/);
  assert.doesNotMatch(appShellSource, /<span>Colaboradores Excluídos<\/span>/);
  assert.match(appShellSource, /<span>Distribuição das categorias<\/span>/);
  assert.doesNotMatch(appShellSource, /<span>Pesos da Distribuição<\/span>/);
});

test("módulo Projetos preserva acesso direto à importação e aos relatórios", () => {
  assert.equal(projectModuleActiveItem("import"), "import");
  assert.equal(projectModuleActiveItem("validation"), "import");
  assert.equal(projectModuleActiveItem("reports"), "reports");
  assert.equal(projectModuleActiveItem("general-indicators"), null);
});

test("Accordion mantém somente um grupo expandido", () => {
  assert.equal(toggleNavigationGroup("reports", "settings"), "settings");
  assert.equal(toggleNavigationGroup("settings", "reports"), "reports");
  assert.equal(toggleNavigationGroup("reports", "reports"), null);
  assert.equal(toggleNavigationGroup("settings", "settings"), null);
});

test("grupo da página ativa é restaurado automaticamente", () => {
  assert.equal(navigationGroupForSection("general-indicators"), "reports");
  assert.equal(navigationGroupForSection("my-reports"), "reports");
  assert.equal(navigationGroupForSection("report-comparison"), "reports");
  assert.equal(navigationGroupForSection("settings"), "settings");
  assert.equal(navigationGroupForSection("distribution-weights"), "settings");
  assert.equal(navigationGroupForSection("audit"), null);
});
