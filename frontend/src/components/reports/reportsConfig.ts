import type { ProjectTimelineCharts } from "../../types";

export type TimelineChartId = keyof ProjectTimelineCharts;
export type TaskSortId = "duration_desc" | "duration_asc" | "title_asc" | "category_asc";
export type PdfChartMode = "none" | "current" | "all";
export type ProjectTabId = "executive" | "charts" | "tasks";
export type ReportLandingTabId = "projects" | "evolution" | "comparisons";
export type PendingTypeFilter = "all" | "unclassified" | "low_confidence" | "zero_duration" | "alert";
export type PendingStatusFilter = "all" | "pendente" | "revisado" | "ignorado";

export const timelineCharts: Array<{
  id: TimelineChartId;
  title: string;
  description: string;
}> = [
  {
    id: "dailyTotal",
    title: "Evolução Diária do Projeto",
    description: "Volume total apontado por dia no projeto.",
  },
  {
    id: "dailyByUser",
    title: "Produtividade Diária por Colaborador",
    description: "Comparativo diário de horas apontadas por pessoa.",
  },
  {
    id: "weeklyByUser",
    title: "Produtividade Semanal por Colaborador",
    description: "Evolução semanal do esforço por colaborador.",
  },
  {
    id: "dailyByCategory",
    title: "Evolução Diária por Categoria",
    description: "Distribuição diária entre desenvolvimento, definição, homologação, retrabalho e outras categorias.",
  },
  {
    id: "weeklyByCategory",
    title: "Evolução Semanal por Categoria",
    description: "Leitura semanal do peso de cada categoria no projeto.",
  },
  {
    id: "monthlyByCategory",
    title: "Evolução Mensal por Categoria",
    description: "Visão mensal consolidada por categoria.",
  },
];

export const projectTabs: Array<{ id: ProjectTabId; label: string }> = [
  { id: "executive", label: "Executivo" },
  { id: "charts", label: "Gráficos" },
  { id: "tasks", label: "Tasks" },
];

export const reportLandingTabs: Array<{ id: ReportLandingTabId; label: string }> = [
  { id: "projects", label: "Projetos" },
  { id: "evolution", label: "Evolução" },
  { id: "comparisons", label: "Comparativos" },
];
