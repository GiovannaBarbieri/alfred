import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  sortCategoryComparison,
  toggleSortDirection,
} from "../src/utils/reportPeriodComparison.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const analyses = read("components/my-reports/ReportAnalysesPanel.tsx");
const page = read("pages/ReportComparisonPage.tsx");
const app = read("App.tsx");
const navigation = read("types/navigation.ts");
const shell = read("components/AppShell.tsx");
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

test("ordenação funciona por categoria, relatórios e variação", () => {
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

test("detalhe do relatório mantém somente a análise Por período", () => {
  assert.match(analyses, /Por período/);
  assert.match(analyses, /ReportPeriodAnalysisPanel/);
  assert.doesNotMatch(analyses, /Comparação|ReportPeriodsComparisonPanel/);
  assert.doesNotMatch(analyses, /Linha do tempo|Inteligência artificial|Exportação/);
});

test("Comparação de Relatórios é um módulo independente e reutiliza o painel existente", () => {
  assert.match(page, /ReportPeriodsComparisonPanel/);
  assert.match(page, /onCreateReport/);
  assert.match(app, /activeSection === "report-comparison"/);
  assert.match(app, /<ReportComparisonPage/);
  assert.match(navigation, /"report-comparison"/);
  assert.match(navigation, /title: "Comparação de Relatórios"/);
  assert.match(shell, /label: "Comparação de Relatórios"/);
});

test("consulta lista revisões e compara apenas snapshots persistidos", () => {
  assert.match(service, /reports\/comparison-options/);
  assert.match(service, /reports\/compare/);
  assert.match(service, /reportARevisionId/);
  assert.match(service, /reportBRevisionId/);
  assert.match(hook, /listReportComparisonOptions/);
  assert.match(hook, /compareSavedReports/);
  assert.match(hook, /requestInFlight/);
  assert.doesNotMatch(hook, /startDateA|endDateB|consultGeneralIndicator|SQLServer|TFS/);
});

test("seleção inicia vazia e nunca compara automaticamente", () => {
  assert.match(hook, /reportARevisionId, setReportARevisionId.*null/);
  assert.match(hook, /reportBRevisionId, setReportBRevisionId.*null/);
  assert.match(hook, /result, setResult.*null/);
  assert.match(component, /Selecione dois relatórios/);
  assert.match(component, /Nenhuma análise é carregada automaticamente/);
  assert.match(component, /onClick=\{\(\) => void comparison\.compare\(\)\}/);
});

test("painel oferece tipo, contexto e versões CURRENT ou históricas", () => {
  assert.match(component, /Tipo do relatório/);
  assert.match(component, /Tipo de comparação/);
  assert.match(component, /Livre/);
  assert.match(component, /Trimestre/);
  assert.match(component, /Semestre/);
  assert.match(component, /Ano/);
  assert.match(component, /Relatório A/);
  assert.match(component, /Relatório B/);
  assert.match(component, /versionNumber/);
  assert.match(component, /CURRENT/);
  assert.match(component, /generatedAt/);
});

test("resultado mantém avisos, contexto, médias, cards, tabela, gráfico e resumo", () => {
  assert.match(component, /Comparando relatórios/);
  assert.match(component, /role="alert"/);
  assert.match(component, /result\.warnings/);
  assert.match(component, /ComparisonContext/);
  assert.match(component, /Total de horas/);
  assert.match(component, /Lançamentos considerados/);
  assert.match(component, /Colaboradores considerados/);
  assert.match(component, /Média de horas por dia/);
  assert.match(component, /Média de lançamentos por dia/);
  assert.match(component, /Novos Projetos \+ Melhorias/);
  assert.match(component, /Erro TI \+ Bug/);
  assert.match(component, /Comparação por categoria/);
  assert.match(component, /<BarChart/);
  assert.match(component, /Resumo comparativo/);
  assert.match(component, /title=\{variationTooltip\(item\)\}/);
});

test("ausência de equivalente permite criar relatório com datas sugeridas", () => {
  assert.match(component, /Nenhum relatório equivalente encontrado/);
  assert.match(component, /Criar novo relatório/);
  assert.match(component, /suggestedPeriodForComparisonType/);
  assert.match(component, /onCreateReport\(suggestedPeriod\)/);
});

test("layout quebra seletores, contexto, cards, ações e gráfico no mobile", () => {
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*?\.report-comparison-selector-grid/);
  assert.match(styles, /\.report-comparison-context/);
  assert.match(styles, /\.report-comparison-actions button \{ width: 100%; \}/);
  assert.match(styles, /\.report-comparison-chart-area \{ height: 300px; min-width: 0; overflow-x: auto; \}/);
});
