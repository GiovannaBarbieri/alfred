import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  formatKpiStatus,
  formatReportDate,
  formatReportHours,
  formatReportNumber,
  formatReportPercentage,
  shouldShowReportPagination,
} from "../src/utils/reportHistoryPresentation.ts";
import { areReportFiltersEqual } from "../src/utils/reportHistoryFilters.ts";
import {
  REPORT_NOTICE_DISMISS_MS,
  scheduleReportNoticeDismiss,
} from "../src/utils/reportHistoryNotice.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const app = read("App.tsx");
const hook = read("hooks/useReportHistory.ts");
const service = read("services/reportHistoryService.ts");
const api = read("services/api.ts");
const page = read("pages/MyReportsPage.tsx");
const flow = read("pages/GeneralIndicatorsFlowPage.tsx");
const validationPanel = read("components/general-indicators/GeneralIndicatorConsultationPanel.tsx");
const card = read("components/my-reports/ReportCard.tsx");
const modal = read("components/my-reports/ReportActionModal.tsx");
const finalizedPanel = read("components/general-indicators/GeneralIndicatorFinalizedPanel.tsx");
const filters = read("components/my-reports/ReportFilters.tsx");
const styles = read("styles.css");

test("relatórios salvos continuam listáveis, pesquisáveis e excluíveis", () => {
  assert.match(page, /items\.map\(\(report\) => <ReportCard key=\{report\.id\}/);
  assert.match(service, /return request<SavedReportListResponse>/);
  assert.match(filters, /Buscar por nome/);
  assert.match(filters, /Tipo de relatório/);
  assert.match(card, /type: "delete", report/);
  assert.match(service, /method: "DELETE"/);
  assert.match(modal, /Excluir relatório\?/);
});

test("cada relatório abre seu snapshot persistido em modo somente leitura", () => {
  assert.match(hook, /async function openReport[\s\S]*getReportDetail\(id\)/);
  assert.match(page, /data-read-only=\{history\.view\.readOnly\}/);
  assert.match(page, /GeneralIndicatorFinalizedPanel/);
  assert.doesNotMatch(service, /consultGeneralIndicator|finalizeGeneralIndicator/);
});

test("fluxo exige nome editável e envia o nome na finalização", () => {
  assert.match(flow, /suggestReportName\(startDate, endDate\)/);
  assert.match(flow, /reportName=\{reportName\}/);
  assert.match(api, /JSON\.stringify\(\{ reportName \}\)/);
  assert.match(flow, /finalizeGeneralIndicatorConsultation\(consultation\.consultationId, reportName\)/);
});

test("nome sugerido cobre mês, trimestre, semestre, ano e período personalizado", () => {
  assert.match(flow, /Janeiro/);
  assert.match(flow, /Trimestre/);
  assert.match(flow, /Semestre/);
  assert.match(flow, /Ano \$\{year\}/);
  assert.match(flow, /formatIsoDate\(startDate\).*formatIsoDate\(endDate\)/);
});

test("período inicial é editável e os atalhos preservam as duas datas", () => {
  assert.match(flow, /id="general-indicator-start-date" disabled=\{busy\}/);
  assert.match(flow, /setStartDate\(dates\.startDate\)/);
  assert.doesNotMatch(flow, /setStartDate\(`\$\{shortcutYear\}-01-01`\)/);
});

test("arquitetura anual não está exposta no fluxo ativo", () => {
  assert.doesNotMatch(app, /annualReportUpdate|onStartAnnualUpdate|annualReportToOpen/);
  assert.doesNotMatch(service, /\/updates/);
  assert.doesNotMatch(card.replace(/\/\*[\s\S]*?\*\//g, ""), /currentRevisionNumber/);
});

test("paginação e formatação executiva permanecem estáveis", () => {
  assert.equal(shouldShowReportPagination(1, 20), false);
  assert.equal(shouldShowReportPagination(21, 20), true);
  assert.equal(formatReportDate("2026-01-31"), "31/01/2026");
  assert.equal(formatReportNumber(19359), "19.359");
  assert.equal(formatReportHours(16789.9167), "16.789,92 h");
  assert.equal(formatReportPercentage(37.01), "37,01%");
  assert.equal(formatKpiStatus("within_target"), "Dentro da meta");
});

test("filtros comparam rascunho e último estado aplicado", () => {
  assert.equal(areReportFiltersEqual({ search: "", year: "" }, { search: "", year: "" }), true);
  assert.equal(areReportFiltersEqual({ search: "2026", year: "" }, { search: "", year: "" }), false);
  assert.match(hook, /canApplyFilters = !areReportFiltersEqual\(draft, applied\)/);
  assert.match(filters, /disabled=\{!canApply\} aria-disabled=\{!canApply\}/);
});

test("mensagem de sucesso continua temporária e acessível", () => {
  let delay = 0;
  let dismissed = false;
  const cleanup = scheduleReportNoticeDismiss(
    () => { dismissed = true; },
    (callback, value) => {
      delay = value;
      callback();
      return 1;
    },
    () => {},
  );
  assert.equal(REPORT_NOTICE_DISMISS_MS, 4_000);
  assert.equal(delay, 4_000);
  assert.equal(dismissed, true);
  cleanup();
  assert.match(page, /role="status" aria-live="polite"/);
});

test("resumo e indicadores existentes permanecem reutilizados", () => {
  assert.match(page, /contextTitle="Resumo do relat/);
  assert.match(page, /savedReportContext/);
  assert.match(finalizedPanel, /projectsImprovements/);
  assert.match(finalizedPanel, /errorsBugs/);
  assert.match(styles, /\.saved-report-summary-grid/);
});

test("Consultar é o único ponto para iniciar ou substituir uma consulta", () => {
  assert.doesNotMatch(validationPanel, /Alterar período|Refazer consulta|onRefreshFull|onBack/);
  assert.doesNotMatch(flow, /refreshFullGeneralIndicatorConsultation|window\.confirm/);
  assert.match(flow, /setConsultation\(null\)/);
  assert.match(flow, /setReportName\(""\)/);
  assert.match(flow, /consultGeneralIndicatorLaunches\(startDate, endDate/);
});

test("nova consulta substitui o nome manual pelo nome sugerido do novo período", () => {
  assert.match(flow, /setReportName\(""\)[\s\S]*consultGeneralIndicatorLaunches[\s\S]*setReportName\(suggestReportName\(startDate, endDate\)\)/);
});

test("Salvar relatório é a única ação da etapa final", () => {
  assert.match(validationPanel, /3\. Salvar relatório/);
  assert.match(validationPanel, /general-indicator-success-actions[\s\S]*Salvar relatório/);
  assert.equal((validationPanel.match(/onClick=\{onFinalize\}/g) ?? []).length, 1);
});

test("salvamento redireciona e abre automaticamente o relatório criado", () => {
  assert.match(flow, /finalized\.reportId/);
  assert.match(flow, /onReportSaved\(finalized\.reportId\)/);
  assert.match(app, /setGeneralIndicatorReportToOpen\(reportId\)/);
  assert.match(app, /setActiveSection\("my-reports"\)/);
  assert.match(app, /openReportId=\{generalIndicatorReportToOpen\}/);
  assert.match(page, /Relatório salvo com sucesso\./);
});

test("tela geradora não renderiza o dashboard finalizado", () => {
  assert.doesNotMatch(flow, /GeneralIndicatorFinalizedPanel/);
  assert.doesNotMatch(flow, /finalData/);
  assert.match(page, /GeneralIndicatorFinalizedPanel/);
});
