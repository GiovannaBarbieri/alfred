import { AlertTriangle, ArrowLeft, FileBarChart, RefreshCw, SearchX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GeneralIndicatorFinalizedPanel } from "../components/general-indicators/GeneralIndicatorFinalizedPanel";
import { ReportAnalysesPanel } from "../components/my-reports/ReportAnalysesPanel";
import { ReportActionModal } from "../components/my-reports/ReportActionModal";
import { ReportCard } from "../components/my-reports/ReportCard";
import { ReportFilters } from "../components/my-reports/ReportFilters";
import { ReportPagination } from "../components/my-reports/ReportPagination";
import { useReportHistory } from "../hooks/useReportHistory";
import { shouldShowReportPagination } from "../utils/reportHistoryPresentation";

export function MyReportsPage({
  onGoToGeneralIndicators,
  openReportId,
  onOpenReportHandled,
}: {
  onGoToGeneralIndicators: () => void;
  openReportId?: number | null;
  onOpenReportHandled?: () => void;
}) {
  const history = useReportHistory();
  const automaticallyOpenedReportId = useRef<number | null>(null);
  const [activeReportTab, setActiveReportTab] = useState<"overview" | "analyses">("overview");

  useEffect(() => {
    if (!openReportId || automaticallyOpenedReportId.current === openReportId) return;
    automaticallyOpenedReportId.current = openReportId;
    history.showNotice("Relatório salvo com sucesso.");
    void history.openReport(openReportId).finally(() => onOpenReportHandled?.());
  }, [openReportId]);

  useEffect(() => {
    setActiveReportTab("overview");
  }, [history.view?.reportId]);

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
        </header>
        <nav className="saved-report-tabs" aria-label="Visualizações do relatório">
          <button
            type="button"
            className={activeReportTab === "overview" ? "active" : undefined}
            aria-current={activeReportTab === "overview" ? "page" : undefined}
            onClick={() => setActiveReportTab("overview")}
          >
            Visão Geral
          </button>
          <button
            type="button"
            className={activeReportTab === "analyses" ? "active" : undefined}
            aria-current={activeReportTab === "analyses" ? "page" : undefined}
            onClick={() => setActiveReportTab("analyses")}
          >
            Análises
          </button>
        </nav>
        {activeReportTab === "overview" ? (
          <GeneralIndicatorFinalizedPanel
            result={history.view.detail.snapshot}
            excludedCollaboratorCount={history.view.detail.report.excludedCollaboratorCount}
            contextTitle="Resumo do relatório"
            savedReportContext
          />
        ) : (
          <ReportAnalysesPanel
            reportId={detail.report.id}
            officialStart={detail.report.periodStart}
            officialEnd={detail.report.periodEnd}
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
        <button className="secondary-button" type="button" onClick={() => void history.refresh()} disabled={history.isRefreshing}>
          <RefreshCw className={history.isRefreshing ? "spinning" : ""} size={16} />
          {history.isRefreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      {history.notice && <div className="saved-report-notice" role="status" aria-live="polite"><span>{history.notice}</span><button type="button" aria-label="Fechar mensagem" onClick={history.dismissNotice}>×</button></div>}

      <ReportFilters
        draft={history.draft}
        canApply={history.canApplyFilters}
        canClear={history.canClearFilters}
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
      {history.isRefreshing && history.data && <div className="saved-report-refreshing" role="status"><RefreshCw className="spinning" size={15} />Atualizando a listagem...</div>}

      {history.data && <div className="saved-report-result-count">{history.data.totalItems.toLocaleString("pt-BR")} {history.data.totalItems === 1 ? "relatório encontrado" : "relatórios encontrados"}</div>}

      {!history.isLoading && history.data && items.length === 0 && (
        history.hasActiveFilters
          ? <StatePanel icon={<SearchX size={26} />} title="Nenhum relatório encontrado" text="Tente ajustar ou limpar os filtros aplicados."><button className="secondary-button" type="button" onClick={history.clearFilters}>Limpar filtros</button></StatePanel>
          : <StatePanel icon={<FileBarChart size={26} />} title="Nenhuma análise salva" text="As análises finalizadas em Indicadores Gerais aparecerão aqui."><button className="primary-button" type="button" onClick={onGoToGeneralIndicators}>Ir para Indicadores Gerais</button></StatePanel>
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

function StatePanel({ icon, title, text, children }: { icon: JSX.Element; title: string; text: string; children: JSX.Element }) {
  return <section className="panel saved-report-state"><span>{icon}</span><h2>{title}</h2><p>{text}</p>{children}</section>;
}

function ReportSkeletons() {
  return <section className="saved-report-list" aria-label="Carregando relatórios" aria-busy="true">{[1, 2, 3].map((item) => <div className="panel saved-report-skeleton" key={item}><span /><span /><span /><div><i /><i /><i /><i /></div></div>)}</section>;
}
