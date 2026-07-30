import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Minus,
  RefreshCw,
  SearchX,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useReportPeriodsComparison } from "../../hooks/useReportPeriodsComparison";
import type {
  ReportCategoryComparison,
  ReportComparisonDifference,
  ReportPeriodsComparisonResponse,
} from "../../types";
import { GENERAL_INDICATOR_CHART_COLORS } from "../../utils/generalIndicatorCharts";
import {
  formatCompactHoursPtBr,
  formatCountPtBr,
  formatHoursPtBr,
  formatPercentagePtBr,
} from "../../utils/numberFormatting";
import {
  sortCategoryComparison,
  toggleSortDirection,
  type ComparisonSortKey,
  type SortDirection,
} from "../../utils/reportPeriodComparison";
import type { PeriodAnalysisShortcut } from "../../utils/reportPeriodAnalysis";

export function ReportPeriodsComparisonPanel({
  reportId,
  officialStart,
  officialEnd,
}: {
  reportId: number;
  officialStart: string;
  officialEnd: string;
}) {
  const comparison = useReportPeriodsComparison(reportId, officialStart, officialEnd);
  const [sortKey, setSortKey] = useState<ComparisonSortKey>("category");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const sortedCategories = useMemo(
    () => comparison.result
      ? sortCategoryComparison(comparison.result.categoriesComparison, sortKey, sortDirection)
      : [],
    [comparison.result, sortDirection, sortKey],
  );

  function changeSort(nextKey: ComparisonSortKey) {
    setSortDirection(toggleSortDirection(sortKey, sortDirection, nextKey));
    setSortKey(nextKey);
  }

  return (
    <section className="report-comparison" aria-label="Comparação entre períodos">
      <section className="panel report-comparison-filters">
        <div className="report-period-official-range">
          <span>Período disponível para comparação</span>
          <strong>{formatDate(officialStart)} a {formatDate(officialEnd)}</strong>
        </div>
        <div className="report-comparison-periods">
          <ComparisonPeriodFilter
            label="Período A"
            period={comparison.periodA}
            officialStart={officialStart}
            officialEnd={officialEnd}
            disabled={comparison.isLoading}
            onChange={comparison.setPeriodA}
            onShortcut={(shortcut) => comparison.applyShortcut("A", shortcut)}
          />
          <div className="report-comparison-versus" aria-hidden="true">×</div>
          <ComparisonPeriodFilter
            label="Período B"
            period={comparison.periodB}
            officialStart={officialStart}
            officialEnd={officialEnd}
            disabled={comparison.isLoading}
            onChange={comparison.setPeriodB}
            onShortcut={(shortcut) => comparison.applyShortcut("B", shortcut)}
          />
        </div>
        <div className="report-comparison-actions">
          <button className="primary-button" type="button" disabled={comparison.isLoading} onClick={() => void comparison.compare()}>
            <RefreshCw size={16} className={comparison.isLoading ? "spinning" : ""} />
            {comparison.isLoading ? "Comparando..." : "Comparar"}
          </button>
          <button className="secondary-button" type="button" disabled={comparison.isLoading} onClick={comparison.clear}>Limpar</button>
        </div>
      </section>

      {comparison.error && <div className="error-banner" role="alert"><AlertTriangle size={18} />{comparison.error}</div>}
      {comparison.isLoading && <div className="general-indicator-processing" role="status"><RefreshCw className="spinning" size={18} /><div><strong>Comparando períodos</strong><span>Calculando exclusivamente com o snapshot salvo.</span></div></div>}
      {!comparison.isLoading && !comparison.result && <section className="panel report-period-analysis-empty"><span><SearchX size={24} /></span><div><h2>Comparação entre períodos</h2><p>Defina os dois intervalos e clique em Comparar.</p></div></section>}
      {!comparison.isLoading && comparison.result && <ComparisonResult result={comparison.result} categories={sortedCategories} sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} />}
    </section>
  );
}

function ComparisonPeriodFilter({
  label,
  period,
  officialStart,
  officialEnd,
  disabled,
  onChange,
  onShortcut,
}: {
  label: string;
  period: { startDate: string; endDate: string };
  officialStart: string;
  officialEnd: string;
  disabled: boolean;
  onChange: (period: { startDate: string; endDate: string }) => void;
  onShortcut: (shortcut: PeriodAnalysisShortcut) => void;
}) {
  return <fieldset className="report-comparison-period">
    <legend>{label}</legend>
    <div>
      <label><span>Data inicial</span><input type="date" min={officialStart} max={officialEnd} value={period.startDate} disabled={disabled} onChange={(event) => onChange({ ...period, startDate: event.target.value })} /></label>
      <label><span>Data final</span><input type="date" min={officialStart} max={officialEnd} value={period.endDate} disabled={disabled} onChange={(event) => onChange({ ...period, endDate: event.target.value })} /></label>
    </div>
    <div className="report-period-shortcuts"><span>Preencher:</span><button type="button" disabled={disabled} onClick={() => onShortcut("complete")}>Período completo</button><button type="button" disabled={disabled} onClick={() => onShortcut("first-month")}>Primeiro mês</button><button type="button" disabled={disabled} onClick={() => onShortcut("last-month")}>Último mês</button></div>
  </fieldset>;
}

function ComparisonResult({
  result,
  categories,
  sortKey,
  sortDirection,
  onSort,
}: {
  result: ReportPeriodsComparisonResponse;
  categories: ReportCategoryComparison[];
  sortKey: ComparisonSortKey;
  sortDirection: SortDirection;
  onSort: (key: ComparisonSortKey) => void;
}) {
  const emptyA = result.summaryA.consideredLaunchCount === 0;
  const emptyB = result.summaryB.consideredLaunchCount === 0;
  return <section className="report-comparison-result">
    {(emptyA || emptyB) && <div className="report-comparison-notice"><AlertTriangle size={16} />{emptyA ? "O Período A" : "O Período B"} não possui lançamentos considerados.</div>}
    {result.differentDurations && <div className="report-comparison-duration-warning"><AlertTriangle size={16} /><div><strong>Os períodos possuem durações diferentes.</strong><span>Considere essa informação na interpretação dos resultados.</span></div><PeriodDuration label="Período A" period={result.periodA} /><PeriodDuration label="Período B" period={result.periodB} /></div>}
    <section className="report-comparison-cards" aria-label="Indicadores comparativos">
      <ComparisonCard title="Total de horas" difference={result.differences.totalHours} />
      <ComparisonCard title="Lançamentos considerados" difference={result.differences.consideredLaunches} />
      <ComparisonCard title="Novos Projetos + Melhorias" difference={result.differences.projectsImprovements} />
      <ComparisonCard title="Erro TI + Bug" difference={result.differences.errorsBugs} />
    </section>
    <ComparisonChart data={result.chartData} />
    <ComparisonTable categories={categories} sortKey={sortKey} sortDirection={sortDirection} onSort={onSort} />
    <ComparisonHighlights summary={result.comparisonSummary} />
  </section>;
}

function PeriodDuration({ label, period }: { label: string; period: ReportPeriodsComparisonResponse["periodA"] }) {
  return <span><small>{label}</small><b>{period.dayCount} dias</b><em>{formatHoursPtBr(period.dailyAverageHours)}/dia</em></span>;
}

function ComparisonCard({ title, difference }: { title: string; difference: ReportComparisonDifference }) {
  return <article className="panel report-comparison-card">
    <h3>{title}</h3>
    <div><span><small>Período A</small><strong>{formatDifferenceValue(difference.valueA, difference.unit)}</strong></span><span><small>Período B</small><strong>{formatDifferenceValue(difference.valueB, difference.unit)}</strong></span></div>
    <footer className={difference.direction.toLowerCase()}><DirectionIcon direction={difference.direction} /><b>{formatSignedValue(difference.absoluteDifference, difference.unit)}</b><span>{formatSignedPercentage(difference.percentageDifference)}</span></footer>
  </article>;
}

function ComparisonTable({ categories, sortKey, sortDirection, onSort }: { categories: ReportCategoryComparison[]; sortKey: ComparisonSortKey; sortDirection: SortDirection; onSort: (key: ComparisonSortKey) => void }) {
  return <article className="panel report-comparison-table-panel"><h2>Comparação por categoria</h2><div className="report-comparison-table-wrap"><table><thead><tr><SortableHeader label="Categoria" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={onSort} /><SortableHeader label="Período A" sortKey="hoursA" activeKey={sortKey} direction={sortDirection} onSort={onSort} /><SortableHeader label="Período B" sortKey="hoursB" activeKey={sortKey} direction={sortDirection} onSort={onSort} /><th>Participação A</th><th>Participação B</th><SortableHeader label="Variação" sortKey="variation" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></tr></thead><tbody>{categories.map((item) => <tr key={item.category}><td><strong>{item.category}</strong></td><td>{formatHoursPtBr(item.hoursA)}</td><td>{formatHoursPtBr(item.hoursB)}</td><td>{formatPercentagePtBr(item.participationA)}</td><td>{formatPercentagePtBr(item.participationB)}</td><td><span className={`comparison-variation ${item.direction.toLowerCase()}`} title={variationTooltip(item)}><DirectionIcon direction={item.direction} /><b>{formatSignedValue(item.absoluteDifference, "HOURS")}</b><small>{formatSignedPercentage(item.percentageDifference)}</small></span></td></tr>)}</tbody></table></div></article>;
}

function SortableHeader({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: ComparisonSortKey; activeKey: ComparisonSortKey; direction: SortDirection; onSort: (key: ComparisonSortKey) => void }) {
  return <th><button type="button" onClick={() => onSort(sortKey)}>{label}{activeKey === sortKey ? direction === "asc" ? " ↑" : " ↓" : ""}</button></th>;
}

function ComparisonChart({ data }: { data: ReportCategoryComparison[] }) {
  return <article className="panel report-comparison-chart"><div><BarChart3 size={18} /><span><h2>Horas por categoria</h2><p>Período A e Período B lado a lado.</p></span></div><div className="report-comparison-chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}><CartesianGrid stroke={GENERAL_INDICATOR_CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="category" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactHoursPtBr} /><Tooltip content={<ComparisonChartTooltip />} /><Legend /><Bar dataKey="hoursA" name="Período A" fill="#2563eb" radius={[5, 5, 0, 0]} /><Bar dataKey="hoursB" name="Período B" fill="#93b4da" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></article>;
}

function ComparisonChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<any>; label?: string }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as ReportCategoryComparison;
  return <div className="management-chart-tooltip"><strong>{label}</strong><span><small>Período A</small><b>{formatHoursPtBr(item.hoursA)} — {formatPercentagePtBr(item.participationA)}</b></span><span><small>Período B</small><b>{formatHoursPtBr(item.hoursB)} — {formatPercentagePtBr(item.participationB)}</b></span><span><small>Diferença</small><b>{formatSignedValue(item.absoluteDifference, "HOURS")}</b></span></div>;
}

function ComparisonHighlights({ summary }: { summary: ReportPeriodsComparisonResponse["comparisonSummary"] }) {
  const items = [["Maior aumento", summary.largestPercentageIncrease, true], ["Maior redução", summary.largestPercentageReduction, true], ["Maior crescimento em horas", summary.largestHoursIncrease, false], ["Maior redução em horas", summary.largestHoursReduction, false]] as const;
  return <article className="panel report-comparison-highlights"><h2>Resumo comparativo</h2><div>{items.map(([label, item, percentage]) => <span key={label}><small>{label}</small><strong>{item?.category ?? "Sem variação"}</strong><em>{item ? percentage ? formatSignedPercentage(item.value) : formatSignedValue(item.value, "HOURS") : "—"}</em></span>)}</div></article>;
}

function DirectionIcon({ direction }: { direction: ReportComparisonDifference["direction"] }) {
  return direction === "INCREASE" ? <ArrowUp size={15} /> : direction === "REDUCTION" ? <ArrowDown size={15} /> : <Minus size={15} />;
}

function formatDifferenceValue(value: number, unit: ReportComparisonDifference["unit"]) {
  if (unit === "COUNT") return formatCountPtBr(value);
  if (unit === "PERCENTAGE") return formatPercentagePtBr(value);
  return formatHoursPtBr(value);
}

function formatSignedValue(value: number, unit: ReportComparisonDifference["unit"]) {
  const sign = value > 0 ? "+" : "";
  if (unit === "COUNT") return `${sign}${formatCountPtBr(value)}`;
  if (unit === "PERCENTAGE") {
    return `${sign}${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} p.p.`;
  }
  return `${sign}${formatHoursPtBr(value)}`;
}

function formatSignedPercentage(value: number | null) {
  if (value === null) return "Sem base no Período A";
  return `${value > 0 ? "+" : ""}${formatPercentagePtBr(value)}`;
}

function variationTooltip(item: ReportCategoryComparison) {
  return `Diferença: ${formatSignedValue(item.absoluteDifference, "HOURS")}\nPercentual: ${formatSignedPercentage(item.percentageDifference)}\nPeríodo A: ${formatHoursPtBr(item.hoursA)}\nPeríodo B: ${formatHoursPtBr(item.hoursB)}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
