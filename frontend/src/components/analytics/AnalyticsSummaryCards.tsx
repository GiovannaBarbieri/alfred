import { Activity, Archive, CheckCircle2, Sparkles } from "lucide-react";
import type { AnalyticsSummary } from "../../types";

type AnalyticsSummaryCardsProps = {
  summary: AnalyticsSummary;
};

export function AnalyticsSummaryCards({ summary }: AnalyticsSummaryCardsProps) {
  const cards = [
    { label: "Total de insights", value: summary.total, icon: <Activity size={18} />, tone: "neutral" },
    { label: "Novos", value: summary.novo, icon: <Sparkles size={18} />, tone: "high" },
    { label: "Revisados", value: summary.revisado, icon: <CheckCircle2 size={18} />, tone: "low" },
    { label: "Ignorados", value: summary.ignorado, icon: <Archive size={18} />, tone: "medium" },
  ];

  return (
    <section className="analytics-summary-grid">
      {cards.map((card) => (
        <article className={`analytics-summary-card ${card.tone}`} key={card.label}>
          <span>{card.icon}</span>
          <div>
            <strong>{card.value}</strong>
            <small>{card.label}</small>
          </div>
        </article>
      ))}
    </section>
  );
}
