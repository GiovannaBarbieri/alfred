import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  periodForShortcut,
  validatePeriod,
} from "../src/utils/reportPeriodAnalysis.ts";
import { buildPeriodEvolutionChart } from "../src/utils/generalIndicatorCharts.ts";
import { normalizePeriodAnalysisResponse } from "../src/utils/reportPeriodAnalysisResponse.ts";
import {
  formatCountPtBr,
  formatHoursPtBr,
  formatPercentagePtBr,
} from "../src/utils/numberFormatting.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("pages/MyReportsPage.tsx");
const analyses = read("components/my-reports/ReportAnalysesPanel.tsx");
const component = read("components/my-reports/ReportPeriodAnalysisPanel.tsx");
const charts = read("components/general-indicators/GeneralIndicatorManagementCharts.tsx");
const service = read("services/reportHistoryService.ts");
const hook = read("hooks/useReportPeriodAnalysis.ts");
const styles = read("styles.css");

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
});

test("validação bloqueia datas vazias, invertidas e externas", () => {
  assert.match(validatePeriod("", "2026-06-20", "2026-01-01", "2026-06-30"), /Data Inicial/);
  assert.match(validatePeriod("2026-01-01", "", "2026-01-01", "2026-06-30"), /Data Final/);
  assert.match(validatePeriod("2026-04-01", "2026-03-31", "2026-01-01", "2026-06-30"), /menor ou igual/);
  assert.match(validatePeriod("2025-12-31", "2026-03-31", "2026-01-01", "2026-06-30"), /período oficial/);
  assert.equal(validatePeriod("2026-02-01", "2026-03-31", "2026-01-01", "2026-06-30"), null);
});

test("relatório possui somente as abas principais Visão Geral e Análises", () => {
  assert.match(page, /Visão Geral/);
  assert.match(page, />\s*Análises\s*</);
  assert.match(page, /ReportAnalysesPanel/);
  assert.doesNotMatch(page, />\s*Análise por período\s*</);
});

test("Análises possui seletor interno compacto apenas com Por período", () => {
  assert.match(analyses, /Tipos de análise/);
  assert.match(analyses, /Por período/);
  assert.match(analyses, /Comparação/);
  assert.match(analyses, /ReportPeriodAnalysisPanel/);
  assert.doesNotMatch(analyses, /Categoria|Linha do tempo|Exportação|inteligência artificial/i);
  assert.match(styles, /\.saved-report-analysis-selector/);
});

test("filtros e ações possuem proporções de desktop e comportamento mobile", () => {
  assert.match(styles, /grid-template-columns:\s*repeat\(2, minmax\(190px, 220px\)\) 180px 132px/);
  assert.match(styles, /\.report-period-analyze-button[\s\S]*?width:\s*180px/);
  assert.match(styles, /\.report-period-clear-button[\s\S]*?width:\s*132px/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.report-period-analyze-button,[\s\S]*?width:\s*100%/);
});

test("resultado e quatro KPIs usam apresentação compacta e neutra", () => {
  assert.match(component, /Resultado da análise/);
  assert.match(component, /period-analysis-kpi/g);
  assert.doesNotMatch(component, /className=\{`general-indicator-card \$\{kpi\.status\}`\}/);
  assert.match(component, /Erro TI \+ Bug/);
  assert.match(styles, /\.report-period-analysis-caption/);
});

test("gráficos recebem variação visual exclusiva da análise", () => {
  assert.match(component, /analysisView/);
  assert.match(charts, /period-analysis-chart/);
  assert.match(styles, /\.report-period-analysis \.period-analysis-composition/);
  assert.match(styles, /\.report-period-analysis \.monthly-category-chart/);
});

test("tooltip executivo apresenta total, horas e participação e omite zeros", () => {
  assert.match(charts, /filter\(\(item\) => Number\(item\.value \|\| 0\) > 0\)/);
  assert.match(charts, /\["Total", formatHoursPtBr\(totalHours\)\]/);
  assert.match(charts, /formatPercentagePtBr\(participation\)/);
  assert.match(charts, /periodTooltipTitle/);
});

test("formatadores pt-BR padronizam horas, percentuais e contagens", () => {
  assert.equal(formatHoursPtBr(8316.32), "8.316,32 h");
  assert.equal(formatPercentagePtBr(39.28), "39,28%");
  assert.equal(formatCountPtBr(9413), "9.413");
});

test("análise reutiliza gráficos e possui estados inicial, carregando, vazio e erro", () => {
  assert.match(component, /GeneralIndicatorCompositionChart/);
  assert.match(component, /GeneralIndicatorMonthlyCategoryChart/);
  assert.match(component, /Analisando o período/);
  assert.match(component, /Sem dados no período/);
  assert.match(component, /Selecione um intervalo dentro do período do relatório para gerar a análise/);
  assert.match(component, /role="alert"/);
});

test("service chama somente o endpoint de snapshot por período", () => {
  assert.match(service, /reports\/\$\{id\}\/period-analysis/);
  assert.match(service, /startDate, endDate/);
  assert.doesNotMatch(hook, /consultGeneralIndicator|SQLServer|TFS/);
  assert.match(hook, /requestInFlight/);
});

test("contrato antigo é normalizado sem derrubar a tela", () => {
  const legacy = {
    reportId: 36,
    source: "SAVED_SNAPSHOT",
    officialPeriod: { startDate: "2026-01-01", endDate: "2026-06-30" },
    analyzedPeriod: { startDate: "2026-01-01", endDate: "2026-06-30" },
    recordCount: 10,
    totalHours: 25,
    kpis: {
      projectsImprovements: { hours: 10, percentage: 40, difference: 0, status: "ON_TARGET", target: 40 },
      errorsBugs: { hours: 2.5, percentage: 10, difference: 0, status: "WITHIN_LIMIT", limit: 10 },
    },
    categories: [],
    months: [],
  };
  const normalized = normalizePeriodAnalysisResponse(legacy);
  assert.deepEqual(normalized.evolution, []);
  assert.equal(normalized.granularity, "MONTH");
  assert.equal(normalized.summary.consideredLaunchCount, 10);
  assert.deepEqual(normalized.appliedWeights, []);
});

test("filtros HTML também aplicam min e max do relatório", () => {
  assert.match(component, /min=\{officialStart\}/);
  assert.match(component, /max=\{officialEnd\}/);
  assert.match(component, /Período completo/);
  assert.match(component, /Primeiro mês/);
  assert.match(component, /Último mês/);
  assert.match(component, />\s*Limpar\s*</);
});

test("Limpar restaura o período completo sem iniciar nova consulta", () => {
  const clearBody = hook.match(/function clear\(\) \{([\s\S]*?)\n  \}/)?.[1] ?? "";
  assert.match(clearBody, /setStartDate\(officialStart\)/);
  assert.match(clearBody, /setEndDate\(officialEnd\)/);
  assert.match(clearBody, /setResult\(null\)/);
  assert.doesNotMatch(clearBody, /getReportPeriodAnalysis|analyze/);
});

test("evolução executiva preserva as seis categorias", () => {
  const [point] = buildPeriodEvolutionChart([{
    month: "2026-01-01",
    label: "01/01",
    competence: { startDate: "2026-01-01", endDate: "2026-01-01" },
    totalHours: 21,
    projectsImprovements: { hours: 7, percentage: 33.33, target: 40, status: "BELOW_TARGET" },
    errorsBugs: { hours: 7, percentage: 33.33, target: 10, status: "ABOVE_LIMIT" },
    categories: {
      "Novo projeto": 3,
      Melhoria: 4,
      "Erro TI": 5,
      Bug: 2,
      Manutenção: 6,
      Treinamento: 1,
    },
  }]);
  assert.equal(point.newProject, 3);
  assert.equal(point.improvement, 4);
  assert.equal(point.itError, 5);
  assert.equal(point.bug, 2);
  assert.equal(point.maintenance, 6);
  assert.equal(point.operational, 1);
});
