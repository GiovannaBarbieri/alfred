import { AlertTriangle, ArrowLeft, Clock3, Download, Eye, FileBarChart, FileSpreadsheet, RefreshCw, SearchX, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GeneralIndicatorFinalizedPanel } from "../components/general-indicators/GeneralIndicatorFinalizedPanel";
import { ReportActionModal } from "../components/my-reports/ReportActionModal";
import { ReportCard } from "../components/my-reports/ReportCard";
import { ReportPeriodAnalysisPanel } from "../components/my-reports/ReportPeriodAnalysisPanel";
import { ReportUpdatePeriodModal } from "../components/my-reports/ReportUpdatePeriodModal";
import { useReportHistory } from "../hooks/useReportHistory";
import { deleteProjectImport } from "../services/api";
import type { ImportSummary, ProjectSavedReportListItem, ReportActionState, SavedReportListItem } from "../types";
import {
  exportChartAsPng,
  exportChartsAsZip,
  getCurrentExportableChart,
  getExportableCharts,
} from "../utils/chartImageExport";
import { formatReportDateTime, formatReportHours, formatReportNumber } from "../utils/reportHistoryPresentation";
import { projectTitleFromFilename } from "../utils/project";

type ReportTypeFilter = "all" | "general" | "projects";
type CombinedReportItem =
  | { key: string; kind: "general"; updatedAt: string; report: SavedReportListItem }
  | { key: string; kind: "project"; updatedAt: string; report: ProjectSavedReportListItem };

export function MyReportsPage({
  imports,
  onGoToGeneralIndicators,
  onOpenProjectReport,
  onProjectDeleted,
  openReportId,
  onOpenReportHandled,
}: {
  imports: ImportSummary[];
  onGoToGeneralIndicators: (period?: { startDate: string; endDate: string }) => void;
  onOpenProjectReport: (importId: number) => Promise<void> | void;
  onProjectDeleted?: () => Promise<void> | void;
  openReportId?: number | null;
  onOpenReportHandled?: () => void;
}) {
  const history = useReportHistory();
  const automaticallyOpenedReportId = useRef<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("all");
  const [openingProjectId, setOpeningProjectId] = useState<number | null>(null);
  const [projectAction, setProjectAction] = useState<Exclude<ReportActionState, null> | null>(null);
  const [projectActionBusy, setProjectActionBusy] = useState(false);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [deletedProjectIds, setDeletedProjectIds] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!openReportId || automaticallyOpenedReportId.current === openReportId) return;
    automaticallyOpenedReportId.current = openReportId;
    history.showNotice("Relatório salvo com sucesso.");
    void history.openReport(openReportId).finally(() => onOpenReportHandled?.());
  }, [openReportId]);

  const projectReports = useMemo<ProjectSavedReportListItem[]>(() => imports
    .filter((item) => !deletedProjectIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: projectTitleFromFilename(item.filename),
      type: "PROJECT",
      filename: item.filename,
      updatedAt: item.importedAt,
      totalHours: item.totalHours,
      consideredLaunchCount: item.validRows,
    })), [deletedProjectIds, imports]);

  const generalReports = history.data?.items ?? [];
  const items = useMemo(() => {
    const combined: CombinedReportItem[] = [
      ...generalReports.map((report) => ({
        key: `general-${report.id}`,
        kind: "general" as const,
        updatedAt: report.updatedAt || report.finalizedAt,
        report,
      })),
      ...projectReports.map((report) => ({
        key: `project-${report.id}`,
        kind: "project" as const,
        updatedAt: report.updatedAt,
        report,
      })),
    ];
    return combined
      .filter((item) => typeFilter === "all" || (typeFilter === "general" ? item.kind === "general" : item.kind === "project"))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [generalReports, projectReports, typeFilter]);

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

  async function openProjectReport(importId: number) {
    setOpeningProjectId(importId);
    history.dismissNotice();
    try {
      await onOpenProjectReport(importId);
    } catch (caught) {
      history.showNotice(caught instanceof Error ? caught.message : "Não foi possível abrir o relatório de projeto.");
    } finally {
      setOpeningProjectId(null);
    }
  }

  function requestProjectDelete(report: ProjectSavedReportListItem) {
    setProjectActionError(null);
    setProjectAction({ type: "delete", report });
  }

  function closeProjectAction() {
    if (projectActionBusy) return;
    setProjectAction(null);
    setProjectActionError(null);
  }

  async function confirmProjectAction() {
    if (!projectAction || projectAction.report.type !== "PROJECT") return;
    setProjectActionBusy(true);
    setProjectActionError(null);
    try {
      await deleteProjectImport(projectAction.report.id);
      setDeletedProjectIds((current) => new Set(current).add(projectAction.report.id));
      setProjectAction(null);
      history.showNotice("Relatório excluído com sucesso.");
      await onProjectDeleted?.();
    } catch (caught) {
      setProjectActionError(caught instanceof Error ? caught.message : "Não foi possível excluir o relatório de projeto.");
    } finally {
      setProjectActionBusy(false);
    }
  }

  const activeAction = projectAction ?? history.action;
  const hasAnyReports = generalReports.length > 0 || projectReports.length > 0;
  const isInitialLoading = history.isLoading && !history.data && projectReports.length === 0;

  return (
    <section className="my-reports-page">
      <header className="saved-report-page-header">
        <div><h1>Meus Relatórios</h1><p>Consulte e gerencie as análises salvas no Alfred.</p></div>
      </header>

      {history.notice && <div className="saved-report-notice" role="status" aria-live="polite"><span>{history.notice}</span><button type="button" aria-label="Fechar mensagem" onClick={history.dismissNotice}>×</button></div>}

      <ReportTypeTabs active={typeFilter} onChange={setTypeFilter} />

      {history.error && !history.data && typeFilter !== "projects" && (
        <StatePanel icon={<AlertTriangle size={25} />} title="Não foi possível carregar os relatórios" text={history.error}>
          <button className="primary-button" type="button" onClick={() => void history.refresh()}>Tentar novamente</button>
        </StatePanel>
      )}

      {isInitialLoading && <ReportSkeletons />}

      {history.data && history.error && <div className="error-banner" role="alert"><AlertTriangle size={17} />{history.error}<button type="button" onClick={() => void history.refresh()}>Tentar novamente</button></div>}

      {(history.data || projectReports.length > 0) && (
        <div className="saved-report-result-count">
          <span>
            {items.length.toLocaleString("pt-BR")} {items.length === 1 ? "relatório encontrado" : "relatórios encontrados"}
          </span>
          {history.isRefreshing && <small><RefreshCw className="spinning" size={13} />Atualizando</small>}
        </div>
      )}

      {!isInitialLoading && hasAnyReports && items.length === 0 && (
        <StatePanel icon={<SearchX size={26} />} title="Nenhum relatório encontrado" text="Não há relatórios para o tipo selecionado."><span /></StatePanel>
      )}

      {!isInitialLoading && !hasAnyReports && !history.error && (
        <StatePanel icon={<FileBarChart size={26} />} title="Nenhuma análise salva" text="As análises finalizadas aparecerão aqui.">
          <button className="primary-button" type="button" onClick={() => onGoToGeneralIndicators()}>Ir para Indicadores Gerais</button>
        </StatePanel>
      )}

      {items.length > 0 && (
        <section className="saved-report-list" aria-label="Relatórios salvos">
          {items.map((item) => item.kind === "general"
            ? <ReportCard key={item.key} report={item.report} opening={history.openingId === item.report.id} onOpen={() => void history.openReport(item.report.id)} onAction={history.requestAction} />
            : (
              <ProjectReportCard
                key={item.key}
                report={item.report}
                opening={openingProjectId === item.report.id}
                onOpen={() => void openProjectReport(item.report.id)}
                onDelete={() => requestProjectDelete(item.report)}
              />
            ))}
        </section>
      )}

      {activeAction && (
        <ReportActionModal
          action={activeAction}
          busy={projectAction ? projectActionBusy : history.actionBusy}
          error={projectAction ? projectActionError : history.actionError}
          onClose={projectAction ? closeProjectAction : history.closeAction}
          onConfirm={() => { projectAction ? void confirmProjectAction() : void history.confirmAction(); }}
        />
      )}
    </section>
  );
}

function ReportTypeTabs({ active, onChange }: { active: ReportTypeFilter; onChange: (value: ReportTypeFilter) => void }) {
  const tabs: Array<{ id: ReportTypeFilter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "general", label: "Indicadores Gerais" },
    { id: "projects", label: "Projetos" },
  ];
  return (
    <div className="saved-report-type-tabs" aria-label="Filtrar relatórios por tipo">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={active === tab.id ? "active" : ""}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ProjectReportCard({
  report,
  opening,
  onOpen,
  onDelete,
}: {
  report: ProjectSavedReportListItem;
  opening: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="panel saved-report-card project">
      <div className="saved-report-card-main">
        <div className="saved-report-card-heading">
          <div>
            <div className="saved-report-badges">
              <span className="saved-report-type project">Projeto</span>
            </div>
            <h2>{report.name}</h2>
            <p className="saved-report-period project">
              <Clock3 size={14} />
              <span>Atualizado em {formatReportDateTime(report.updatedAt)}</span>
            </p>
          </div>
        </div>
        <div className="saved-report-project-summary">
          <span><FileSpreadsheet size={15} />{report.filename}</span>
          <strong>{formatReportHours(report.totalHours)} · {formatReportNumber(report.consideredLaunchCount)} registros</strong>
        </div>
      </div>

      <div className="saved-report-card-actions">
        <button className="primary-button" type="button" onClick={onOpen} disabled={opening}>
          <Eye size={16} />
          {opening ? "Abrindo..." : "Abrir"}
        </button>
        <button className="saved-report-delete" type="button" onClick={onDelete}>
          <Trash2 size={15} />
          Excluir
        </button>
      </div>
    </article>
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
  return (
    <section className="saved-report-list" aria-label="Carregando relatórios" aria-busy="true">
      {[1, 2, 3].map((item) => <div className="panel saved-report-skeleton" key={item}><span /><span /><span /><div><i /><i /><i /><i /></div></div>)}
    </section>
  );
}
