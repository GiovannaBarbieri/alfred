import type {
  ReportDeleteResponse,
  AnnualReportUpdateRequest,
  ReportComparisonType,
  ReportListParams,
  ReportPeriodAnalysisResponse,
  ReportPeriodsComparisonResponse,
  SavedReportDetail,
  SavedReportComparisonOptionsResponse,
  SavedReportListResponse,
  ReportTypeOptionsResponse,
  SavedReportsComparisonResponse,
  SavedReportType,
} from "../types";
import {
  normalizePeriodAnalysisResponse,
  type ReportPeriodAnalysisWireResponse,
} from "../utils/reportPeriodAnalysisResponse";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const REPORT_DELETE_TIMEOUT_MS = 45_000;

type ReportHistoryRequestOptions = RequestInit & {
  timeoutMs?: number;
};

export class ReportHistoryApiError extends Error {
  public readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "ReportHistoryApiError";
    this.status = status;
  }
}

export async function listReports(params: ReportListParams): Promise<SavedReportListResponse> {
  return request<SavedReportListResponse>(`/general-indicators/reports${buildQuery(params)}`);
}

export async function listReportTypes(): Promise<ReportTypeOptionsResponse> {
  return request<ReportTypeOptionsResponse>("/general-indicators/reports/types");
}

export async function getReportDetail(id: number): Promise<SavedReportDetail> {
  return request<SavedReportDetail>(`/general-indicators/reports/${id}`);
}

export async function updateReport(
  id: number,
  payload: AnnualReportUpdateRequest,
): Promise<SavedReportDetail> {
  return request<SavedReportDetail>(`/general-indicators/reports/${id}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function getReportPeriodAnalysis(
  id: number,
  startDate: string,
  endDate: string,
): Promise<ReportPeriodAnalysisResponse> {
  const query = new URLSearchParams({ startDate, endDate });
  const payload = await request<ReportPeriodAnalysisWireResponse>(
    `/general-indicators/reports/${id}/period-analysis?${query.toString()}`,
  );
  return normalizePeriodAnalysisResponse(payload);
}

export async function getReportPeriodsComparison(
  id: number,
  startDateA: string,
  endDateA: string,
  startDateB: string,
  endDateB: string,
): Promise<ReportPeriodsComparisonResponse> {
  const query = new URLSearchParams({ startDateA, endDateA, startDateB, endDateB });
  return request<ReportPeriodsComparisonResponse>(
    `/general-indicators/reports/${id}/compare-periods?${query.toString()}`,
  );
}

export async function listReportComparisonOptions(
  reportType: SavedReportType,
  comparisonType: ReportComparisonType,
): Promise<SavedReportComparisonOptionsResponse> {
  const query = new URLSearchParams({
    type: reportType,
    comparisonType,
  });
  return request<SavedReportComparisonOptionsResponse>(
    `/general-indicators/reports/comparison-options?${query.toString()}`,
  );
}

export async function compareSavedReports(
  reportType: SavedReportType,
  reportARevisionId: number,
  reportBRevisionId: number,
): Promise<SavedReportsComparisonResponse> {
  return request<SavedReportsComparisonResponse>("/general-indicators/reports/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reportType,
      reportARevisionId,
      reportBRevisionId,
    }),
  });
}

export async function deleteReport(id: number, actor?: string | null): Promise<ReportDeleteResponse> {
  const query = actor?.trim() ? `?actor=${encodeURIComponent(actor.trim())}` : "";
  return request<ReportDeleteResponse>(`/general-indicators/reports/${id}${query}`, {
    method: "DELETE",
    timeoutMs: REPORT_DELETE_TIMEOUT_MS,
  });
}

function buildQuery(params: ReportListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

async function request<T>(path: string, options?: ReportHistoryRequestOptions): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options ?? {};
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller?.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller?.signal ?? fetchOptions.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: string } | null;
      throw new ReportHistoryApiError(payload?.detail ?? fallbackMessage(response.status), response.status);
    }
    return response.json() as Promise<T>;
  } catch (caught) {
    if (caught instanceof Error && caught.name === "AbortError") {
      throw new ReportHistoryApiError(fallbackMessage(408), 408);
    }
    throw caught;
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

function fallbackMessage(status: number): string {
  if (status === 408) return "A exclusão demorou mais que o esperado. Atualize a página e tente novamente.";
  if (status === 404) return "O relatório não existe mais.";
  if (status === 409) return "A análise está em processamento e não pode ser alterada agora.";
  return "Não foi possível concluir a operação.";
}
