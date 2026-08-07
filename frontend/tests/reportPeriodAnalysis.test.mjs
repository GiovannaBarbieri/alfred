import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildPeriodEvolutionChart } from "../src/utils/generalIndicatorCharts.ts";
import {
  validateSnapshotPeriod,
} from "../src/utils/savedReportSnapshotPeriodAnalysis.ts";
import {
  formatChartLabelHoursPtBr,
  formatChartLabelPercentagePtBr,
  formatCountPtBr,
  formatHoursPtBr,
  formatPercentagePtBr,
} from "../src/utils/numberFormatting.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const page = read("pages/MyReportsPage.tsx");
const component = read("components/my-reports/ReportPeriodAnalysisPanel.tsx");
const charts = read("components/general-indicators/GeneralIndicatorManagementCharts.tsx");
const service = read("services/reportHistoryService.ts");
const hook = read("hooks/useReportPeriodAnalysis.ts");
const styles = read("styles.css");

test("detalhe do relatório não possui aba Análises e inclui análise por período na visão geral", () => {
  assert.doesNotMatch(page, /activeReportTab|saved-report-tabs|ReportAnalysesPanel/);
  assert.match(page, /periodAnalysisSlot/);
  assert.match(page, /ReportPeriodAnalysisPanel/);
  assert.match(component, /<details className="panel report-period-analysis-card">/);
  assert.match(component, /Análise por período/);
});

test("card inicia recolhível e não oferece atalhos ou abas internas", () => {
  assert.match(component, /Selecione um intervalo dentro do período deste relatório para visualizar indicadores específicos\./);
  assert.doesNotMatch(component, /Período completo|Primeiro mês|Último mês|Tipo de análise|Por período/);
  assert.match(styles, /\.report-period-analysis-card > summary/);
  assert.match(styles, /\.report-period-analysis-card\[open\] > summary/);
});

test("accordions do relatorio salvo seguem a nova ordem e iniciam fechados", () => {
  const finalizedPanel = read("components/general-indicators/GeneralIndicatorFinalizedPanel.tsx");
  const periodIndex = finalizedPanel.indexOf("{periodAnalysisSlot}");
  const quarterlyIndex = finalizedPanel.indexOf("accordion />");
  const hoursIndex = finalizedPanel.indexOf('title="Composição das horas"');
  const updateIndex = finalizedPanel.indexOf('title="Distribuição da Atualização do sistema"');
  const modulesIndex = finalizedPanel.indexOf('title="Módulos desconsiderados nesta consulta"');

  assert.ok(periodIndex >= 0);
  assert.ok(quarterlyIndex >= 0);
  assert.ok(periodIndex < quarterlyIndex);
  assert.ok(quarterlyIndex < hoursIndex);
  assert.ok(hoursIndex < updateIndex);
  assert.ok(updateIndex < modulesIndex);
  assert.match(charts, /accordion = false/);
  assert.match(charts, /general-indicator-technical-accordion/);
  assert.doesNotMatch(component, /<details className="panel report-period-analysis-card" open/);
  assert.doesNotMatch(charts, /<details className="panel general-indicator-technical-accordion" open/);
});

test("validação visual ignora datas incompletas e bloqueia apenas intervalos inválidos", () => {
  assert.deepEqual(
    validateSnapshotPeriod("", "2026-06-20", "2026-01-01", "2026-06-30"),
    {},
  );
  assert.deepEqual(
    validateSnapshotPeriod("2026-01-01", "", "2026-01-01", "2026-06-30"),
    {},
  );
  assert.deepEqual(
    validateSnapshotPeriod("2026-04-01", "2026-03-31", "2026-01-01", "2026-06-30"),
    { endDate: "A data final não pode ser anterior à data inicial." },
  );
  assert.deepEqual(
    validateSnapshotPeriod("2025-12-31", "2026-07-01", "2026-01-01", "2026-06-30"),
    {
      startDate: "A data inicial deve estar dentro do período do relatório.",
      endDate: "A data final deve estar dentro do período do relatório.",
    },
  );
  assert.deepEqual(validateSnapshotPeriod("2026-02-01", "2026-03-31", "2026-01-01", "2026-06-30"), {});
});

test("campos HTML aplicam min e max e botões respeitam validação", () => {
  assert.match(component, /min=\{officialStart\}/);
  assert.match(component, /max=\{officialEnd\}/);
  assert.match(component, /disabled=\{!canAnalyze\}/);
  assert.match(component, /disabled=\{!canClear\}/);
  assert.match(component, />\s*Limpar\s*</);
  assert.match(component, /aria-invalid=\{Boolean\(validation\.startDate\)\}/);
  assert.match(component, /aria-invalid=\{Boolean\(validation\.endDate\)\}/);
  assert.doesNotMatch(component, /Revise as datas informadas para continuar/);
});

test("análise por período reutiliza o cálculo oficial de snapshot salvo", () => {
  assert.match(component, /useReportPeriodAnalysis/);
  assert.match(service, /reports\/\$\{id\}\/period-analysis/);
  assert.doesNotMatch(hook, /consultGeneralIndicator|SQLServer|TFS/);
  assert.doesNotMatch(component, /getReportPeriodAnalysis|reports\/\$\{id\}\/period-analysis/);
});

test("resultado exibe quatro indicadores e dois gráficos", () => {
  assert.match(component, /Total de horas/);
  assert.match(component, /Lançamentos considerados/);
  assert.match(component, /Novos projetos \+ melhorias/);
  assert.match(component, /Erro TI \+ Bug/);
  assert.match(component, /report-period-kpi-strip/);
  assert.match(component, /period-analysis-metric is-informative/);
  assert.match(component, /period-analysis-metric is-kpi/);
  assert.match(component, /statusLabels\[kpi\.status\]/);
  assert.match(component, /GeneralIndicatorCompositionChart/);
  assert.match(component, /GeneralIndicatorMonthlyCategoryChart/);
  assert.match(component, /Período analisado/);
});

test("relatório salvo permite exportar cards gráficos como imagens", () => {
  const finalizedPanel = read("components/general-indicators/GeneralIndicatorFinalizedPanel.tsx");
  const exportButton = read("components/general-indicators/ChartExportButton.tsx");
  const exportUtils = read("utils/chartImageExport.ts");
  assert.match(page, /SavedReportExportMenu/);
  assert.match(page, /Exportar todas as imagens \(\.zip\)/);
  assert.match(page, /Exportar gráfico atual \(\.png\)/);
  assert.match(charts, /data-chart-export-card/);
  assert.match(finalizedPanel, /data-chart-export-card/);
  assert.match(exportButton, /data-export-exclude/);
  assert.match(exportUtils, /data-chart-export-card/);
  assert.match(exportUtils, /data-export-exclude/);
  assert.match(exportUtils, /data-period-analysis-result/);
  assert.match(component, /data-period-analysis-result/);
  assert.match(exportUtils, /type: "application\/zip"/);
});

test("Limpar restaura datas vazias e resultado local", () => {
  assert.match(hook, /setStartDate\(""\)/);
  assert.match(hook, /setEndDate\(""\)/);
  assert.match(hook, /setResult\(null\)/);
});

test("formatadores pt-BR padronizam horas, percentuais e contagens", () => {
  assert.equal(formatHoursPtBr(8316.32), "8.316,32 h");
  assert.equal(formatPercentagePtBr(39.28), "39,28%");
  assert.equal(formatChartLabelHoursPtBr(2422.02), "2.422,0h");
  assert.equal(formatChartLabelPercentagePtBr(14.43), "14,4%");
  assert.equal(formatCountPtBr(9413), "9.413");
});

test("gráficos preservam variação visual da análise", () => {
  assert.match(component, /analysisView/);
  assert.match(component, /strategicOnly/);
  assert.match(charts, /strategicOnly \? STRATEGIC_CHART_SERIES : executive \? EXECUTIVE_CHART_SERIES : STRATEGIC_CHART_SERIES/);
  assert.match(charts, /periodTitle=\{executive \|\| strategicOnly\}/);
  assert.match(charts, /period-analysis-chart/);
  assert.match(styles, /\.report-period-analysis \.period-analysis-composition/);
  assert.match(styles, /\.report-period-analysis \.monthly-category-chart/);
  assert.match(charts, /analysisView \? \(\s*<PeriodCompositionBars data=\{visibleData\} \/>/);
  assert.match(charts, /<PieChart>/);
  assert.match(charts, /period-composition-legend/);
  assert.match(styles, /\.period-composition-bars/);
});

test("evolução executiva preserva as seis categorias", () => {
  const [point] = buildPeriodEvolutionChart([{
    month: "2026-01-01",
    label: "01/01",
    competence: { startDate: "2026-01-01", endDate: "2026-01-01" },
    totalHours: 21,
    projectsImprovements: { hours: 7, percentage: 33.33, target: 40, status: "attention" },
    errorsBugs: { hours: 7, percentage: 33.33, target: 10, status: "critical" },
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
