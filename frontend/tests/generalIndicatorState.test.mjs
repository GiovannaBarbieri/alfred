import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isCompletedGeneralIndicatorValidation,
  requiresConsultationReplacementConfirmation,
  resolveGeneralIndicatorScreenState,
} from "../src/utils/generalIndicatorState.ts";
import {
  hasDerivedClassification,
  operationalPendingCount,
  visibleOperationalIssues,
} from "../src/utils/generalIndicatorIssuePresentation.ts";
import {
  buildExecutiveHoursComposition,
  filterIndicatorCategories,
  hasAdjustedIndicatorHours,
  isStrategicIndicatorCategory,
  participationBarWidth,
  reconciledParticipationPercentage,
  sortIndicatorCategories,
  summarizeHoursComposition,
  summarizeUpdateDistribution,
} from "../src/utils/generalIndicatorResultsPresentation.ts";
import {
  buildCategoryHoursChart,
  buildMonthlyStrategicChart,
  buildPeriodCompositionChart,
  buildQuarterlyKpiChart,
  shouldShowQuarterlyChart,
} from "../src/utils/generalIndicatorCharts.ts";

const base = { hasConsultation: false, uniqueLaunchCount: 0, canFinalize: false, hasFinalData: false, operation: null, hasError: false };

test("1. consulta ainda não executada", () => assert.equal(resolveGeneralIndicatorScreenState(base), "initial"));
test("2. consulta em processamento", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, operation: "consultation" }), "processing"));
test("3. consulta sem resultados", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasConsultation: true }), "empty"));
test("4. consulta com inconsistências", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasConsultation: true, uniqueLaunchCount: 10 }), "inconsistencies"));
test("5. atualização de pendências", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasConsultation: true, uniqueLaunchCount: 10, operation: "pending" }), "processing"));
test("6. consulta pronta para finalizar", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasConsultation: true, uniqueLaunchCount: 10, canFinalize: true }), "ready"));
test("7. finalização em processamento", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasConsultation: true, uniqueLaunchCount: 10, operation: "finalization" }), "finalizing"));
test("8. indicadores finalizados", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasConsultation: true, uniqueLaunchCount: 10, hasFinalData: true }), "finalized"));
test("9. erro de comunicação", () => assert.equal(resolveGeneralIndicatorScreenState({ ...base, hasError: true }), "error"));
test("10. alteração de período com consulta não finalizada exige confirmação", () => {
  assert.equal(requiresConsultationReplacementConfirmation({ hasConsultation: true, isFinalized: false, currentStartDate: "2026-01-01", currentEndDate: "2026-03-31", requestedStartDate: "2026-04-01", requestedEndDate: "2026-06-30" }), true);
  assert.equal(requiresConsultationReplacementConfirmation({ hasConsultation: true, isFinalized: true, currentStartDate: "2026-01-01", currentEndDate: "2026-03-31", requestedStartDate: "2026-04-01", requestedEndDate: "2026-06-30" }), false);
});

const rootIssue = {
  type: "feature_type_invalid", blocking: true, scope: "launch", idLancamento: "269895",
  idFeature: null, affectedLaunchIds: ["269895"],
  details: {
    idTask: "187564", parentItemId: "187563", featureCandidateId: "115886",
    isRootCause: true, isDerived: false, displayGroupKey: "execution:77|cause:feature_type_invalid|task:187564",
    derivedIssueTypes: ["classification_impossible"],
  },
};
const derivedIssue = {
  type: "classification_impossible", blocking: true, scope: "launch", idLancamento: "269895",
  idFeature: null, affectedLaunchIds: ["269895"],
  details: {
    idTask: "187564", isRootCause: false, isDerived: true, derivedFromType: "feature_type_invalid",
    displayGroupKey: "execution:77|cause:feature_type_invalid|task:187564",
  },
};

test("11. causa e consequência geram um único card operacional", () => {
  const technicalIssues = [rootIssue, derivedIssue];
  assert.equal(technicalIssues.length, 2);
  assert.deepEqual(visibleOperationalIssues(technicalIssues), [rootIssue]);
  assert.equal(operationalPendingCount(technicalIssues, 1), 1);
  assert.equal(hasDerivedClassification(rootIssue, technicalIssues), true);
});

test("12. fallback consolida consulta antiga sem metadados de causa", () => {
  const legacyRoot = { ...rootIssue, details: { idTask: "187564", featureCandidateId: "115886" } };
  const legacyDerived = { ...derivedIssue, details: { idTask: "187564" } };
  assert.deepEqual(visibleOperationalIssues([legacyRoot, legacyDerived]), [legacyRoot]);
  assert.equal(operationalPendingCount([legacyRoot, legacyDerived], 2), 1);
});

test("13. classificação sem causa conhecida continua visível", () => {
  const standalone = { ...derivedIssue, idLancamento: "2", affectedLaunchIds: ["2"], details: {} };
  assert.deepEqual(visibleOperationalIssues([standalone]), [standalone]);
});

test("14. causas independentes permanecem separadas", () => {
  const duration = { ...rootIssue, type: "duration_invalid", details: {}, idLancamento: "3", affectedLaunchIds: ["3"] };
  const tag = { ...rootIssue, type: "tag_3_missing", scope: "feature", idFeature: "200", details: {}, idLancamento: null, affectedLaunchIds: ["3"] };
  assert.deepEqual(visibleOperationalIssues([duration, tag]), [duration, tag]);
  assert.equal(operationalPendingCount([duration, tag], 2), 2);
});

test("15. vários lançamentos da mesma causa compartilham a chave de exibição", () => {
  const secondRoot = { ...rootIssue, idLancamento: "269896", affectedLaunchIds: ["269896"] };
  const visible = visibleOperationalIssues([rootIssue, secondRoot, derivedIssue]);
  assert.equal(new Set(visible.map((item) => item.details.displayGroupKey)).size, 1);
  assert.equal(operationalPendingCount([rootIssue, secondRoot, derivedIssue], 1), 1);
});

test("16. consulta com pendências não usa o estado visual concluído", () => {
  assert.equal(isCompletedGeneralIndicatorValidation({ uniqueLaunchCount: 10, canFinalize: false, pendingCount: 2 }), false);
});

test("17. consulta validada sem pendências usa o estado visual concluído", () => {
  assert.equal(isCompletedGeneralIndicatorValidation({ uniqueLaunchCount: 10, canFinalize: true, pendingCount: 0 }), true);
});

test("18. consulta vazia não usa o estado visual concluído", () => {
  assert.equal(isCompletedGeneralIndicatorValidation({ uniqueLaunchCount: 0, canFinalize: true, pendingCount: 0 }), false);
});

test("19. resolução do estado visual preserva os dados recebidos", () => {
  const input = { uniqueLaunchCount: 10, canFinalize: true, pendingCount: 0 };
  const snapshot = { ...input };
  isCompletedGeneralIndicatorValidation(input);
  assert.deepEqual(input, snapshot);
});

const resultCategories = [
  { category: "Outros", originalHours: 10, allocatedHours: 0, adjustedHours: 10, percentage: 10 },
  { category: "Manutenção", originalHours: 30, allocatedHours: 15, adjustedHours: 45, percentage: 45 },
  { category: "Melhoria", originalHours: 20, allocatedHours: 5, adjustedHours: 25, percentage: 25 },
  { category: "Bug", originalHours: 20, allocatedHours: 0, adjustedHours: 20, percentage: 20 },
];

const balancedDistribution = [
  { month: "2026-01", label: "jan./2026", updateSystemHours: 100, distributionBaseHours: 400, maintenanceHours: 50, newProjectHours: 20, improvementHours: 20, itErrorHours: 10, distributedHours: 100, isBalanced: true },
  { month: "2026-03", label: "mar./2026", updateSystemHours: 200, distributionBaseHours: 600, maintenanceHours: 100, newProjectHours: 30, improvementHours: 50, itErrorHours: 20, distributedHours: 200, isBalanced: true },
];

test("20. composição ordena inicialmente por horas ajustadas decrescentes", () => {
  assert.deepEqual(sortIndicatorCategories(resultCategories, "adjustedHours", "desc").map((item) => item.category), ["Manutenção", "Melhoria", "Bug", "Outros"]);
});

test("21. composição permite ordenar todas as colunas", () => {
  assert.equal(sortIndicatorCategories(resultCategories, "category", "asc")[0].category, "Bug");
  assert.equal(sortIndicatorCategories(resultCategories, "originalHours", "desc")[0].category, "Manutenção");
  assert.equal(sortIndicatorCategories(resultCategories, "allocatedHours", "desc")[0].allocatedHours, 15);
  assert.equal(sortIndicatorCategories(resultCategories, "percentage", "asc")[0].percentage, 10);
});

test("22. filtros separam estratégicas e demais sem ocultar por padrão", () => {
  assert.equal(filterIndicatorCategories(resultCategories, "all").length, 4);
  assert.deepEqual(filterIndicatorCategories(resultCategories, "strategic").map((item) => item.category), ["Melhoria", "Bug"]);
  assert.deepEqual(filterIndicatorCategories(resultCategories, "other").map((item) => item.category), ["Outros", "Manutenção"]);
});

test("23. categorias estratégicas e barras de participação são identificadas", () => {
  assert.equal(isStrategicIndicatorCategory("Manutenção"), false);
  assert.equal(isStrategicIndicatorCategory("Novo projeto"), true);
  assert.equal(isStrategicIndicatorCategory("Outros"), false);
  assert.equal(participationBarWidth(45.5), 45.5);
  assert.equal(participationBarWidth(120), 100);
});

test("24. resumo identifica total, maior mês e maior destino", () => {
  const summary = summarizeUpdateDistribution(balancedDistribution);
  assert.equal(summary.totalUpdateHours, 300);
  assert.equal(summary.peakMonth?.month, "2026-03");
  assert.deepEqual(summary.leadingDestination, { category: "Manutenção", hours: 150 });
});

test("24a. resumo inclui Bug como destino da distribuição", () => {
  const summary = summarizeUpdateDistribution([
    {
      ...balancedDistribution[0],
      maintenanceHours: 10,
      newProjectHours: 20,
      improvementHours: 20,
      itErrorHours: 10,
      bugHours: 40,
    },
  ]);
  assert.deepEqual(summary.leadingDestination, { category: "Bug", hours: 40 });
});

test("25. distribuição integral é marcada como conferida", () => {
  const summary = summarizeUpdateDistribution(balancedDistribution);
  assert.equal(summary.isBalanced, true);
  assert.equal(summary.distributedPercentage, 100);
});

test("26. divergência é preservada no resumo", () => {
  const divergent = [{ ...balancedDistribution[0], distributedHours: 90, isBalanced: false }];
  const summary = summarizeUpdateDistribution(divergent);
  assert.equal(summary.isBalanced, false);
  assert.equal(summary.distributedPercentage, 90);
});

test("27. totais e valores de origem permanecem preservados", () => {
  const snapshot = structuredClone(resultCategories);
  const totals = summarizeHoursComposition(resultCategories);
  assert.deepEqual(totals, { originalHours: 80, allocatedHours: 20, adjustedHours: 100, percentage: 100 });
  assert.deepEqual(resultCategories, snapshot);
});

const chartCategories = [
  { category: "Manutenção", originalHours: 25, allocatedHours: 15, adjustedHours: 40, percentage: 40 },
  { category: "Novo projeto", originalHours: 20, allocatedHours: 5, adjustedHours: 25, percentage: 25 },
  { category: "Melhoria", originalHours: 10, allocatedHours: 5, adjustedHours: 15, percentage: 15 },
  { category: "Erro TI", originalHours: 8, allocatedHours: 2, adjustedHours: 10, percentage: 10 },
  { category: "Bug", originalHours: 5, allocatedHours: 0, adjustedHours: 5, percentage: 5 },
  { category: "Reunião", originalHours: 3, allocatedHours: 0, adjustedHours: 3, percentage: 3 },
  { category: "Treinamento", originalHours: 2, allocatedHours: 0, adjustedHours: 2, percentage: 2 },
];

function chartMonth(month, totalHours, projectsHours, errorsHours, categories = {}) {
  return {
    month,
    label: month,
    totalHours,
    projectsImprovements: { hours: projectsHours, percentage: totalHours ? projectsHours / totalHours * 100 : 0, target: 40, difference: 0, status: "within_target" },
    errorsBugs: { hours: errorsHours, percentage: totalHours ? errorsHours / totalHours * 100 : 0, limit: 10, difference: 0, status: "within_target" },
    categories,
  };
}

test("28. gráfico executivo agrupa as categorias operacionais em ordem fixa", () => {
  const data = buildCategoryHoursChart(chartCategories);
  assert.equal(data.length, 6);
  assert.deepEqual(data.map((item) => item.name), ["Novo Projeto", "Melhoria", "Erro TI", "Bug", "Manutenção", "Operacional"]);
  assert.equal(data[4].hours, 40);
  assert.equal(data[4].percentage, 40);
  assert.equal(data[5].hours, 5);
  assert.equal(data[5].percentage, 5);
  assert.deepEqual(data[5].groupedCategories, ["Reunião", "Treinamento"]);
});

test("29. composição separa Manutenção de Operacional e reconcilia o total", () => {
  const data = buildPeriodCompositionChart(chartCategories);
  assert.equal(data.length, 6);
  assert.equal(data.find((item) => item.name === "Manutenção").hours, 40);
  assert.equal(data.find((item) => item.name === "Operacional").hours, 5);
  assert.equal(data.find((item) => item.name === "Operacional").groupedCategories.includes("Manutenção"), false);
  assert.equal(data.reduce((total, item) => total + item.hours, 0), 100);
  assert.equal(data.reduce((total, item) => total + item.percentage, 0), 100);
});

test("29a. snapshot antigo sem Manutenção continua reconciliado", () => {
  const legacyCategories = chartCategories.filter((item) => item.category !== "Manutenção");
  const data = buildPeriodCompositionChart(legacyCategories);
  assert.equal(data.length, 6);
  assert.equal(data.find((item) => item.name === "Manutenção").hours, 0);
  assert.equal(data.reduce((total, item) => total + item.hours, 0), 60);
  assert.equal(Math.round(data.reduce((total, item) => total + item.percentage, 0)), 100);
});

test("30. evolução mensal usa somente os quatro indicadores estratégicos", () => {
  const data = buildMonthlyStrategicChart([
    chartMonth("2026-01", 20, 8, 2, { Manutenção: 5, "Novo projeto": 3, Melhoria: 1, "Erro TI": 1, Bug: 1, Reunião: 9 }),
  ]);
  assert.deepEqual(data[0], { month: "2026-01", label: "2026-01", totalHours: 20, newProject: 3, improvement: 1, itError: 1, bug: 1 });
});

test("31. período mensal ou de um trimestre não exibe comparativo trimestral", () => {
  assert.equal(shouldShowQuarterlyChart([chartMonth("2026-01", 100, 45, 8)]), false);
  assert.equal(shouldShowQuarterlyChart(["01", "02", "03"].map((month) => chartMonth(`2026-${month}`, 100, 45, 8))), false);
});

test("32. período de dois trimestres exibe comparativo trimestral", () => {
  const months = ["01", "02", "03", "04", "05", "06"].map((month) => chartMonth(`2026-${month}`, 100, 45, 8));
  assert.equal(shouldShowQuarterlyChart(months), true);
  assert.equal(buildQuarterlyKpiChart(months).length, 2);
});

test("33. período anual produz quatro trimestres em ordem", () => {
  const months = Array.from({ length: 12 }, (_, index) => chartMonth(`2026-${String(index + 1).padStart(2, "0")}`, 100, 45, 8));
  assert.deepEqual(buildQuarterlyKpiChart(months).map((item) => item.key), ["2026-T1", "2026-T2", "2026-T3", "2026-T4"]);
});

test("34. categorias e períodos sem horas não produzem valores inválidos", () => {
  const composition = buildPeriodCompositionChart([{ category: "Bug", originalHours: 0, allocatedHours: 0, adjustedHours: 0, percentage: 0 }]);
  assert.equal(composition.every((item) => Number.isFinite(item.percentage) && item.percentage === 0), true);
  assert.equal(buildQuarterlyKpiChart([chartMonth("2026-01", 0, 0, 0)])[0].projectsPercentage, 0);
});

test("35. comparativo trimestral reconcilia horas mensais antes de calcular percentuais", () => {
  const quarter = buildQuarterlyKpiChart([
    chartMonth("2026-01", 100, 50, 5),
    chartMonth("2026-02", 200, 70, 25),
    chartMonth("2026-03", 100, 40, 10),
  ], 40, 10)[0];
  assert.equal(quarter.totalHours, 400);
  assert.equal(quarter.projectsHours, 160);
  assert.equal(quarter.projectsPercentage, 40);
  assert.equal(quarter.errorsHours, 40);
  assert.equal(quarter.errorsPercentage, 10);
});

test("36. agrupamento executivo não altera categorias nem KPIs recebidos", () => {
  const categoriesSnapshot = structuredClone(chartCategories);
  const kpis = {
    projectsImprovements: { hours: 40, percentage: 40, target: 40 },
    errorsBugs: { hours: 15, percentage: 15, limit: 10 },
  };
  const kpiSnapshot = structuredClone(kpis);
  buildCategoryHoursChart(chartCategories);
  buildPeriodCompositionChart(chartCategories);
  assert.deepEqual(chartCategories, categoriesSnapshot);
  assert.deepEqual(kpis, kpiSnapshot);
});

test("37. horas ajustadas são destacadas somente quando diferem das originais", () => {
  assert.equal(hasAdjustedIndicatorHours({ category: "Manutenção", originalHours: 100, allocatedHours: 20, adjustedHours: 120, percentage: 60 }), true);
  assert.equal(hasAdjustedIndicatorHours({ category: "Bug", originalHours: 20, allocatedHours: 0, adjustedHours: 20, percentage: 10 }), false);
  assert.equal(hasAdjustedIndicatorHours({ category: "Atualização do sistema", originalHours: 30, allocatedHours: 0, adjustedHours: 0, percentage: 0 }), true);
});

test("38. participação total é reconciliada pelas horas e não pela soma de percentuais arredondados", () => {
  const roundedCategoryPercentages = [43.40, 22.39, 14.62, 4.76, 4.59, 3.04, 2.72, 1.38, 1.25, 0.54, 0.36, 0.32, 0.31, 0.28, 0.03, 0];
  assert.equal(Number(roundedCategoryPercentages.reduce((total, value) => total + value, 0).toFixed(2)), 99.99);
  assert.equal(reconciledParticipationPercentage(16789.92, 16789.92), 100);
});

test("39. visão executiva da composição preserva a ordem e consolida as demais categorias", () => {
  const data = buildExecutiveHoursComposition(chartCategories);
  assert.deepEqual(data.map((item) => item.category), ["Manutenção", "Novo projeto", "Melhoria", "Erro TI", "Bug", "Operacional"]);
  assert.deepEqual(data.at(-1), {
    category: "Operacional",
    originalHours: 5,
    allocatedHours: 0,
    adjustedHours: 5,
    percentage: 5,
  });
});

test("40. total estratégico mensal reconcilia as quatro categorias exibidas", () => {
  const [month] = buildMonthlyStrategicChart([
    chartMonth("2026-01", 20, 8, 2, { "Novo projeto": 3, Melhoria: 1, "Erro TI": 1, Bug: 1, Reunião: 14 }),
  ]);
  assert.equal(month.newProject + month.improvement + month.itError + month.bug, 6);
});
