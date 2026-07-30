import { useCallback, useRef, useState } from "react";

import { getReportPeriodAnalysis } from "../services/reportHistoryService";
import type { ReportPeriodAnalysisResponse } from "../types";
import {
  periodForShortcut,
  type PeriodAnalysisShortcut,
  validatePeriod,
} from "../utils/reportPeriodAnalysis";

export function useReportPeriodAnalysis(
  reportId: number,
  officialStart: string,
  officialEnd: string,
) {
  const [startDate, setStartDate] = useState(officialStart);
  const [endDate, setEndDate] = useState(officialEnd);
  const [result, setResult] = useState<ReportPeriodAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestInFlight = useRef(false);

  const analyze = useCallback(async () => {
    if (requestInFlight.current) return;
    const validation = validatePeriod(startDate, endDate, officialStart, officialEnd);
    if (validation) {
      setError(validation);
      return;
    }
    requestInFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      setResult(await getReportPeriodAnalysis(reportId, startDate, endDate));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar o período.");
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  }, [endDate, officialEnd, officialStart, reportId, startDate]);

  function applyShortcut(shortcut: PeriodAnalysisShortcut) {
    const period = periodForShortcut(shortcut, officialStart, officialEnd);
    setStartDate(period.startDate);
    setEndDate(period.endDate);
    setError(null);
  }

  function clear() {
    setStartDate(officialStart);
    setEndDate(officialEnd);
    setResult(null);
    setError(null);
  }

  return {
    analyze,
    applyShortcut,
    clear,
    endDate,
    error,
    isLoading,
    result,
    setEndDate,
    setStartDate,
    startDate,
  };
}
