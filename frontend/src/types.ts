export type ImportIssue = {
  line: number | null;
  field: string;
  value: string | null;
  severity: "bloqueio" | "alerta";
  code: string;
  message: string;
};

export type DuplicateGroup = {
  idLancamento: string;
  lines: number[];
  records: Array<{
    line: number;
    idLancamento: string;
    dataHoraCadastro: string;
    loginUsuario: string;
    duracao: string;
    epic: string;
    feature: string;
    pbi: string;
    task: string;
  }>;
};

export type ClassificationSuggestion = {
  line: number;
  idTask: string;
  loginUsuario: string;
  tituloTask: string;
  category: string;
  subcategory: string;
  origin: string;
  confidence: number;
  confidenceLevel: "alta" | "media" | "baixa" | string;
  classifierVersion: string;
  confidenceFactors: string[];
  matchedKeywords: string[];
};

export type ImportPreviewCategory = {
  category: string;
  totalHours: number;
  totalRecords: number;
  percentage: number;
};

export type ImportPreviewSummary = {
  totalHours: number;
  collaboratorsCount: number;
  tasksCount: number;
  categoriesCount: number;
  averageConfidence: number;
  lowConfidenceCount: number;
  unclassifiedCount: number;
  zeroDurationCount: number;
  topCategories: ImportPreviewCategory[];
};

export type RelatedImportSummary = {
  importId: number;
  filename: string;
  importedAt: string;
  totalRows: number;
  totalHours: number;
  sameFileHash: boolean;
};

export type ImportFileHistory = {
  status: string;
  message: string;
  sameProjectImportCount: number;
  exactDuplicate: boolean;
  latestImport: RelatedImportSummary | null;
  matchingImport: RelatedImportSummary | null;
  newRecords: number;
  removedRecords: number;
  unchangedRecords: number;
};

export type ImportValidationResponse = {
  sessionId: number | null;
  filename: string;
  totalRows: number;
  validRows: number;
  blockedRows: number;
  alertRows: number;
  missingColumns: string[];
  issues: ImportIssue[];
  duplicates: DuplicateGroup[];
  classifications: ClassificationSuggestion[];
  preview: ImportPreviewSummary | null;
  fileHistory: ImportFileHistory | null;
  canComplete: boolean;
};

export type ImportCompleteResponse = {
  importId: number;
  filename: string;
  status: string;
  totalRows: number;
  validRows: number;
  alertRows: number;
  blockedRows: number;
  savedRows: number;
};

export type ImportSessionSummary = {
  sessionId: number;
  filename: string;
  status: string;
  totalRows: number;
  validRows: number;
  alertRows: number;
  blockedRows: number;
  createdAt: string;
  updatedAt: string;
  importId: number | null;
};

export type ImportSessionResponse = {
  session: ImportSessionSummary;
  validation: ImportValidationResponse;
};

export type SQLServerConnectionStatus = {
  ok: boolean;
  message: string;
};

export type SQLServerImportRequest = {
  ids: Array<number | string>;
  idType: "auto" | "epic" | "feature";
};

export type ImportSummary = {
  id: number;
  filename: string;
  status: string;
  importedAt: string;
  totalRows: number;
  validRows: number;
  alertRows: number;
  blockedRows: number;
  classifierVersion: string;
  totalHours: number;
};

export type ImportDetail = ImportSummary & {
  records: Array<{
    idLancamento: string;
    dataHoraCadastro: string;
    loginUsuario: string;
    duracao: string;
    duracaoSegundos: number;
    epic: string;
    feature: string;
    pbi: string;
    task: string;
    categoria: string;
    subcategoria: string;
    statusValidacao: string;
    statusClassificacao: string;
    classifierVersion: string;
    confidenceLevel: string;
    confidence: number;
  }>;
  issues: Array<{
    line: number | null;
    field: string;
    value: string | null;
    code: string;
    severity: string;
    message: string;
    resolved: boolean;
  }>;
  duplicates: Array<{
    idLancamento: string;
    lines: number[];
    keptRecordId: number | null;
    removedLines: number[];
    resolved: boolean;
    resolvedAt: string | null;
  }>;
};

export type ImportReprocessPreviewItem = {
  recordId: number;
  taskKey: string;
  line: number;
  idLancamento: string;
  idTask: string;
  tituloTask: string;
  loginUsuario: string;
  currentCategory: string;
  currentSubcategory: string;
  currentConfidence: number;
  currentConfidenceLevel: string;
  currentClassifierVersion: string;
  newCategory: string;
  newSubcategory: string;
  newConfidence: number;
  newConfidenceLevel: string;
  newClassifierVersion: string;
  newOrigin: string;
  changed: boolean;
  confidenceDelta: number;
  confidenceFactors: string[];
  matchedKeywords: string[];
};

export type ImportReprocessPreviewTaskGroup = {
  taskKey: string;
  idTask: string;
  tituloTask: string;
  firstLine: number;
  totalRecords: number;
  collaborators: string[];
  currentCategory: string;
  currentSubcategory: string;
  newCategory: string;
  newSubcategory: string;
  averageCurrentConfidence: number;
  averageNewConfidence: number;
  confidenceDelta: number;
  confidenceFactors: string[];
};

export type ImportReprocessPreview = {
  importId: number;
  filename: string;
  currentClassifierVersion: string;
  newClassifierVersion: string;
  totalRecords: number;
  changedRecords: number;
  unchangedRecords: number;
  changedTasks: number;
  confidenceImproved: number;
  confidenceReduced: number;
  averageCurrentConfidence: number;
  averageNewConfidence: number;
  categoryChanges: Array<{
    fromCategory: string;
    toCategory: string;
    totalRecords: number;
  }>;
  taskGroups: ImportReprocessPreviewTaskGroup[];
  items: ImportReprocessPreviewItem[];
  itemLimit: number;
};

export type ImportReprocessApplyResponse = {
  importId: number;
  filename: string;
  status: string;
  appliedRecords: number;
  changedTasks: number;
  classifierVersion: string;
  message: string;
};

export type ReprocessHistoryItem = {
  id: number;
  recordId: number;
  idLancamento: string;
  idTask: string;
  tituloTask: string;
  loginUsuario: string;
  previousCategory: string | null;
  previousSubcategory: string | null;
  newCategory: string | null;
  newSubcategory: string | null;
  previousConfidence: number | null;
  newConfidence: number | null;
  previousConfidenceLevel: string | null;
  newConfidenceLevel: string | null;
  previousVersion: string | null;
  newVersion: string | null;
  origin: string | null;
  reason: string | null;
  user: string;
  createdAt: string;
};

export type DashboardSummary = {
  totalHours: number;
  totalRecords: number;
  totalUsers: number;
  totalEpics: number;
  pendingAlerts: number;
};

export type DashboardOverviewSummary = {
  totalHours: number;
  projectsCount: number;
  totalRecords: number;
  collaboratorsCount: number;
  pendingAlerts: number;
};

export type DashboardRecentProject = {
  importId: number;
  projectName: string;
  filename: string;
  importedAt: string;
  totalHours: number;
  recordsCount: number;
  collaboratorsCount: number;
  alertsCount: number;
  reworkHours: number;
  status: string;
};

export type DashboardPendingItems = {
  classificationPending: number;
  lowConfidence: number;
  collaboratorsWithoutProfile: number;
  alertsPending: number;
};

export type DashboardCategorySummary = {
  category: string;
  hours: number;
  percentage: number;
};

export type DashboardCollaboratorSummary = {
  loginUsuario: string;
  hours: number;
  percentage: number;
};

export type TimelinePoint = {
  period: string;
  horas: number;
};

export type ProjectTimelinePoint = TimelinePoint & {
  series?: string;
};

export type ProjectTimelineCharts = {
  dailyTotal: ProjectTimelinePoint[];
  dailyByUser: ProjectTimelinePoint[];
  weeklyByUser: ProjectTimelinePoint[];
  dailyByCategory: ProjectTimelinePoint[];
  monthlyByCategory: ProjectTimelinePoint[];
  weeklyByCategory: ProjectTimelinePoint[];
};

export type ProjectCollaboratorTask = {
  idTask: string;
  tituloTask: string;
  categoria: string;
  subcategoria: string;
  totalSeconds: number;
  totalDuration: string;
  totalHours: number;
  totalRecords: number;
  firstWorkedAt: string;
  lastWorkedAt: string;
};

export type ProjectComparisonItem = {
  importId: number;
  projectName: string;
  filename: string;
  importedAt: string;
  status: string;
  totalSeconds: number;
  totalHours: number;
  recordsCount: number;
  collaboratorsCount: number;
  tasksCount: number;
  openPendings: number;
  reviewedPendings: number;
  ignoredPendings: number;
  pendingRate: number;
  attentionLevel: "alta" | "media" | "baixa";
  attentionLabel: string;
  topCategory: string;
  topCategoryPercentage: number;
  topCollaborator: string;
  topCollaboratorPercentage: number;
};

export type ProjectComparison = {
  summary: {
    projectsCount: number;
    totalHours: number;
    recordsCount: number;
    openPendings: number;
    highAttentionProjects: number;
  };
  projects: ProjectComparisonItem[];
};

export type SavedProjectComparisonSummary = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  importIds: number[];
  projectsCount: number;
  totalHours: number;
  openPendings: number;
  highAttentionProjects: number;
};

export type SavedProjectComparisonDetail = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  importIds: number[];
  comparison: ProjectComparison;
};

export type ProjectEvolutionOption = {
  projectName: string;
  importsCount: number;
  latestImportedAt: string;
  totalHours: number;
};

export type ProjectEvolutionPoint = {
  importId: number;
  filename: string;
  importedAt: string;
  status: string;
  totalHours: number;
  recordsCount: number;
  openPendings: number;
  pendingRate: number;
  attentionLevel: "alta" | "media" | "baixa";
  attentionLabel: string;
  hoursDelta: number;
  recordsDelta: number;
  pendingsDelta: number;
  attentionChanged: boolean;
};

export type ProjectEvolution = {
  projectName: string;
  importsCount: number;
  firstImportedAt: string;
  latestImportedAt: string;
  summary: {
    hoursDelta: number;
    recordsDelta: number;
    pendingsDelta: number;
    firstAttention: string;
    latestAttention: string;
    trendLabel: string;
  };
  insights: Array<{
    priority: "alta" | "media" | "baixa";
    title: string;
    reason: string;
    action: string;
    source: string;
  }>;
  points: ProjectEvolutionPoint[];
};

export type ProjectExecutiveSummary = {
  metrics: {
    totalDuration: string;
    totalHours: number;
    collaboratorsCount: number;
    tasksCount: number;
  };
  topUsers: HoursReportItem[];
  topTasks: HoursReportItem[];
  categories: HoursReportItem[];
  pending: {
    unclassifiedTasks: number;
    lowConfidence: number;
    zeroDuration: number;
    alerts: number;
    open: number;
    reviewed: number;
    ignored: number;
    total: number;
  };
};

export type ProjectPendingItems = {
  unclassifiedTasks: Array<{
    idTask: string;
    tituloTask: string;
    loginUsuario: string;
    impactSeconds: number;
    impactHours: number;
    totalDuration: string;
    totalRecords: number;
    impactRecords: number;
    reviewKey: string;
    reviewStatus: "pendente" | "revisado" | "ignorado";
  }>;
  lowConfidence: Array<{
    idTask: string;
    tituloTask: string;
    loginUsuario: string;
    categoria: string;
    confidenceLevel: string;
    confidence: number;
    impactSeconds: number;
    impactHours: number;
    impactDuration: string;
    impactRecords: number;
    reviewKey: string;
    reviewStatus: "pendente" | "revisado" | "ignorado";
  }>;
  zeroDuration: Array<{
    idLancamento: string;
    idTask: string;
    tituloTask: string;
    loginUsuario: string;
    dataHoraCadastro: string;
    impactSeconds: number;
    impactHours: number;
    impactDuration: string;
    impactRecords: number;
    reviewKey: string;
    reviewStatus: "pendente" | "revisado" | "ignorado";
  }>;
  alerts: Array<{
    id: number;
    line: number | null;
    field: string;
    code: string;
    message: string;
    value: string | null;
    impactSeconds: number;
    impactHours: number;
    impactDuration: string;
    impactRecords: number;
  }>;
};

export type ProjectInsightCard = {
  kind: string;
  title: string;
  value: string;
  detail: string;
  tone: "info" | "success" | "warning" | "danger";
};

export type ProjectInsights = {
  totalHours: number;
  cards: ProjectInsightCard[];
  topUsers: HoursReportItem[];
  topTasks: HoursReportItem[];
  topCategories: HoursReportItem[];
};

export type ProjectRecommendation = {
  priority: "alta" | "media" | "baixa";
  title: string;
  reason: string;
  action: string;
  source: string;
};

export type DashboardOverview = {
  summary: DashboardOverviewSummary;
  recentProjects: DashboardRecentProject[];
  pendingItems: DashboardPendingItems;
  categorySummary: DashboardCategorySummary[];
  collaboratorSummary: DashboardCollaboratorSummary[];
  timeline: TimelinePoint[];
};

export type HoursReportItem = {
  key: string;
  label: string;
  totalSeconds: number;
  totalHours: number;
  totalRecords: number;
  percentage: number;
};

export type ReportsOverview = {
  user: HoursReportItem[];
  epic: HoursReportItem[];
  feature: HoursReportItem[];
  pbi: HoursReportItem[];
  task: HoursReportItem[];
  category: HoursReportItem[];
  subcategory: HoursReportItem[];
};

export type FilterOption = {
  value: string;
  label: string;
};

export type ReportFilters = {
  startDate: string;
  endDate: string;
  user: string;
  epicId: string;
  category: string;
  importId?: string;
};

export type ReportFilterOptions = {
  users: FilterOption[];
  epics: FilterOption[];
  categories: FilterOption[];
};

export type ClassificationOverride = {
  line: number;
  category: string;
  subcategory: string;
};

export type SettingItem = {
  id: number;
  name: string;
  active: boolean;
  description?: string | null;
  group?: string | null;
  aiAlias?: string | null;
  displayOrder?: number | null;
};

export type KeywordItem = {
  id: number;
  keyword: string;
  active: boolean;
  categoryId: number;
  category: string;
};

export type ClassificationRuleItem = {
  id: number;
  name: string;
  categoryId: number;
  category: string;
  subcategoryId: number | null;
  subcategory: string | null;
  keywords: string[];
  priority: number;
  active: boolean;
  version: string;
};

export type CollaboratorProfileItem = {
  id: number;
  loginUsuario: string;
  subcategoryId: number;
  subcategory: string;
  active: boolean;
};

export type IgnoredCollaboratorItem = {
  id: number;
  loginUsuario: string;
  active: boolean;
};

export type AuditLogItem = {
  id: number;
  entity: string;
  recordId: string | null;
  action: string;
  user: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
};

export type AnalyticsInsightType = "anomalia" | "tendencia" | "concentracao" | "qualidade" | "risco";

export type AnalyticsInsightSeverity = "baixa" | "media" | "alta";
export type AnalyticsInsightStatus = "novo" | "revisado" | "ignorado";

export type AnalyticsInsight = {
  id: number;
  tipo: AnalyticsInsightType;
  severidade: AnalyticsInsightSeverity;
  titulo: string;
  descricao: string;
  recomendacao: string;
  importId: number;
  projectName: string;
  metadata: Record<string, unknown>;
  status: AnalyticsInsightStatus;
  generatedAt: string | null;
  reviewedAt: string | null;
  reviewUser: string | null;
};

export type AnalyticsSummary = {
  total: number;
  alta: number;
  media: number;
  baixa: number;
  novo: number;
  revisado: number;
  ignorado: number;
  tendencia: number;
  anomalia: number;
  concentracao: number;
  qualidade: number;
  risco: number;
};

export type AnalyticsContext = {
  importId: number;
  projectName: string;
  filename: string;
  importedAt: string;
  totalHours: number;
  totalRecords: number;
  previousImportId: number | null;
};

export type AnalyticsFilters = {
  projects: FilterOption[];
  imports: Array<{
    value: number;
    label: string;
    projectName: string;
    importedAt: string;
  }>;
};

export type AnalyticsInsightsResponse = {
  summary: AnalyticsSummary;
  context: AnalyticsContext | null;
  filters: AnalyticsFilters;
  insights: AnalyticsInsight[];
};
