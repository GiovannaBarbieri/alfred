import { AlertTriangle, Bug, Clock3, ListChecks, RefreshCw, SearchX, TrendingUp } from "lucide-react";

import {
  GeneralIndicatorCategoryCharts,
  GeneralIndicatorMonthlyCategoryChart,
} from "../general-indicators/GeneralIndicatorManagementCharts";
import { useReportPeriodAnalysis } from "../../hooks/useReportPeriodAnalysis";
import type { GeneralIndicatorKpi } from "../../types";

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
          <span>Período do relatório</span>
          <strong>{formatDate(officialStart)} até {formatDate(officialEnd)}</strong>
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
        </div>

        <div className="report-period-shortcuts" aria-label="Atalhos de período">
          <span>Preencher período:</span>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("complete")}>Período completo</button>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("first-month")}>Primeiro mês</button>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("last-month")}>Último mês</button>
          <button type="button" disabled={analysis.isLoading} onClick={() => analysis.applyShortcut("clear")}>Limpar</button>
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
          <div><h2>Selecione um período</h2><p>Defina as datas e clique em Analisar para gerar um recorte temporário.</p></div>
        </section>
      )}

      {!analysis.isLoading && analysis.result?.recordCount === 0 && (
        <section className="panel report-period-analysis-empty">
          <span><SearchX size={24} /></span>
          <div><h2>Sem dados no período</h2><p>Nenhum lançamento considerado foi encontrado no intervalo selecionado.</p></div>
        </section>
      )}

      {!analysis.isLoading && analysis.result && analysis.result.recordCount > 0 && (
        <section className="report-period-analysis-result">
          <div className="report-period-analysis-caption">
            Período analisado: <strong>{formatDate(analysis.result.analyzedPeriod.startDate)} até {formatDate(analysis.result.analyzedPeriod.endDate)}</strong>
          </div>
          <section className="general-indicators-kpis" aria-label="Indicadores do período analisado">
            <article className="general-indicator-card total">
              <span><Clock3 size={20} /></span>
              <div><small>Total de horas</small><strong>{formatHours(analysis.result.totalHours)}</strong></div>
            </article>
            <article className="general-indicator-card total">
              <span><ListChecks size={20} /></span>
              <div><small>Lançamentos considerados</small><strong>{analysis.result.recordCount.toLocaleString("pt-BR")}</strong></div>
            </article>
            <PeriodKpiCard icon={<TrendingUp size={20} />} title="Novos projetos + melhorias" kpi={analysis.result.kpis.projectsImprovements} />
            <PeriodKpiCard icon={<Bug size={20} />} title="Erros TI + Bugs" kpi={analysis.result.kpis.errorsBugs} />
          </section>
          <GeneralIndicatorCategoryCharts
            result={analysis.result}
            hoursTitle="Horas por categoria"
            compositionTitle="Composição das horas"
          />
          <GeneralIndicatorMonthlyCategoryChart
            result={analysis.result}
            title="Evolução dentro do período"
          />
        </section>
      )}
    </section>
  );
}

function PeriodKpiCard({ icon, title, kpi }: { icon: JSX.Element; title: string; kpi: GeneralIndicatorKpi }) {
  return (
    <article className={`general-indicator-card ${kpi.status}`}>
      <span>{icon}</span>
      <div>
        <small>{title}</small>
        <strong>{formatPercentage(kpi.percentage)}</strong>
        <em>{formatHours(kpi.hours)}</em>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatHours(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

function formatPercentage(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
