import type {
  ReportDeleteResponse,
  ReportListParams,
  ReportPeriodAnalysisResponse,
  ReportPeriodsComparisonResponse,
  SavedReportDetail,
  SavedReportListResponse,
} from "../types";
import {
  normalizePeriodAnalysisResponse,
  type ReportPeriodAnalysisWireResponse,
} from "../utils/reportPeriodAnalysisResponse";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

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

export async function getReportDetail(id: number): Promise<SavedReportDetail> {
  return request<SavedReportDetail>(`/general-indicators/reports/${id}`);
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

export async function deleteReport(id: number, actor?: string | null): Promise<ReportDeleteResponse> {
  const query = actor?.trim() ? `?actor=${encodeURIComponent(actor.trim())}` : "";
  return request<ReportDeleteResponse>(`/general-indicators/reports/${id}${query}`, { method: "DELETE" });
}

function buildQuery(params: ReportListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new ReportHistoryApiError(payload?.detail ?? fallbackMessage(response.status), response.status);
  }
  return response.json() as Promise<T>;
}

function fallbackMessage(status: number): string {
  if (status === 404) return "O relatório não existe mais.";
  if (status === 409) return "A análise está em processamento e não pode ser alterada agora.";
  return "Não foi possível concluir a operação.";
}
