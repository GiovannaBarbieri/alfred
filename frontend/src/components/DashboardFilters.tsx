import type { ReportFilterOptions, ReportFilters } from "../types";

type DashboardFiltersProps = {
  filters: ReportFilters;
  filterOptions: ReportFilterOptions;
  onFilterChange: (field: keyof ReportFilters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
};

export function DashboardFilters({
  filters,
  filterOptions,
  onFilterChange,
  onApply,
  onClear,
}: DashboardFiltersProps) {
  return (
    <section className="panel filters-panel" aria-label="Filtros dos relatórios">
      <div className="filters-grid">
        <label>
          <span>Data inicial</span>
          <input type="date" value={filters.startDate} onChange={(event) => onFilterChange("startDate", event.target.value)} />
        </label>
        <label>
          <span>Data final</span>
          <input type="date" value={filters.endDate} onChange={(event) => onFilterChange("endDate", event.target.value)} />
        </label>
        <label>
          <span>Colaborador</span>
          <select value={filters.user} onChange={(event) => onFilterChange("user", event.target.value)}>
            <option value="">Todos</option>
            {filterOptions.users.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Epic</span>
          <select value={filters.epicId} onChange={(event) => onFilterChange("epicId", event.target.value)}>
            <option value="">Todos</option>
            {filterOptions.epics.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Categoria</span>
          <select value={filters.category} onChange={(event) => onFilterChange("category", event.target.value)}>
            <option value="">Todas</option>
            {filterOptions.categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <div className="filter-actions">
          <button className="primary-button compact" type="button" onClick={onApply}>
            Aplicar
          </button>
          <button className="secondary-button compact" type="button" onClick={onClear}>
            Limpar
          </button>
        </div>
      </div>
    </section>
  );
}
