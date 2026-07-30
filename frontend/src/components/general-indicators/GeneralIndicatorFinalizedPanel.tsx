import { BarChart3, Bug, CheckCircle2, Clock3, TrendingUp } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GeneralIndicatorFinalizedResponse, GeneralIndicatorKpi } from "../../types";
import { GENERAL_INDICATOR_CHART_COLORS } from "../../utils/generalIndicatorCharts";
import { buildDisregardedModulesPresentation } from "../../utils/disregardedModulesPresentation";
import {
  GeneralIndicatorCategoryCharts,
  GeneralIndicatorMonthlyCategoryChart,
  GeneralIndicatorQuarterlyChart,
} from "./GeneralIndicatorManagementCharts";
import { GeneralIndicatorHoursComposition, GeneralIndicatorUpdateDistribution } from "./GeneralIndicatorResultTables";

const statusLabels = {
  within_target: "Dentro da meta",
  attention: "Atenção",
  alert: "Alerta",
  critical: "Crítico",
};

export function GeneralIndicatorFinalizedPanel({
  result,
  excludedCollaboratorCount = 0,
  contextTitle = "Indicadores finalizados",
  savedReportContext,
}: {
  result: GeneralIndicatorFinalizedResponse;
  excludedCollaboratorCount?: number;
  contextTitle?: string;
  savedReportContext?: boolean;
}) {
  const snapshotExcludedCollaboratorCount =
    result.summary?.excludedCollaboratorCount ?? excludedCollaboratorCount;
  const chartData = result.months.map((item) => ({
    label: item.label,
    projetos: item.projectsImprovements.percentage,
    erros: item.errorsBugs.percentage,
  }));
  const disregardedModules = buildDisregardedModulesPresentation(result.disregardedModules);

  return (
    <section className="general-indicator-finalized" aria-label="Indicadores gerais finalizados">
      <article className="panel general-indicator-final-context">
        {savedReportContext ? (
          <div className="saved-report-summary-heading">
            <div className="saved-report-summary-title">
              <h2>{contextTitle}</h2>
            </div>
          </div>
        ) : (
          <div className="general-indicators-heading">
            <span><CheckCircle2 size={18} /></span>
            <div><h2>{contextTitle}</h2><p>Resultado oficial da consulta {result.consultationId}.</p></div>
          </div>
        )}
        <div className={`general-indicator-summary-grid ${savedReportContext ? "saved-report-summary-grid" : ""}`}>
          <Summary label="Período" value={`${formatDate(result.period.startDate)} ${savedReportContext ? "→" : "a"} ${formatDate(result.period.endDate)}`} />
          {!savedReportContext && <Summary label="Consulta" value={formatDateTime(result.consultedAt)} />}
          <Summary label="Finalização" value={formatDateTime(result.finalizedAt)} />
          <Summary label={savedReportContext ? "Lançamentos" : "Lançamentos considerados"} value={result.recordCount} detail={savedReportContext ? undefined : `${snapshotExcludedCollaboratorCount.toLocaleString("pt-BR")} ${snapshotExcludedCollaboratorCount === 1 ? "colaborador excluído" : "colaboradores excluídos"}`} />
          {savedReportContext && <Summary label="Colaboradores" value={snapshotExcludedCollaboratorCount} />}
          <Summary label="Total geral" value={formatHours(result.totalHours)} />
        </div>
      </article>

      <section className="general-indicators-kpis" aria-label="KPIs principais">
        <article className="general-indicator-card total">
          <span><Clock3 size={20} /></span><div><small>Total geral</small><strong>{formatHours(result.totalHours)}</strong><em>{result.recordCount} lançamentos válidos</em></div>
        </article>
        <KpiCard icon={<TrendingUp size={20} />} title="Novos projetos e melhorias" kpi={result.kpis.projectsImprovements} total={result.totalHours} reference={`Meta ≥ ${result.kpis.projectsImprovements.target}%`} />
        <KpiCard icon={<Bug size={20} />} title="Erros TI e Bugs" kpi={result.kpis.errorsBugs} total={result.totalHours} reference={`Limite ≤ ${result.kpis.errorsBugs.limit}%`} />
      </section>

      <article className="panel general-indicators-chart">
        <Heading title="Evolução mensal" subtitle="Comparação dos indicadores ao longo dos meses do período." />
        <div className="general-indicators-chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={GENERAL_INDICATOR_CHART_COLORS.grid} vertical={false} /><XAxis dataKey="label" /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} /><Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} /><Legend /><Line type="monotone" dataKey="projetos" name="Novos projetos e melhorias" stroke={GENERAL_INDICATOR_CHART_COLORS.development} strokeWidth={3} /><Line type="monotone" dataKey="erros" name="Erros TI e Bugs" stroke={GENERAL_INDICATOR_CHART_COLORS.bug} strokeWidth={3} /></LineChart></ResponsiveContainer></div>
        <details className="general-indicator-chart-details"><summary>Ver detalhamento mensal</summary><div className="general-indicators-table-wrap"><table><thead><tr><th>Mês</th><th>Total</th><th>Projetos + melhorias</th><th>Meta</th><th>Situação</th><th>Erros TI + Bugs</th><th>Limite</th><th>Situação</th></tr></thead><tbody>
          {result.months.map((item) => <tr key={item.month}><td>{item.label}</td><td>{formatHours(item.totalHours)}</td><td>{item.projectsImprovements.percentage.toFixed(2)}%</td><td>{item.projectsImprovements.target}%</td><td>{statusLabels[item.projectsImprovements.status]}</td><td>{item.errorsBugs.percentage.toFixed(2)}%</td><td>{item.errorsBugs.limit}%</td><td>{statusLabels[item.errorsBugs.status]}</td></tr>)}
        </tbody></table></div></details>
      </article>

      <GeneralIndicatorCategoryCharts result={result} />

      <article className="panel general-indicators-summary">
        <Heading title="Composição das horas" subtitle="Valores originais e resultado após a distribuição de Atualização do sistema." />
        <GeneralIndicatorHoursComposition categories={result.categories} totalHours={result.totalHours} />
      </article>

      <article className="panel general-indicators-summary">
        <Heading title="Distribuição da Atualização do sistema" subtitle="Conferência mensal da base e das parcelas distribuídas." />
        <GeneralIndicatorUpdateDistribution distribution={result.distribution} />
      </article>

      <GeneralIndicatorMonthlyCategoryChart result={result} />
      <GeneralIndicatorQuarterlyChart result={result} />
      {disregardedModules.moduleCount > 0 && (
        <article className="panel disregarded-modules-summary">
          <header>
            <h2>Módulos desconsiderados nesta consulta</h2>
            <p>
              Os módulos abaixo não participam dos Indicadores Gerais. Os lançamentos permanecem disponíveis na Auditoria.
            </p>
          </header>
          <div className="general-indicator-summary-grid disregarded-modules-cards" aria-label="Resumo dos módulos desconsiderados">
            <div>
              <span>Total desconsiderado</span>
              <strong>{formatHours(disregardedModules.totalHours)}</strong>
            </div>
            <div>
              <span>Módulos desconsiderados</span>
              <strong>{disregardedModules.moduleCount.toLocaleString("pt-BR")}</strong>
            </div>
          </div>
          <div className="disregarded-modules-list" role="list" aria-label="Módulos desconsiderados">
            {disregardedModules.modules.map((item) => (
              <div role="listitem" key={item.tagName}>
                <span>{item.tagName}</span>
                <strong>{formatHours(item.hours)}</strong>
              </div>
            ))}
          </div>
        </article>
      )}
    </section>
  );
}

function Heading({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="general-indicators-heading"><span><BarChart3 size={18} /></span><div><h2>{title}</h2><p>{subtitle}</p></div></div>;
}

function Summary({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <div><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</strong>{detail && <small>{detail}</small>}</div>;
}

function KpiCard({ icon, title, kpi, total, reference }: { icon: JSX.Element; title: string; kpi: GeneralIndicatorKpi; total: number; reference: string }) {
  return <article className={`general-indicator-card ${kpi.status}`}><span>{icon}</span><div><small>{title}</small><strong>{kpi.percentage.toFixed(2)}%</strong><em>{formatHours(kpi.hours)} de {formatHours(total)} · {reference}</em></div><b>{statusLabels[kpi.status]}</b><i>{kpi.difference >= 0 ? "+" : ""}{kpi.difference.toFixed(2)} p.p.</i></article>;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) { return new Date(value).toLocaleString("pt-BR"); }
function formatHours(value: number) { return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`; }
