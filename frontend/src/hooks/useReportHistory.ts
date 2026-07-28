import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteReport,
  getReportDetail,
  listReports,
  ReportHistoryApiError,
} from "../services/reportHistoryService";
import type {
  ReportActionState,
  ReportListParams,
  SavedReportListResponse,
  SavedReportViewState,
} from "../types";
import { areReportFiltersEqual } from "../utils/reportHistoryFilters";
import { scheduleReportNoticeDismiss } from "../utils/reportHistoryNotice";

export type ReportFilterDraft = {
  search: string;
  year: string;
};

const defaultFilters: ReportFilterDraft = {
  search: "",
  year: "",
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
  const noticeSequence = useRef(0);
  const [notice, setNotice] = useState<{ id: number; message: string } | null>(null);

  const params = useMemo<ReportListParams>(() => ({
    type: "GENERAL_INDICATORS",
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

  function requestAction(nextAction: Exclude<ReportActionState, null>) {
    setActionError(null);
    setAction(nextAction);
  }

  function closeAction() {
    if (actionBusy) return;
    setAction(null);
    setActionError(null);
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
    refresh: () => load(true),
    requestAction,
    showNotice,
    setPage,
    updateDraft,
    applyFilters,
    changePageSize,
    view,
    closeView: () => setView(null),
  };
}

function messageFrom(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}
