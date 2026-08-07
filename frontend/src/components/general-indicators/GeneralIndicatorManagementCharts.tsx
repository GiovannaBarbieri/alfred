import { BarChart3, CalendarRange, Layers3, PieChart as PieChartIcon } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  LabelList,
  Line,
  LineChart,
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
  buildPeriodEvolutionChart,
  buildPeriodCompositionChart,
  buildQuarterlyKpiChart,
  sortCategoryHoursDescending,
  EXECUTIVE_CHART_SERIES,
  GENERAL_INDICATOR_CHART_COLORS,
  STRATEGIC_CHART_SERIES,
} from "../../utils/generalIndicatorCharts";
import {
  formatChartLabelHoursPtBr,
  formatChartLabelPercentagePtBr,
  formatCompactHoursPtBr,
  formatHoursPtBr,
  formatPercentagePtBr,
} from "../../utils/numberFormatting";
import type { PeriodRange } from "../../utils/periodPresentation";
import { buildLineChartHighlights, LinePointValueLabel } from "./GeneralIndicatorLineChartPrimitives";
import { PeriodContextLine } from "./PeriodContextLine";

type ResultProps = {
  result: Pick<GeneralIndicatorFinalizedResponse, "categories" | "months" | "kpis"> & { period?: PeriodRange };
};

export function GeneralIndicatorCategoryCharts({
  result,
  hoursTitle = "Horas estratégicas",
  compositionTitle = "Distribuição das horas da TI",
}: ResultProps & { hoursTitle?: string; compositionTitle?: string }) {
  return (
    <section className="general-indicator-charts-grid" aria-label="Distribuição gerencial das horas">
      <CategoryHoursChart result={result} title={hoursTitle} />
      <PeriodCompositionChart result={result} title={compositionTitle} />
    </section>
  );
}

export function GeneralIndicatorCompositionChart({
  result,
  title = "Composição das horas por categoria",
  analysisView = false,
}: ResultProps & { title?: string; analysisView?: boolean }) {
  return <PeriodCompositionChart result={result} title={title} analysisView={analysisView} />;
}

export function GeneralIndicatorMonthlyCategoryChart({
  result,
  title = "Evolução mensal das categorias estratégicas",
  executive = false,
  analysisView = false,
  strategicOnly = false,
  description,
}: ResultProps & { title?: string; executive?: boolean; analysisView?: boolean; strategicOnly?: boolean; description?: string }) {
  const data = useMemo(
    () => executive ? buildPeriodEvolutionChart(result.months) : buildMonthlyStrategicChart(result.months),
    [executive, result.months],
  );
  const series = strategicOnly ? STRATEGIC_CHART_SERIES : executive ? EXECUTIVE_CHART_SERIES : STRATEGIC_CHART_SERIES;
  const highlights = useMemo(() => buildLineChartHighlights(data, series), [data, series]);
  return (
    <article className={`panel general-indicators-chart management-chart-panel${analysisView ? " period-analysis-chart" : ""}`}>
      <ChartHeading
        icon={<Layers3 size={18} />}
        title={title}
        description={description ?? "Comparação mensal de Novo projeto, Melhoria, Erro TI e Bug."}
        period={result.period}
      />
      {data.length === 0 ? <ChartEmptyState /> : (
        <div className="management-chart-area monthly-category-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 18, right: 22, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GENERAL_INDICATOR_CHART_COLORS.grid} strokeDasharray="3 3" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => formatCompactHoursPtBr(Number(value))} width={54} />
              <Tooltip content={<MonthlyCategoryTooltip executive={executive && !strategicOnly} periodTitle={executive || strategicOnly} />} />
              <Legend verticalAlign="bottom" height={analysisView ? 28 : 34} />
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2.8}
                  dot={{ r: 3.5, stroke: item.color, strokeWidth: 2, fill: "#ffffff" }}
                  activeDot={{ r: 5, stroke: item.color, strokeWidth: 2, fill: item.color }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={item.key}
                    content={(props) => (
                      <LinePointValueLabel
                        {...props}
                        highlightedIndexes={highlights[item.key] ?? new Set<number>()}
                        formatter={(value: number) => formatChartLabelHoursPtBr(value, false)}
                      />
                    )}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}

export function GeneralIndicatorQuarterlyChart({ result, accordion = false }: ResultProps & { accordion?: boolean }) {
  const projectsTarget = result.kpis.projectsImprovements.target ?? 40;
  const errorsLimit = result.kpis.errorsBugs.limit ?? 10;
  const data = useMemo(
    () => buildQuarterlyKpiChart(result.months, projectsTarget, errorsLimit),
    [errorsLimit, projectsTarget, result.months],
  );
  if (data.length <= 1) return null;

  const content = (
    <div className="general-indicators-table-wrap executive-table-wrap">
      <table className="quarterly-indicators-table">
        <thead><tr><th>Trimestre</th><th>Projetos + melhorias</th><th>Meta</th><th>Situação</th><th>Erro TI + Bug</th><th>Limite</th><th>Situação</th></tr></thead>
        <tbody>{data.map((item) => {
          const projectsWithinTarget = item.projectsPercentage >= item.projectsTarget;
          const errorsWithinLimit = item.errorsPercentage <= item.errorsLimit;
          return <tr key={item.key}>
            <td><strong>{item.label}</strong></td>
            <td>{formatPercentagePtBr(item.projectsPercentage)}</td>
            <td>{formatPercentagePtBr(item.projectsTarget)}</td>
            <td><QuarterlyStatus success={projectsWithinTarget} successLabel="Dentro da meta" warningLabel="Atenção" /></td>
            <td>{formatPercentagePtBr(item.errorsPercentage)}</td>
            <td>{formatPercentagePtBr(item.errorsLimit)}</td>
            <td><QuarterlyStatus success={errorsWithinLimit} successLabel="Dentro do limite" warningLabel="Acima do limite" /></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  );

  if (accordion) {
    return (
      <details className="panel general-indicator-technical-accordion">
        <summary>
          <span><CalendarRange size={18} />Comparativo trimestral dos indicadores</span>
          <i aria-hidden="true" />
        </summary>
        <div className="general-indicator-technical-content">{content}</div>
      </details>
    );
  }

  return (
    <article className="panel general-indicators-chart management-chart-panel quarterly-summary-panel">
      <ChartHeading
        icon={<CalendarRange size={18} />}
        title="Comparativo trimestral dos indicadores"
        description="Visão consolidada das metas de desenvolvimento e qualidade por trimestre."
        period={result.period}
      />
      {content}
    </article>
  );
}

function CategoryHoursChart({ result, title }: ResultProps & { title: string }) {
  const data = useMemo(() => buildCategoryHoursChart(result.categories), [result.categories]);
  return (
    <article className="panel general-indicators-chart management-chart-panel">
      <ChartHeading
        icon={<BarChart3 size={18} />}
        title={title}
        description="Distribuição do tempo entre desenvolvimento, qualidade e operação."
        period={result.period}
      />
      {data.length === 0 ? <ChartEmptyState /> : (
        <div className="management-chart-area category-hours-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 138, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={GENERAL_INDICATOR_CHART_COLORS.grid} strokeDasharray="3 3" strokeOpacity={0.45} horizontal={false} />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                tickFormatter={(value) => formatCompactHoursPtBr(Number(value))}
              />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={112} />
              <Tooltip content={<CategoryHoursTooltip />} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="hours" name="Horas" radius={[0, 6, 6, 0]} maxBarSize={24} isAnimationActive={false}>
                {data.map((item) => <Cell key={item.key} fill={item.color} />)}
                <LabelList dataKey="hours" content={(props) => <CategoryHoursBarLabel {...props} data={data} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className="management-chart-note"><i className="operational-chart-key" /> Operacional representa atividades administrativas, suporte, reuniões, treinamentos e demais atividades não estratégicas.</p>
    </article>
  );
}

function CategoryHoursBarLabel(props: any & { data: ReturnType<typeof buildCategoryHoursChart> }) {
  const { x = 0, y = 0, width = 0, height = 0, index, data } = props;
  const item = data[Number(index)];
  if (!item) return null;
  const label = `${formatChartLabelHoursPtBr(Number(item.hours || 0), false)} (${formatChartLabelPercentagePtBr(Number(item.percentage || 0))})`;
  return (
    <text
      className="category-hours-bar-label"
      dominantBaseline="middle"
      textAnchor="start"
      x={Number(x) + Number(width) + 8}
      y={Number(y) + Number(height) / 2}
    >
      {label}
    </text>
  );
}

function PeriodCompositionChart({
  result,
  title,
  analysisView = false,
}: ResultProps & { title: string; analysisView?: boolean }) {
  const data = useMemo(() => buildPeriodCompositionChart(result.categories), [result.categories]);
  const visibleData = data.filter((item) => item.hours > 0);
  const legendData = sortCategoryHoursDescending(data);
  const totalHours = data.reduce((total, item) => total + item.hours, 0);
  return (
    <article className={`panel general-indicators-chart management-chart-panel${analysisView ? " period-analysis-chart period-analysis-composition" : ""}`}>
      <ChartHeading
        icon={<PieChartIcon size={18} />}
        title={title}
        description="Leitura executiva das horas de desenvolvimento, qualidade e operação."
        period={result.period}
      />
      {visibleData.length === 0 ? <ChartEmptyState /> : (
        <div className="period-composition-layout">
          <div className="period-composition-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={visibleData} dataKey="hours" nameKey="name" innerRadius="61%" outerRadius="88%" paddingAngle={2} isAnimationActive={false}>
                  {visibleData.map((item) => <Cell key={item.key} fill={item.color} stroke="#ffffff" strokeWidth={2} />)}
                </Pie>
                <Tooltip content={<CompositionTooltip spaceBeforeUnit={analysisView} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="period-composition-total"><span>Total geral</span><strong>{formatHoursPtBr(totalHours, analysisView)}</strong></div>
          </div>
          <div className="period-composition-legend" role="list" aria-label="Composição percentual do período">
            <div className="period-composition-legend-header" aria-hidden="true"><span>Categoria</span><span>Horas</span><span>Participação</span></div>
            {legendData.map((item) => <div className={item.key === "operational" || item.key === "maintenance" ? "operational" : undefined} key={item.key} role="listitem"><i style={{ background: item.color }} /><span>{item.name}</span><small>{formatHoursPtBr(item.hours, analysisView)}</small><strong>{formatPercentagePtBr(item.percentage)}</strong></div>)}
          </div>
        </div>
      )}
    </article>
  );
}

function ChartHeading({
  icon,
  title,
  description,
  period,
}: {
  icon: JSX.Element;
  title: string;
  description: string;
  period?: PeriodRange;
}) {
  return <div className="general-indicators-heading"><span>{icon}</span><div><h2>{title}</h2><p>{description}</p><PeriodContextLine period={period} /></div></div>;
}

function ChartEmptyState() {
  return <div className="chart-empty-state compact">Sem horas para exibir neste período.</div>;
}

function CategoryHoursTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const rows: Array<[string, string]> = [
    ["Horas", formatHoursPtBr(item.hours, false)],
    ["Participação", formatPercentagePtBr(item.percentage)],
  ];
  if (item.key === "operational") rows.push(["Categorias agrupadas", item.groupedCategories.join(", ") || "Nenhuma"]);
  return <ChartTooltip title={String(item.name)} rows={rows} />;
}

function CompositionTooltip({ active, payload, spaceBeforeUnit = false }: TooltipProps & { spaceBeforeUnit?: boolean }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const rows: Array<[string, string]> = [["Horas", formatHoursPtBr(item.hours, spaceBeforeUnit)], ["Participação", formatPercentagePtBr(item.percentage)]];
  return <ChartTooltip title={String(item.name)} rows={rows} />;
}

function MonthlyCategoryTooltip({ active, payload, label, executive = false, periodTitle = false }: TooltipProps & { executive?: boolean; periodTitle?: boolean }) {
  if (!active || !payload?.length) return null;
  if (executive) {
    const totalHours = Number(payload[0]?.payload?.totalHours || 0);
    const rows: Array<[string, string]> = [["Total", formatHoursPtBr(totalHours)]];
    payload
      .filter((item) => Number(item.value || 0) > 0)
      .forEach((item) => {
        const hours = Number(item.value || 0);
        const participation = totalHours > 0 ? (hours / totalHours) * 100 : 0;
        rows.push([
          String(item.name),
          `${formatHoursPtBr(hours)} — ${formatPercentagePtBr(participation)}`,
        ]);
      });
    return <ChartTooltip title={periodTooltipTitle(payload[0]?.payload, label)} rows={rows} />;
  }
  const rows = payload.map((item) => [String(item.name), formatHoursPtBr(Number(item.value || 0), false)] as [string, string]);
  const strategicTotal = payload.reduce((total, item) => total + Number(item.value || 0), 0);
  rows.push(["Total do mês", formatHoursPtBr(strategicTotal, false)]);
  return <ChartTooltip title={periodTitle ? periodTooltipTitle(payload[0]?.payload, label) : String(label ?? "")} rows={rows} />;
}

function periodTooltipTitle(point: any, fallbackLabel?: string) {
  const startDate = point?.competence?.startDate;
  const endDate = point?.competence?.endDate;
  if (!startDate || !endDate) return String(fallbackLabel ?? "");
  if (startDate === endDate) return formatDatePtBr(startDate);
  return `${formatDatePtBr(startDate)} a ${formatDatePtBr(endDate)}`;
}

function formatDatePtBr(value: string) {
  const [year, month, day] = String(value).slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

type TooltipProps = { active?: boolean; payload?: Array<any>; label?: string };

function ChartTooltip({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <div className="management-chart-tooltip"><strong>{title}</strong>{rows.map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div>;
}

function QuarterlyStatus({ success, successLabel, warningLabel }: { success: boolean; successLabel: string; warningLabel: string }) {
  return <span className={`quarterly-status ${success ? "success" : "warning"}`}><i aria-hidden="true" />{success ? successLabel : warningLabel}</span>;
}
