import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CircleDot,
  Gauge,
  History,
  RefreshCw,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import type { ImportValidationResponse } from "../../types";
import { formatDateBR } from "../../utils/date";
import type { ImportWizardStep } from "../ImportWizard";

type ImportPreviewPanelProps = {
  result: ImportValidationResponse;
  hasUnprofiledCollaborators?: boolean;
  onStepChange: (step: ImportWizardStep) => void;
};

export function ImportPreviewPanel({ result, hasUnprofiledCollaborators = false, onStepChange }: ImportPreviewPanelProps) {
  const preview = result.preview;
  const averageConfidence = preview ? Math.round(preview.averageConfidence * 100) : 0;
  const hasBlocking = result.blockedRows > 0;
  const pendingReview = (preview?.lowConfidenceCount ?? 0) + (preview?.unclassifiedCount ?? 0);
  const reviewItems = result.alertRows + pendingReview;
  const fileHistory = result.fileHistory;
  const historyTone = fileHistory?.exactDuplicate ? "warning" : fileHistory?.status === "nova_versao" ? "info" : "success";
  const classifiedRecords = Math.max(result.totalRows - (preview?.unclassifiedCount ?? 0), 0);
  const possibleInconsistencies = result.alertRows + result.blockedRows;
  const topCategories = preview?.topCategories ?? [];
  const requiresClassificationReview = pendingReview > 0 || hasUnprofiledCollaborators;
  const validationSummaryMessage = hasBlocking
    ? "Existem bloqueios que impedem a continuidade."
    : reviewItems > 0 || result.duplicates.length > 0
      ? "Importacao pronta para seguir, mas existem itens para revisar."
      : "Importacao validada e pronta para confirmacao.";
  const nextStep = result.duplicates.length > 0 ? "duplicates" : requiresClassificationReview ? "classification" : "confirm";
  const previewStatus = hasBlocking
    ? { tone: "warning", label: "Exige correção", icon: <AlertTriangle size={16} /> }
    : result.duplicates.length > 0
      ? { tone: "warning", label: "Duplicidades para revisar", icon: <AlertTriangle size={16} /> }
      : requiresClassificationReview
        ? { tone: "warning", label: "Revisão necessária", icon: <AlertTriangle size={16} /> }
        : { tone: "success", label: "Sem bloqueios", icon: <CheckCircle2 size={16} /> };
  const nextStepLabel =
    nextStep === "duplicates"
      ? "Resolver duplicidades"
      : nextStep === "classification"
        ? "Revisar classificações"
        : "Ir para confirmação";
  const nextStepDetail =
    nextStep === "duplicates"
      ? "Existem registros duplicados para resolver antes de confirmar."
      : nextStep === "classification"
        ? "Confira os itens que precisam de revisão antes de salvar."
        : "Tudo pronto para revisar o resumo final e salvar.";
  const flowSteps = [
    { id: "upload", label: "Upload", status: "done" },
    { id: "validation", label: "Validação", status: hasBlocking ? "attention" : "done" },
    { id: "duplicates", label: "Duplicidades", status: result.duplicates.length > 0 ? "attention" : "done" },
    { id: "classification", label: "Classificação", status: requiresClassificationReview ? "attention" : "done" },
    { id: "confirm", label: "Confirmação", status: "pending" },
  ] as const;

  return (
    <section className="panel import-preview-panel">
      <div className="import-preview-hero">
        <div className="import-preview-title">
          <h2>{result.filename}</h2>
          <span className="eyebrow">Pré-validação</span>
          <p>Confira se existe algo que impede continuar e siga para a proxima acao.</p>
        </div>
        <span className={`preview-status ${previewStatus.tone}`}>
          {previewStatus.icon}
          {previewStatus.label}
        </span>
      </div>

      <div className="preview-metric-grid">
        <PreviewMetric icon={<Clock size={17} />} label="Horas" value={`${preview?.totalHours.toFixed(2) ?? "0.00"}h`} />
        <PreviewMetric icon={<ClipboardList size={17} />} label="Registros" value={result.totalRows.toString()} />
        <PreviewMetric icon={<Users size={17} />} label="Colaboradores" value={(preview?.collaboratorsCount ?? 0).toString()} />
        <PreviewMetric icon={<Tags size={17} />} label="Tasks" value={(preview?.tasksCount ?? 0).toString()} />
        <PreviewMetric icon={<Gauge size={17} />} label="Confiança média" value={`${averageConfidence}%`} tone={averageConfidence < 70 ? "warning" : "default"} />
      </div>

      <div className="import-preview-layout">
        <div className="import-preview-main">
          {fileHistory && (
            <div className={`import-history-card ${historyTone}`}>
              <span className="import-history-icon">
                {fileHistory.status === "nova_versao" ? <RefreshCw size={18} /> : <History size={18} />}
              </span>
              <div>
                <strong>
                  {fileHistory.exactDuplicate
                    ? "Arquivo já importado"
                    : fileHistory.status === "nova_versao"
                      ? "Possível atualização do projeto"
                      : "Primeira importação identificada"}
                </strong>
                <p>{fileHistory.message}</p>
                {fileHistory.latestImport && (
                  <small>
                    Última importação: #{fileHistory.latestImport.importId} em{" "}
                    {formatDateBR(fileHistory.latestImport.importedAt)} -{" "}
                    {fileHistory.latestImport.totalRows} registros - {fileHistory.latestImport.totalHours.toFixed(2)}h
                  </small>
                )}
              </div>
              {fileHistory.status === "nova_versao" && (
                <div className="import-history-diff">
                  <span><strong>{fileHistory.newRecords}</strong><small>novos</small></span>
                  <span><strong>{fileHistory.unchangedRecords}</strong><small>mantidos</small></span>
                  <span><strong>{fileHistory.removedRecords}</strong><small>removidos</small></span>
                </div>
              )}
            </div>
          )}

          <div className="import-preview-grid">
            <section className="preview-card preview-health-card">
              <div className="preview-card-heading">
                <span><ClipboardCheck size={17} /></span>
                <div>
                  <h3>Resumo da validação</h3>
                  <p>{validationSummaryMessage}</p>
                </div>
              </div>
              <div className="preview-health-list">
                <PreviewHealthItem icon={<CheckCircle2 size={16} />} label="registros prontos" value={result.validRows} tone="success" />
                <PreviewHealthItem icon={<AlertTriangle size={16} />} label="precisam de revisao" value={reviewItems} tone={reviewItems > 0 ? "warning" : "neutral"} />
                <PreviewHealthItem icon={<Ban size={16} />} label="bloqueios" value={result.blockedRows} tone={result.blockedRows > 0 ? "danger" : "neutral"} />
                <PreviewHealthItem icon={<CircleDot size={16} />} label="duplicidades" value={result.duplicates.length} tone={result.duplicates.length > 0 ? "warning" : "neutral"} />
              </div>
            </section>

            <section className="preview-card preview-insights-card">
              <div className="preview-card-heading">
                <span><Sparkles size={17} /></span>
                <div>
                  <h3>Qualidade da classificação</h3>
                  <p>Checagens do padrão [Categoria] e perfis operacionais para priorizar a revisão.</p>
                </div>
              </div>
              <div className="preview-insight-list">
                <InsightRow label="Registros classificados" value={classifiedRecords} tone="success" />
                <InsightRow label="Não classificados" value={preview?.unclassifiedCount ?? 0} tone={(preview?.unclassifiedCount ?? 0) > 0 ? "warning" : "neutral"} />
                <InsightRow label="Baixa confiança" value={preview?.lowConfidenceCount ?? 0} tone={(preview?.lowConfidenceCount ?? 0) > 0 ? "warning" : "neutral"} />
                <InsightRow label="Possíveis inconsistências" value={possibleInconsistencies} tone={possibleInconsistencies > 0 ? "warning" : "neutral"} />
                <InsightRow label="Duplicidades encontradas" value={result.duplicates.length} tone={result.duplicates.length > 0 ? "danger" : "neutral"} />
              </div>
            </section>
          </div>

          <section className="preview-card preview-category-card">
            <div className="preview-card-heading">
              <span><BarChart3 size={17} /></span>
              <div>
                <h3>Distribuição por categoria</h3>
                <p>Horas, participação e volume de registros classificados.</p>
              </div>
            </div>
            <div className="preview-category-bars">
              {topCategories.length === 0 && <p className="muted">Nenhuma categoria identificada ainda.</p>}
              {topCategories.map((category) => (
                <div className="preview-category-bar-row" key={category.category}>
                  <div className="preview-category-bar-label">
                    <strong>{category.category}</strong>
                    <small>{category.totalHours.toFixed(2)}h - {category.totalRecords} registros</small>
                  </div>
                  <div className="preview-category-bar-track">
                    <span style={{ width: `${Math.min(category.percentage, 100)}%` }} />
                  </div>
                  <strong className="preview-category-percent">{category.percentage}%</strong>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="preview-side-panel">
          <section className="preview-next-step-card">
            <span className="eyebrow">Próxima ação</span>
            <h3>{nextStepLabel}</h3>
            <p>{nextStepDetail}</p>
            <button className="primary-button" type="button" onClick={() => onStepChange(nextStep)}>
              {nextStepLabel}
              <ArrowRight size={16} />
            </button>
          </section>

          <section className="preview-card">
            <div className="preview-card-heading">
              <span><ClipboardCheck size={17} /></span>
              <div>
                <h3>Status da importação</h3>
                <p>Fluxo até a confirmação final.</p>
              </div>
            </div>
            <div className="preview-flow-list">
              {flowSteps.map((step, index) => (
                <div className={`preview-flow-step ${step.status} ${step.id === nextStep ? "current" : ""}`} key={step.label}>
                  <span>{index + 1}</span>
                  <strong>{step.label}</strong>
                </div>
              ))}
            </div>
          </section>

        </aside>
      </div>
    </section>
  );
}

function PreviewHealthItem({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <span className={`preview-health-item ${tone}`}>
      {icon}
      <strong>{value}</strong>
      <small>{label}</small>
    </span>
  );
}

function InsightRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <div className={`preview-insight-row ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PreviewMetric({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className={`preview-metric ${tone}`}>
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}
