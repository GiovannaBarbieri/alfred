import type {
  DistributionWeightConfiguration,
  DistributionWeightUpdateItem,
} from "../types/distributionWeights";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedConfiguration: DistributionWeightConfiguration | null = null;
let cachedAt = 0;
let pendingRequest: Promise<DistributionWeightConfiguration> | null = null;

export async function getDistributionWeights(): Promise<DistributionWeightConfiguration> {
  if (cachedConfiguration && Date.now() - cachedAt < CACHE_TTL_MS) return cachedConfiguration;
  if (pendingRequest) return pendingRequest;
  pendingRequest = request<DistributionWeightConfiguration>("/settings/distribution-weights")
    .then((configuration) => {
      primeDistributionWeightsCache(configuration);
      return configuration;
    })
    .finally(() => {
      pendingRequest = null;
    });
  return pendingRequest;
}

export async function updateDistributionWeights(
  items: DistributionWeightUpdateItem[],
): Promise<DistributionWeightConfiguration> {
  const configuration = await request<DistributionWeightConfiguration>("/settings/distribution-weights", {
    method: "PUT",
    headers: requestHeaders(),
    body: JSON.stringify({ items }),
  });
  primeDistributionWeightsCache(configuration);
  return configuration;
}

export async function restoreDefaultDistributionWeights(): Promise<DistributionWeightConfiguration> {
  const configuration = await request<DistributionWeightConfiguration>("/settings/distribution-weights/restore-defaults", {
    method: "POST",
    headers: requestHeaders(),
  });
  primeDistributionWeightsCache(configuration);
  return configuration;
}

export function primeDistributionWeightsCache(configuration: DistributionWeightConfiguration): void {
  cachedConfiguration = configuration;
  cachedAt = Date.now();
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
    throw new Error(payload?.detail ?? "Não foi possível salvar os pesos de distribuição.");
  }
  return response.json() as Promise<T>;
}
