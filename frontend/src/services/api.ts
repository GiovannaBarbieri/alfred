import type {
  DashboardSummary,
  DashboardOverview,
  ClassificationRuleItem,
  CollaboratorProfileItem,
  ClassificationOverride,
  IgnoredCollaboratorItem,
  ImportCompleteResponse,
  ImportDetail,
  ImportReprocessApplyResponse,
  ImportReprocessPreview,
  ImportSessionResponse,
  ImportSessionSummary,
  ImportSummary,
  ImportValidationResponse,
  ProjectCollaboratorTask,
  ProjectComparison,
  ProjectExecutiveSummary,
  ProjectEvolution,
  ProjectEvolutionOption,
  ProjectInsights,
  ProjectPendingItems,
  ProjectRecommendation,
  ProjectTimelineCharts,
  ReprocessHistoryItem,
  ReportFilterOptions,
  ReportFilters,
  ReportsOverview,
  SavedProjectComparisonDetail,
  SavedProjectComparisonSummary,
  SettingItem,
  KeywordItem,
  TimelinePoint,
  AuditLogItem,
  AnalyticsInsight,
  AnalyticsInsightsResponse,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

function buildQuery(filters?: Partial<ReportFilters>): string {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildExportUrl(path: string, filters?: Partial<ReportFilters>, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries({ ...(filters ?? {}), ...(extra ?? {}) }).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return `${API_BASE_URL}${path}${query ? `?${query}` : ""}`;
}

export function buildProjectComparisonExportUrl(importIds: number[]): string {
  const params = new URLSearchParams();
  importIds.forEach((importId) => params.append("importIds", String(importId)));
  return `${API_BASE_URL}/exports/project-comparison.xlsx?${params.toString()}`;
}

export function buildProjectEvolutionExportUrl(projectName: string): string {
  const params = new URLSearchParams({ projectName });
  return `${API_BASE_URL}/exports/project-evolution.xlsx?${params.toString()}`;
}

export async function validateImport(file: File): Promise<ImportValidationResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/imports/validate`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível validar o arquivo.");
  }

  return response.json();
}

export async function createImportSession(file: File): Promise<ImportSessionResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/imports/sessions`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível criar a sessão de importação.");
  }

  return response.json();
}

export async function completeImport(
  file: File,
  duplicateKeepLines: number[] = [],
  classificationOverrides: ClassificationOverride[] = [],
): Promise<ImportCompleteResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (duplicateKeepLines.length > 0) {
    formData.append("duplicateKeepLines", JSON.stringify(duplicateKeepLines));
  }
  if (classificationOverrides.length > 0) {
    formData.append("classificationOverrides", JSON.stringify(classificationOverrides));
  }

  const response = await fetch(`${API_BASE_URL}/imports/complete`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível concluir a importação.");
  }

  return response.json();
}

export async function completeImportSession(
  sessionId: number,
  duplicateKeepLines: number[] = [],
  classificationOverrides: ClassificationOverride[] = [],
): Promise<ImportCompleteResponse> {
  const response = await fetch(`${API_BASE_URL}/imports/sessions/${sessionId}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ duplicateKeepLines, classificationOverrides }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível concluir a importação.");
  }

  return response.json();
}

export async function reprocessImportSession(sessionId: number): Promise<ImportSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/imports/sessions/${sessionId}/reprocess`, {
    method: "POST",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível reprocessar a importação.");
  }

  return response.json();
}

export async function cancelImportSession(sessionId: number): Promise<ImportSessionSummary> {
  const response = await fetch(`${API_BASE_URL}/imports/sessions/${sessionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível cancelar a importação.");
  }

  return response.json();
}

export async function getImports(): Promise<ImportSummary[]> {
  const response = await fetch(`${API_BASE_URL}/imports`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar o histórico.");
  }
  return response.json();
}

export async function getImportDetail(importId: number): Promise<ImportDetail> {
  const response = await fetch(`${API_BASE_URL}/imports/${importId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a importação.");
  }
  return response.json();
}

export async function getImportReprocessPreview(importId: number): Promise<ImportReprocessPreview> {
  const response = await fetch(`${API_BASE_URL}/imports/${importId}/reprocess-preview`);
  if (!response.ok) {
    throw new Error("Não foi possível gerar a prévia de reprocessamento.");
  }
  return response.json();
}

export async function applyImportReprocess(importId: number, selectedTaskKeys?: string[]): Promise<ImportReprocessApplyResponse> {
  const response = await fetch(`${API_BASE_URL}/imports/${importId}/reprocess-apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selectedTaskKeys }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível aplicar o reprocessamento.");
  }
  return response.json();
}

export async function getImportReprocessHistory(importId: number): Promise<ReprocessHistoryItem[]> {
  const response = await fetch(`${API_BASE_URL}/imports/${importId}/reprocess-history`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar o histórico de reprocessamento.");
  }
  return response.json();
}

export async function getDashboardSummary(filters?: Partial<ReportFilters>): Promise<DashboardSummary> {
  const response = await fetch(`${API_BASE_URL}/dashboard/summary${buildQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar o dashboard.");
  }
  return response.json();
}

export async function getDashboardOverview(filters?: Partial<ReportFilters>): Promise<DashboardOverview> {
  const response = await fetch(`${API_BASE_URL}/dashboard/overview${buildQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a central operacional.");
  }
  return response.json();
}

export async function getDashboardTimeline(filters?: Partial<ReportFilters>): Promise<TimelinePoint[]> {
  const response = await fetch(`${API_BASE_URL}/dashboard/timeline${buildQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a linha do tempo.");
  }
  return response.json();
}

export async function getReportsOverview(filters?: Partial<ReportFilters>): Promise<ReportsOverview> {
  const response = await fetch(`${API_BASE_URL}/reports/overview${buildQuery(filters)}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar os relatórios.");
  }
  return response.json();
}

export async function getProjectTimelineCharts(importId: number): Promise<ProjectTimelineCharts> {
  const response = await fetch(`${API_BASE_URL}/reports/project-timelines?importId=${importId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar as linhas do tempo do projeto.");
  }
  return response.json();
}

export async function getProjectComparison(importIds: number[]): Promise<ProjectComparison> {
  const params = new URLSearchParams();
  importIds.forEach((importId) => params.append("importIds", String(importId)));
  const response = await fetch(`${API_BASE_URL}/reports/project-comparison?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível comparar os projetos.");
  }
  return response.json();
}

export async function getProjectEvolutionOptions(): Promise<ProjectEvolutionOption[]> {
  const response = await fetch(`${API_BASE_URL}/reports/project-evolution-options`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar projetos com histórico.");
  }
  return response.json();
}

export async function getProjectEvolution(projectName: string): Promise<ProjectEvolution> {
  const params = new URLSearchParams({ projectName });
  const response = await fetch(`${API_BASE_URL}/reports/project-evolution?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível carregar a evolução do projeto.");
  }
  return response.json();
}

export async function getSavedProjectComparisons(): Promise<SavedProjectComparisonSummary[]> {
  const response = await fetch(`${API_BASE_URL}/reports/project-comparisons`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar os comparativos salvos.");
  }
  return response.json();
}

export async function createSavedProjectComparison(name: string, importIds: number[]): Promise<SavedProjectComparisonSummary> {
  const response = await fetch(`${API_BASE_URL}/reports/project-comparisons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, importIds }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível salvar o comparativo.");
  }
  return response.json();
}

export async function getSavedProjectComparison(comparisonId: number): Promise<SavedProjectComparisonDetail> {
  const response = await fetch(`${API_BASE_URL}/reports/project-comparisons/${comparisonId}`);
  if (!response.ok) {
    throw new Error("Não foi possível abrir o comparativo salvo.");
  }
  return response.json();
}

export async function deleteSavedProjectComparison(comparisonId: number): Promise<{ id: number; deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/reports/project-comparisons/${comparisonId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Não foi possível excluir o comparativo.");
  }
  return response.json();
}

export async function getProjectExecutiveSummary(importId: number): Promise<ProjectExecutiveSummary> {
  const response = await fetch(`${API_BASE_URL}/reports/project-summary?importId=${importId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar o resumo executivo do projeto.");
  }
  return response.json();
}

export async function getProjectPendingItems(importId: number): Promise<ProjectPendingItems> {
  const response = await fetch(`${API_BASE_URL}/reports/project-pending-items?importId=${importId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar as pendências do projeto.");
  }
  return response.json();
}

export async function updateProjectPendingAlert(alertId: number, resolved = true): Promise<{ id: number; resolved: boolean }> {
  const response = await fetch(`${API_BASE_URL}/reports/project-pending-alerts/${alertId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolved }),
  });
  if (!response.ok) {
    throw new Error("Não foi possível atualizar o alerta.");
  }
  return response.json();
}

export async function updateProjectPendingReview(
  importId: number,
  type: "unclassified" | "low_confidence" | "zero_duration",
  key: string,
  status: "pendente" | "revisado" | "ignorado",
): Promise<{ id: number; importId: number; type: string; key: string; status: string }> {
  const response = await fetch(`${API_BASE_URL}/reports/project-pending-reviews`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ importId, type, key, status }),
  });
  if (!response.ok) {
    throw new Error("Não foi possível atualizar a pendencia.");
  }
  return response.json();
}

export async function getProjectInsights(importId: number): Promise<ProjectInsights> {
  const response = await fetch(`${API_BASE_URL}/reports/project-insights?importId=${importId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar as análises principais do projeto.");
  }
  return response.json();
}

export async function getProjectRecommendations(importId: number): Promise<ProjectRecommendation[]> {
  const response = await fetch(`${API_BASE_URL}/reports/project-recommendations?importId=${importId}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar as recomendações do projeto.");
  }
  return response.json();
}

export async function getProjectCollaboratorTasks(importId: number, user: string): Promise<ProjectCollaboratorTask[]> {
  const params = new URLSearchParams({ importId: String(importId), user });
  const response = await fetch(`${API_BASE_URL}/reports/project-collaborator-tasks?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar as tasks do colaborador.");
  }
  return response.json();
}

export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  const response = await fetch(`${API_BASE_URL}/reports/filters`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar os filtros.");
  }
  return response.json();
}

export async function getCategories(): Promise<SettingItem[]> {
  const response = await fetch(`${API_BASE_URL}/settings/categories`);
  if (!response.ok) throw new Error("Não foi possível carregar categorias.");
  return response.json();
}

export async function createCategory(payload: {
  name: string;
  description?: string | null;
  displayOrder?: number | null;
}): Promise<SettingItem> {
  const response = await fetch(`${API_BASE_URL}/settings/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Não foi possível criar a categoria.");
  return response.json();
}

export async function updateCategory(
  categoryId: number,
  payload: { name?: string; active?: boolean; description?: string | null; displayOrder?: number | null },
): Promise<SettingItem> {
  const response = await fetch(`${API_BASE_URL}/settings/categories/${categoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Não foi possível atualizar a categoria.");
  return response.json();
}

export async function deleteCategory(categoryId: number): Promise<SettingItem & { deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/settings/categories/${categoryId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível excluir a categoria.");
  }
  return response.json();
}

export async function getSubcategories(): Promise<SettingItem[]> {
  const response = await fetch(`${API_BASE_URL}/settings/subcategories`);
  if (!response.ok) throw new Error("Não foi possível carregar subcategorias.");
  return response.json();
}

export async function createSubcategory(payload: {
  name: string;
  active?: boolean;
  group?: string | null;
  aiAlias?: string | null;
  displayOrder?: number | null;
}): Promise<SettingItem> {
  const response = await fetch(`${API_BASE_URL}/settings/subcategories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível criar o cargo.");
  }
  return response.json();
}

export async function updateSubcategory(
  subcategoryId: number,
  payload: { name?: string; active?: boolean; group?: string | null; aiAlias?: string | null; displayOrder?: number | null },
): Promise<SettingItem> {
  const response = await fetch(`${API_BASE_URL}/settings/subcategories/${subcategoryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível atualizar o cargo.");
  }
  return response.json();
}

export async function deleteSubcategory(subcategoryId: number): Promise<SettingItem & { deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/settings/subcategories/${subcategoryId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível excluir o cargo.");
  }
  return response.json();
}

export async function getKeywords(): Promise<KeywordItem[]> {
  const response = await fetch(`${API_BASE_URL}/settings/keywords`);
  if (!response.ok) throw new Error("Não foi possível carregar palavras-chave.");
  return response.json();
}

export async function createKeyword(categoryId: number, keyword: string): Promise<KeywordItem> {
  const response = await fetch(`${API_BASE_URL}/settings/keywords`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ categoryId, keyword }),
  });
  if (!response.ok) throw new Error("Não foi possível criar a palavra-chave.");
  return response.json();
}

export async function updateKeyword(
  keywordId: number,
  payload: { categoryId?: number; keyword?: string; active?: boolean },
): Promise<KeywordItem> {
  const response = await fetch(`${API_BASE_URL}/settings/keywords/${keywordId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Não foi possível atualizar a palavra-chave.");
  return response.json();
}

export async function getClassificationRules(): Promise<ClassificationRuleItem[]> {
  const response = await fetch(`${API_BASE_URL}/settings/classification-rules`);
  if (!response.ok) throw new Error("Não foi possível carregar regras de classificação.");
  return response.json();
}

export async function createClassificationRule(payload: {
  name: string;
  categoryId: number;
  subcategoryId?: number | null;
  keywords: string[];
  priority: number;
  version: string;
}): Promise<ClassificationRuleItem> {
  const response = await fetch(`${API_BASE_URL}/settings/classification-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível criar a regra.");
  }
  return response.json();
}

export async function updateClassificationRule(
  ruleId: number,
  payload: {
    name?: string;
    categoryId?: number;
    subcategoryId?: number | null;
    keywords?: string[];
    priority?: number;
    active?: boolean;
    version?: string;
  },
): Promise<ClassificationRuleItem> {
  const response = await fetch(`${API_BASE_URL}/settings/classification-rules/${ruleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível atualizar a regra.");
  }
  return response.json();
}

export async function getCollaboratorProfiles(): Promise<CollaboratorProfileItem[]> {
  const response = await fetch(`${API_BASE_URL}/settings/collaborator-profiles`);
  if (!response.ok) throw new Error("Não foi possível carregar perfis de colaboradores.");
  return response.json();
}

export async function createCollaboratorProfile(
  loginUsuario: string,
  subcategoryId: number,
  active = true,
): Promise<CollaboratorProfileItem> {
  const response = await fetch(`${API_BASE_URL}/settings/collaborator-profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginUsuario, subcategoryId, active }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível criar o perfil do colaborador.");
  }
  return response.json();
}

export async function updateCollaboratorProfile(
  profileId: number,
  payload: { loginUsuario?: string; subcategoryId?: number; active?: boolean },
): Promise<CollaboratorProfileItem> {
  const response = await fetch(`${API_BASE_URL}/settings/collaborator-profiles/${profileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível atualizar o perfil do colaborador.");
  }
  return response.json();
}

export async function deleteCollaboratorProfile(profileId: number): Promise<CollaboratorProfileItem & { deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/settings/collaborator-profiles/${profileId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail ?? "Não foi possível excluir o perfil do colaborador.");
  }
  return response.json();
}

export async function getIgnoredCollaborators(): Promise<IgnoredCollaboratorItem[]> {
  const response = await fetch(`${API_BASE_URL}/settings/ignored-collaborators`);
  if (!response.ok) throw new Error("Não foi possível carregar colaboradores ignorados.");
  return response.json();
}

export async function ignoreCollaborator(loginUsuario: string): Promise<IgnoredCollaboratorItem> {
  const response = await fetch(`${API_BASE_URL}/settings/ignored-collaborators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginUsuario }),
  });
  if (!response.ok) throw new Error("Não foi possível ignorar o colaborador.");
  return response.json();
}

export async function restoreIgnoredCollaborator(ignoredId: number): Promise<IgnoredCollaboratorItem> {
  const response = await fetch(`${API_BASE_URL}/settings/ignored-collaborators/${ignoredId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Não foi possível restaurar o colaborador.");
  return response.json();
}

export async function getAuditLogs(filters: {
  entity?: string;
  action?: string;
  search?: string;
  limit?: number;
} = {}): Promise<AuditLogItem[]> {
  const params = new URLSearchParams();
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.action) params.set("action", filters.action);
  if (filters.search) params.set("search", filters.search);
  if (filters.limit) params.set("limit", String(filters.limit));

  const response = await fetch(`${API_BASE_URL}/audit${params.toString() ? `?${params.toString()}` : ""}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a auditoria.");
  }
  return response.json();
}

export async function getAnalyticsInsights(filters: {
  importId?: string;
  type?: string;
  severity?: string;
  status?: string;
} = {}): Promise<AnalyticsInsightsResponse> {
  const params = new URLSearchParams();
  if (filters.importId) params.set("importação_id", filters.importId);
  if (filters.type) params.set("type", filters.type);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.status) params.set("status", filters.status);

  const response = await fetch(`${API_BASE_URL}/analytics/insights${params.toString() ? `?${params.toString()}` : ""}`);
  if (!response.ok) {
    throw new Error("Não foi possível carregar a inteligência operacional.");
  }
  return response.json();
}

export async function generateAnalyticsInsights(importId: number): Promise<AnalyticsInsightsResponse> {
  const response = await fetch(`${API_BASE_URL}/analytics/insights/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ importação_id: importId }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível gerar os insights operacionais.");
  }
  return response.json();
}

export async function updateAnalyticsInsightStatus(
  insightId: number,
  status: "novo" | "revisado" | "ignorado",
  user = "sistema",
): Promise<AnalyticsInsight> {
  const response = await fetch(`${API_BASE_URL}/analytics/insights/${insightId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, usuario: user }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Não foi possível atualizar o insight.");
  }
  return response.json();
}
