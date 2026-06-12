import { Brain, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnalyticsFilters } from "../components/analytics/AnalyticsFilters";
import { AnalyticsInsightCard } from "../components/analytics/AnalyticsInsightCard";
import { AnalyticsSummaryCards } from "../components/analytics/AnalyticsSummaryCards";
import { generateAnalyticsInsights, getAnalyticsInsights, updateAnalyticsInsightStatus } from "../services/api";
import type { AnalyticsInsight, AnalyticsInsightsResponse, AnalyticsInsightType } from "../types";

const typeOrder: AnalyticsInsightType[] = ["tendencia", "anomalia", "concentracao", "qualidade", "risco"];

const typeTitles: Record<AnalyticsInsightType, string> = {
  tendencia: "Tendencias",
  anomalia: "Anomalias",
  concentracao: "Concentracoes",
  qualidade: "Qualidade dos dados",
  risco: "Riscos operacionais",
};

const emptySummary = {
  total: 0,
  alta: 0,
  media: 0,
  baixa: 0,
  novo: 0,
  revisado: 0,
  ignorado: 0,
  tendencia: 0,
  anomalia: 0,
  concentracao: 0,
  qualidade: 0,
  risco: 0,
};

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsInsightsResponse | null>(null);
  const [projectName, setProjectName] = useState("");
  const [importId, setImportId] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [updatingInsightId, setUpdatingInsightId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getAnalyticsInsights({ importId, type, severity, status })
      .then((response) => {
        if (active) setData(response);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Erro inesperado.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [importId, type, severity, status]);

  const groupedInsights = useMemo(() => groupInsights(data?.insights ?? []), [data]);

  function handleProjectChange(value: string) {
    setProjectName(value);
    const latestProjectImport = data?.filters.imports.find((item) => item.projectName === value);
    setImportId(latestProjectImport ? String(latestProjectImport.value) : "");
  }

  function handleClearFilters() {
    setProjectName("");
    setImportId("");
    setType("");
    setSeverity("");
    setStatus("");
  }

  async function handleGenerateInsights() {
    const selectedImportId = Number(importId);
    if (!selectedImportId) {
      setError("Selecione uma importacao para gerar os insights.");
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      setData(await generateAnalyticsInsights(selectedImportId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleUpdateInsightStatus(insightId: number, nextStatus: "revisado" | "ignorado") {
    setUpdatingInsightId(insightId);
    setError(null);
    try {
      await updateAnalyticsInsightStatus(insightId, nextStatus);
      setData(await getAnalyticsInsights({ importId, type, severity, status }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setUpdatingInsightId(null);
    }
  }

  return (
    <section className="analytics-page">
      <div className="analytics-hero">
        <div>
          <span className="eyebrow">Modulo analitico</span>
          <h2>Inteligencia Operacional</h2>
          <p>
            Analises automaticas sobre tendencias, concentracoes, anomalias e qualidade dos dados ja importados.
          </p>
        </div>
        <span className="analytics-hero-icon">
          <Brain size={24} />
        </span>
      </div>

      <AnalyticsFilters
        filters={data?.filters ?? null}
        projectName={projectName}
        importId={importId}
        type={type}
        severity={severity}
        status={status}
        onProjectNameChange={handleProjectChange}
        onImportIdChange={setImportId}
        onTypeChange={setType}
        onSeverityChange={setSeverity}
        onStatusChange={setStatus}
        onClear={handleClearFilters}
      />

      {error && <div className="notice error">{error}</div>}

      <section className="analytics-action-card">
        <div>
          <span className="eyebrow">Historico de insights</span>
          <h3>Gerar analise operacional da importacao</h3>
          <p>Os insights gerados ficam salvos para revisao, historico e auditoria.</p>
        </div>
        <button type="button" disabled={!importId || isGenerating} onClick={handleGenerateInsights}>
          {isGenerating ? "Gerando..." : "Gerar insights"}
        </button>
      </section>

      <AnalyticsSummaryCards summary={data?.summary ?? emptySummary} />

      {data?.context && (
        <section className="analytics-context-card">
          <div>
            <span className="eyebrow">Projeto analisado</span>
            <h3>{data.context.projectName}</h3>
            <p>{data.context.filename}</p>
          </div>
          <div className="analytics-context-metrics">
            <span>
              <strong>{data.context.totalHours.toFixed(2)}h</strong>
              Horas
            </span>
            <span>
              <strong>{data.context.totalRecords}</strong>
              Lancamentos
            </span>
            <span>
              <strong>{data.context.previousImportId ? `#${data.context.previousImportId}` : "Sem anterior"}</strong>
              Comparativo
            </span>
          </div>
        </section>
      )}

      {isLoading && (
        <section className="analytics-loading">
          <Sparkles size={18} />
          Gerando analises operacionais...
        </section>
      )}

      {!isLoading && data && data.insights.length === 0 && (
        <section className="analytics-empty">
          <Sparkles size={22} />
          <h3>Nenhum insight encontrado</h3>
          <p>Nao foram encontrados riscos, anomalias ou tendencias relevantes para os filtros aplicados.</p>
        </section>
      )}

      {!isLoading && data && data.insights.length > 0 && (
        <div className="analytics-groups">
          {typeOrder.map((groupType) => {
            const insights = groupedInsights[groupType] ?? [];
            if (insights.length === 0) return null;
            return (
              <section className="analytics-group" key={groupType}>
                <header>
                  <h3>{typeTitles[groupType]}</h3>
                  <span>{insights.length}</span>
                </header>
                <div className="analytics-insight-list">
                  {insights.map((insight) => (
                    <AnalyticsInsightCard
                      insight={insight}
                      isUpdating={updatingInsightId === insight.id}
                      key={`${insight.tipo}-${insight.id}`}
                      onIgnore={(insightId) => handleUpdateInsightStatus(insightId, "ignorado")}
                      onReview={(insightId) => handleUpdateInsightStatus(insightId, "revisado")}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function groupInsights(insights: AnalyticsInsight[]): Record<AnalyticsInsightType, AnalyticsInsight[]> {
  return insights.reduce(
    (groups, insight) => {
      groups[insight.tipo] = [...(groups[insight.tipo] ?? []), insight];
      return groups;
    },
    {} as Record<AnalyticsInsightType, AnalyticsInsight[]>,
  );
}
