import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ReportFilterDraft } from "../../hooks/useReportHistory";
import type { SavedReportTypeOption } from "../../types";

const MIN_REPORT_YEAR = 2020;

export function ReportFilters({
  draft,
  onChange,
  onApply,
  onClear,
  canApply,
  canClear,
  reportTypes,
}: {
  draft: ReportFilterDraft;
  onChange: <K extends keyof ReportFilterDraft>(key: K, value: ReportFilterDraft[K]) => void;
  onApply: () => void;
  onClear: () => void;
  canApply: boolean;
  canClear: boolean;
  reportTypes: SavedReportTypeOption[];
}) {
  return (
    <form className="panel saved-report-filters" onSubmit={(event) => { event.preventDefault(); if (canApply) onApply(); }}>
      <div className="saved-report-filter-grid">
        <label className="saved-report-search">
          <span>Buscar por nome</span>
          <div><Search size={16} /><input value={draft.search} onChange={(event) => onChange("search", event.target.value)} placeholder="Ex.: 1º semestre de 2026" /></div>
        </label>
        <label><span>Ano</span><select value={draft.year} onChange={(event) => onChange("year", event.target.value)}><option value="">Todos os anos</option>{yearOptions().map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <label><span>Tipo de relatório</span><select value={draft.type} onChange={(event) => onChange("type", event.target.value)}><option value="">Todos os tipos</option>{reportTypes.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
        <div className="saved-report-filter-actions">
          <button className="secondary-button" type="button" disabled={!canClear} aria-disabled={!canClear} onClick={onClear}><X size={16} />Limpar filtros</button>
          <button className="primary-button" type="submit" disabled={!canApply} aria-disabled={!canApply}><SlidersHorizontal size={16} />Aplicar filtros</button>
        </div>
      </div>
    </form>
  );
}

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - MIN_REPORT_YEAR + 1 }, (_, index) => MIN_REPORT_YEAR + index);
}
