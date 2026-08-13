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
  projectName?: string;
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
  adjustmentHours?: number;
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
  developmentAdjustments?: {
    regularHours: number;
    regularPercentage: number;
    adjustmentHours: number;
    adjustmentPercentage: number;
  };
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

export type SettingsBootstrap = {
  categories: SettingItem[];
  subcategories: SettingItem[];
  keywords: KeywordItem[];
  classificationRules: ClassificationRuleItem[];
  collaboratorProfiles: CollaboratorProfileItem[];
  ignoredCollaborators: IgnoredCollaboratorItem[];
  distributionWeights: import("./types/distributionWeights").DistributionWeightConfiguration;
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
  participatesInGeneralIndicators: boolean;
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

export type GeneralIndicatorStatus = "within_target" | "attention" | "alert" | "critical";

export type GeneralIndicatorKpi = {
  hours: number;
  percentage: number;
  target?: number;
  limit?: number;
  difference: number;
  status: GeneralIndicatorStatus;
};

export type GeneralIndicatorCategory = {
  category: string;
  originalHours: number;
  allocatedHours: number;
  adjustedHours: number;
  percentage: number;
};

export type GeneralIndicatorMonth = {
  month: string;
  label: string;
  totalHours: number;
  projectsImprovementsPercentage: number;
  errorsBugsPercentage: number;
  categories: Record<string, number>;
};

export type GeneralIndicatorIssue = {
  type: string;
  idLancamento: string | null;
  message: string;
  details: Record<string, unknown>;
};

export type GeneralIndicatorClassifiedLaunch = {
  idLancamento: string | null;
  launchDate: string | null;
  durationOriginal: string | null;
  durationSeconds: number | null;
  durationHours: number | null;
  user: string | null;
  idTask: string | null;
  idParent: string | null;
  parentItemId: string | null;
  parentWorkItemType: string | null;
  parentItemType: string | null;
  parentItemTitle: string | null;
  idFeature: string | null;
  featureId: string | null;
  featureWorkItemType: string | null;
  featureTitle: string | null;
  featureTags: string | null;
  idEpic: string | null;
  tag1: string | null;
  tag2: string | null;
  tag3: string | null;
  finalCategory: string | null;
  isBug: boolean;
  isUpdateSystem: boolean;
  monthYear: string | null;
  quarter: number | null;
  year: number | null;
  validationState: "pending" | "valid" | "blocking" | "auto_treated" | "disregarded";
  participatesInGeneralIndicators: boolean;
  disregardedFromGeneralIndicators: boolean;
  eligibleForOfficialCalculation?: boolean;
  exclusionReason?: string | null;
  validatedCategory?: string | null;
  classificationState: "classified" | "hierarchy_pending" | "hierarchy_ambiguous" | "parent_pending" | "feature_pending" | "feature_type_invalid" | "feature_tags_pending";
  trace: Record<string, unknown>;
};

export type GeneralIndicatorConsultationResponse = {
  consultationId: number;
  annualReportId?: number | null;
  stage: "consultation_classified" | "validation_completed";
  nextStage: "validation" | "correction" | "finalization";
  status: "COM_INCONSISTENCIAS" | "PRONTA_PARA_FINALIZAR";
  canFinalize: boolean;
  requiresFullRefresh?: boolean;
  validatedAt: string;
  period: { startDate: string; endDate: string };
  summary: {
    sourceRowCount: number;
    uniqueLaunchCount: number;
    classifiedCount: number;
    pendingClassificationCount: number;
    duplicateIdCount: number;
    validLaunchCount: number;
    consideredLaunchCount: number;
    disregardedLaunchCount: number;
    excludedCollaboratorCount: number;
    affectedLaunchCount: number;
    inconsistencyCount: number;
    pendingCount: number;
    blockingInconsistencyCount: number;
    autoTreatedInconsistencyCount: number;
    inconsistencyCountsByType: Record<string, number>;
    affectedFeatureCount: number;
    validHours: number;
    grossHours: number;
    consideredHours: number;
    disregardedHours: number;
    affectedHours: number;
  };
  launches: GeneralIndicatorClassifiedLaunch[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  diagnostics: {
    duplicates: Array<Record<string, unknown>>;
    unresolvedTaskIds: string[];
    unresolvedParentIds: string[];
    unresolvedFeatureIds: string[];
  };
  inconsistencies: {
    items: Array<{
      type: string;
      severity: "IMPEDITIVA" | "TRATADA_AUTOMATICAMENTE";
      scope: "feature" | "launch";
      idLancamento: string | null;
      idFeature: string | null;
      originalText: string | null;
      message: string;
      blocking: boolean;
      treatment: string | null;
      status: "ABERTA" | "TRATADA";
      affectedLaunchIds: string[];
      details: Record<string, unknown>;
    }>;
    byFeature: Array<Record<string, unknown>>;
    byLaunch: Array<Record<string, unknown>>;
  };
  updateSummary?: {
    type: "SELETIVA" | "COMPLETA";
    pendingBefore: number;
    resolvedPendingCount: number;
    remainingPendingCount: number;
    requeriedFeatureCount: number;
    revalidatedLaunchCount: number;
    newInconsistencyCount: number;
    status: "COM_INCONSISTENCIAS" | "PRONTA_PARA_FINALIZAR";
    updatedAt: string;
  };
};

export type GeneralIndicatorConsultationProgress = {
  stage: string;
  percentage: number;
  message: string;
  sourceRowCount?: number;
  uniqueLaunchCount?: number;
  uniqueTaskCount?: number;
  uniqueFeatureCount?: number;
  elapsedSeconds?: number;
};

export type GeneralIndicatorConsultationJobResponse = {
  consultationId: number;
  annualReportId?: number | null;
  status: "CONSULTANDO" | "ERRO";
  period: { startDate: string; endDate: string };
  progress: GeneralIndicatorConsultationProgress;
  error?: string | null;
};

export type GeneralIndicatorInconsistencyHistory = {
  id: number;
  idLancamento: string | null;
  idFeature: string | null;
  type: string;
  severity: string;
  scope: string;
  originalText: string | null;
  message: string;
  blocking: boolean;
  treatment: string | null;
  status: string;
  active: boolean;
  affectedLaunchIds: string[];
  details: Record<string, unknown>;
  createdAt: string;
  lastValidatedAt: string;
};

export type GeneralIndicatorFinalizedResponse = {
  contractVersion?: number;
  consultationId: number;
  status: "FINALIZADA";
  period: { startDate: string; endDate: string };
  consultedAt: string;
  finalizedAt: string;
  metadata?: {
    consultationId: number;
    consultedAt: string | null;
    validatedAt: string | null;
    finalizedAt: string | null;
    initiatedBy: string | null;
    finalizedBy: string | null;
    resultContractVersion: number;
    calculationVersion: string | null;
    classificationVersion: string | null;
    distributionRulesVersion: string | null;
    targetsVersion: string | null;
    backendBuild: string | null;
  } | null;
  summary?: {
    foundLaunchCount: number | null;
    uniqueLaunchCount: number | null;
    consideredLaunchCount: number | null;
    disregardedLaunchCount: number | null;
    excludedCollaboratorCount: number | null;
    excludedCollaborators: string[];
    grossHours: number | null;
    consideredHours: number | null;
    disregardedHours: number | null;
    inconsistencyCount?: number | null;
    pendingCount: number | null;
    affectedLaunchCount: number | null;
    affectedHours: number | null;
  } | null;
  rules?: Record<string, unknown> | null;
  integrity?: {
    algorithm: string;
    launchSnapshotHash: string | null;
    resultHash: string | null;
  } | null;
  recordCount: number;
  totalHours: number;
  kpis: { projectsImprovements: GeneralIndicatorKpi; errorsBugs: GeneralIndicatorKpi };
  categories: GeneralIndicatorCategory[];
  distribution: Array<{
    month: string;
    label: string;
    competence?: { startDate: string; endDate: string };
    updateSystemHours: number;
    distributionBaseHours: number;
    maintenanceHours: number;
    newProjectHours: number;
    improvementHours: number;
    itErrorHours: number;
    bugHours?: number;
    distributedHours: number;
    isBalanced: boolean;
  }>;
  months: Array<{
    month: string;
    label: string;
    totalHours: number;
    projectsImprovements: GeneralIndicatorKpi;
    errorsBugs: GeneralIndicatorKpi;
    categories: Record<string, number>;
    competence?: { startDate: string; endDate: string };
  }>;
  quarters?: Array<{
    quarter: string;
    label: string;
    competence: { startDate: string; endDate: string };
    totalHours: number;
    newProjectHours: number;
    improvementHours: number;
    itErrorHours: number;
    bugHours: number;
    projectsImprovements: GeneralIndicatorKpi;
    errorsBugs: GeneralIndicatorKpi;
  }>;
  disregardedModules?: Array<{
    tagName: string;
    hours: number;
    launchCount: number;
  }>;
  audit: Array<{
    idLancamento: string | null;
    date: string | null;
    collaborator: string | null;
    durationHours: number | null;
    idTask: string | null;
    idParent: string | null;
    parentType: string | null;
    idFeature: string | null;
    originalTags: string | null;
    tags: string[];
    originalCategory?: string | null;
    finalCategory: string | null;
    month: string | null;
    kpiParticipation: string[];
    allocatedHours: number;
    isUpdateSystem: boolean;
    validationState: "valid" | "auto_treated";
    validationIssues: Array<{
      type: string;
      severity: string;
      status: string;
      message: string;
      treatment: string | null;
      originalText: string | null;
    }>;
    includedInOfficialCalculation: boolean;
    participatesInGeneralIndicators?: boolean;
    disregardedFromGeneralIndicators?: boolean;
    moduleTag?: string | null;
    moduleActive?: boolean;
    excludedByModule?: boolean;
    exclusionReason: string | null;
    sourceOccurrenceCount: number;
    sourceRows: Array<Record<string, unknown>>;
    validationHistory: GeneralIndicatorInconsistencyHistory[];
  }>;
  inconsistencyHistory: GeneralIndicatorInconsistencyHistory[];
  auditPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export type GeneralIndicatorFinalizationResponse = GeneralIndicatorFinalizedResponse & {
  reportId: number;
};

export type SavedReportType = string;
export type SavedReportTypeOption = {
  value: SavedReportType;
  label: string;
};
export type AnnualReportUpdateStatus = "IDLE" | "PROCESSING" | "PENDING_CORRECTIONS" | "READY_TO_FINALIZE" | "FAILED";

export type AnnualReportListItem = {
  id: number;
  name: string;
  type: SavedReportType;
  year: number;
  currentRevisionNumber: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string;
  totalHours: number;
  consideredLaunchCount: number;
  excludedCollaboratorCount: number;
  projectsImprovementsPercentage: number | null;
  projectsImprovementsStatus: string | null;
  errorsBugsPercentage: number | null;
  errorsBugsStatus: string | null;
  hasUpdateInProgress: boolean;
  updateStatus: AnnualReportUpdateStatus;
  responsible: string | null;
};

export type AnnualReportListResponse = {
  items: AnnualReportListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AnnualReportCurrentRevision = {
  id: number;
  consultationId: number;
  revisionNumber: number;
  periodStart: string;
  periodEnd: string;
  finalizedAt: string;
  responsible: string | null;
  snapshotContractVersion: number;
  resultHash: string | null;
  previousRevisionId: number | null;
};

export type AnnualReportUpdateState = {
  consultationId: number | null;
  status: AnnualReportUpdateStatus;
  currentPeriodEnd: string;
  requestedPeriodEnd: string | null;
  createdAt: string | null;
  createdBy: string | null;
  inconsistenciesCount: number;
  canContinue: boolean;
  canFinalize: boolean;
};

export type AnnualReportDetail = {
  report: AnnualReportListItem;
  currentRevision: AnnualReportCurrentRevision;
  snapshot: GeneralIndicatorFinalizedResponse;
  update: AnnualReportUpdateState;
  revisionCount: number;
};

export type ReportListParams = {
  type?: SavedReportType;
  year?: number | null;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ReportTypeOptionsResponse = {
  items: SavedReportTypeOption[];
};

export type AnnualReportUpdateRequest = {
  startDate: string;
  endDate: string;
  actor?: string | null;
};

export type AnnualReportUpdateResponse = {
  reportId: number;
  consultationId: number;
  status: AnnualReportUpdateStatus;
  periodStart: string;
  periodEnd: string;
};

export type AnnualReportFlowContext = AnnualReportUpdateResponse & {
  reportName: string;
};

export type AnnualReportRevisionSummary = {
  id: number;
  consultationId: number;
  revisionNumber: number;
  periodStart: string;
  periodEnd: string;
  finalizedAt: string;
  createdBy: string | null;
  previousRevisionId: number | null;
};

export type AnnualReportDeleteResponse = {
  deleted: boolean;
  id: number;
  type: SavedReportType;
  year: number;
  deletedRevisionCount: number;
  deletedConsultationCount: number;
  deletedAt: string;
};

export type ProjectSavedReportListItem = {
  id: number;
  name: string;
  type: "PROJECT";
  filename: string;
  updatedAt: string;
  totalHours: number;
  consideredLaunchCount: number;
};

export type ReportActionState =
  | { type: "delete"; report: AnnualReportListItem | ProjectSavedReportListItem }
  | null;

export type SavedReportViewState = {
  source: "saved-report";
  reportId: number;
  readOnly: true;
  detail: AnnualReportDetail;
};

export type SavedReportListItem = AnnualReportListItem;
export type SavedReportListResponse = AnnualReportListResponse;
export type SavedReportDetail = AnnualReportDetail;
export type ReportDeleteResponse = AnnualReportDeleteResponse;

export type ReportPeriodAnalysisResponse = {
  reportId: number;
  reportName: string;
  source: "SAVED_SNAPSHOT";
  officialPeriod: { startDate: string; endDate: string };
  analyzedPeriod: { startDate: string; endDate: string };
  recordCount: number;
  totalHours: number;
  summary: {
    totalHours: number;
    consideredLaunchCount: number;
    projectsImprovementsHours: number;
    projectsImprovementsPercentage: number;
    errorsBugsHours: number;
    errorsBugsPercentage: number;
  };
  kpis: GeneralIndicatorFinalizedResponse["kpis"];
  categories: GeneralIndicatorCategory[];
  months: GeneralIndicatorFinalizedResponse["months"];
  granularity: "DAY" | "MONTH";
  evolution: GeneralIndicatorFinalizedResponse["months"];
  appliedWeights: Array<{ category: string; weight: number; active: boolean }>;
};

export type ReportComparisonDifference = {
  valueA: number;
  valueB: number;
  absoluteDifference: number;
  percentageDifference: number | null;
  direction: "INCREASE" | "REDUCTION" | "UNCHANGED";
  unit: "HOURS" | "COUNT" | "PERCENTAGE";
};

export type ReportCategoryComparison = {
  category: string;
  hoursA: number;
  hoursB: number;
  participationA: number;
  participationB: number;
  absoluteDifference: number;
  percentageDifference: number | null;
  direction: "INCREASE" | "REDUCTION" | "UNCHANGED";
};

export type ReportPeriodsComparisonResponse = {
  reportId: number;
  reportName: string;
  source: "SAVED_SNAPSHOT";
  officialPeriod: { startDate: string; endDate: string };
  periodA: { startDate: string; endDate: string; dayCount: number; dailyAverageHours: number };
  periodB: { startDate: string; endDate: string; dayCount: number; dailyAverageHours: number };
  summaryA: ReportPeriodAnalysisResponse["summary"];
  summaryB: ReportPeriodAnalysisResponse["summary"];
  differences: {
    totalHours: ReportComparisonDifference;
    consideredLaunches: ReportComparisonDifference;
    projectsImprovements: ReportComparisonDifference;
    errorsBugs: ReportComparisonDifference;
  };
  categoriesComparison: ReportCategoryComparison[];
  chartData: ReportCategoryComparison[];
  comparisonSummary: {
    largestPercentageIncrease: { category: string; value: number } | null;
    largestPercentageReduction: { category: string; value: number } | null;
    largestHoursIncrease: { category: string; value: number } | null;
    largestHoursReduction: { category: string; value: number } | null;
  };
  differentDurations: boolean;
};

export type ReportComparisonType = "FREE" | "QUARTER" | "SEMESTER" | "YEAR";
export type ReportPeriodKind =
  | "FIRST_QUARTER"
  | "SECOND_QUARTER"
  | "THIRD_QUARTER"
  | "FOURTH_QUARTER"
  | "FIRST_SEMESTER"
  | "SECOND_SEMESTER"
  | "YEAR"
  | "CUSTOM";

export type SavedReportComparisonOption = {
  revisionId: number;
  reportId: number;
  reportName: string;
  reportType: SavedReportType;
  periodStart: string;
  periodEnd: string;
  periodKind: ReportPeriodKind;
  periodLabel: string;
  versionNumber: number;
  status: "CURRENT" | "SUPERSEDED" | "ARCHIVED";
  isCurrent: boolean;
  generatedAt: string;
  totalHours: number;
  consideredLaunchCount: number;
};

export type SavedReportComparisonOptionsResponse = {
  reportType: SavedReportType;
  comparisonType: ReportComparisonType;
  items: SavedReportComparisonOption[];
};

export type SavedReportComparisonContext = {
  revisionId: number;
  reportId: number;
  reportName: string;
  reportType: SavedReportType;
  versionNumber: number;
  status: "CURRENT" | "SUPERSEDED" | "ARCHIVED";
  isCurrent: boolean;
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
    dayCount: number;
    dailyAverageHours: number;
    dailyAverageLaunches: number;
    periodKind: ReportPeriodKind;
    periodLabel: string;
  };
  totalHours: number;
  consideredLaunchCount: number;
  consideredCollaboratorCount: number;
};

export type SavedReportsComparisonResponse = {
  source: "SAVED_SNAPSHOTS";
  reportType: SavedReportType;
  reportA: SavedReportComparisonContext;
  reportB: SavedReportComparisonContext;
  summaryA: ReportPeriodAnalysisResponse["summary"] & {
    consideredCollaboratorCount: number;
  };
  summaryB: ReportPeriodAnalysisResponse["summary"] & {
    consideredCollaboratorCount: number;
  };
  differences: {
    totalHours: ReportComparisonDifference;
    consideredLaunches: ReportComparisonDifference;
    consideredCollaborators: ReportComparisonDifference;
    dailyAverageHours: ReportComparisonDifference;
    dailyAverageLaunches: ReportComparisonDifference;
    projectsImprovements: ReportComparisonDifference;
    errorsBugs: ReportComparisonDifference;
  };
  categoriesComparison: ReportCategoryComparison[];
  chartData: ReportCategoryComparison[];
  comparisonSummary: ReportPeriodsComparisonResponse["comparisonSummary"];
  differentDurations: boolean;
  differentPeriodTypes: boolean;
  overlappingPeriods: boolean;
  warnings: Array<{ code: string; message: string }>;
};
