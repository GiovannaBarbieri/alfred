export type PeriodAnalysisShortcut = "complete" | "first-month" | "last-month";

export function periodForShortcut(
  shortcut: PeriodAnalysisShortcut,
  officialStart: string,
  officialEnd: string,
) {
  if (shortcut === "complete") return { startDate: officialStart, endDate: officialEnd };
  if (shortcut === "first-month") {
    return {
      startDate: officialStart,
      endDate: minIso(officialEnd, endOfMonth(officialStart)),
    };
  }
  return {
    startDate: maxIso(officialStart, startOfMonth(officialEnd)),
    endDate: officialEnd,
  };
}

export function validatePeriod(
  startDate: string,
  endDate: string,
  officialStart: string,
  officialEnd: string,
): string | null {
  if (!startDate) return "Informe a Data Inicial.";
  if (!endDate) return "Informe a Data Final.";
  if (startDate > endDate) return "A Data Inicial deve ser menor ou igual à Data Final.";
  if (startDate < officialStart || endDate > officialEnd) {
    return "O período analisado deve estar contido no período oficial do relatório.";
  }
  return null;
}

function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function endOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return toIsoDate(new Date(year, month, 0));
}

function minIso(left: string, right: string) {
  return left < right ? left : right;
}

function maxIso(left: string, right: string) {
  return left > right ? left : right;
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
