import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ReportFilterDraft } from "../../hooks/useReportHistory";

export function ReportFilters({
  draft,
  onChange,
  onApply,
  onClear,
}: {
  draft: ReportFilterDraft;
  onChange: <K extends keyof ReportFilterDraft>(key: K, value: ReportFilterDraft[K]) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <form className="panel saved-report-filters" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <div className="saved-report-filter-grid">
        <label className="saved-report-search">
          <span>Buscar por nome</span>
          <div><Search size={16} /><input value={draft.search} onChange={(event) => onChange("search", event.target.value)} placeholder="Ex.: 1º semestre de 2026" /></div>
        </label>
        <label><span>Ano</span><select value={draft.year} onChange={(event) => onChange("year", event.target.value)}><option value="">Todos os anos</option>{yearOptions().map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
        <div className="saved-report-filter-actions">
          <button className="secondary-button" type="button" onClick={onClear}><X size={16} />Limpar filtros</button>
          <button className="primary-button" type="submit"><SlidersHorizontal size={16} />Aplicar filtros</button>
        </div>
      </div>
    </form>
  );
}

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - 1999 }, (_, index) => currentYear - index);
}
