import type {
  GeneralIndicatorModule,
  GeneralIndicatorModuleList,
  GeneralIndicatorModuleSyncResult,
} from "../types/generalIndicatorModules";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export function getGeneralIndicatorModules(): Promise<GeneralIndicatorModuleList> {
  return request("/settings/modules");
}

export function updateGeneralIndicatorModule(
  id: number,
  active: boolean,
): Promise<GeneralIndicatorModule> {
  return request(`/settings/modules/${id}`, {
    method: "PATCH",
    headers: requestHeaders(),
    body: JSON.stringify({ active }),
  });
}

export function syncGeneralIndicatorModules(): Promise<GeneralIndicatorModuleSyncResult> {
  return request("/settings/modules/sync", {
    method: "POST",
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
    throw new Error(payload?.detail ?? "Não foi possível carregar a configuração de módulos.");
  }
  return response.json() as Promise<T>;
}
