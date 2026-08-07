import { AlertTriangle, Bug, CalendarRange, Clock3, ListChecks, RefreshCw, SearchX, TrendingUp } from "lucide-react";
import { useMemo } from "react";

import {
  GeneralIndicatorCompositionChart,
  GeneralIndicatorMonthlyCategoryChart,
} from "../general-indicators/GeneralIndicatorManagementCharts";
import type { GeneralIndicatorFinalizedResponse, GeneralIndicatorKpi } from "../../types";
import { useReportPeriodAnalysis } from "../../hooks/useReportPeriodAnalysis";
import {
  formatCountPtBr,
  formatHoursPtBr,
  formatPercentagePtBr,
} from "../../utils/numberFormatting";
import { validateSnapshotPeriod } from "../../utils/savedReportSnapshotPeriodAnalysis";

export function ReportPeriodAnalysisPanel({
  snapshot,
  reportId,
}: {
  snapshot: GeneralIndicatorFinalizedResponse;
  reportId: number;
}) {
  const officialStart = snapshot.period.startDate;
  const officialEnd = snapshot.period.endDate;
  const analysis = useReportPeriodAnalysis(reportId, officialStart, officialEnd);
  const { startDate, endDate, result, isLoading } = analysis;

  const validation = useMemo(
    () => validateSnapshotPeriod(startDate, endDate, officialStart, officialEnd),
    [endDate, officialEnd, officialStart, startDate],
  );
  const hasDates = Boolean(startDate || endDate);
  const hasValidationErrors = Boolean(validation.startDate || validation.endDate);
  const canAnalyze = Boolean(startDate && endDate && !hasValidationErrors && !isLoading);
  const canClear = Boolean((hasDates || result) && !isLoading);

  function analyze() {
    if (!canAnalyze) return;
    void analysis.analyze();
  }

  function updateStartDate(value: string) {
    analysis.setStartDate(value);
  }

  function updateEndDate(value: string) {
    analysis.setEndDate(value);
  }

  return (
    <details className="panel report-period-analysis-card">
      <summary>
        <span><CalendarRange size={18} />Análise por período</span>
        <i aria-hidden="true" />
      </summary>

      <section className="report-period-analysis" aria-label="Análise por período">
        <p className="report-period-analysis-intro">Selecione um intervalo dentro do período deste relatório para visualizar indicadores específicos.</p>
        <div className="report-period-official-range">
          <span>Período disponível para análise</span>
          <strong>{formatDate(officialStart)} a {formatDate(officialEnd)}</strong>
        </div>

        <div className="report-period-analysis-filter-row">
          <label>
            <span>Data inicial</span>
            <input
              type="date"
              min={officialStart}
              max={officialEnd}
              value={startDate}
              disabled={isLoading}
              aria-invalid={Boolean(validation.startDate)}
              onChange={(event) => updateStartDate(event.target.value)}
              onInput={(event) => updateStartDate(event.currentTarget.value)}
            />
            {validation.startDate && <small role="alert">{validation.startDate}</small>}
          </label>
          <label>
            <span>Data final</span>
            <input
              type="date"
              min={officialStart}
              max={officialEnd}
              value={endDate}
              disabled={isLoading}
              aria-invalid={Boolean(validation.endDate)}
              onChange={(event) => updateEndDate(event.target.value)}
              onInput={(event) => updateEndDate(event.currentTarget.value)}
            />
            {validation.endDate && <small role="alert">{validation.endDate}</small>}
          </label>
          <button
            className="primary-button report-period-analyze-button"
            type="button"
            disabled={!canAnalyze}
            onClick={analyze}
          >
            <RefreshCw size={16} className={isLoading ? "spinning" : ""} />
            {isLoading ? "Analisando..." : "Analisar"}
          </button>
          <button
            className="secondary-button report-period-clear-button"
            type="button"
            disabled={!canClear}
            onClick={analysis.clear}
          >
            Limpar
          </button>
        </div>

        {analysis.error && <div className="error-banner compact" role="alert"><AlertTriangle size={17} />{analysis.error}</div>}

        {isLoading && (
          <div className="general-indicator-processing compact" role="status" aria-live="polite">
            <RefreshCw className="spinning" size={18} />
            <div><strong>Analisando o período</strong><span>Recalculando exclusivamente com os dados do snapshot salvo.</span></div>
          </div>
        )}

        {!isLoading && result?.recordCount === 0 && (
          <section className="panel report-period-analysis-empty">
            <span><SearchX size={24} /></span>
            <div><h2>Sem dados no período</h2><p>Não foram encontrados lançamentos no período selecionado.</p></div>
          </section>
        )}

        {!isLoading && result && result.recordCount > 0 && (
          <section className="report-period-analysis-result">
            <div className="report-period-analysis-caption">
              <span>Período analisado</span>
              <strong>{formatDate(result.analyzedPeriod.startDate)} a {formatDate(result.analyzedPeriod.endDate)}</strong>
            </div>
            <section className="general-indicators-kpis" aria-label="Indicadores do período analisado">
              <article className="general-indicator-card period-analysis-kpi">
                <span><Clock3 size={20} /></span>
                <div><small>Total de horas</small><strong>{formatHoursPtBr(result.totalHours)}</strong></div>
              </article>
              <article className="general-indicator-card period-analysis-kpi">
                <span><ListChecks size={20} /></span>
                <div><small>Lançamentos considerados</small><strong>{formatCountPtBr(result.recordCount)}</strong></div>
              </article>
              <PeriodKpiCard icon={<TrendingUp size={20} />} title="Novos projetos + melhorias" kpi={result.kpis.projectsImprovements} />
              <PeriodKpiCard icon={<Bug size={20} />} title="Erro TI + Bug" kpi={result.kpis.errorsBugs} />
            </section>
            <GeneralIndicatorCompositionChart
              result={{ ...result, period: result.analyzedPeriod }}
              title="Composição das horas por categoria"
              analysisView
            />
            <GeneralIndicatorMonthlyCategoryChart
              result={{ ...result, period: result.analyzedPeriod, months: result.evolution }}
              title="Evolução mensal no intervalo selecionado"
              executive
              analysisView
              description="Evolução mensal das categorias no intervalo selecionado."
            />
          </section>
        )}
      </section>
    </details>
  );
}

function PeriodKpiCard({ icon, title, kpi }: { icon: JSX.Element; title: string; kpi: GeneralIndicatorKpi }) {
  return (
    <article className="general-indicator-card period-analysis-kpi">
      <span>{icon}</span>
      <div>
        <small>{title}</small>
        <strong>{formatPercentagePtBr(kpi.percentage)}</strong>
        <em>{formatHoursPtBr(kpi.hours)}</em>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
