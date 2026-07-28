import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  periodForShortcut,
  validatePeriod,
} from "../src/utils/reportPeriodAnalysis.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("pages/MyReportsPage.tsx");
const component = read("components/my-reports/ReportPeriodAnalysisPanel.tsx");
const service = read("services/reportHistoryService.ts");
const hook = read("hooks/useReportPeriodAnalysis.ts");

test("atalhos respeitam os limites oficiais do relatório", () => {
  assert.deepEqual(
    periodForShortcut("complete", "2026-01-10", "2026-06-20"),
    { startDate: "2026-01-10", endDate: "2026-06-20" },
  );
  assert.deepEqual(
    periodForShortcut("first-month", "2026-01-10", "2026-06-20"),
    { startDate: "2026-01-10", endDate: "2026-01-31" },
  );
  assert.deepEqual(
    periodForShortcut("last-month", "2026-01-10", "2026-06-20"),
    { startDate: "2026-06-01", endDate: "2026-06-20" },
  );
  assert.deepEqual(
    periodForShortcut("clear", "2026-01-10", "2026-06-20"),
    { startDate: "", endDate: "" },
  );
});

test("validação bloqueia datas vazias, invertidas e externas", () => {
  assert.match(validatePeriod("", "2026-06-20", "2026-01-01", "2026-06-30"), /Data Inicial/);
  assert.match(validatePeriod("2026-01-01", "", "2026-01-01", "2026-06-30"), /Data Final/);
  assert.match(validatePeriod("2026-04-01", "2026-03-31", "2026-01-01", "2026-06-30"), /menor ou igual/);
  assert.match(validatePeriod("2025-12-31", "2026-03-31", "2026-01-01", "2026-06-30"), /período oficial/);
  assert.equal(validatePeriod("2026-02-01", "2026-03-31", "2026-01-01", "2026-06-30"), null);
});

test("aba reutiliza visualizações existentes e possui todos os estados", () => {
  assert.match(page, /Visão Geral/);
  assert.match(page, /Análise por período/);
  assert.match(page, /ReportPeriodAnalysisPanel/);
  assert.match(component, /GeneralIndicatorCategoryCharts/);
  assert.match(component, /GeneralIndicatorMonthlyCategoryChart/);
  assert.match(component, /Analisando o período/);
  assert.match(component, /Sem dados no período/);
  assert.match(component, /role="alert"/);
});

test("service chama somente o endpoint de snapshot por período", () => {
  assert.match(service, /reports\/\$\{id\}\/period-analysis/);
  assert.match(service, /startDate, endDate/);
  assert.doesNotMatch(hook, /consultGeneralIndicator|SQLServer|TFS/);
});

test("filtros HTML também aplicam min e max do relatório", () => {
  assert.match(component, /min=\{officialStart\}/);
  assert.match(component, /max=\{officialEnd\}/);
  assert.match(component, /Período completo/);
  assert.match(component, /Primeiro mês/);
  assert.match(component, /Último mês/);
});
