import type { HoursReportItem } from "../types";

export function ReportCard({ title, items }: { title: string; items: HoursReportItem[] }) {
  return (
    <div className="panel report-card">
      <div className="result-heading">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      <div className="report-list">
        {items.length === 0 ? (
          <p className="muted">Sem dados para exibir.</p>
        ) : (
          items.slice(0, 5).map((item) => (
            <div className="report-row" key={`${title}-${item.key}`}>
              <div className="report-row-text">
                <strong>{item.label}</strong>
                <small>
                  {item.totalHours}h em {item.totalRecords} lancamento{item.totalRecords === 1 ? "" : "s"}
                </small>
              </div>
              <div className="report-row-meter" aria-label={`${item.percentage}%`}>
                <span style={{ width: `${Math.min(item.percentage, 100)}%` }} />
              </div>
              <em>{item.percentage}%</em>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
