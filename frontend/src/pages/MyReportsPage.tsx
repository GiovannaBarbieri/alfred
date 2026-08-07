import { AlertTriangle, ArrowLeft, Download, FileBarChart, RefreshCw, SearchX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GeneralIndicatorFinalizedPanel } from "../components/general-indicators/GeneralIndicatorFinalizedPanel";
import { ReportActionModal } from "../components/my-reports/ReportActionModal";
import { ReportCard } from "../components/my-reports/ReportCard";
import { ReportFilters } from "../components/my-reports/ReportFilters";
import { ReportPagination } from "../components/my-reports/ReportPagination";
import { ReportPeriodAnalysisPanel } from "../components/my-reports/ReportPeriodAnalysisPanel";
import { ReportUpdatePeriodModal } from "../components/my-reports/ReportUpdatePeriodModal";
import { useReportHistory } from "../hooks/useReportHistory";
import {
  exportChartAsPng,
  exportChartsAsZip,
  getCurrentExportableChart,
  getExportableCharts,
} from "../utils/chartImageExport";
import { shouldShowReportPagination } from "../utils/reportHistoryPresentation";

export function MyReportsPage({
  onGoToGeneralIndicators,
  openReportId,
  onOpenReportHandled,
}: {
  onGoToGeneralIndicators: (period?: { startDate: string; endDate: string }) => void;
  openReportId?: number | null;
  onOpenReportHandled?: () => void;
}) {
  const history = useReportHistory();
  const automaticallyOpenedReportId = useRef<number | null>(null);

  useEffect(() => {
    if (!openReportId || automaticallyOpenedReportId.current === openReportId) return;
    automaticallyOpenedReportId.current = openReportId;
    history.showNotice("Relatório salvo com sucesso.");
    void history.openReport(openReportId).finally(() => onOpenReportHandled?.());
  }, [openReportId]);

  if (history.view) {
    if (!history.view.detail.currentRevision) {
      return (
        <section className="saved-report-view">
          <StatePanel
            icon={<AlertTriangle size={26} />}
            title="Relatório incompatível com a versão atual"
            text="Atualize o backend do Alfred e tente abrir o relatório novamente."
          >
            <button className="secondary-button" type="button" onClick={history.closeView}><ArrowLeft size={16} />Voltar para Meus Relatórios</button>
          </StatePanel>
        </section>
      );
    }
    const { detail } = history.view;
    return (
      <section className="saved-report-view" data-source={history.view.source} data-read-only={history.view.readOnly}>
        {history.notice && <div className="saved-report-notice" role="status" aria-live="polite"><span>{history.notice}</span><button type="button" aria-label="Fechar mensagem" onClick={history.dismissNotice}>×</button></div>}
        <header className="page-header">
          <div className="saved-report-page-title">
            <button className="page-title-back" type="button" aria-label="Voltar para Meus Relatórios" title="Voltar" onClick={history.closeView}>
              <ArrowLeft size={24} />
            </button>
            <h1>{detail.report.name}</h1>
          </div>
          <div className="saved-report-header-actions">
            <SavedReportExportMenu reportName={detail.report.name} />
            <button className="primary-button saved-report-update-button" type="button" onClick={history.requestReportUpdate} disabled={history.viewRefreshing}>
              <RefreshCw className={history.viewRefreshing ? "spinning" : ""} size={16} />
              {history.viewRefreshing ? "Atualizando..." : "Atualizar relatório"}
            </button>
          </div>
        </header>
        {history.error && !history.updatePeriodDraft && <div className="error-banner" role="alert"><AlertTriangle size={17} />{history.error}</div>}
        <GeneralIndicatorFinalizedPanel
          result={history.view.detail.snapshot}
          excludedCollaboratorCount={history.view.detail.report.excludedCollaboratorCount}
          contextTitle="Resumo do relatório"
          savedReportContext
          periodAnalysisSlot={(
            <ReportPeriodAnalysisPanel
              snapshot={history.view.detail.snapshot}
              reportId={detail.report.id}
            />
          )}
        />
        {history.updatePeriodDraft && (
          <ReportUpdatePeriodModal
            draft={history.updatePeriodDraft}
            busy={history.viewRefreshing}
            error={history.error}
            onChange={history.updateReportPeriodDraft}
            onCancel={history.closeReportUpdateModal}
            onConfirm={() => void history.refreshOpenReport()}
          />
        )}
      </section>
    );
  }

  const items = history.data?.items ?? [];
  const totalPages = history.data?.totalPages ?? 0;

  return (
    <section className="my-reports-page">
      <header className="saved-report-page-header">
        <div><h1>Meus Relatórios</h1><p>Consulte e acesse as análises finalizadas no Alfred.</p></div>
      </header>

      {history.notice && <div className="saved-report-notice" role="status" aria-live="polite"><span>{history.notice}</span><button type="button" aria-label="Fechar mensagem" onClick={history.dismissNotice}>×</button></div>}

      <ReportFilters
        draft={history.draft}
        canApply={history.canApplyFilters}
        canClear={history.canClearFilters}
        reportTypes={history.reportTypes}
        onChange={history.updateDraft}
        onApply={history.applyFilters}
        onClear={history.clearFilters}
      />

      {history.error && !history.data && (
        <StatePanel icon={<AlertTriangle size={25} />} title="Não foi possível carregar os relatórios" text={history.error}>
          <button className="primary-button" type="button" onClick={() => void history.refresh()}>Tentar novamente</button>
        </StatePanel>
      )}

      {history.isLoading && !history.data && <ReportSkeletons />}

      {history.data && history.error && <div className="error-banner" role="alert"><AlertTriangle size={17} />{history.error}<button type="button" onClick={() => void history.refresh()}>Tentar novamente</button></div>}
      {history.data && <div className="saved-report-result-count">{history.data.totalItems.toLocaleString("pt-BR")} {history.data.totalItems === 1 ? "relatório encontrado" : "relatórios encontrados"}</div>}

      {!history.isLoading && history.data && items.length === 0 && (
        history.hasActiveFilters
          ? <StatePanel icon={<SearchX size={26} />} title="Nenhum relatório encontrado" text="Tente ajustar ou limpar os filtros aplicados."><button className="secondary-button" type="button" onClick={history.clearFilters}>Limpar filtros</button></StatePanel>
          : <StatePanel icon={<FileBarChart size={26} />} title="Nenhuma análise salva" text="As análises finalizadas em Indicadores Gerais aparecerão aqui."><button className="primary-button" type="button" onClick={() => onGoToGeneralIndicators()}>Ir para Indicadores Gerais</button></StatePanel>
      )}

      {items.length > 0 && (
        <section className="saved-report-list" aria-label="Relatórios salvos">
          {items.map((report) => <ReportCard key={report.id} report={report} opening={history.openingId === report.id} onOpen={() => void history.openReport(report.id)} onAction={history.requestAction} />)}
        </section>
      )}

      {history.data && shouldShowReportPagination(history.data.totalItems, history.pageSize) && <ReportPagination page={history.data.page} totalPages={totalPages} totalItems={history.data.totalItems} pageSize={history.pageSize} onPageChange={history.setPage} onPageSizeChange={history.changePageSize} />}

      {history.action && <ReportActionModal action={history.action} busy={history.actionBusy} error={history.actionError} onClose={history.closeAction} onConfirm={() => void history.confirmAction()} />}
    </section>
  );
}

function SavedReportExportMenu({ reportName }: { reportName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"current" | "all" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportCurrent() {
    const chart = getCurrentExportableChart();
    if (!chart) {
      setError("Nenhum gráfico disponível para exportação.");
      return;
    }
    setBusy("current");
    setError(null);
    try {
      await exportChartAsPng(chart);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível exportar o gráfico.");
    } finally {
      setBusy(null);
    }
  }

  async function exportAll() {
    const charts = getExportableCharts();
    if (charts.length === 0) {
      setError("Nenhum gráfico disponível para exportação.");
      return;
    }
    setBusy("all");
    setError(null);
    try {
      await exportChartsAsZip(charts, `Indicadores Gerais - ${reportName}`);
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível exportar as imagens.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="saved-report-export-menu" data-export-exclude>
      <button
        aria-expanded={open}
        className="secondary-button saved-report-export-trigger"
        disabled={Boolean(busy)}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Download size={16} />
        {busy ? "Exportando..." : "Exportar"}
      </button>
      {open && (
        <div className="saved-report-export-options" role="menu">
          <button disabled={Boolean(busy)} onClick={() => void exportAll()} role="menuitem" type="button">
            {busy === "all" ? "Gerando imagens..." : "Exportar todas as imagens (.zip)"}
          </button>
          <button disabled={Boolean(busy)} onClick={() => void exportCurrent()} role="menuitem" type="button">
            {busy === "current" ? "Gerando PNG..." : "Exportar gráfico atual (.png)"}
          </button>
          {error && <small role="alert">{error}</small>}
        </div>
      )}
    </div>
  );
}

function StatePanel({ icon, title, text, children }: { icon: JSX.Element; title: string; text: string; children: JSX.Element }) {
  return <section className="panel saved-report-state"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{children}</section>;
}

function ReportSkeletons() {
  return <section className="saved-report-list" aria-label="Carregando relatórios" aria-busy="true">{[1, 2, 3].map((item) => <div className="panel saved-report-skeleton" key={item}><span /><span /><span /><div><i /><i /><i /><i /></div></div>)}</section>;
}
