import type { HoursReportItem } from "../../types";

type ExecutiveSummaryListProps = {
  title: string;
  items: HoursReportItem[];
  showKey?: boolean;
};

export function ExecutiveSummaryList({ title, items, showKey = false }: ExecutiveSummaryListProps) {
  return (
    <div className="executive-summary-card">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">Sem dados para exibir.</p>
      ) : (
        <ol className="executive-ranking-list">
          {items.map((item) => (
            <li key={`${title}-${item.key}`}>
              <span title={item.label}>
                {showKey ? `${item.key} - ${item.label || item.key}` : item.label || item.key}
              </span>
              <strong>{item.totalHours.toFixed(2)}h</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
