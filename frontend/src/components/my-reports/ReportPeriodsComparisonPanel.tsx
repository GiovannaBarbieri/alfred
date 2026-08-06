import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarPlus,
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
  ReportComparisonType,
  SavedReportComparisonContext,
  SavedReportComparisonOption,
  SavedReportsComparisonResponse,
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

type SuggestedPeriod = { startDate: string; endDate: string };

export function ReportPeriodsComparisonPanel({
  onCreateReport,
}: {
  onCreateReport: (period?: SuggestedPeriod) => void;
}) {
  const comparison = useReportPeriodsComparison();
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
    <section className="report-comparison" aria-label="Comparação entre relatórios salvos">
      <section className="panel report-comparison-filters">
        <div className="report-comparison-selector-grid">
          <label>
            <span>Tipo do relatório</span>
            <select value={comparison.reportType} disabled>
              <option value="GENERAL_INDICATORS">Indicadores Gerais</option>
            </select>
          </label>
          <label>
            <span>Tipo de comparação</span>
            <select
              value={comparison.comparisonType}
              disabled={comparison.isLoading || comparison.isLoadingOptions}
              onChange={(event) =>
                comparison.changeComparisonType(event.target.value as ReportComparisonType)}
            >
              <option value="FREE">Livre</option>
              <option value="QUARTER">Trimestre</option>
              <option value="SEMESTER">Semestre</option>
              <option value="YEAR">Ano</option>
            </select>
          </label>
          <ReportSelector
            label="Relatório A"
            value={comparison.reportARevisionId}
            options={comparison.options}
            disabled={comparison.isLoading || comparison.isLoadingOptions}
            excludedRevisionId={comparison.reportBRevisionId}
            onChange={comparison.selectReportA}
          />
          <ReportSelector
            label="Relatório B"
            value={comparison.reportBRevisionId}
            options={comparison.options}
            disabled={comparison.isLoading || comparison.isLoadingOptions}
            excludedRevisionId={comparison.reportARevisionId}
            onChange={comparison.selectReportB}
          />
        </div>
        <div className="report-comparison-actions">
          <button
            className="primary-button"
            type="button"
            disabled={!comparison.canCompare || comparison.isLoading}
            onClick={() => void comparison.compare()}
          >
            <RefreshCw size={16} className={comparison.isLoading ? "spinning" : ""} />
            {comparison.isLoading ? "Comparando..." : "Comparar"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={comparison.isLoading || (
              comparison.reportARevisionId === null
              && comparison.reportBRevisionId === null
              && !comparison.result
            )}
            onClick={comparison.clear}
          >
            Limpar
          </button>
        </div>
      </section>

      {comparison.optionsError && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          {comparison.optionsError}
          <button type="button" onClick={() => void comparison.loadOptions()}>Tentar novamente</button>
        </div>
      )}
      {comparison.error && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          {comparison.error}
        </div>
      )}
      {comparison.isLoadingOptions && (
        <div className="general-indicator-processing" role="status">
          <RefreshCw className="spinning" size={18} />
          <div>
            <strong>Carregando relatórios</strong>
            <span>Consultando somente os snapshots salvos no Alfred.</span>
          </div>
        </div>
      )}
      {!comparison.isLoadingOptions && !comparison.optionsError && comparison.options.length === 0 && (
        <NoEquivalentReports
          comparisonType={comparison.comparisonType}
          onCreateReport={onCreateReport}
        />
      )}
      {comparison.isLoading && (
        <div className="general-indicator-processing" role="status">
          <RefreshCw className="spinning" size={18} />
          <div>
            <strong>Comparando relatórios</strong>
            <span>Calculando exclusivamente com os snapshots persistidos.</span>
          </div>
        </div>
      )}
      {!comparison.isLoading
        && !comparison.isLoadingOptions
        && comparison.options.length > 0
        && !comparison.result && (
          <section className="panel report-period-analysis-empty">
            <span><SearchX size={24} /></span>
            <div>
              <h2>Selecione dois relatórios</h2>
              <p>Escolha os snapshots e clique em Comparar. Nenhuma análise é carregada automaticamente.</p>
            </div>
          </section>
        )}
      {!comparison.isLoading && comparison.result && (
        <ComparisonResult
          result={comparison.result}
          categories={sortedCategories}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={changeSort}
        />
      )}
    </section>
  );
}

function ReportSelector({
  label,
  value,
  options,
  disabled,
  excludedRevisionId,
  onChange,
}: {
  label: string;
  value: number | null;
  options: SavedReportComparisonOption[];
  disabled: boolean;
  excludedRevisionId: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="report-comparison-report-select">
      <span>{label}</span>
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      >
        <option value="">Selecione um relatório</option>
        {options.map((option) => (
          <option
            key={option.revisionId}
            value={option.revisionId}
            disabled={option.revisionId === excludedRevisionId}
          >
            {reportOptionLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoEquivalentReports({
  comparisonType,
  onCreateReport,
}: {
  comparisonType: ReportComparisonType;
  onCreateReport: (period?: SuggestedPeriod) => void;
}) {
  const suggestedPeriod = suggestedPeriodForComparisonType(comparisonType, new Date());
  return (
    <section className="panel report-period-analysis-empty">
      <span><CalendarPlus size={24} /></span>
      <div>
        <h2>Nenhum relatório equivalente encontrado</h2>
        <p>Selecione outro tipo de comparação ou crie um relatório para o período sugerido.</p>
        <button
          className="primary-button"
          type="button"
          onClick={() => onCreateReport(suggestedPeriod)}
        >
          Criar novo relatório
        </button>
      </div>
    </section>
  );
}

function ComparisonResult({
  result,
  categories,
  sortKey,
  sortDirection,
  onSort,
}: {
  result: SavedReportsComparisonResponse;
  categories: ReportCategoryComparison[];
  sortKey: ComparisonSortKey;
  sortDirection: SortDirection;
  onSort: (key: ComparisonSortKey) => void;
}) {
  return (
    <section className="report-comparison-result">
      {result.warnings.map((warning) => (
        <div className="report-comparison-duration-warning" key={warning.code}>
          <AlertTriangle size={16} />
          <div><strong>{warning.message}</strong></div>
        </div>
      ))}
      <ComparisonContext reportA={result.reportA} reportB={result.reportB} />
      <section className="report-comparison-cards" aria-label="Indicadores comparativos">
        <ComparisonCard title="Total de horas" difference={result.differences.totalHours} />
        <ComparisonCard title="Lançamentos considerados" difference={result.differences.consideredLaunches} />
        <ComparisonCard title="Colaboradores considerados" difference={result.differences.consideredCollaborators} />
        {result.differentDurations && (
          <>
            <ComparisonCard title="Média de horas por dia" difference={result.differences.dailyAverageHours} />
            <ComparisonCard title="Média de lançamentos por dia" difference={result.differences.dailyAverageLaunches} />
          </>
        )}
        <ComparisonCard title="Novos Projetos + Melhorias" difference={result.differences.projectsImprovements} />
        <ComparisonCard title="Erro TI + Bug" difference={result.differences.errorsBugs} />
      </section>
      <ComparisonChart data={result.chartData} />
      <ComparisonTable
        categories={categories}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={onSort}
      />
      <ComparisonHighlights summary={result.comparisonSummary} />
    </section>
  );
}

function ComparisonContext({
  reportA,
  reportB,
}: {
  reportA: SavedReportComparisonContext;
  reportB: SavedReportComparisonContext;
}) {
  return (
    <section className="panel report-comparison-context">
      <div>
        <span>Relatório A</span>
        <strong>{reportA.reportName}</strong>
        <small>{reportA.period.periodLabel} • {formatDate(reportA.period.startDate)} a {formatDate(reportA.period.endDate)}</small>
        <dl>
          <div><dt>Duração</dt><dd>{reportA.period.dayCount} dias</dd></div>
          <div><dt>Horas</dt><dd>{formatHoursPtBr(reportA.totalHours)}</dd></div>
          <div><dt>Lançamentos</dt><dd>{formatCountPtBr(reportA.consideredLaunchCount)}</dd></div>
          <div><dt>Colaboradores</dt><dd>{formatCountPtBr(reportA.consideredCollaboratorCount)}</dd></div>
          <div><dt>Snapshot</dt><dd>R{reportA.versionNumber} • {statusLabel(reportA)}</dd></div>
          <div><dt>Geração</dt><dd>{formatDateTime(reportA.generatedAt)}</dd></div>
        </dl>
      </div>
      <div>
        <span>Relatório B</span>
        <strong>{reportB.reportName}</strong>
        <small>{reportB.period.periodLabel} • {formatDate(reportB.period.startDate)} a {formatDate(reportB.period.endDate)}</small>
        <dl>
          <div><dt>Duração</dt><dd>{reportB.period.dayCount} dias</dd></div>
          <div><dt>Horas</dt><dd>{formatHoursPtBr(reportB.totalHours)}</dd></div>
          <div><dt>Lançamentos</dt><dd>{formatCountPtBr(reportB.consideredLaunchCount)}</dd></div>
          <div><dt>Colaboradores</dt><dd>{formatCountPtBr(reportB.consideredCollaboratorCount)}</dd></div>
          <div><dt>Snapshot</dt><dd>R{reportB.versionNumber} • {statusLabel(reportB)}</dd></div>
          <div><dt>Geração</dt><dd>{formatDateTime(reportB.generatedAt)}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function ComparisonCard({
  title,
  difference,
}: {
  title: string;
  difference: ReportComparisonDifference;
}) {
  return (
    <article className="panel report-comparison-card">
      <h3>{title}</h3>
      <div>
        <span><small>Relatório A</small><strong>{formatDifferenceValue(difference.valueA, difference.unit)}</strong></span>
        <span><small>Relatório B</small><strong>{formatDifferenceValue(difference.valueB, difference.unit)}</strong></span>
      </div>
      <footer className={difference.direction.toLowerCase()}>
        <DirectionIcon direction={difference.direction} />
        <b>{formatSignedValue(difference.absoluteDifference, difference.unit)}</b>
        <span>{formatSignedPercentage(difference.percentageDifference)}</span>
      </footer>
    </article>
  );
}

function ComparisonTable({
  categories,
  sortKey,
  sortDirection,
  onSort,
}: {
  categories: ReportCategoryComparison[];
  sortKey: ComparisonSortKey;
  sortDirection: SortDirection;
  onSort: (key: ComparisonSortKey) => void;
}) {
  return (
    <article className="panel report-comparison-table-panel">
      <h2>Comparação por categoria</h2>
      <div className="report-comparison-table-wrap">
        <table>
          <thead>
            <tr>
              <SortableHeader label="Categoria" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortableHeader label="Relatório A" sortKey="hoursA" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <SortableHeader label="Relatório B" sortKey="hoursB" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
              <th>Participação A</th>
              <th>Participação B</th>
              <SortableHeader label="Variação" sortKey="variation" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {categories.map((item) => (
              <tr key={item.category}>
                <td><strong>{item.category}</strong></td>
                <td>{formatHoursPtBr(item.hoursA)}</td>
                <td>{formatHoursPtBr(item.hoursB)}</td>
                <td>{formatPercentagePtBr(item.participationA)}</td>
                <td>{formatPercentagePtBr(item.participationB)}</td>
                <td>
                  <span
                    className={`comparison-variation ${item.direction.toLowerCase()}`}
                    title={variationTooltip(item)}
                  >
                    <DirectionIcon direction={item.direction} />
                    <b>{formatSignedValue(item.absoluteDifference, "HOURS")}</b>
                    <small>{formatSignedPercentage(item.percentageDifference)}</small>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: ComparisonSortKey;
  activeKey: ComparisonSortKey;
  direction: SortDirection;
  onSort: (key: ComparisonSortKey) => void;
}) {
  return (
    <th>
      <button type="button" onClick={() => onSort(sortKey)}>
        {label}{activeKey === sortKey ? direction === "asc" ? " ↑" : " ↓" : ""}
      </button>
    </th>
  );
}

function ComparisonChart({ data }: { data: ReportCategoryComparison[] }) {
  return (
    <article className="panel report-comparison-chart">
      <div>
        <BarChart3 size={18} />
        <span><h2>Horas por categoria</h2><p>Relatório A e Relatório B lado a lado.</p></span>
      </div>
      <div className="report-comparison-chart-area">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={GENERAL_INDICATOR_CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="category" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactHoursPtBr} />
            <Tooltip content={<ComparisonChartTooltip />} />
            <Legend />
            <Bar dataKey="hoursA" name="Relatório A" fill="#2563eb" radius={[5, 5, 0, 0]} />
            <Bar dataKey="hoursB" name="Relatório B" fill="#93b4da" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function ComparisonChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<any>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as ReportCategoryComparison;
  return (
    <div className="management-chart-tooltip">
      <strong>{label}</strong>
      <span><small>Relatório A</small><b>{formatHoursPtBr(item.hoursA)} — {formatPercentagePtBr(item.participationA)}</b></span>
      <span><small>Relatório B</small><b>{formatHoursPtBr(item.hoursB)} — {formatPercentagePtBr(item.participationB)}</b></span>
      <span><small>Diferença</small><b>{formatSignedValue(item.absoluteDifference, "HOURS")}</b></span>
    </div>
  );
}

function ComparisonHighlights({
  summary,
}: {
  summary: SavedReportsComparisonResponse["comparisonSummary"];
}) {
  const items = [
    ["Maior aumento", summary.largestPercentageIncrease, true],
    ["Maior redução", summary.largestPercentageReduction, true],
    ["Maior crescimento em horas", summary.largestHoursIncrease, false],
    ["Maior redução em horas", summary.largestHoursReduction, false],
  ] as const;
  return (
    <article className="panel report-comparison-highlights">
      <h2>Resumo comparativo</h2>
      <div>
        {items.map(([label, item, percentage]) => (
          <span key={label}>
            <small>{label}</small>
            <strong>{item?.category ?? "Sem variação"}</strong>
            <em>{item ? percentage ? formatSignedPercentage(item.value) : formatSignedValue(item.value, "HOURS") : "—"}</em>
          </span>
        ))}
      </div>
    </article>
  );
}

function DirectionIcon({ direction }: { direction: ReportComparisonDifference["direction"] }) {
  return direction === "INCREASE"
    ? <ArrowUp size={15} />
    : direction === "REDUCTION"
      ? <ArrowDown size={15} />
      : <Minus size={15} />;
}

function reportOptionLabel(option: SavedReportComparisonOption) {
  const current = option.isCurrent ? " • CURRENT" : "";
  return `${option.reportName} — ${formatDate(option.periodStart)} a ${formatDate(option.periodEnd)} — R${option.versionNumber} — ${formatDateTime(option.generatedAt)} — ${statusLabel(option)}${current}`;
}

function statusLabel(option: { status: "CURRENT" | "SUPERSEDED" | "ARCHIVED"; isCurrent: boolean }) {
  if (option.isCurrent || option.status === "CURRENT") return "Vigente";
  if (option.status === "ARCHIVED") return "Arquivado";
  return "Substituído";
}

function formatDifferenceValue(value: number, unit: ReportComparisonDifference["unit"]) {
  if (unit === "COUNT") return formatCountPtBr(value);
  if (unit === "PERCENTAGE") return formatPercentagePtBr(value);
  return formatHoursPtBr(value);
}

function formatSignedValue(value: number, unit: ReportComparisonDifference["unit"]) {
  const sign = value > 0 ? "+" : "";
  if (unit === "COUNT") {
    return `${sign}${value.toLocaleString("pt-BR", {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (unit === "PERCENTAGE") {
    return `${sign}${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} p.p.`;
  }
  return `${sign}${formatHoursPtBr(value)}`;
}

function formatSignedPercentage(value: number | null) {
  if (value === null) return "Sem base no Relatório A";
  return `${value > 0 ? "+" : ""}${formatPercentagePtBr(value)}`;
}

function variationTooltip(item: ReportCategoryComparison) {
  return `Diferença: ${formatSignedValue(item.absoluteDifference, "HOURS")}\nPercentual: ${formatSignedPercentage(item.percentageDifference)}\nRelatório A: ${formatHoursPtBr(item.hoursA)}\nRelatório B: ${formatHoursPtBr(item.hoursB)}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function suggestedPeriodForComparisonType(
  comparisonType: ReportComparisonType,
  reference: Date,
): SuggestedPeriod {
  const year = reference.getFullYear();
  if (comparisonType === "QUARTER") {
    const quarter = Math.floor(reference.getMonth() / 3);
    const startMonth = quarter * 3;
    return {
      startDate: localDate(year, startMonth, 1),
      endDate: localDate(year, startMonth + 3, 0),
    };
  }
  if (comparisonType === "SEMESTER") {
    const startMonth = reference.getMonth() < 6 ? 0 : 6;
    return {
      startDate: localDate(year, startMonth, 1),
      endDate: localDate(year, startMonth + 6, 0),
    };
  }
  return {
    startDate: localDate(year, 0, 1),
    endDate: localDate(year, 11, 31),
  };
}

function localDate(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dateDay = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${dateDay}`;
}
