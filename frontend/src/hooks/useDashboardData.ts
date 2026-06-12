import { useState } from "react";

import {
  getDashboardOverview,
  getImports,
  getProjectExecutiveSummary,
  getProjectInsights,
  getProjectPendingItems,
  getProjectRecommendations,
  getProjectTimelineCharts,
  getReportFilterOptions,
  getReportsOverview,
} from "../services/api";
import type {
  DashboardSummary,
  DashboardOverview,
  ImportSummary,
  ProjectExecutiveSummary,
  ProjectInsights,
  ProjectPendingItems,
  ProjectRecommendation,
  ProjectTimelineCharts,
  ReportFilterOptions,
  ReportFilters,
  ReportsOverview,
  TimelinePoint,
} from "../types";
import type { ReportViewId } from "../pages/ReportsPage";

const emptySummary: DashboardSummary = {
  totalHours: 0,
  totalRecords: 0,
  totalUsers: 0,
  totalEpics: 0,
  pendingAlerts: 0,
};

const emptyOverview: DashboardOverview = {
  summary: {
    totalHours: 0,
    projectsCount: 0,
    collaboratorsCount: 0,
    pendingAlerts: 0,
  },
  recentProjects: [],
  pendingItems: {
    classificationPending: 0,
    lowConfidence: 0,
    collaboratorsWithoutProfile: 0,
    alertsPending: 0,
  },
  categorySummary: [],
  timeline: [],
};

const emptyReports: ReportsOverview = {
  user: [],
  epic: [],
  feature: [],
  pbi: [],
  task: [],
  category: [],
  subcategory: [],
};

const emptyFilters: ReportFilters = {
  startDate: "",
  endDate: "",
  user: "",
  epicId: "",
  category: "",
};

const emptyFilterOptions: ReportFilterOptions = {
  users: [],
  epics: [],
  categories: [],
};

const emptyProjectTimelineCharts: ProjectTimelineCharts = {
  dailyTotal: [],
  dailyByUser: [],
  weeklyByUser: [],
  dailyByCategory: [],
  monthlyByCategory: [],
  weeklyByCategory: [],
};

const emptyProjectExecutiveSummary: ProjectExecutiveSummary = {
  metrics: {
    totalDuration: "00:00:00",
    totalHours: 0,
    collaboratorsCount: 0,
    tasksCount: 0,
  },
  topUsers: [],
  topTasks: [],
  categories: [],
  pending: {
    unclassifiedTasks: 0,
    lowConfidence: 0,
    zeroDuration: 0,
    alerts: 0,
    open: 0,
    reviewed: 0,
    ignored: 0,
    total: 0,
  },
};

const emptyProjectPendingItems: ProjectPendingItems = {
  unclassifiedTasks: [],
  lowConfidence: [],
  zeroDuration: [],
  alerts: [],
};

const emptyProjectInsights: ProjectInsights = {
  totalHours: 0,
  cards: [],
  topUsers: [],
  topTasks: [],
  topCategories: [],
};

const emptyProjectRecommendations: ProjectRecommendation[] = [];

export function useDashboardData() {
  const [selectedReportImportId, setSelectedReportImportId] = useState<number | null>(null);
  const [selectedReportView, setSelectedReportView] = useState<ReportViewId | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary);
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [reports, setReports] = useState<ReportsOverview>(emptyReports);
  const [projectTimelineCharts, setProjectTimelineCharts] = useState<ProjectTimelineCharts>(emptyProjectTimelineCharts);
  const [projectExecutiveSummary, setProjectExecutiveSummary] = useState<ProjectExecutiveSummary>(emptyProjectExecutiveSummary);
  const [projectPendingItems, setProjectPendingItems] = useState<ProjectPendingItems>(emptyProjectPendingItems);
  const [projectInsights, setProjectInsights] = useState<ProjectInsights>(emptyProjectInsights);
  const [projectRecommendations, setProjectRecommendations] = useState<ProjectRecommendation[]>(emptyProjectRecommendations);
  const [filters, setFilters] = useState<ReportFilters>(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions>(emptyFilterOptions);

  async function refreshDashboard(activeFilters: ReportFilters = filters) {
    const [summaryData, importsData, reportsData] = await Promise.all([
      getDashboardOverview(activeFilters).then((data) => {
        setOverview(data);
        setTimeline(data.timeline);
        return {
          totalHours: data.summary.totalHours,
          totalRecords: data.summary.projectsCount,
          totalUsers: data.summary.collaboratorsCount,
          totalEpics: data.summary.projectsCount,
          pendingAlerts: data.summary.pendingAlerts,
        };
      }),
      getImports(),
      getReportsOverview(activeFilters),
    ]);
    setSummary(summaryData);
    setImports(importsData);
    setReports(reportsData);
  }

  async function refreshFilterOptions() {
    setFilterOptions(await getReportFilterOptions());
  }

  function updateFilter(field: keyof ReportFilters, value: string) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function handleApplyFilters() {
    const reportFilters =
      selectedReportImportId
        ? { ...filters, importId: String(selectedReportImportId) }
        : filters;
    await refreshDashboard(reportFilters);
  }

  async function handleClearFilters() {
    setFilters(emptyFilters);
    const reportFilters =
      selectedReportImportId
        ? { ...emptyFilters, importId: String(selectedReportImportId) }
        : emptyFilters;
    await refreshDashboard(reportFilters);
  }

  async function handleOpenReportProject(importId: number) {
    setSelectedReportImportId(importId);
    setSelectedReportView(null);
    const projectFilters = { ...filters, importId: String(importId) };
    const [, timelineChartsData, executiveSummaryData, pendingItemsData, insightsData, recommendationsData] = await Promise.all([
      refreshDashboard(projectFilters),
      getProjectTimelineCharts(importId),
      getProjectExecutiveSummary(importId),
      getProjectPendingItems(importId),
      getProjectInsights(importId),
      getProjectRecommendations(importId),
    ]);
    setProjectTimelineCharts(timelineChartsData);
    setProjectExecutiveSummary(executiveSummaryData);
    setProjectPendingItems(pendingItemsData);
    setProjectInsights(insightsData);
    setProjectRecommendations(recommendationsData);
  }

  function handleBackToReportProjects() {
    setSelectedReportImportId(null);
    setSelectedReportView(null);
    setProjectTimelineCharts(emptyProjectTimelineCharts);
    setProjectExecutiveSummary(emptyProjectExecutiveSummary);
    setProjectPendingItems(emptyProjectPendingItems);
    setProjectInsights(emptyProjectInsights);
    setProjectRecommendations(emptyProjectRecommendations);
    void refreshDashboard(filters);
  }

  return {
    selectedReportImportId,
    selectedReportView,
    setSelectedReportView,
    summary,
    overview,
    timeline,
    imports,
    reports,
    projectTimelineCharts,
    projectExecutiveSummary,
    projectPendingItems,
    projectInsights,
    projectRecommendations,
    filters,
    filterOptions,
    refreshDashboard,
    refreshFilterOptions,
    updateFilter,
    handleApplyFilters,
    handleClearFilters,
    handleOpenReportProject,
    handleBackToReportProjects,
  };
}
