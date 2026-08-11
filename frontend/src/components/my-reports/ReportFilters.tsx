import type { ReportFilterDraft } from "../../hooks/useReportHistory";
import type { SavedReportTypeOption } from "../../types";

const MIN_REPORT_YEAR = 2020;

export function ReportFilters({
  draft,
  onChange,
  reportTypes,
}: {
  draft: ReportFilterDraft;
  onChange: <K extends keyof ReportFilterDraft>(key: K, value: ReportFilterDraft[K]) => void;
  reportTypes: SavedReportTypeOption[];
}) {
  return (
    <form className="panel saved-report-filters" onSubmit={(event) => event.preventDefault()}>
      <div className="saved-report-filter-grid">
        <label>
          <span>Ano</span>
          <select value={draft.year} onChange={(event) => onChange("year", event.target.value)}>
            <option value="">Todos os anos</option>
            {yearOptions().map((year) => <option value={year} key={year}>{year}</option>)}
          </select>
        </label>
        <label>
          <span>Tipo de relatório</span>
          <select value={draft.type} onChange={(event) => onChange("type", event.target.value)}>
            <option value="">Todos os tipos</option>
            {reportTypes.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
          </select>
        </label>
      </div>
    </form>
  );
}

function yearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - MIN_REPORT_YEAR + 1 }, (_, index) => MIN_REPORT_YEAR + index);
}
