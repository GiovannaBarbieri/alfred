import { BarChart3, CalendarRange, Layers3, PieChart as PieChartIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { GeneralIndicatorFinalizedResponse } from "../../types";
import {
  buildCategoryHoursChart,
  buildMonthlyStrategicChart,
  buildPeriodCompositionChart,
  buildQuarterlyKpiChart,
  GENERAL_INDICATOR_CHART_COLORS,
  STRATEGIC_CHART_SERIES,
} from "../../utils/generalIndicatorCharts";

type ResultProps = { result: GeneralIndicatorFinalizedResponse };

export function GeneralIndicatorCategoryCharts({ result }: ResultProps) {
  return (
    <section className="general-indicator-charts-grid" aria-label="Distribuição gerencial das horas">
      <CategoryHoursChart result={result} />
      <PeriodCompositionChart result={result} />
    </section>
  );
}

export function GeneralIndicatorMonthlyCategoryChart({ result }: ResultProps) {
  const data = useMemo(() => buildMonthlyStrategicChart(result.months), [result.months]);
  return (
    <article className="panel general-indicators-chart management-chart-panel">
      <ChartHeading
        icon={<Layers3 size={18} />}
        title="Evolução mensal das categorias estratégicas"
        description="Comparação mensal de Novo projeto, Melhoria, Erro TI e Bug."
      />
      {data.length === 0 ? <ChartEmptyState /> : (
        <div className="management-chart-area monthly-category-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: 6, bottom: 0 }}>
              <CartesianGrid stroke={GENERAL_INDICATOR_CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => formatCompactHours(Number(value))} />
              <Tooltip content={<MonthlyCategoryTooltip />} />
              <Legend verticalAlign="bottom" height={34} />
              {STRATEGIC_CHART_SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color}
                  stackId="strategic"
                  maxBarSize={58}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

export function GeneralIndicatorQuarterlyChart({ result }: ResultProps) {
  const projectsTarget = result.kpis.projectsImprovements.target ?? 40;
  const errorsLimit = result.kpis.errorsBugs.limit ?? 10;
  const data = useMemo(
    () => buildQuarterlyKpiChart(result.months, projectsTarget, errorsLimit),
    [errorsLimit, projectsTarget, result.months],
  );
  if (data.length <= 1) return null;

  return (
    <article className="panel general-indicators-chart management-chart-panel quarterly-summary-panel">
      <ChartHeading
        icon={<CalendarRange size={18} />}
        title="Comparativo trimestral dos indicadores"
        description="Visão consolidada das metas de desenvolvimento e qualidade por trimestre."
      />
      <div className="general-indicators-table-wrap executive-table-wrap">
        <table className="quarterly-indicators-table">
          <thead><tr><th>Trimestre</th><th>Projetos + melhorias</th><th>Meta</th><th>Situação</th><th>Erro TI + Bug</th><th>Limite</th><th>Situação</th></tr></thead>
          <tbody>{data.map((item) => {
            const projectsWithinTarget = item.projectsPercentage >= item.projectsTarget;
            const errorsWithinLimit = item.errorsPercentage <= item.errorsLimit;
            return <tr key={item.key}>
              <td><strong>{item.label}</strong></td>
              <td>{formatPercentage(item.projectsPercentage)}</td>
              <td>{formatPercentage(item.projectsTarget)}</td>
              <td><QuarterlyStatus success={projectsWithinTarget} successLabel="Dentro da meta" warningLabel="Atenção" /></td>
              <td>{formatPercentage(item.errorsPercentage)}</td>
              <td>{formatPercentage(item.errorsLimit)}</td>
              <td><QuarterlyStatus success={errorsWithinLimit} successLabel="Dentro do limite" warningLabel="Acima do limite" /></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </article>
  );
}

function CategoryHoursChart({ result }: ResultProps) {
  const data = useMemo(() => buildCategoryHoursChart(result.categories), [result.categories]);
  return (
    <article className="panel general-indicators-chart management-chart-panel">
      <ChartHeading
        icon={<BarChart3 size={18} />}
        title="Horas estratégicas"
        description="Distribuição do tempo entre desenvolvimento, qualidade e operação."
      />
      {data.length === 0 ? <ChartEmptyState /> : (
        <div className="management-chart-area category-hours-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 22, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={GENERAL_INDICATOR_CHART_COLORS.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => formatCompactHours(Number(value))} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={112} />
              <Tooltip content={<CategoryHoursTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="hours" name="Horas" radius={[0, 6, 6, 0]} maxBarSize={24} isAnimationActive={false}>
                {data.map((item) => <Cell key={item.key} fill={item.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="management-chart-note"><i className="operational-chart-key" /> Operacional representa atividades administrativas, suporte, reuniões, treinamentos e demais atividades não estratégicas.</p>
    </article>
  );
}

function PeriodCompositionChart({ result }: ResultProps) {
  const data = useMemo(() => buildPeriodCompositionChart(result.categories), [result.categories]);
  const visibleData = data.filter((item) => item.hours > 0);
  const totalHours = data.reduce((total, item) => total + item.hours, 0);
  return (
    <article className="panel general-indicators-chart management-chart-panel">
      <ChartHeading
        icon={<PieChartIcon size={18} />}
        title="Distribuição das horas da TI"
        description="Leitura executiva das horas de desenvolvimento, qualidade e operação."
      />
      {visibleData.length === 0 ? <ChartEmptyState /> : (
        <div className="period-composition-layout">
          <div className="period-composition-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visibleData} dataKey="hours" nameKey="name" innerRadius="61%" outerRadius="88%" paddingAngle={2} isAnimationActive={false}>
                  {visibleData.map((item) => <Cell key={item.key} fill={item.color} stroke="#ffffff" strokeWidth={2} />)}
                </Pie>
                <Tooltip content={<CompositionTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="period-composition-total"><span>Total geral</span><strong>{formatHours(totalHours)}</strong></div>
          </div>
          <div className="period-composition-legend" role="list" aria-label="Composição percentual do período">
            <div className="period-composition-legend-header" aria-hidden="true"><span>Categoria</span><span>Horas</span><span>Participação</span></div>
            {data.map((item) => <div className={item.key === "operational" || item.key === "maintenance" ? "operational" : undefined} key={item.key} role="listitem"><i style={{ background: item.color }} /><span>{item.name}</span><small>{formatHours(item.hours)}</small><strong>{formatPercentage(item.percentage)}</strong></div>)}
          </div>
        </div>
      )}
    </article>
  );
}

function ChartHeading({ icon, title, description }: { icon: JSX.Element; title: string; description: string }) {
  return <div className="general-indicators-heading"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p></div></div>;
}

function ChartEmptyState() {
  return <div className="chart-empty-state compact">Sem horas para exibir neste período.</div>;
}

function CategoryHoursTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const rows: Array<[string, string]> = [
    ["Horas", formatHours(item.hours)],
    ["Participação", formatPercentage(item.percentage)],
  ];
  if (item.key === "operational") rows.push(["Categorias agrupadas", item.groupedCategories.join(", ") || "Nenhuma"]);
  return <ChartTooltip title={String(item.name)} rows={rows} />;
}

function CompositionTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const rows: Array<[string, string]> = [["Horas", formatHours(item.hours)], ["Participação", formatPercentage(item.percentage)]];
  return <ChartTooltip title={String(item.name)} rows={rows} />;
}

function MonthlyCategoryTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.map((item) => [String(item.name), formatHours(Number(item.value || 0))] as [string, string]);
  const strategicTotal = payload.reduce((total, item) => total + Number(item.value || 0), 0);
  rows.push(["Total estratégico do mês", formatHours(strategicTotal)]);
  return <ChartTooltip title={String(label ?? "")} rows={rows} />;
}

type TooltipProps = { active?: boolean; payload?: Array<any>; label?: string };

function ChartTooltip({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <div className="management-chart-tooltip"><strong>{title}</strong>{rows.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div>;
}

function QuarterlyStatus({ success, successLabel, warningLabel }: { success: boolean; successLabel: string; warningLabel: string }) {
  return <span className={`quarterly-status ${success ? "success" : "warning"}`}><i aria-hidden="true" />{success ? successLabel : warningLabel}</span>;
}

function formatCompactHours(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}h`;
}

function formatHours(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;
}

function formatPercentage(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
