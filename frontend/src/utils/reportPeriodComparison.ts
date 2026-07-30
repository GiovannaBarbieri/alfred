import type { ReportCategoryComparison } from "../types";

export type ComparisonSortKey = "category" | "hoursA" | "hoursB" | "variation";
export type SortDirection = "asc" | "desc";

export function validateComparisonPeriod(
  label: string,
  startDate: string,
  endDate: string,
  officialStart: string,
  officialEnd: string,
) {
  if (!startDate) return `${label}: a Data Inicial é obrigatória.`;
  if (!endDate) return `${label}: a Data Final é obrigatória.`;
  if (startDate > endDate) return `${label}: a Data Inicial deve ser menor ou igual à Data Final.`;
  if (startDate < officialStart || endDate > officialEnd) {
    return `${label}: o intervalo deve estar dentro do período oficial do relatório.`;
  }
  if (startDate === endDate) return `${label}: a Data Inicial deve ser anterior à Data Final.`;
  return null;
}

export function sortCategoryComparison(
  items: ReportCategoryComparison[],
  key: ComparisonSortKey,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (key === "category") return left.category.localeCompare(right.category, "pt-BR") * multiplier;
    const leftValue = key === "variation" ? left.absoluteDifference : left[key];
    const rightValue = key === "variation" ? right.absoluteDifference : right[key];
    return (leftValue - rightValue) * multiplier;
  });
}

export function toggleSortDirection(
  currentKey: ComparisonSortKey,
  currentDirection: SortDirection,
  nextKey: ComparisonSortKey,
) {
  return currentKey === nextKey && currentDirection === "desc" ? "asc" : "desc";
}
