import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  sortCategoryComparison,
  toggleSortDirection,
  validateComparisonPeriod,
} from "../src/utils/reportPeriodComparison.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const analyses = read("components/my-reports/ReportAnalysesPanel.tsx");
const component = read("components/my-reports/ReportPeriodsComparisonPanel.tsx");
const hook = read("hooks/useReportPeriodsComparison.ts");
const service = read("services/reportHistoryService.ts");
const styles = read("styles.css");

const categories = [
  {
    category: "Melhoria",
    hoursA: 10,
    hoursB: 15,
    participationA: 25,
    participationB: 30,
    absoluteDifference: 5,
    percentageDifference: 50,
    direction: "INCREASE",
  },
  {
    category: "Bug",
    hoursA: 8,
    hoursB: 2,
    participationA: 20,
    participationB: 4,
    absoluteDifference: -6,
    percentageDifference: -75,
    direction: "REDUCTION",
  },
];

test("validação exige intervalos válidos dentro do snapshot", () => {
  assert.match(
    validateComparisonPeriod("Período A", "", "2026-01-31", "2026-01-01", "2026-06-30"),
    /Período A.*Data Inicial/,
  );
  assert.match(
    validateComparisonPeriod("Período B", "2026-02-01", "2026-02-01", "2026-01-01", "2026-06-30"),
    /anterior à Data Final/,
  );
  assert.match(
    validateComparisonPeriod("Período B", "2026-07-01", "2026-07-31", "2026-01-01", "2026-06-30"),
    /período oficial/,
  );
  assert.equal(
    validateComparisonPeriod("Período A", "2026-01-01", "2026-01-31", "2026-01-01", "2026-06-30"),
    null,
  );
});

test("ordenação funciona por categoria, períodos e variação", () => {
  assert.deepEqual(
    sortCategoryComparison(categories, "category", "asc").map((item) => item.category),
    ["Bug", "Melhoria"],
  );
  assert.deepEqual(
    sortCategoryComparison(categories, "hoursB", "desc").map((item) => item.category),
    ["Melhoria", "Bug"],
  );
  assert.deepEqual(
    sortCategoryComparison(categories, "variation", "asc").map((item) => item.category),
    ["Bug", "Melhoria"],
  );
  assert.equal(toggleSortDirection("hoursA", "desc", "hoursA"), "asc");
  assert.equal(toggleSortDirection("hoursA", "asc", "hoursB"), "desc");
});

test("Análises oferece somente Por período e Comparação", () => {
  assert.match(analyses, /Por período/);
  assert.match(analyses, /Comparação/);
  assert.match(analyses, /ReportPeriodAnalysisPanel/);
  assert.match(analyses, /ReportPeriodsComparisonPanel/);
  assert.doesNotMatch(analyses, /Linha do tempo|Inteligência artificial|Exportação/);
});

test("consulta usa apenas o endpoint específico do snapshot", () => {
  assert.match(service, /reports\/\$\{id\}\/compare-periods/);
  assert.match(service, /startDateA/);
  assert.match(service, /endDateB/);
  assert.match(hook, /requestInFlight/);
  assert.doesNotMatch(hook, /consultGeneralIndicator|SQLServer|TFS/);
});

test("períodos possuem estados e atalhos independentes", () => {
  assert.match(hook, /setPeriodA/);
  assert.match(hook, /setPeriodB/);
  assert.match(hook, /target === "A"/);
  assert.match(component, /onShortcut=\{\(shortcut\) => comparison\.applyShortcut\("A"/);
  assert.match(component, /onShortcut=\{\(shortcut\) => comparison\.applyShortcut\("B"/);
  assert.match(component, /Período completo/);
  assert.match(component, /Primeiro mês/);
  assert.match(component, /Último mês/);
});

test("tela contempla estados, aviso de duração, cards, tabela, gráfico e resumo", () => {
  assert.match(component, /Comparando períodos/);
  assert.match(component, /role="alert"/);
  assert.match(component, /não possui lançamentos considerados/);
  assert.match(component, /Os períodos possuem durações diferentes/);
  assert.match(component, /Total de horas/);
  assert.match(component, /Lançamentos considerados/);
  assert.match(component, /Novos Projetos \+ Melhorias/);
  assert.match(component, /Erro TI \+ Bug/);
  assert.match(component, /Comparação por categoria/);
  assert.match(component, /<BarChart/);
  assert.match(component, /Resumo comparativo/);
  assert.match(component, /title=\{variationTooltip\(item\)\}/);
});

test("layout quebra períodos, cards, ações e gráfico no mobile", () => {
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.report-comparison-periods/);
  assert.match(styles, /\.report-comparison-actions button \{ width: 100%; \}/);
  assert.match(styles, /\.report-comparison-chart-area \{ height: 300px; min-width: 0; overflow-x: auto; \}/);
});
