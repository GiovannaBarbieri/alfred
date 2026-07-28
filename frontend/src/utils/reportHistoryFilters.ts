export type ComparableReportFilters = Record<string, string>;

export function areReportFiltersEqual<T extends ComparableReportFilters>(
  current: T,
  reference: T,
): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(reference)]);
  return [...keys].every((key) => current[key] === reference[key]);
}
