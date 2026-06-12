import { AlertTriangle, BarChart3, CheckSquare, ClipboardList, Clock3, UsersRound } from "lucide-react";

import type { ImportSummary, ProjectExecutiveSummary } from "../../types";
import type { ProjectTabId } from "./reportsConfig";

type ProjectOperationalPanelProps = {
  selectedImport: ImportSummary;
  projectExecutiveSummary: ProjectExecutiveSummary;
  collaboratorOptionsCount: number;
  onOpenTab: (tab: ProjectTabId) => void;
};

export function ProjectOperationalPanel({
  selectedImport,
  projectExecutiveSummary,
  collaboratorOptionsCount,
  onOpenTab,
}: ProjectOperationalPanelProps) {
  const pendingOpen = projectExecutiveSummary.pending.open;
  const hasPendencies = pendingOpen > 0;
  const topCategory = projectExecutiveSummary.categories[0];
  const topUser = projectExecutiveSummary.topUsers[0];

  return (
    <section className="operational-report-panel">
      <div className="operational-report-hero panel">
        <div>
          <span>Visao operacional</span>
          <h2>O que analisar neste projeto</h2>
          <p className="muted">
            Use esta area como atalho para investigar horas, pendencias, colaboradores e Tasks sem misturar com o resumo executivo.
          </p>
        </div>
        <div className={`operational-health ${hasPendencies ? "attention" : "ok"}`}>
          <AlertTriangle size={18} />
          <strong>{hasPendencies ? `${pendingOpen} pendencia(s) abertas` : "Sem pendencias abertas"}</strong>
          <small>{hasPendencies ? "Priorize a revisao antes de fechar a analise." : "A analise operacional esta limpa."}</small>
        </div>
      </div>

      <div className="operational-kpi-grid">
        <span>
          <Clock3 size={18} />
          <strong>{selectedImport.totalHours}h</strong>
          <small>Total de horas</small>
        </span>
        <span>
          <ClipboardList size={18} />
          <strong>{projectExecutiveSummary.metrics.tasksCount}</strong>
          <small>Tasks analisadas</small>
        </span>
        <span>
          <UsersRound size={18} />
          <strong>{collaboratorOptionsCount}</strong>
          <small>Colaboradores</small>
        </span>
        <span>
          <CheckSquare size={18} />
          <strong>{selectedImport.validRows}</strong>
          <small>Registros validos</small>
        </span>
      </div>

      <div className="operational-action-grid">
        <button type="button" onClick={() => onOpenTab("charts")}>
          <BarChart3 size={20} />
          <span>
            <strong>Investigar linha do tempo</strong>
            <small>Veja a evolucao diaria, semanal, por colaborador e por categoria.</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("tasks")}>
          <ClipboardList size={20} />
          <span>
            <strong>Detalhar Tasks por colaborador</strong>
            <small>Encontre as Tasks trabalhadas, duracao total e classificacao.</small>
          </span>
        </button>
        <button type="button" onClick={() => onOpenTab("pending")}>
          <CheckSquare size={20} />
          <span>
            <strong>Revisar pendencias</strong>
            <small>Trate classificacoes, baixa confianca e alertas operacionais.</small>
          </span>
        </button>
      </div>

      <div className="operational-context-grid">
        <article className="panel operational-context-card">
          <h3>Concentracao operacional</h3>
          <div className="operational-context-row">
            <span>Categoria dominante</span>
            <strong>{topCategory ? `${topCategory.label || topCategory.key} (${topCategory.percentage.toFixed(1)}%)` : "Sem dados"}</strong>
          </div>
          <div className="operational-context-row">
            <span>Maior colaborador</span>
            <strong>{topUser ? `${topUser.label || topUser.key} (${topUser.percentage.toFixed(1)}%)` : "Sem dados"}</strong>
          </div>
        </article>

        <article className="panel operational-context-card">
          <h3>Fila de atencao</h3>
          <div className="operational-context-row">
            <span>Baixa confianca</span>
            <strong>{projectExecutiveSummary.pending.lowConfidence}</strong>
          </div>
          <div className="operational-context-row">
            <span>Nao classificadas</span>
            <strong>{projectExecutiveSummary.pending.unclassifiedTasks}</strong>
          </div>
          <div className="operational-context-row">
            <span>Duracao zero</span>
            <strong>{projectExecutiveSummary.pending.zeroDuration}</strong>
          </div>
        </article>
      </div>
    </section>
  );
}
