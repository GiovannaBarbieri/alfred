import type {
  IndicatorTargetPeriod,
  IndicatorTargetPeriodList,
  IndicatorTargetPeriodPayload,
} from "../types/indicatorTargets";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function getIndicatorTargets(): Promise<IndicatorTargetPeriodList> {
  return request<IndicatorTargetPeriodList>("/settings/indicator-targets");
}

export async function createIndicatorTarget(payload: IndicatorTargetPeriodPayload): Promise<IndicatorTargetPeriod> {
  return request<IndicatorTargetPeriod>("/settings/indicator-targets", {
    method: "POST",
    headers: requestHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateIndicatorTarget(
  id: number,
  payload: Partial<IndicatorTargetPeriodPayload>,
): Promise<IndicatorTargetPeriod> {
  return request<IndicatorTargetPeriod>(`/settings/indicator-targets/${id}`, {
    method: "PATCH",
    headers: requestHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteIndicatorTarget(id: number): Promise<void> {
  await request<void>(`/settings/indicator-targets/${id}`, {
    method: "DELETE",
    headers: requestHeaders(),
  });
}

function requestHeaders(): HeadersInit {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const configuredUser = String(import.meta.env.VITE_CURRENT_USER ?? "").trim();
  if (configuredUser) headers["X-User"] = configuredUser;
  return headers;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Não foi possível salvar as metas dos indicadores.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
