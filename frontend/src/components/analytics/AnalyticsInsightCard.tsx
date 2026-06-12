import { AlertTriangle, ArrowUpRight, BadgeCheck, CircleGauge, ShieldAlert } from "lucide-react";
import type { AnalyticsInsight } from "../../types";

type AnalyticsInsightCardProps = {
  insight: AnalyticsInsight;
  isUpdating?: boolean;
  onReview: (insightId: number) => void;
  onIgnore: (insightId: number) => void;
};

const typeLabels: Record<AnalyticsInsight["tipo"], string> = {
  anomalia: "Anomalia",
  tendencia: "Tendencia",
  concentracao: "Concentracao",
  qualidade: "Qualidade",
  risco: "Risco",
};

const severityLabels: Record<AnalyticsInsight["severidade"], string> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

const statusLabels: Record<AnalyticsInsight["status"], string> = {
  novo: "Novo",
  revisado: "Revisado",
  ignorado: "Ignorado",
};

const icons: Record<AnalyticsInsight["tipo"], JSX.Element> = {
  anomalia: <AlertTriangle size={17} />,
  tendencia: <ArrowUpRight size={17} />,
  concentracao: <CircleGauge size={17} />,
  qualidade: <BadgeCheck size={17} />,
  risco: <ShieldAlert size={17} />,
};

export function AnalyticsInsightCard({ insight, isUpdating = false, onReview, onIgnore }: AnalyticsInsightCardProps) {
  return (
    <article className={`analytics-insight-card ${insight.severidade}`}>
      <div className="analytics-insight-icon">{icons[insight.tipo]}</div>
      <div className="analytics-insight-body">
        <div className="analytics-insight-meta">
          <span className={`analytics-chip ${insight.tipo}`}>{typeLabels[insight.tipo]}</span>
          <span className={`analytics-chip severity-${insight.severidade}`}>{severityLabels[insight.severidade]}</span>
          <span className={`analytics-chip status-${insight.status}`}>{statusLabels[insight.status]}</span>
        </div>
        <h3>{insight.titulo}</h3>
        <p>{insight.descricao}</p>
        <div className="analytics-recommendation">
          <strong>Recomendacao</strong>
          <span>{insight.recomendacao}</span>
        </div>
        {insight.status === "novo" && (
          <div className="analytics-card-actions">
            <button type="button" disabled={isUpdating} onClick={() => onReview(insight.id)}>
              Marcar revisado
            </button>
            <button type="button" disabled={isUpdating} onClick={() => onIgnore(insight.id)}>
              Ignorar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
