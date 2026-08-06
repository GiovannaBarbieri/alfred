import { AlertTriangle, Bug, Clock3, ListChecks, RefreshCw, SearchX, TrendingUp } from "lucide-react";

import {
  GeneralIndicatorCompositionChart,
  GeneralIndicatorMonthlyCategoryChart,
} from "../general-indicators/GeneralIndicatorManagementCharts";
import { useReportPeriodAnalysis } from "../../hooks/useReportPeriodAnalysis";
import type { GeneralIndicatorKpi } from "../../types";
import {
  formatCountPtBr,
  formatHoursPtBr,
  formatPercentagePtBr,
} from "../../utils/numberFormatting";

export function ReportPeriodAnalysisPanel({
  reportId,
  officialStart,
  officialEnd,
}: {
  reportId: number;
  officialStart: string;
  officialEnd: string;
}) {
  const analysis = useReportPeriodAnalysis(reportId, officialStart, officialEnd);

  return (
    <section className="report-period-analysis" aria-label="Análise por período">
      <section className="panel report-period-analysis-filters">
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
              value={analysis.startDate}
              disabled={analysis.isLoading}
              onChange={(event) => analysis.setStartDate(event.target.value)}
            />
          </label>
          <label>
            <span>Data final</span>
            <input
              type="date"
              min={officialStart}
              max={officialEnd}
              value={analysis.endDate}
              disabled={analysis.isLoading}
              onChange={(event) => analysis.setEndDate(event.target.value)}
            />
          </label>
          <button
            className="primary-button report-period-analyze-button"
            type="button"
            disabled={analysis.isLoading}
            onClick={() => void analysis.analyze()}
          >
            <RefreshCw size={16} className={analysis.isLoading ? "spinning" : ""} />
            {analysis.isLoading ? "Analisando..." : "Analisar"}
          </button>
          <button
            className="secondary-button report-period-clear-button"
            type="button"
            disabled={analysis.isLoading}
            onClick={analysis.clear}
          >
            Limpar
          </button>
        </div>

        <div className="report-period-shortcuts" aria-label="Atalhos de período">
          <span>Preencher período:</span>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("complete")}>Período completo</button>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("first-month")}>Primeiro mês</button>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("last-month")}>Último mês</button>
        </div>
      </section>

      {analysis.error && <div className="error-banner" role="alert"><AlertTriangle size={18} />{analysis.error}</div>}
      {analysis.isLoading && (
        <div className="general-indicator-processing" role="status" aria-live="polite">
          <RefreshCw className="spinning" size={18} />
          <div><strong>Analisando o período</strong><span>Recalculando exclusivamente com os dados do snapshot salvo.</span></div>
        </div>
      )}

      {!analysis.isLoading && !analysis.result && (
        <section className="panel report-period-analysis-empty">
          <span><SearchX size={24} /></span>
          <div><h2>Por período</h2><p>Selecione um intervalo dentro do período do relatório para gerar a análise.</p></div>
        </section>
      )}

      {!analysis.isLoading && analysis.result?.recordCount === 0 && (
        <section className="panel report-period-analysis-empty">
          <span><SearchX size={24} /></span>
          <div><h2>Sem dados no período</h2><p>Não foram encontrados lançamentos no período selecionado.</p></div>
        </section>
      )}

      {!analysis.isLoading && analysis.result && analysis.result.recordCount > 0 && (
        <section className="report-period-analysis-result">
          <div className="report-period-analysis-caption">
            <span>Resultado da análise</span>
            <strong>{formatDate(analysis.result.analyzedPeriod.startDate)} a {formatDate(analysis.result.analyzedPeriod.endDate)}</strong>
          </div>
          <section className="general-indicators-kpis" aria-label="Indicadores do período analisado">
            <article className="general-indicator-card period-analysis-kpi">
              <span><Clock3 size={20} /></span>
              <div><small>Total de horas</small><strong>{formatHoursPtBr(analysis.result.totalHours)}</strong></div>
            </article>
            <article className="general-indicator-card period-analysis-kpi">
              <span><ListChecks size={20} /></span>
              <div><small>Lançamentos considerados</small><strong>{formatCountPtBr(analysis.result.recordCount)}</strong></div>
            </article>
            <PeriodKpiCard icon={<TrendingUp size={20} />} title="Novos projetos + melhorias" kpi={analysis.result.kpis.projectsImprovements} />
            <PeriodKpiCard icon={<Bug size={20} />} title="Erro TI + Bug" kpi={analysis.result.kpis.errorsBugs} />
          </section>
          <GeneralIndicatorCompositionChart
            result={{ ...analysis.result, period: analysis.result.analyzedPeriod }}
            title="Composição das horas por categoria"
            analysisView
          />
          <GeneralIndicatorMonthlyCategoryChart
            result={{
              ...analysis.result,
              period: analysis.result.analyzedPeriod,
              months: analysis.result.evolution?.length
                ? analysis.result.evolution
                : analysis.result.months,
            }}
            title="Evolução das horas no intervalo selecionado"
            executive
            analysisView
            description={
              analysis.result.granularity === "DAY"
                ? "Evolução diária das categorias no intervalo selecionado."
                : "Evolução mensal das categorias no intervalo selecionado."
            }
          />
        </section>
      )}
    </section>
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
