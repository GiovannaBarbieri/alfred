import type { HoursReportItem } from "../../types";

type ExecutiveSummaryListProps = {
  title: string;
  items: HoursReportItem[];
  showKey?: boolean;
};

export function ExecutiveSummaryList({ title, items, showKey = false }: ExecutiveSummaryListProps) {
  const isCategoryList = title.toLowerCase().includes("categoria");

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
                {isCategoryList ? (
                  <span className={`report-category-chip ${categoryClassName(item.label || item.key)}`}>
                    {item.label || item.key}
                  </span>
                ) : showKey ? (
                  `${item.key} - ${item.label || item.key}`
                ) : (
                  item.label || item.key
                )}
              </span>
              <strong>{item.totalHours.toFixed(2)}h</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function categoryClassName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("desenvolvimento")) return "development";
  if (normalized.includes("homologacao")) return "quality";
  if (normalized.includes("definicao")) return "definition";
  if (normalized.includes("acompanhamento")) return "followup";
  if (normalized.includes("impedimento")) return "blocked";
  if (normalized.includes("retrabalho")) return "rework";
  return "neutral";
}
