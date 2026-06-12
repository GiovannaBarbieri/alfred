import type { ProjectTimelineCharts } from "../../types";

export type TimelineChartId = keyof ProjectTimelineCharts;
export type TaskSortId = "duration_desc" | "duration_asc" | "title_asc" | "category_asc";
export type PdfChartMode = "none" | "current" | "all";
export type ProjectTabId = "executive" | "operational" | "charts" | "pending" | "tasks";
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
    title: "Linha do tempo diaria - total do projeto",
    description: "Volume total apontado por dia no projeto.",
  },
  {
    id: "dailyByUser",
    title: "Horas por dia e colaborador",
    description: "Comparativo diario de horas apontadas por pessoa.",
  },
  {
    id: "weeklyByUser",
    title: "Horas por semana e colaborador",
    description: "Evolucao semanal do esforco por colaborador.",
  },
  {
    id: "dailyByCategory",
    title: "Horas diarias por categoria",
    description: "Distribuicao diaria entre desenvolvimento, definicao, homologacao, retrabalho e outras categorias.",
  },
  {
    id: "weeklyByCategory",
    title: "Horas semanais por categoria",
    description: "Leitura semanal do peso de cada categoria no projeto.",
  },
  {
    id: "monthlyByCategory",
    title: "Horas mensais por categoria",
    description: "Visao mensal consolidada por categoria.",
  },
];

export const projectTabs: Array<{ id: ProjectTabId; label: string }> = [
  { id: "executive", label: "Executivo" },
  { id: "operational", label: "Operacional" },
  { id: "charts", label: "Graficos" },
  { id: "pending", label: "Pendencias" },
  { id: "tasks", label: "Tasks" },
];

export const reportLandingTabs: Array<{ id: ReportLandingTabId; label: string }> = [
  { id: "projects", label: "Projetos" },
  { id: "evolution", label: "Evolucao" },
  { id: "comparisons", label: "Comparativos" },
];
