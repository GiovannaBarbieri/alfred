import { useCallback, useEffect, useRef, useState } from "react";

import {
  compareSavedReports,
  listReportComparisonOptions,
} from "../services/reportHistoryService";
import type {
  ReportComparisonType,
  SavedReportComparisonOption,
  SavedReportsComparisonResponse,
  SavedReportType,
} from "../types";

const DEFAULT_REPORT_TYPE: SavedReportType = "GENERAL_INDICATORS";

export function useReportPeriodsComparison() {
  const [reportType] = useState<SavedReportType>(DEFAULT_REPORT_TYPE);
  const [comparisonType, setComparisonType] = useState<ReportComparisonType>("FREE");
  const [options, setOptions] = useState<SavedReportComparisonOption[]>([]);
  const [reportARevisionId, setReportARevisionId] = useState<number | null>(null);
  const [reportBRevisionId, setReportBRevisionId] = useState<number | null>(null);
  const [result, setResult] = useState<SavedReportsComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const requestInFlight = useRef(false);

  const loadOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    setOptionsError(null);
    try {
      const response = await listReportComparisonOptions(reportType, comparisonType);
      setOptions(response.items);
      setReportARevisionId((current) =>
        current !== null && response.items.some((item) => item.revisionId === current)
          ? current
          : null,
      );
      setReportBRevisionId((current) =>
        current !== null && response.items.some((item) => item.revisionId === current)
          ? current
          : null,
      );
    } catch (caught) {
      setOptions([]);
      setOptionsError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível carregar os relatórios disponíveis.",
      );
    } finally {
      setIsLoadingOptions(false);
    }
  }, [comparisonType, reportType]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const compare = useCallback(async () => {
    if (requestInFlight.current) return;
    if (reportARevisionId === null || reportBRevisionId === null) {
      setError("Selecione o Relatório A e o Relatório B.");
      return;
    }
    if (reportARevisionId === reportBRevisionId) {
      setError("Selecione dois relatórios diferentes para realizar a comparação.");
      return;
    }
    requestInFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      setResult(
        await compareSavedReports(
          reportType,
          reportARevisionId,
          reportBRevisionId,
        ),
      );
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível comparar os relatórios.",
      );
    } finally {
      requestInFlight.current = false;
      setIsLoading(false);
    }
  }, [reportARevisionId, reportBRevisionId, reportType]);

  function changeComparisonType(value: ReportComparisonType) {
    setComparisonType(value);
    setResult(null);
    setError(null);
  }

  function selectReportA(value: number | null) {
    setReportARevisionId(value);
    setResult(null);
    setError(null);
  }

  function selectReportB(value: number | null) {
    setReportBRevisionId(value);
    setResult(null);
    setError(null);
  }

  function clear() {
    setReportARevisionId(null);
    setReportBRevisionId(null);
    setResult(null);
    setError(null);
  }

  return {
    canCompare:
      reportARevisionId !== null
      && reportBRevisionId !== null
      && reportARevisionId !== reportBRevisionId,
    changeComparisonType,
    clear,
    compare,
    comparisonType,
    error,
    isLoading,
    isLoadingOptions,
    loadOptions,
    options,
    optionsError,
    reportARevisionId,
    reportBRevisionId,
    reportType,
    result,
    selectReportA,
    selectReportB,
  };
}
