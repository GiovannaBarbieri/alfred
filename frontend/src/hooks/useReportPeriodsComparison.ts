import { useCallback, useRef, useState } from "react";

import { getReportPeriodsComparison } from "../services/reportHistoryService";
import type { ReportPeriodsComparisonResponse } from "../types";
import { periodForShortcut, type PeriodAnalysisShortcut } from "../utils/reportPeriodAnalysis";
import { validateComparisonPeriod } from "../utils/reportPeriodComparison";

export function useReportPeriodsComparison(
  reportId: number,
  officialStart: string,
  officialEnd: string,
) {
  const initialA = periodForShortcut("first-month", officialStart, officialEnd);
  const initialB = periodForShortcut("last-month", officialStart, officialEnd);
  const [periodA, setPeriodA] = useState(initialA);
  const [periodB, setPeriodB] = useState(initialB);
  const [result, setResult] = useState<ReportPeriodsComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestInFlight = useRef(false);

  const compare = useCallback(async () => {
    if (requestInFlight.current) return;
    const validationA = validateComparisonPeriod("Período A", periodA.startDate, periodA.endDate, officialStart, officialEnd);
    const validationB = validateComparisonPeriod("Período B", periodB.startDate, periodB.endDate, officialStart, officialEnd);
    if (validationA || validationB) {
      setError(validationA ?? validationB);
      return;
    }
    requestInFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      setResult(await getReportPeriodsComparison(
        reportId,
        periodA.startDate,
        periodA.endDate,
        periodB.startDate,
        periodB.endDate,
      ));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível comparar os períodos.");
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  }, [officialEnd, officialStart, periodA, periodB, reportId]);

  function applyShortcut(target: "A" | "B", shortcut: PeriodAnalysisShortcut) {
    const period = periodForShortcut(shortcut, officialStart, officialEnd);
    if (target === "A") setPeriodA(period);
    else setPeriodB(period);
    setError(null);
  }

  function clear() {
    setPeriodA(initialA);
    setPeriodB(initialB);
    setResult(null);
    setError(null);
  }

  return {
    applyShortcut,
    clear,
    compare,
    error,
    isLoading,
    periodA,
    periodB,
    result,
    setPeriodA,
    setPeriodB,
  };
}
