import type { GeneralIndicatorCategory, GeneralIndicatorFinalizedResponse } from "../types";

export type HoursCompositionSortKey = "category" | "originalHours" | "allocatedHours" | "adjustedHours" | "percentage";
export type HoursCompositionFilter = "all" | "strategic" | "other";
export type SortDirection = "asc" | "desc";

const strategicCategories = new Set([
  "novo projeto",
  "melhoria",
  "erro ti",
  "bug",
]);

export function isStrategicIndicatorCategory(category: string) {
  return strategicCategories.has(normalize(category));
}

export function filterIndicatorCategories(
  categories: GeneralIndicatorCategory[],
  filter: HoursCompositionFilter,
) {
  if (filter === "all") return [...categories];
  return categories.filter((item) => (
    filter === "strategic"
      ? isStrategicIndicatorCategory(item.category)
      : !isStrategicIndicatorCategory(item.category)
  ));
}

export function sortIndicatorCategories(
  categories: GeneralIndicatorCategory[],
  key: HoursCompositionSortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return categories
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const comparison = key === "category"
        ? left.item.category.localeCompare(right.item.category, "pt-BR", { sensitivity: "base" })
        : left.item[key] - right.item[key];
      return comparison === 0 ? left.index - right.index : comparison * multiplier;
    })
    .map(({ item }) => item);
}

export function summarizeHoursComposition(categories: GeneralIndicatorCategory[]) {
  return categories.reduce(
    (totals, item) => ({
      originalHours: totals.originalHours + item.originalHours,
      allocatedHours: totals.allocatedHours + item.allocatedHours,
      adjustedHours: totals.adjustedHours + item.adjustedHours,
      percentage: totals.percentage + item.percentage,
    }),
    { originalHours: 0, allocatedHours: 0, adjustedHours: 0, percentage: 0 },
  );
}

export function buildExecutiveHoursComposition(categories: GeneralIndicatorCategory[]) {
  const preferred = ["manutencao", "novo projeto", "melhoria", "erro ti", "bug"];
  const rowsByCategory = new Map(categories.map((item) => [normalize(item.category), item]));
  const visible = preferred
    .map((category) => rowsByCategory.get(category))
    .filter((item): item is GeneralIndicatorCategory => Boolean(item));
  const operationalItems = categories.filter((item) => !preferred.includes(normalize(item.category)));
  if (operationalItems.length === 0) return visible;

  const operational = operationalItems.reduce<GeneralIndicatorCategory>(
    (total, item) => ({
      category: "Operacional",
      originalHours: total.originalHours + item.originalHours,
      allocatedHours: total.allocatedHours + item.allocatedHours,
      adjustedHours: total.adjustedHours + item.adjustedHours,
      percentage: 0,
    }),
    { category: "Operacional", originalHours: 0, allocatedHours: 0, adjustedHours: 0, percentage: 0 },
  );
  const adjustedTotal = categories.reduce((total, item) => total + item.adjustedHours, 0);
  operational.percentage = reconciledParticipationPercentage(operational.adjustedHours, adjustedTotal);
  return [...visible, operational];
}

export function participationBarWidth(percentage: number) {
  return Math.max(0, Math.min(100, Number(percentage || 0)));
}

export function hasAdjustedIndicatorHours(category: GeneralIndicatorCategory) {
  return Math.abs(Number(category.adjustedHours || 0) - Number(category.originalHours || 0)) >= 0.005;
}

export function reconciledParticipationPercentage(adjustedHours: number, totalHours: number) {
  if (totalHours <= 0) return 0;
  return (adjustedHours / totalHours) * 100;
}

type DistributionRow = GeneralIndicatorFinalizedResponse["distribution"][number];

export function summarizeUpdateDistribution(distribution: DistributionRow[]) {
  const totalUpdateHours = distribution.reduce((total, item) => total + item.updateSystemHours, 0);
  const totalDistributedHours = distribution.reduce((total, item) => total + item.distributedHours, 0);
  const peakMonth = distribution.reduce<DistributionRow | null>(
    (peak, item) => !peak || item.updateSystemHours > peak.updateSystemHours ? item : peak,
    null,
  );
  const destinations = [
    { category: "Manutenção", hours: distribution.reduce((total, item) => total + item.maintenanceHours, 0) },
    { category: "Novo projeto", hours: distribution.reduce((total, item) => total + item.newProjectHours, 0) },
    { category: "Melhoria", hours: distribution.reduce((total, item) => total + item.improvementHours, 0) },
    { category: "Erro TI", hours: distribution.reduce((total, item) => total + item.itErrorHours, 0) },
    { category: "Bug", hours: distribution.reduce((total, item) => total + (item.bugHours ?? 0), 0) },
  ];
  const leadingDestination = destinations.reduce(
    (leader, item) => item.hours > leader.hours ? item : leader,
    destinations[0],
  );
  const isBalanced = distribution.every((item) => item.isBalanced);
  const distributedPercentage = totalUpdateHours === 0
    ? 100
    : (totalDistributedHours / totalUpdateHours) * 100;

  return {
    totalUpdateHours,
    totalDistributedHours,
    peakMonth,
    leadingDestination,
    isBalanced,
    distributedPercentage,
  };
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}
