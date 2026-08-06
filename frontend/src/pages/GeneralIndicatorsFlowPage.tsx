import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { GeneralIndicatorConsultationPanel } from "../components/general-indicators/GeneralIndicatorConsultationPanel";
import {
  consultGeneralIndicatorLaunches,
  finalizeGeneralIndicatorConsultation,
  refreshGeneralIndicatorPendings,
} from "../services/api";
import type { GeneralIndicatorConsultationProgress, GeneralIndicatorConsultationResponse } from "../types";
import { resolveGeneralIndicatorScreenState } from "../utils/generalIndicatorState";

type Operation = "consultation" | "pending" | "finalization" | null;
type DateShortcut = "current-month" | "previous-month" | "current-quarter" | "current-year" | "last-30-days";

export function GeneralIndicatorsFlowPage({
  onReportSaved,
  initialPeriod,
  onInitialPeriodConsumed,
}: {
  onReportSaved: (reportId: number) => void;
  initialPeriod?: { startDate: string; endDate: string } | null;
  onInitialPeriodConsumed?: () => void;
}) {
  const today = new Date();
  const initialDates = initialPeriod ?? yearDates(today.getFullYear());
  const [year, setYear] = useState(Number(initialDates.startDate.slice(0, 4)));
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [consultation, setConsultation] = useState<GeneralIndicatorConsultationResponse | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportName, setReportName] = useState("");
  const [consultationProgress, setConsultationProgress] = useState<GeneralIndicatorConsultationProgress | null>(null);
  const finalizationInFlight = useRef(false);
  const busy = operation !== null;

  useEffect(() => {
    if (!initialPeriod) return;
    setYear(Number(initialPeriod.startDate.slice(0, 4)));
    setStartDate(initialPeriod.startDate);
    setEndDate(initialPeriod.endDate);
    setError(null);
    onInitialPeriodConsumed?.();
  }, [initialPeriod, onInitialPeriodConsumed]);

  const screenState = useMemo(() => resolveGeneralIndicatorScreenState({
    hasConsultation: consultation !== null,
    uniqueLaunchCount: consultation?.summary.uniqueLaunchCount,
    canFinalize: consultation?.canFinalize,
    hasFinalData: false,
    operation,
    hasError: error !== null,
  }), [consultation, error, operation]);

  const load = useCallback(async () => {
    if (!startDate) return setError("Informe a Data Inicial.");
    if (!endDate) return setError("Informe a Data Final.");
    if (startDate > endDate) return setError("A Data Inicial deve ser menor ou igual à Data Final.");

    setOperation("consultation");
    setConsultationProgress({ stage: "starting", percentage: 0, message: "Iniciando consulta." });
    setError(null);
    setConsultation(null);
    setReportName("");
    try {
      const result = await consultGeneralIndicatorLaunches(startDate, endDate, setConsultationProgress);
      setConsultation(result);
      setReportName(suggestReportName(startDate, endDate));
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível consultar os indicadores."));
    } finally {
      setOperation(null);
      setConsultationProgress(null);
    }
  }, [endDate, startDate]);

  const refreshPendings = useCallback(async () => {
    if (!consultation) return;
    setOperation("pending"); setError(null);
    try { setConsultation(await refreshGeneralIndicatorPendings(consultation.consultationId)); }
    catch (caught) { setError(errorMessage(caught, "Não foi possível atualizar as pendências.")); }
    finally { setOperation(null); }
  }, [consultation]);

  const finalize = useCallback(async () => {
    if (!consultation?.canFinalize || finalizationInFlight.current) return;
    if (!reportName.trim()) {
      setError("Informe o nome do relatório.");
      return;
    }
    finalizationInFlight.current = true;
    setOperation("finalization"); setError(null);
    try {
      const finalized = await finalizeGeneralIndicatorConsultation(consultation.consultationId, reportName);
      if (!finalized.reportId) {
        throw new Error("O relatório foi salvo, mas seu identificador não foi retornado.");
      }
      onReportSaved(finalized.reportId);
    }
    catch (caught) { setError(errorMessage(caught, "Não foi possível finalizar os indicadores.")); }
    finally { finalizationInFlight.current = false; setOperation(null); }
  }, [consultation, onReportSaved, reportName]);

  function selectYear(nextYear: number) {
    setYear(nextYear);
    if (Number.isInteger(nextYear) && nextYear >= 1 && nextYear <= 9999) {
      const dates = yearDates(nextYear); setStartDate(dates.startDate); setEndDate(dates.endDate);
    }
  }

  function applyShortcut(shortcut: DateShortcut) {
    const dates = shortcutDates(shortcut, new Date());
    const shortcutYear = Number(dates.startDate.slice(0, 4));
    setYear(shortcutYear);
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
    setError(null);
  }

  return (
    <section className="general-indicators-page" data-state={screenState}>
      <section className="panel general-indicators-filters" aria-label="Filtros dos indicadores gerais">
        <div className="general-indicators-filter-grid">
          <label><span>Ano</span><input disabled={busy} type="number" min="2020" max="2100" value={year} onChange={(event) => selectYear(Number(event.target.value))} /></label>
          <label><span>Data inicial</span><input id="general-indicator-start-date" disabled={busy} required type="date" value={startDate} onChange={(event) => { setStartDate(event.target.value); setYear(Number(event.target.value.slice(0, 4))); }} /></label>
          <label><span>Data final</span><input disabled={busy} required type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
          <button className="primary-button general-indicators-refresh" type="button" onClick={() => void load()} disabled={busy}>
            <RefreshCw size={16} className={operation === "consultation" ? "spinning" : ""} />{operation === "consultation" ? "Consultando..." : "Consultar"}
          </button>
        </div>
        <div className="general-indicators-shortcuts" aria-label="Atalhos de período">
          <span>Preencher período:</span>
          <button disabled={busy} type="button" onClick={() => applyShortcut("current-month")}>Mês atual</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("previous-month")}>Mês anterior</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("current-quarter")}>Trimestre atual</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("current-year")}>Ano atual</button>
          <button disabled={busy} type="button" onClick={() => applyShortcut("last-30-days")}>Últimos 30 dias</button>
        </div>
      </section>

      {operation && <Processing operation={operation} affected={consultation?.summary.affectedLaunchCount} progress={consultationProgress} />}
      {error && <div className="error-banner" role="alert"><AlertTriangle size={18} />{error}</div>}
      {consultation && <GeneralIndicatorConsultationPanel consultation={consultation} operation={operation} onRefreshPendings={() => void refreshPendings()} onFinalize={() => void finalize()} reportName={reportName} onReportNameChange={setReportName} />}
    </section>
  );
}

function Processing({ operation, affected, progress }: { operation: Exclude<Operation, null>; affected?: number; progress?: GeneralIndicatorConsultationProgress | null }) {
  const content = {
    consultation: ["Buscando lançamentos", "Consultando o período, resolvendo hierarquias e validando os dados."],
    pending: ["Atualizando pendências", `Reconsultando somente os itens afetados${affected !== undefined ? ` (${affected} lançamentos)` : ""}.`],
    finalization: ["Salvando relatório", "Registrando um novo snapshot independente."],
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

export function suggestReportName(startDate: string, endDate: string) {
  const start = fromIsoDate(startDate);
  const end = fromIsoDate(endDate);
  const year = start.getFullYear();
  if (year === end.getFullYear()) {
    if (startDate === `${year}-01-01` && endDate === `${year}-12-31`) return `Ano ${year}`;
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const monthEnd = new Date(year, start.getMonth() + 1, 0);
    if (start.getDate() === 1 && endDate === toIsoDate(monthEnd)) return `${monthNames[start.getMonth()]} ${year}`;
    const quarter = Math.floor(start.getMonth() / 3);
    const quarterStart = new Date(year, quarter * 3, 1);
    const quarterEnd = new Date(year, quarter * 3 + 3, 0);
    if (startDate === toIsoDate(quarterStart) && endDate === toIsoDate(quarterEnd)) return `${quarter + 1}º Trimestre ${year}`;
    if (startDate === `${year}-01-01` && endDate === `${year}-06-30`) return `1º Semestre ${year}`;
    if (startDate === `${year}-07-01` && endDate === `${year}-12-31`) return `2º Semestre ${year}`;
    const endMonthLastDay = new Date(year, end.getMonth() + 1, 0);
    if (start.getDate() === 1 && endDate === toIsoDate(endMonthLastDay)) {
      return `${monthNames[start.getMonth()]} a ${monthNames[end.getMonth()]} ${year}`;
    }
  }
  return `${formatIsoDate(startDate)} a ${formatIsoDate(endDate)}`;
}

function fromIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
