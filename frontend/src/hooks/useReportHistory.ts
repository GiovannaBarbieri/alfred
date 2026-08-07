import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteReport,
  getReportDetail,
  listReportTypes,
  listReports,
  ReportHistoryApiError,
  updateReport,
} from "../services/reportHistoryService";
import type {
  ReportActionState,
  ReportListParams,
  SavedReportListResponse,
  SavedReportTypeOption,
  SavedReportViewState,
} from "../types";
import { areReportFiltersEqual } from "../utils/reportHistoryFilters";
import { scheduleReportNoticeDismiss } from "../utils/reportHistoryNotice";

export type ReportFilterDraft = {
  search: string;
  year: string;
  type: string;
};

const defaultFilters: ReportFilterDraft = {
  search: "",
  year: currentYearFilter(),
  type: "",
};

export function useReportHistory(actor?: string | null) {
  const [draft, setDraft] = useState<ReportFilterDraft>(defaultFilters);
  const [applied, setApplied] = useState<ReportFilterDraft>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<SavedReportListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ReportActionState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [view, setView] = useState<SavedReportViewState | null>(null);
  const [viewRefreshing, setViewRefreshing] = useState(false);
  const [updatePeriodDraft, setUpdatePeriodDraft] = useState<{ startDate: string; endDate: string } | null>(null);
  const [reportTypes, setReportTypes] = useState<SavedReportTypeOption[]>([]);
  const noticeSequence = useRef(0);
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);

  const params = useMemo<ReportListParams>(() => ({
    type: applied.type || undefined,
    year: applied.year ? Number(applied.year) : undefined,
    search: applied.search.trim(),
    page,
    pageSize,
  }), [applied, page, pageSize]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setIsRefreshing(true) : setIsLoading(true);
    setError(null);
    try {
      setData(await listReports(params));
    } catch (caught) {
      setError(messageFrom(caught, "Não foi possível carregar os relatórios."));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [params]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    let ignore = false;
    async function loadReportTypeOptions() {
      try {
        const response = await listReportTypes();
        if (!ignore) setReportTypes(response.items);
      } catch {
        if (!ignore) setReportTypes([]);
      }
    }
    void loadReportTypeOptions();
    return () => { ignore = true; };
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const showNotice = useCallback((message: string) => {
    noticeSequence.current += 1;
    setNotice({ id: noticeSequence.current, message });
  }, []);

  useEffect(() => {
    if (!notice) return;
    return scheduleReportNoticeDismiss(dismissNotice);
  }, [dismissNotice, notice]);

  function updateDraft<K extends keyof ReportFilterDraft>(key: K, value: ReportFilterDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyFilters() {
    setPage(1);
    setApplied({ ...draft });
  }

  function clearFilters() {
    setPage(1);
    setDraft(defaultFilters);
    setApplied(defaultFilters);
  }

  function changePageSize(pageSize: number) {
    setPage(1);
    setPageSize(pageSize);
  }

  async function openReport(id: number) {
    setOpeningId(id);
    setError(null);
    try {
      const detail = await getReportDetail(id);
      setView({ source: "saved-report", reportId: id, readOnly: true, detail });
    } catch (caught) {
      setError(messageFrom(caught, "Não foi possível abrir o relatório salvo."));
    } finally {
      setOpeningId(null);
    }
  }

  function requestReportUpdate() {
    if (!view || viewRefreshing) return;
    setError(null);
    setUpdatePeriodDraft({
      startDate: view.detail.report.periodStart.slice(0, 10),
      endDate: view.detail.report.periodEnd.slice(0, 10),
    });
  }

  function updateReportPeriodDraft(field: "startDate" | "endDate", value: string) {
    setUpdatePeriodDraft((current) => current ? { ...current, [field]: value } : current);
  }

  function closeReportUpdateModal() {
    if (viewRefreshing) return;
    setUpdatePeriodDraft(null);
    setError(null);
  }

  async function refreshOpenReport() {
    if (!view || !updatePeriodDraft || viewRefreshing) return;
    const reportId = view.reportId;
    setViewRefreshing(true);
    setError(null);
    try {
      const detail = await updateReport(reportId, {
        startDate: updatePeriodDraft.startDate,
        endDate: updatePeriodDraft.endDate,
        actor,
      });
      setView((current) => current?.reportId === reportId ? { ...current, detail } : current);
      setUpdatePeriodDraft(null);
      showNotice("Relatório atualizado com sucesso.");
    } catch (caught) {
      setError(messageFrom(caught, "Não foi possível atualizar o relatório."));
    } finally {
      setViewRefreshing(false);
    }
  }

  function requestAction(nextAction: Exclude<ReportActionState, null>) {
    setActionError(null);
    setAction(nextAction);
  }

  function closeAction() {
    if (actionBusy) return;
    setAction(null);
    setActionError(null);
  }

  function closeView() {
    setView(null);
    setError(null);
  }

  async function confirmAction() {
    if (!action) return;
    setActionBusy(true);
    setActionError(null);
    try {
      if (action.type === "delete") {
        await deleteReport(action.report.id, actor);
        showNotice("Análise excluída permanentemente.");
      }
      setAction(null);
      if (action.type === "delete" && data?.items.length === 1 && page > 1) {
        setPage((current) => current - 1);
      } else {
        await load(true);
      }
    } catch (caught) {
      if (caught instanceof ReportHistoryApiError && caught.status === 404) {
        setAction(null);
        showNotice("O relatório não existe mais. A listagem foi atualizada.");
        await load(true);
      } else if (caught instanceof ReportHistoryApiError && caught.status === 409) {
        setActionError("A análise está em processamento e não pode ser alterada agora.");
      } else {
        setActionError(messageFrom(caught, "Não foi possível concluir a operação."));
      }
    } finally {
      setActionBusy(false);
    }
  }

  const hasActiveFilters = Boolean(applied.search || applied.year);
  const canApplyFilters = !areReportFiltersEqual(draft, applied);
  const canClearFilters = (
    !areReportFiltersEqual(draft, defaultFilters)
    || !areReportFiltersEqual(applied, defaultFilters)
  );

  return {
    action,
    actionBusy,
    actionError,
    applied,
    canApplyFilters,
    canClearFilters,
    clearFilters,
    closeAction,
    confirmAction,
    data,
    dismissNotice,
    draft,
    error,
    hasActiveFilters,
    isLoading,
    isRefreshing,
    notice: notice?.message ?? null,
    openReport,
    openingId,
    page,
    pageSize,
    reportTypes,
    refresh: () => load(true),
    requestAction,
    showNotice,
    setPage,
    updateDraft,
    updatePeriodDraft,
    updateReportPeriodDraft,
    applyFilters,
    changePageSize,
    view,
    viewRefreshing,
    requestReportUpdate,
    closeReportUpdateModal,
    refreshOpenReport,
    closeView,
  };
}

function messageFrom(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

function currentYearFilter(): string {
  return String(new Date().getFullYear());
}
