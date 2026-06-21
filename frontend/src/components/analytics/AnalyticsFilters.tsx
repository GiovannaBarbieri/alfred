import { Filter, RotateCcw } from "lucide-react";
import type { AnalyticsFilters as AnalyticsFilterOptions } from "../../types";

type AnalyticsFiltersProps = {
  filters: AnalyticsFilterOptions | null;
  projectName: string;
  importId: string;
  type: string;
  severity: string;
  status: string;
  onProjectNameChange: (value: string) => void;
  onImportIdChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onSeverityChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onClear: () => void;
};

const insightTypes = [
  { value: "", label: "Todos os tipos" },
  { value: "tendencia", label: "Tendencias" },
  { value: "anomalia", label: "Anomalias" },
  { value: "concentracao", label: "Concentracoes" },
  { value: "qualidade", label: "Qualidade" },
  { value: "risco", label: "Riscos" },
];

const severities = [
  { value: "", label: "Todas severidades" },
  { value: "alta", label: "Alta" },
  { value: "media", label: "Media" },
  { value: "baixa", label: "Baixa" },
];

const statuses = [
  { value: "", label: "Todos status" },
  { value: "novo", label: "Novos" },
  { value: "revisado", label: "Revisados" },
  { value: "ignorado", label: "Ignorados" },
];

export function AnalyticsFilters({
  filters,
  projectName,
  importId,
  type,
  severity,
  status,
  onProjectNameChange,
  onImportIdChange,
  onTypeChange,
  onSeverityChange,
  onStatusChange,
  onClear,
}: AnalyticsFiltersProps) {
  return (
    <section className="analytics-filters" aria-label="Filtros da inteligencia operacional">
      <div className="analytics-filter-title">
        <Filter size={16} />
        <span>Filtros</span>
      </div>
      <select value={projectName} onChange={(event) => onProjectNameChange(event.target.value)}>
        <option value="">Todos os projetos</option>
        {(filters?.projects ?? []).map((project) => (
          <option key={project.value} value={project.value}>
            {project.label}
          </option>
        ))}
      </select>
      <select value={importId} onChange={(event) => onImportIdChange(event.target.value)}>
        <option value="">Importação mais recente</option>
        {(filters?.imports ?? [])
          .filter((item) => !projectName || item.projectName === projectName)
          .map((item) => (
            <option key={item.value} value={item.value}>
              #{item.value} - {item.label}
            </option>
          ))}
      </select>
      <select value={type} onChange={(event) => onTypeChange(event.target.value)}>
        {insightTypes.map((item) => (
          <option key={item.value || "all"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select value={severity} onChange={(event) => onSeverityChange(event.target.value)}>
        {severities.map((item) => (
          <option key={item.value || "all"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select value={status} onChange={(event) => onStatusChange(event.target.value)}>
        {statuses.map((item) => (
          <option key={item.value || "all"} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={onClear}>
        <RotateCcw size={15} />
        Limpar
      </button>
    </section>
  );
}
