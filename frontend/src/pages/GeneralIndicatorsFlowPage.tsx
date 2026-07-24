import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { GeneralIndicatorConsultationPanel } from "../components/general-indicators/GeneralIndicatorConsultationPanel";
import { GeneralIndicatorFinalizedPanel } from "../components/general-indicators/GeneralIndicatorFinalizedPanel";
import {
  consultGeneralIndicatorLaunches,
  finalizeGeneralIndicatorConsultation,
  refreshFullGeneralIndicatorConsultation,
  refreshGeneralIndicatorPendings,
  waitForGeneralIndicatorConsultation,
} from "../services/api";
import type { AnnualReportFlowContext, GeneralIndicatorConsultationProgress, GeneralIndicatorConsultationResponse, GeneralIndicatorFinalizedResponse } from "../types";
import { requiresConsultationReplacementConfirmation, resolveGeneralIndicatorScreenState } from "../utils/generalIndicatorState";

type Operation = "consultation" | "pending" | "full" | "finalization" | null;
type DateShortcut = "current-month" | "previous-month" | "current-quarter" | "current-year" | "last-30-days";

export function GeneralIndicatorsFlowPage({
  annualUpdate,
  onAnnualUpdateCompleted,
}: {
  annualUpdate?: AnnualReportFlowContext | null;
  onAnnualUpdateCompleted?: (reportId: number) => void;
} = {}) {
  const today = new Date();
  const initialDates = annualUpdate
    ? { startDate: annualUpdate.periodStart, endDate: annualUpdate.periodEnd }
    : yearDates(today.getFullYear());
  const [year, setYear] = useState(annualUpdate ? Number(annualUpdate.periodStart.slice(0, 4)) : today.getFullYear());
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [consultation, setConsultation] = useState<GeneralIndicatorConsultationResponse | null>(null);
  const [finalData, setFinalData] = useState<GeneralIndicatorFinalizedResponse | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [error, setError] = useState<string | null>(null);
  const [consultationProgress, setConsultationProgress] = useState<GeneralIndicatorConsultationProgress | null>(null);
  const resumedUpdateRef = useRef<number | null>(null);
  const busy = operation !== null;

  useEffect(() => {
    if (!annualUpdate || resumedUpdateRef.current === annualUpdate.consultationId) return;
    resumedUpdateRef.current = annualUpdate.consultationId;
    setOperation("consultation");
    setConsultationProgress({ stage: "starting", percentage: 0, message: "Carregando atualização do relatório anual." });
    void waitForGeneralIndicatorConsultation(annualUpdate.consultationId, setConsultationProgress)
      .then((result) => setConsultation(result))
      .catch((caught) => setError(errorMessage(caught, "Não foi possível continuar a atualização do relatório anual.")))
      .finally(() => { setOperation(null); setConsultationProgress(null); });
  }, [annualUpdate]);

  const screenState = useMemo(() => resolveGeneralIndicatorScreenState({
    hasConsultation: consultation !== null,
    uniqueLaunchCount: consultation?.summary.uniqueLaunchCount,
    canFinalize: consultation?.canFinalize,
    hasFinalData: finalData !== null,
    operation,
    hasError: error !== null,
  }), [consultation, error, finalData, operation]);

  const load = useCallback(async () => {
    if (!startDate) return setError("Informe a Data Inicial.");
    if (!endDate) return setError("Informe a Data Final.");
    if (startDate > endDate) return setError("A Data Inicial deve ser menor ou igual à Data Final.");

    if (consultation && consultation.period.startDate === startDate && consultation.period.endDate === endDate && !finalData) {
      setError("Este período já foi consultado. Use as ações da consulta atual.");
      return;
    }
    if (requiresConsultationReplacementConfirmation({
      hasConsultation: consultation !== null,
      isFinalized: finalData !== null,
      currentStartDate: consultation?.period.startDate,
      currentEndDate: consultation?.period.endDate,
      requestedStartDate: startDate,
      requestedEndDate: endDate,
    }) && !window.confirm("Existe uma consulta não finalizada. Deseja substituí-la pelo novo período?")) return;

    setOperation("consultation");
    setConsultationProgress({ stage: "starting", percentage: 0, message: "Iniciando consulta." });
    setError(null);
    try {
      const result = await consultGeneralIndicatorLaunches(startDate, endDate, setConsultationProgress);
      setConsultation(result);
      setFinalData(null);
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível consultar os indicadores."));
    } finally {
      setOperation(null);
      setConsultationProgress(null);
    }
  }, [consultation, endDate, finalData, startDate]);

  const refreshPendings = useCallback(async () => {
    if (!consultation) return;
    setOperation("pending"); setError(null);
    try { setConsultation(await refreshGeneralIndicatorPendings(consultation.consultationId)); }
    catch (caught) { setError(errorMessage(caught, "Não foi possível atualizar as pendências.")); }
    finally { setOperation(null); }
  }, [consultation]);

  const refreshFull = useCallback(async () => {
    if (!consultation || !window.confirm("Refazer a consulta completa buscará novamente todos os lançamentos do período. Deseja continuar?")) return;
    setOperation("full"); setError(null);
    try { setConsultation(await refreshFullGeneralIndicatorConsultation(consultation.consultationId)); }
    catch (caught) { setError(errorMessage(caught, "Não foi possível refazer a consulta completa.")); }
    finally { setOperation(null); }
  }, [consultation]);

  const finalize = useCallback(async () => {
    if (!consultation?.canFinalize) return;
    setOperation("finalization"); setError(null);
    try {
      setFinalData(await finalizeGeneralIndicatorConsultation(consultation.consultationId));
      if (annualUpdate && onAnnualUpdateCompleted) onAnnualUpdateCompleted(annualUpdate.reportId);
    }
    catch (caught) { setError(errorMessage(caught, "Não foi possível finalizar os indicadores.")); }
    finally { setOperation(null); }
  }, [annualUpdate, consultation, onAnnualUpdateCompleted]);

  function selectYear(nextYear: number) {
    setYear(nextYear);
    if (Number.isInteger(nextYear) && nextYear >= 1 && nextYear <= 9999) {
      const dates = yearDates(nextYear); setStartDate(dates.startDate); setEndDate(dates.endDate);
    }
  }

  function applyShortcut(shortcut: DateShortcut) {
    const dates = shortcutDates(shortcut, new Date());
    const shortcutYear = Number(dates.endDate.slice(0, 4));
    setYear(shortcutYear);
    setStartDate(`${shortcutYear}-01-01`);
    setEndDate(dates.endDate);
    setError(null);
  }

  function focusPeriod() {
    document.getElementById("general-indicator-start-date")?.focus();
    document.querySelector(".general-indicators-filters")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="general-indicators-page" data-state={screenState}>
      {annualUpdate && <div className="panel annual-report-flow-banner" role="status"><RefreshCw size={17} /><div><strong>Atualização de {annualUpdate.reportName}</strong><span>Consulta completa de {formatIsoDate(annualUpdate.periodStart)} até {formatIsoDate(annualUpdate.periodEnd)}.</span></div></div>}
      <section className="panel general-indicators-filters" aria-label="Filtros dos indicadores gerais">
        <div className="general-indicators-filter-grid">
          <label><span>Ano</span><input disabled={busy || Boolean(annualUpdate)} type="number" min="2020" max="2100" value={year} onChange={(event) => selectYear(Number(event.target.value))} /></label>
          <label><span>Data inicial</span><input id="general-indicator-start-date" disabled required type="date" value={startDate} /></label>
          <label><span>Data final</span><input disabled={busy || Boolean(annualUpdate)} required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <button className="primary-button general-indicators-refresh" type="button" onClick={() => void load()} disabled={busy || Boolean(annualUpdate)}>
            <RefreshCw size={16} className={operation === "consultation" ? "spinning" : ""} />{operation === "consultation" ? "Consultando..." : "Consultar"}
          </button>
        </div>
        {!annualUpdate && <div className="general-indicators-shortcuts" aria-label="Atalhos de período">
          <span>Preencher período:</span>
          <button disabled={busy} type="button" onClick={() => applyShortcut("current-month")}>Mês atual</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("previous-month")}>Mês anterior</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("current-quarter")}>Trimestre atual</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("current-year")}>Ano atual</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("last-30-days")}>Últimos 30 dias</button>
        </div>}
      </section>

      {operation && <Processing operation={operation} affected={consultation?.summary.affectedLaunchCount} progress={consultationProgress} />}
      {error && <div className="error-banner" role="alert"><AlertTriangle size={18} />{error}</div>}
      {!finalData && consultation && <GeneralIndicatorConsultationPanel consultation={consultation} operation={operation} onRefreshPendings={() => void refreshPendings()} onRefreshFull={() => void refreshFull()} onFinalize={() => void finalize()} onBack={focusPeriod} />}
      {finalData && <GeneralIndicatorFinalizedPanel result={finalData} excludedCollaboratorCount={consultation?.summary.excludedCollaboratorCount ?? 0} />}
    </section>
  );
}

function Processing({ operation, affected, progress }: { operation: Exclude<Operation, null>; affected?: number; progress?: GeneralIndicatorConsultationProgress | null }) {
  const content = {
    consultation: ["Buscando lançamentos", "Consultando o período, resolvendo hierarquias e validando os dados."],
    pending: ["Atualizando pendências", `Reconsultando somente os itens afetados${affected !== undefined ? ` (${affected} lançamentos)` : ""}.`],
    full: ["Refazendo consulta completa", "Buscando novamente todos os lançamentos do período."],
    finalization: ["Finalizando indicadores", "Calculando e registrando o resultado oficial."],
  }[operation];
  const message = operation === "consultation" && progress ? `${progress.message} (${progress.percentage}%)` : content[1];
  return <div className="general-indicator-processing" role="status" aria-live="polite"><RefreshCw className="spinning" size={18} /><div><strong>{content[0]}</strong><span>{message}</span></div></div>;
}

function errorMessage(value: unknown, fallback: string) { return value instanceof Error ? value.message : fallback; }
function yearDates(year: number) { return { startDate: `${String(year).padStart(4, "0")}-01-01`, endDate: `${String(year).padStart(4, "0")}-12-31` }; }
function shortcutDates(shortcut: DateShortcut, today: Date) {
  const year = today.getFullYear(); const month = today.getMonth(); let start: Date; let end: Date;
  if (shortcut === "current-month") { start = new Date(year, month, 1); end = new Date(year, month + 1, 0); }
  else if (shortcut === "previous-month") { start = new Date(year, month - 1, 1); end = new Date(year, month, 0); }
  else if (shortcut === "current-quarter") { const quarter = Math.floor(month / 3) * 3; start = new Date(year, quarter, 1); end = new Date(year, quarter + 3, 0); }
  else if (shortcut === "last-30-days") { end = new Date(year, month, today.getDate()); start = new Date(year, month, today.getDate() - 29); }
  else { start = new Date(year, 0, 1); end = new Date(year, 11, 31); }
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}
function toIsoDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }
function formatIsoDate(value: string) { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; }
