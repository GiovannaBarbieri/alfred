import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  formatKpiStatus,
  formatReportDate,
  formatReportHours,
  formatReportNumber,
  formatReportPercentage,
} from "../src/utils/reportHistoryPresentation.ts";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
const app = read("App.tsx");
const hook = read("hooks/useReportHistory.ts");
const service = read("services/reportHistoryService.ts");
const api = read("services/api.ts");
const page = read("pages/MyReportsPage.tsx");
const flow = read("pages/GeneralIndicatorsFlowPage.tsx");
const card = read("components/my-reports/ReportCard.tsx");
const modal = read("components/my-reports/ReportActionModal.tsx");
const updateModal = read("components/my-reports/AnnualReportUpdateModal.tsx");
const finalizedPanel = read("components/general-indicators/GeneralIndicatorFinalizedPanel.tsx");
const filters = read("components/my-reports/ReportFilters.tsx");
const pagination = read("components/my-reports/ReportPagination.tsx");
const styles = read("styles.css");

test("1. filtro Status não existe mais", () => {
  assert.doesNotMatch(filters, /<span>Status<\/span>|CURRENT|SUPERSEDED|ARCHIVED/);
  assert.equal((filters.match(/<label/g) ?? []).length, 2);
});

test("2. listagem renderiza um card por relatório anual", () => {
  assert.match(page, /items\.map\(\(report\) => <ReportCard key=\{report\.id\}/);
  assert.match(service, /return request<SavedReportListResponse>/);
  assert.doesNotMatch(service, /listAllPages|SUPERSEDED/);
});

test("3. card exibe o período anual atual", () => {
  assert.match(card, /Período atual:/);
  assert.match(card, /report\.periodStart/);
  assert.match(card, /report\.periodEnd/);
});

test("4. card exibe a revisão atual", () => {
  assert.match(card, /Revisão \{report\.currentRevisionNumber\}/);
  assert.doesNotMatch(card, /Vigente|Substituído/);
});

test("5. abertura carrega o detalhe persistido", () => {
  assert.match(hook, /async function openReport[\s\S]*getReportDetail\(id\)/);
  assert.match(page, /GeneralIndicatorFinalizedPanel/);
});

test("6. relatório aberto oferece Atualizar dados", () => {
  assert.match(page, /Atualizar dados/);
  assert.match(page, /setShowUpdateModal\(true\)/);
});

test("7. existe modal próprio para atualização anual", () => {
  assert.match(page, /AnnualReportUpdateModal/);
  assert.match(updateModal, /Atualizar relatório de \{report\.year\}/);
  assert.match(updateModal, /novo período final/i);
});

test("8. data inicial fica bloqueada", () => {
  assert.match(updateModal, /Início do período[\s\S]*value=\{report\.periodStart\} disabled/);
  assert.match(flow, /id="general-indicator-start-date" disabled required/);
});

test("9. modal exige nova data posterior", () => {
  assert.match(updateModal, /newPeriodEnd <= report\.periodEnd/);
  assert.match(updateModal, /deve ser posterior ao período atual/);
  assert.match(updateModal, /min=\{nextDate\(report\.periodEnd\)\}/);
});

test("10. modal exige data no mesmo ano", () => {
  assert.match(updateModal, /Number\(newPeriodEnd\.slice\(0, 4\)\) !== report\.year/);
  assert.match(updateModal, /mesmo ano do relatório/);
  assert.match(updateModal, /max=\{`\$\{report\.year\}-12-31`\}/);
});

test("11. início da atualização usa o endpoint anual", () => {
  assert.match(service, /\/general-indicators\/reports\/\$\{id\}\/updates/);
  assert.match(service, /method: "POST"/);
  assert.match(page, /startAnnualReportUpdate/);
});

test("12. envio duplicado é bloqueado durante a requisição", () => {
  assert.match(updateModal, /disabled=\{busy\}/);
  assert.match(updateModal, /busy \? "Iniciando\.\.\." : "Atualizar dados"/);
  assert.match(page, /setUpdateBusy\(true\)/);
});

test("13. atualização em andamento é indicada e pode continuar", () => {
  assert.match(card, /report\.hasUpdateInProgress/);
  assert.match(card, /Atualização em andamento/);
  assert.match(page, /Continuar atualização/);
  assert.match(page, /detail\.update\.consultationId/);
});

test("14. fluxo retorna ao relatório depois da finalização", () => {
  assert.match(flow, /onAnnualUpdateCompleted\(annualUpdate\.reportId\)/);
  assert.match(app, /setAnnualReportToOpen\(reportId\)/);
  assert.match(app, /setActiveSection\("my-reports"\)/);
});

test("15. retorno abre novamente o detalhe e o novo snapshot", () => {
  assert.match(page, /history\.openReport\(openReportId\)/);
  assert.match(page, /detail\.snapshot/);
  assert.match(app, /openReportId=\{annualReportToOpen\}/);
});

test("16. exclusão permanente do relatório anual permanece disponível", () => {
  assert.match(card, /type: "delete", report/);
  assert.match(service, /method: "DELETE"/);
  assert.match(modal, /Excluir relatório anual\?/);
});

test("17. confirmação de exclusão menciona todo o histórico", () => {
  assert.match(modal, /todo o seu histórico de atualizações/);
  assert.match(modal, /Não será possível desfazer/);
  assert.match(modal, /type="checkbox"/);
});

test("18. paginação mantém tamanho, total e limites", () => {
  assert.match(pagination, /Por página/);
  assert.match(pagination, /totalItems/);
  assert.match(pagination, /page <= 1/);
  assert.match(pagination, /page >= totalPages/);
});

test("19. busca por nome continua disponível com debounce", () => {
  assert.match(filters, /Buscar por nome/);
  assert.match(hook, /setTimeout[\s\S]*450/);
  assert.match(hook, /search: applied\.search\.trim\(\)/);
});

test("20. filtro por ano inicia vazio e só envia valor escolhido", () => {
  assert.match(filters, /option value="">Todos os anos/);
  assert.match(hook, /year: ""/);
  assert.match(hook, /year: applied\.year \? Number\(applied\.year\) : undefined/);
});

test("21. atualização reutiliza consulta, pendências e finalização existentes", () => {
  assert.match(api, /waitForGeneralIndicatorConsultation/);
  assert.match(flow, /refreshGeneralIndicatorPendings/);
  assert.match(flow, /refreshFullGeneralIndicatorConsultation/);
  assert.match(flow, /finalizeGeneralIndicatorConsultation/);
});

test("22. relatório salvo continua somente leitura e sem consulta ao TFS", () => {
  assert.match(page, /data-read-only=\{history\.view\.readOnly\}/);
  assert.doesNotMatch(service, /consultGeneralIndicator|finalizeGeneralIndicator/);
});

test("23. layout anual permanece responsivo", () => {
  assert.match(styles, /annual-report-update-fields/);
  assert.match(styles, /@media \(max-width: 860px\)/);
  assert.match(styles, /@media \(max-width: 600px\)/);
});

test("24. formatação executiva continua em pt-BR", () => {
  assert.equal(formatReportDate("2026-01-31"), "31/01/2026");
  assert.equal(formatReportNumber(19359), "19.359");
  assert.equal(formatReportHours(16789.9167), "16.789,92 h");
  assert.equal(formatReportPercentage(37.01), "37,01%");
  assert.equal(formatKpiStatus("within_target"), "Dentro da meta");
});

test("25. contrato antigo mostra erro orientativo em vez de tela branca", () => {
  assert.match(page, /!history\.view\.detail\.currentRevision/);
  assert.match(page, /Relatório incompatível com a versão atual/);
  assert.match(page, /Atualize o backend do Alfred/);
});

test("26. botão Voltar usa somente o ícone e mantém a navegação", () => {
  assert.match(page, /page-title-back[\s\S]*aria-label="Voltar para Meus Relatórios"[\s\S]*history\.closeView/);
  assert.match(page, /page-title-back[\s\S]*<ArrowLeft size=\{24\} \/>[\s\S]*<\/button>/);
  assert.doesNotMatch(page, /<ArrowLeft size=\{24\} \/>Voltar/);
});

test("27. botão Atualizar dados está no cabeçalho e tem largura automática", () => {
  assert.match(page, /<header className="page-header">[\s\S]*primary-button saved-report-update-button[\s\S]*<\/header>/);
  assert.match(styles, /\.page-header \.saved-report-update-button[\s\S]*margin-top: 0[\s\S]*width: auto/);
  assert.doesNotMatch(styles, /\.page-header \.saved-report-update-button[^}]*width: 100%/);
});

test("28. topo usa o cabeçalho padrão com seta e título na mesma linha", () => {
  assert.match(page, /<header className="page-header">[\s\S]*saved-report-page-title[\s\S]*page-title-back[\s\S]*<h1>\{detail\.report\.name\}<\/h1>[\s\S]*<\/header>/);
  assert.match(styles, /\.saved-report-page-title[\s\S]*align-items: center[\s\S]*display: flex/);
  assert.doesNotMatch(page, /saved-report-detail-header|saved-report-detail-info|saved-report-detail-actions/);
});

test("29. período aparece somente no resumo do relatório", () => {
  assert.doesNotMatch(page, /Período acumulado:|Última atualização:/);
  assert.match(finalizedPanel, /<Summary label="Período"/);
});

test("30. informações duplicadas foram removidas do topo", () => {
  assert.doesNotMatch(page, /formatSavedReportDateTime|saved-report-readonly-note|saved-report-metadata-separator/);
});

test("31. consulta, revisão e status não aparecem no resumo salvo", () => {
  assert.doesNotMatch(page, /revisionNumber: detail\.currentRevision\.revisionNumber/);
  assert.match(finalizedPanel, /!savedReportContext && <Summary label="Consulta"/);
  assert.doesNotMatch(finalizedPanel, /<Summary label="Revisão"|saved-report-summary-status/);
});

test("32. textos auxiliares de status foram removidos", () => {
  assert.doesNotMatch(page, /Somente leitura|Snapshot salvo/);
  assert.doesNotMatch(finalizedPanel, /Somente leitura|Snapshot salvo/);
});

test("33. layout antigo em grandes colunas foi removido", () => {
  assert.doesNotMatch(page, /saved-report-view-toolbar|saved-report-view-identity/);
  assert.doesNotMatch(styles, /saved-report-view-toolbar|saved-report-view-identity/);
});

test("34. ação fica no canto direito do título sem ocupar toda a linha", () => {
  assert.match(styles, /\.page-header[\s\S]*justify-content: space-between/);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.saved-report-update-button[\s\S]*width: auto/);
  assert.doesNotMatch(styles, /\.saved-report-detail-header|\.saved-report-open-metadata/);
});

test("35. modal de atualização continua sendo aberto", () => {
  assert.match(page, /setShowUpdateModal\(true\)/);
  assert.match(page, /<AnnualReportUpdateModal/);
});

test("36. painel inferior usa Relatório salvo sem alterar os KPIs", () => {
  assert.match(page, /contextTitle="Resumo do relatório"/);
  assert.match(page, /savedReportContext\s*\/>/);
  assert.match(finalizedPanel, /saved-report-summary-title">\s*<h2>\{contextTitle\}<\/h2>/);
  assert.doesNotMatch(finalizedPanel, /Informações da última atualização do relatório\./);
  assert.match(finalizedPanel, /savedReportContext \? "Lançamentos" : "Lançamentos considerados"/);
  assert.match(finalizedPanel, /<Summary label="Colaboradores"/);
  assert.match(finalizedPanel, /Total geral/);
  assert.match(finalizedPanel, /contextTitle = "Indicadores finalizados"/);
  assert.match(finalizedPanel, /<KpiCard[\s\S]*projectsImprovements/);
  assert.match(finalizedPanel, /<KpiCard[\s\S]*errorsBugs/);
});

test("37. resumo salvo usa um único painel com cinco colunas sem cards internos", () => {
  assert.match(styles, /\.saved-report-summary-grid[\s\S]*grid-template-columns: repeat\(5, minmax\(150px, 1fr\)\)/);
  assert.match(styles, /\.general-indicator-summary-grid\.saved-report-summary-grid > div[\s\S]*background: transparent[\s\S]*border-radius: 0[\s\S]*box-shadow: none/);
});

test("38. período salvo usa seta entre as datas", () => {
  assert.match(finalizedPanel, /savedReportContext \? "→" : "a"/);
});
