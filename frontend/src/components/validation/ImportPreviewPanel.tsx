import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CircleDot,
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
  const hasBlocking = result.blockedRows > 0;
  const pendingReview = preview?.unclassifiedCount ?? 0;
  const reviewItems = result.alertRows + pendingReview;
  const fileHistory = result.fileHistory;
  const historyTone = fileHistory?.exactDuplicate ? "warning" : fileHistory?.status === "nova_versao" ? "info" : "success";
  const historyBadgeLabel = fileHistory?.exactDuplicate
    ? "Arquivo já importado"
    : fileHistory?.status === "nova_versao"
      ? "Possível atualização"
      : fileHistory
        ? "Importação inédita"
        : null;
  const classifiedRecords = Math.max(result.totalRows - (preview?.unclassifiedCount ?? 0), 0);
  const possibleInconsistencies = result.alertRows + result.blockedRows;
  const hasClassificationIssues =
    (preview?.unclassifiedCount ?? 0) > 0 ||
    possibleInconsistencies > 0 ||
    result.duplicates.length > 0;
  const requiresClassificationReview = pendingReview > 0 || hasUnprofiledCollaborators;
  const validationSummaryMessage = hasBlocking
    ? "Bloqueios impedem continuar."
    : reviewItems > 0 || result.duplicates.length > 0
      ? "Importação pronta, com revisões pendentes."
      : "Importação validada e pronta.";
  const nextStep = hasBlocking
    ? "validation"
    : result.duplicates.length > 0
      ? "duplicates"
      : requiresClassificationReview
        ? "classification"
        : "confirm";
  const previewStatus = hasBlocking
    ? { tone: "warning", label: "Exige correção", icon: <AlertTriangle size={16} /> }
    : result.duplicates.length > 0
      ? { tone: "warning", label: "Duplicidades para revisar", icon: <AlertTriangle size={16} /> }
      : requiresClassificationReview
        ? { tone: "warning", label: "Revisão necessária", icon: <AlertTriangle size={16} /> }
        : { tone: "success", label: "Sem bloqueios", icon: <CheckCircle2 size={16} /> };
  const nextStepTitle =
    nextStep === "validation"
      ? "Corrigir bloqueios"
      : nextStep === "duplicates"
        ? "Resolver duplicidades"
        : nextStep === "classification"
          ? "Revisar classificações"
          : "Confirmar importação";
  const nextStepDetail =
    nextStep === "validation"
      ? "Existem problemas que impedem a continuidade."
      : nextStep === "duplicates"
        ? "Existem registros duplicados para revisar."
        : nextStep === "classification"
          ? "Existem itens que precisam de revisão antes da confirmação."
          : "A importação está pronta para ser salva.";
  const nextStepButtonLabel =
    nextStep === "validation"
      ? "Ver bloqueios"
      : nextStep === "duplicates"
        ? "Revisar duplicidades"
        : nextStep === "classification"
          ? "Revisar classificações"
          : "Continuar para confirmação";
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
          <div className="import-preview-subtitle">
            <span className="eyebrow">Pré-validação</span>
            {historyBadgeLabel && <span className={`import-history-badge ${historyTone}`}>{historyBadgeLabel}</span>}
          </div>
          <p>Confira o status da importação e avance para a próxima etapa.</p>
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
        <PreviewMetric icon={<ClipboardCheck size={17} />} label="Itens classificados" value={String(classifiedRecords)} />
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
                <PreviewHealthItem icon={<AlertTriangle size={16} />} label="itens precisam de revisão" value={reviewItems} tone={reviewItems > 0 ? "warning" : "neutral"} />
                <PreviewHealthItem icon={<Ban size={16} />} label="bloqueios" value={result.blockedRows} tone={result.blockedRows > 0 ? "danger" : "neutral"} />
                <PreviewHealthItem icon={<CircleDot size={16} />} label="duplicidades" value={result.duplicates.length} tone={result.duplicates.length > 0 ? "warning" : "neutral"} />
              </div>
            </section>

            <section className="preview-card preview-insights-card">
              <div className="preview-card-heading">
                <span><Sparkles size={17} /></span>
                <div>
                  <h3>Qualidade da classificação</h3>
                  <p>{hasClassificationIssues ? "Há itens que exigem atenção." : "Tudo classificado corretamente."}</p>
                </div>
              </div>
              <div className="preview-insight-list">
                <InsightRow label="Classificados" value={classifiedRecords} tone="success" />
                <InsightRow label="Não classificados" value={preview?.unclassifiedCount ?? 0} tone={(preview?.unclassifiedCount ?? 0) > 0 ? "warning" : "neutral"} />
                <InsightRow label="Inconsistências" value={possibleInconsistencies} tone={possibleInconsistencies > 0 ? "warning" : "neutral"} />
                <InsightRow label="Duplicidades encontradas" value={result.duplicates.length} tone={result.duplicates.length > 0 ? "danger" : "neutral"} />
              </div>
            </section>
          </div>

        </div>

        <aside className="preview-side-panel">
          <section className={`preview-next-step-card ${nextStep}`}>
            <span className="eyebrow">Próxima ação</span>
            <h3>{nextStepTitle}</h3>
            <p>{nextStepDetail}</p>
            <button className="primary-button" type="button" onClick={() => onStepChange(nextStep)}>
              {nextStepButtonLabel}
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
