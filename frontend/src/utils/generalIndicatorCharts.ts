import type { GeneralIndicatorCategory, GeneralIndicatorFinalizedResponse } from "../types";

type ResultMonth = GeneralIndicatorFinalizedResponse["months"][number];

export const GENERAL_INDICATOR_CHART_COLORS = {
  development: "#2563eb",
  newProject: "#16a34a",
  improvement: "#f97316",
  itError: "#7c3aed",
  bug: "#dc2626",
  maintenance: "#cbd5e1",
  operational: "#94a3b8",
  neutral: "#e2e8f0",
  grid: "#d9e2ec",
} as const;

export const STRATEGIC_CHART_SERIES = [
  { key: "newProject", label: "Novo Projeto", color: GENERAL_INDICATOR_CHART_COLORS.newProject },
  { key: "improvement", label: "Melhoria", color: GENERAL_INDICATOR_CHART_COLORS.improvement },
  { key: "itError", label: "Erro TI", color: GENERAL_INDICATOR_CHART_COLORS.itError },
  { key: "bug", label: "Bug", color: GENERAL_INDICATOR_CHART_COLORS.bug },
] as const;

export type StrategicChartKey = typeof STRATEGIC_CHART_SERIES[number]["key"];

export function buildCategoryHoursChart(categories: GeneralIndicatorCategory[]) {
  return buildExecutiveCategoryGroups(categories);
}

export function buildPeriodCompositionChart(categories: GeneralIndicatorCategory[]) {
  return buildExecutiveCategoryGroups(categories);
}

export function buildMonthlyStrategicChart(months: ResultMonth[]) {
  return months.map((month) => ({
    month: month.month,
    label: month.label,
    totalHours: month.totalHours,
    ...strategicHoursFromCategories(month.categories),
  }));
}

export function buildQuarterlyKpiChart(
  months: ResultMonth[],
  projectsTarget = 40,
  errorsLimit = 10,
) {
  const quarters = new Map<string, {
    key: string;
    label: string;
    totalHours: number;
    projectsHours: number;
    errorsHours: number;
  }>();

  months.forEach((month) => {
    const [yearText, monthText] = month.month.split("-");
    const monthNumber = Number(monthText);
    if (!yearText || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) return;
    const quarter = Math.ceil(monthNumber / 3);
    const key = `${yearText}-T${quarter}`;
    const current = quarters.get(key) ?? {
      key,
      label: `${quarter}º tri./${yearText}`,
      totalHours: 0,
      projectsHours: 0,
      errorsHours: 0,
    };
    current.totalHours += Number(month.totalHours || 0);
    current.projectsHours += Number(month.projectsImprovements.hours || 0);
    current.errorsHours += Number(month.errorsBugs.hours || 0);
    quarters.set(key, current);
  });

  return Array.from(quarters.values())
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((quarter) => ({
      ...quarter,
      projectsPercentage: percentage(quarter.projectsHours, quarter.totalHours),
      errorsPercentage: percentage(quarter.errorsHours, quarter.totalHours),
      projectsTarget,
      errorsLimit,
    }));
}

export function shouldShowQuarterlyChart(months: ResultMonth[]) {
  return buildQuarterlyKpiChart(months).length > 1;
}

export function strategicCategoryKey(category: string): StrategicChartKey | null {
  switch (normalize(category)) {
    case "novo projeto": return "newProject";
    case "melhoria": return "improvement";
    case "erro ti": return "itError";
    case "bug": return "bug";
    default: return null;
  }
}

function strategicHoursFromCategories(categories: Record<string, number>) {
  const totals: Record<StrategicChartKey, number> = {
    newProject: 0,
    improvement: 0,
    itError: 0,
    bug: 0,
  };
  Object.entries(categories).forEach(([category, hours]) => {
    const key = strategicCategoryKey(category);
    if (key) totals[key] += Number(hours || 0);
  });
  return totals;
}

function buildExecutiveCategoryGroups(categories: GeneralIndicatorCategory[]) {
  type ExecutiveChartKey = StrategicChartKey | "maintenance" | "operational";
  const grouped = new Map<ExecutiveChartKey, {
    key: ExecutiveChartKey;
    name: string;
    hours: number;
    color: string;
    isStrategic: boolean;
    groupedCategories: string[];
  }>();
  STRATEGIC_CHART_SERIES.forEach((series) => grouped.set(series.key, {
    key: series.key,
    name: series.label,
    hours: 0,
    color: series.color,
    isStrategic: true,
    groupedCategories: [series.label],
  }));
  grouped.set("maintenance", {
    key: "maintenance",
    name: "Manutenção",
    hours: 0,
    color: GENERAL_INDICATOR_CHART_COLORS.maintenance,
    isStrategic: false,
    groupedCategories: ["Manutenção"],
  });
  grouped.set("operational", {
    key: "operational",
    name: "Operacional",
    hours: 0,
    color: GENERAL_INDICATOR_CHART_COLORS.operational,
    isStrategic: false,
    groupedCategories: [],
  });

  categories.forEach((item) => {
    const strategicKey = strategicCategoryKey(item.category);
    const maintenance = normalize(item.category) === "manutencao";
    const key: ExecutiveChartKey = strategicKey ?? (maintenance ? "maintenance" : "operational");
    const current = grouped.get(key)!;
    current.hours += Number(item.adjustedHours || 0);
    if (!strategicKey && !maintenance && !current.groupedCategories.includes(item.category)) {
      current.groupedCategories.push(item.category);
    }
  });

  const totalHours = Array.from(grouped.values()).reduce((total, item) => total + item.hours, 0);
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    groupedCategories: [...item.groupedCategories].sort((left, right) => left.localeCompare(right, "pt-BR")),
    percentage: percentage(item.hours, totalHours),
  }));
}

function percentage(hours: number, totalHours: number) {
  return totalHours > 0 ? (hours / totalHours) * 100 : 0;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
