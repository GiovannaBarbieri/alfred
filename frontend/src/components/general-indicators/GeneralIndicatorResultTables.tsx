import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { GeneralIndicatorCategory, GeneralIndicatorFinalizedResponse } from "../../types";
import {
  buildExecutiveHoursComposition,
  hasAdjustedIndicatorHours,
  isStrategicIndicatorCategory,
  participationBarWidth,
  reconciledParticipationPercentage,
  sortIndicatorCategories,
  summarizeHoursComposition,
  summarizeUpdateDistribution,
  type HoursCompositionSortKey,
  type SortDirection,
} from "../../utils/generalIndicatorResultsPresentation";

type CompositionProps = {
  categories: GeneralIndicatorCategory[];
  totalHours: number;
};

export function GeneralIndicatorHoursComposition({ categories, totalHours }: CompositionProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [sortActive, setSortActive] = useState(false);
  const [sortKey, setSortKey] = useState<HoursCompositionSortKey>("adjustedHours");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const rows = useMemo(() => {
    const source = showAllCategories ? categories : buildExecutiveHoursComposition(categories);
    if (!sortActive && !showAllCategories) return source;
    return sortIndicatorCategories(source, sortKey, sortDirection);
  }, [categories, showAllCategories, sortActive, sortDirection, sortKey]);
  const totals = useMemo(() => summarizeHoursComposition(categories), [categories]);
  const reconciledParticipation = reconciledParticipationPercentage(totals.adjustedHours, totalHours);

  function changeSort(nextKey: HoursCompositionSortKey) {
    setSortActive(true);
    if (nextKey === sortKey) {
      setSortDirection((current) => current === "desc" ? "asc" : "desc");
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "category" ? "asc" : "desc");
  }

  return (
    <>
      <div className="indicator-table-toolbar" aria-label="Filtros da composição das horas">
        <button
          type="button"
          className="categories-expansion-button"
          aria-expanded={showAllCategories}
          onClick={() => {
            setShowAllCategories((current) => !current);
            setSortActive(false);
          }}
        >
          {showAllCategories ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showAllCategories ? "Mostrar visão executiva" : "Mostrar todas as categorias"}
        </button>
      </div>
      <div className="general-indicators-table-wrap executive-table-wrap">
        <table className="hours-composition-table">
          <thead><tr>
            <SortableHeader label="Categoria" sortKey="category" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
            <SortableHeader label="Horas originais" sortKey="originalHours" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
            <SortableHeader label="Horas redistribuídas" sortKey="allocatedHours" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
            <SortableHeader label="Horas ajustadas" sortKey="adjustedHours" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
            <SortableHeader label="Participação" sortKey="percentage" activeKey={sortKey} direction={sortDirection} onSort={changeSort} />
          </tr></thead>
          <tbody>
            {rows.map((item) => {
              const strategic = isStrategicIndicatorCategory(item.category);
              return <tr className={strategic ? "strategic-category-row" : undefined} key={item.category}>
                <td><span className="category-name">{strategic && <i aria-hidden="true" />}{item.category}</span></td>
                <td>{formatHours(item.originalHours)}</td>
                <td className="allocated">{item.allocatedHours > 0.005
                  ? <span className="redistributed-hours"><ArrowUp size={12} /><strong>+{formatHours(item.allocatedHours)}</strong></span>
                  : <span className="hours-without-adjustment">—</span>}</td>
                <td>{hasAdjustedIndicatorHours(item)
                  ? <strong>{formatHours(item.adjustedHours)}</strong>
                  : <span className="hours-without-adjustment" title="Sem ajuste no período">—</span>}</td>
                <td><div className="participation-cell"><span>{formatPercentage(item.percentage)}</span><i aria-hidden="true"><b style={{ width: `${participationBarWidth(item.percentage)}%` }} /></i></div></td>
              </tr>;
            })}
          </tbody>
          <tfoot><tr>
            <th>Total geral</th>
            <td>{formatHours(totals.originalHours)}</td>
            <td>{totals.allocatedHours > 0.005
              ? <span className="redistributed-hours"><ArrowUp size={12} /><strong>+{formatHours(totals.allocatedHours)}</strong></span>
              : <span className="hours-without-adjustment">—</span>}</td>
            <td><strong>{formatHours(totalHours)}</strong></td>
            <td>{formatPercentage(reconciledParticipation)}</td>
          </tr></tfoot>
        </table>
      </div>
    </>
  );
}

export function GeneralIndicatorUpdateDistribution({
  distribution,
}: {
  distribution: GeneralIndicatorFinalizedResponse["distribution"];
}) {
  const summary = useMemo(() => summarizeUpdateDistribution(distribution), [distribution]);
  return (
    <>
      <div className="update-distribution-summary" aria-label="Resumo da distribuição">
        <DistributionSummary label="Atualização distribuída" value={formatHours(summary.totalUpdateHours)} />
        <DistributionSummary label="Maior mês" value={summary.peakMonth ? `${summary.peakMonth.label} — ${formatHours(summary.peakMonth.updateSystemHours)}` : "Sem dados"} />
        <DistributionSummary label="Maior destino" value={`${summary.leadingDestination.category} — ${formatHours(summary.leadingDestination.hours)}`} />
        <DistributionSummary
          label="Validação"
          value={summary.isBalanced ? "100% distribuído" : `${formatPercentage(summary.distributedPercentage)} distribuído`}
          status={summary.isBalanced ? "success" : "warning"}
        />
      </div>
      <div className="general-indicators-table-wrap executive-table-wrap">
        <table className="update-distribution-table">
          <thead><tr><th>Mês</th><th>Atualização</th><th>Manutenção</th><th>Novo projeto</th><th>Melhoria</th><th>Erro TI</th><th>Bug</th><th>Validação</th></tr></thead>
          <tbody>{distribution.map((item) => <tr key={item.month}>
            <td>
              <strong>{item.label}</strong>
              <details className="distribution-technical-detail">
                <summary>Base técnica</summary>
                <div><span>Base: {formatHours(item.distributionBaseHours)}</span><span>Distribuído: {formatHours(item.distributedHours)}</span></div>
              </details>
            </td>
            <td>{formatHours(item.updateSystemHours)}</td>
            <td>{formatHours(item.maintenanceHours)}</td>
            <td>{formatHours(item.newProjectHours)}</td>
            <td>{formatHours(item.improvementHours)}</td>
            <td>{formatHours(item.itErrorHours)}</td>
            <td>{formatHours(item.bugHours ?? 0)}</td>
            <td><span className={`distribution-validation ${item.isBalanced ? "success" : "warning"}`}>
              {item.isBalanced ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {item.isBalanced ? "Conferido" : "Divergência"}
            </span></td>
          </tr>)}</tbody>
        </table>
      </div>
    </>
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
  sortKey: HoursCompositionSortKey;
  activeKey: HoursCompositionSortKey;
  direction: SortDirection;
  onSort: (key: HoursCompositionSortKey) => void;
}) {
  const active = activeKey === sortKey;
  return <th aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}>
    <button type="button" onClick={() => onSort(sortKey)}>
      {label}{active ? direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : null}
    </button>
  </th>;
}

function DistributionSummary({ label, value, status }: { label: string; value: string; status?: "success" | "warning" }) {
  return <div className={status ? `distribution-summary-${status}` : undefined}><span>{label}</span><strong>{value}</strong></div>;
}

function formatHours(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;
}

function formatPercentage(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
