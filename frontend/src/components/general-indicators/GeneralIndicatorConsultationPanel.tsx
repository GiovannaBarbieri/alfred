import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw, Wrench } from "lucide-react";
import type { GeneralIndicatorConsultationResponse } from "../../types";
import {
  hasDerivedClassification as issueHasDerivedClassification,
  operationalPendingCount,
  visibleOperationalIssues,
} from "../../utils/generalIndicatorIssuePresentation";
import { isCompletedGeneralIndicatorValidation } from "../../utils/generalIndicatorState";

type Operation = "consultation" | "pending" | "finalization" | null;

type Props = {
  consultation: GeneralIndicatorConsultationResponse;
  operation: Operation;
  onRefreshPendings: () => void;
  onFinalize: () => void;
  reportName: string;
  onReportNameChange: (value: string) => void;
};

const issueNames: Record<string, string> = {
  tag_1_missing: "TAG 1- ausente",
  tag_2_missing: "TAG 2- ausente",
  tag_3_missing: "TAG 3- ausente",
  tag_1_multiple: "Mais de uma TAG 1-",
  tag_2_multiple: "Mais de uma TAG 2-",
  tag_3_multiple: "Mais de uma TAG 3-",
  tag_empty: "TAG obrigat\u00f3ria vazia",
  tag_invalid: "TAG fora do padr\u00e3o",
  category_unrecognized: "Categoria n\u00e3o reconhecida",
  duration_empty: "Dura\u00e7\u00e3o ausente",
  duration_invalid: "Dura\u00e7\u00e3o inv\u00e1lida",
  duration_negative: "Dura\u00e7\u00e3o negativa",
  date_invalid: "Data inv\u00e1lida",
  date_outside_period: "Data fora do per\u00edodo",
  duplicate_id_conflict: "Duplicidade conflitante",
  task_not_found: "Task n\u00e3o localizada",
  hierarchy_ambiguous: "Hierarquia amb\u00edgua",
  parent_not_found: "Pai da Task n\u00e3o localizado",
  parent_type_not_identified: "Tipo do pai n\u00e3o identificado",
  parent_type_unsupported: "Tipo do pai n\u00e3o suportado",
  feature_not_found: "Feature n\u00e3o localizada",
  feature_type_invalid: "Hierarquia inv\u00e1lida",
  classification_impossible: "Classifica\u00e7\u00e3o n\u00e3o determinada",
  distribution_impossible: "Distribui\u00e7\u00e3o mensal imposs\u00edvel",
};

const hierarchyIssueTypes = new Set([
  "task_not_found",
  "hierarchy_ambiguous",
  "parent_not_found",
  "parent_type_not_identified",
  "parent_type_unsupported",
  "feature_not_found",
  "feature_type_invalid",
  "classification_impossible",
]);

export function GeneralIndicatorConsultationPanel({
  consultation,
  operation,
  onRefreshPendings,
  onFinalize,
  reportName,
  onReportNameChange,
}: Props) {
  const isEmpty = consultation.summary.uniqueLaunchCount === 0;
  const featureGroups = groupFeatureIssues(consultation);
  const hierarchyGroups = groupHierarchyIssues(consultation);
  const launchGroups = groupLaunchIssues(consultation);
  const displayedPendingCount = operationalPendingCount(
    consultation.inconsistencies.items,
    consultation.summary.pendingCount,
  );
  const validationCompleted = isCompletedGeneralIndicatorValidation({
    uniqueLaunchCount: consultation.summary.uniqueLaunchCount,
    canFinalize: consultation.canFinalize,
    pendingCount: displayedPendingCount,
  });
  const busy = operation !== null;

  return (
    <section className="general-indicator-flow" aria-label={"Valida\u00e7\u00e3o dos indicadores gerais"}>
      <ol className="general-indicator-steps" aria-label="Etapas dos indicadores gerais">
        <li className="done"><CheckCircle2 size={15} /><span>1. Consulta</span></li>
        <li className={consultation.canFinalize ? "done" : "current"}><span>{"2. Valida\u00e7\u00e3o"}</span></li>
        <li className={consultation.canFinalize ? "current" : "pending"}><span>3. Salvar relatório</span></li>
      </ol>

      <article className={`panel general-indicator-consultation-summary${validationCompleted ? " completed" : ""}`}>
        <div className="general-indicators-heading">
          <span>{consultation.canFinalize ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
          <div>
            <h2>{mainTitle(consultation, isEmpty)}</h2>
            <p>{mainMessage(consultation, isEmpty, displayedPendingCount)}</p>
            <p>{formatDate(consultation.period.startDate)} {"at\u00e9"} {formatDate(consultation.period.endDate)} {"\u00b7"} validada em {formatDateTime(consultation.validatedAt)}</p>
          </div>
        </div>
        <div className="general-indicator-summary-grid">
          <Summary label="Lançamentos encontrados" value={consultation.summary.sourceRowCount} />
          <Summary label="Lançamentos considerados" value={consultation.summary.consideredLaunchCount} />
          <Summary label="Lançamentos desconsiderados" value={consultation.summary.disregardedLaunchCount} />
          <Summary label="Colaboradores excluídos" value={consultation.summary.excludedCollaboratorCount} />
          <Summary label="Horas brutas" value={formatHours(consultation.summary.grossHours)} />
          <Summary label="Horas consideradas" value={formatHours(consultation.summary.consideredHours)} />
          <Summary label="Horas desconsideradas" value={formatHours(consultation.summary.disregardedHours)} />
          {!validationCompleted && (
            <>
              <Summary label="Pendências" value={displayedPendingCount} />
              <Summary
                label={consultation.summary.affectedFeatureCount > 0 ? "Features afetadas" : "Itens afetados"}
                value={consultation.summary.affectedFeatureCount > 0
                  ? consultation.summary.affectedFeatureCount
                  : consultation.summary.affectedLaunchCount}
              />
              <Summary label="Lançamentos afetados" value={consultation.summary.affectedLaunchCount} />
              <Summary label="Horas afetadas" value={formatHours(consultation.summary.affectedHours)} />
            </>
          )}
        </div>
        {validationCompleted && (
          <footer className="general-indicator-success-footer">
            <label className="general-indicator-report-name">
              <span>Nome do relatório</span>
              <input
                type="text"
                required
                maxLength={255}
                value={reportName}
                onChange={(event) => onReportNameChange(event.target.value)}
                disabled={busy}
                aria-describedby="general-indicator-report-name-help"
              />
              <small id="general-indicator-report-name-help">Você poderá alterar este nome posteriormente em Meus Relatórios.</small>
            </label>
            <div className="general-indicator-success-actions">
              <button className="primary-button" type="button" onClick={onFinalize} disabled={busy || !reportName.trim()}>
                {operation === "finalization" ? "Salvando..." : "Salvar relatório"}
              </button>
            </div>
          </footer>
        )}
      </article>

      {consultation.updateSummary && (
        <div className="general-indicators-update-summary" role="status">
          <strong>{"\u00daltima atualiza\u00e7\u00e3o:"}</strong>
          <span>{consultation.updateSummary.pendingBefore} antes</span>
          <span>{"\u00b7"} {consultation.updateSummary.resolvedPendingCount} resolvidas</span>
          <span>{"\u00b7"} {consultation.updateSummary.remainingPendingCount} abertas</span>
          <span>{"\u00b7"} {consultation.updateSummary.requeriedFeatureCount} Features reconsultadas</span>
          <span>{"\u00b7"} {consultation.updateSummary.revalidatedLaunchCount} {"lan\u00e7amentos revalidados"}</span>
          <span>{"\u00b7"} {formatDateTime(consultation.updateSummary.updatedAt)}</span>
        </div>
      )}

      {consultation.requiresFullRefresh && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={18} />
          Esta consulta foi criada com uma versão antiga da hierarquia. Clique em Consultar no card superior para executar uma nova consulta completa.
        </div>
      )}

      {!consultation.requiresFullRefresh && !isEmpty && !consultation.canFinalize && (
        <article className="panel general-indicator-inconsistencies">
          <div className="general-indicators-heading with-count">
            <span><AlertTriangle size={18} /></span>
            <div><h2>O que precisa ser corrigido</h2><p>{"Fa\u00e7a os ajustes no TFS e depois atualize somente as pend\u00eancias."}</p></div>
            <b>{displayedPendingCount}</b>
          </div>

          {featureGroups.map((group) => (
            <details className="general-indicator-issue-group" key={group.idFeature} open>
              <summary>
                <span>Feature {group.idFeature}{group.featureTitle ? ` \u2014 ${group.featureTitle}` : ""}</span>
                <small>{group.launchCount} {"lan\u00e7amentos"} {"\u00b7"} {formatHours(group.hours)} afetadas</small>
                <ChevronDown size={16} />
              </summary>
              <div className="general-indicator-issue-detail">
                {group.issues.map((issue, index) => (
                  <div key={`${issue.type}-${index}`}>
                    <strong>{issueNames[issue.type] ?? issue.type}</strong>
                    <p>{issue.message}</p>
                    {issue.originalText && <p><b>Encontrado:</b> {issue.originalText}</p>}
                    {issueHasDerivedClassification(issue, consultation.inconsistencies.items) && (
                      <div className="hierarchy-consequence">
                        <b>{"Consequ\u00eancia:"}</b> {"N\u00e3o foi poss\u00edvel determinar a classifica\u00e7\u00e3o do lan\u00e7amento."}
                      </div>
                    )}
                    <p><b>Como corrigir:</b> {correctionFor(issue.type)}</p>
                  </div>
                ))}
              </div>
            </details>
          ))}

          {hierarchyGroups.map((group) => (
            <details className="general-indicator-issue-group hierarchy-issue-group" key={group.key} open>
              <summary>
                <div className="hierarchy-issue-summary-title">
                  <span>{issueNames[group.type] ?? group.type}{group.taskId ? ` \u00b7 Task ${group.taskId}` : ""}</span>
                  <small>{hierarchyDescription(group)}</small>
                </div>
                <small className="hierarchy-issue-summary-impact">{group.launchCount} {group.launchCount === 1 ? "lan\u00e7amento" : "lan\u00e7amentos"} {"\u00b7"} {formatHours(group.hours)}</small>
                <ChevronDown size={16} />
              </summary>
              <div className="general-indicator-issue-detail hierarchy-issue-detail">
                <div>
                  <p className="hierarchy-issue-message">{group.message}</p>
                  <div className="hierarchy-context-grid">
                    <HierarchyField label="Task" value={formatWorkItem(group.taskId, group.taskTitle)} />
                    <HierarchyField label="PBI/Bug" value={formatWorkItem(group.parentItemId, group.parentItemTitle, group.parentItemType)} />
                    <HierarchyField label="Feature esperada" value={formatWorkItem(group.featureId, group.featureTitle, group.featureType, "\u274c N\u00e3o encontrada")} />
                    <HierarchyField label="Tipo encontrado" value={group.foundParentType || "N\u00e3o identificado"} />
                    {group.featureCandidateId && group.featureCandidateId !== group.featureId && (
                      <HierarchyField
                        label="Item encontrado"
                        value={formatFoundItem(group.featureCandidateId, group.featureCandidateType, group.featureCandidateTitle)}
                      />
                    )}
                  </div>
                  {group.hasClassificationConsequence && (
                    <div className="hierarchy-consequence">
                      <b>{"Consequ\u00eancia:"}</b> {"N\u00e3o foi poss\u00edvel determinar a classifica\u00e7\u00e3o."}
                    </div>
                  )}
                  <div className="hierarchy-impact-summary">
                    <span><b>{group.launchCount}</b> {group.launchCount === 1 ? "lan\u00e7amento afetado" : "lan\u00e7amentos afetados"}</span>
                    <span><b>{formatHours(group.hours)}</b> afetadas</span>
                  </div>
                  <div className="hierarchy-correction">
                    <Wrench size={15} aria-hidden="true" />
                    <p><b>Como corrigir:</b> {correctionFor(group.type)}</p>
                  </div>
                </div>
              </div>
            </details>
          ))}

          {launchGroups.map((group) => (
            <details className="general-indicator-issue-group" key={group.type}>
              <summary>
                <span>{issueNames[group.type] ?? group.type}</span>
                <small>{group.launchCount} {"lan\u00e7amentos afetados"}</small>
                <ChevronDown size={16} />
              </summary>
              <div className="general-indicator-issue-detail">
                <p>{group.messages.join(" ")}</p>
                <p><b>Como corrigir:</b> {correctionFor(group.type)}</p>
              </div>
            </details>
          ))}
        </article>
      )}

      {!validationCompleted && <div className="general-indicator-flow-actions">
        <div className="general-indicator-primary-actions">
          {!consultation.requiresFullRefresh && !consultation.canFinalize && !isEmpty && (
            <button className="primary-button" type="button" onClick={onRefreshPendings} disabled={busy}>
              <RefreshCw size={16} className={operation === "pending" ? "spinning" : ""} />
              {operation === "pending" ? "Atualizando..." : "Atualizar pend\u00eancias"}
            </button>
          )}
        </div>
      </div>}
      {!consultation.requiresFullRefresh && !consultation.canFinalize && !isEmpty && <p className="general-indicator-action-help">{"A finaliza\u00e7\u00e3o permanece bloqueada at\u00e9 a corre\u00e7\u00e3o das pend\u00eancias."}</p>}
    </section>
  );
}

function mainTitle(consultation: GeneralIndicatorConsultationResponse, isEmpty: boolean) {
  if (isEmpty) return "Nenhum lan\u00e7amento encontrado";
  return consultation.canFinalize ? "Valida\u00e7\u00e3o conclu\u00edda" : "Existem corre\u00e7\u00f5es pendentes no TFS";
}

function mainMessage(consultation: GeneralIndicatorConsultationResponse, isEmpty: boolean, pendingCount: number) {
  if (isEmpty) return "Ajuste o período no card superior e clique em Consultar.";
  if (consultation.canFinalize) return "Todos os lan\u00e7amentos considerados foram validados. Os indicadores j\u00e1 podem ser gerados.";
  return `${pendingCount.toLocaleString("pt-BR")} pend\u00eancia(s) precisam ser corrigidas antes da finaliza\u00e7\u00e3o.`;
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div><span>{label}</span><strong>{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</strong></div>;
}

function groupFeatureIssues(consultation: GeneralIndicatorConsultationResponse) {
  const groups = new Map<string, typeof consultation.inconsistencies.items>();
  visibleOperationalIssues(consultation.inconsistencies.items)
    .filter((item) => item.scope === "feature" && item.idFeature)
    .forEach((item) => {
    groups.set(item.idFeature!, [...(groups.get(item.idFeature!) ?? []), item]);
  });
  return [...groups.entries()].map(([idFeature, issues]) => ({
    idFeature,
    issues,
    featureTitle: String(issues.find((item) => item.details.featureTitle)?.details.featureTitle ?? ""),
    launchCount: new Set(issues.flatMap((item) => item.affectedLaunchIds)).size,
    hours: Number(issues[0]?.details.affectedHours ?? 0),
  }));
}

function groupHierarchyIssues(consultation: GeneralIndicatorConsultationResponse) {
  const groups = new Map<string, typeof consultation.inconsistencies.items>();
  const hierarchyIssues = visibleOperationalIssues(consultation.inconsistencies.items)
    .filter((item) => item.scope === "launch" && hierarchyIssueTypes.has(item.type));

  hierarchyIssues
    .forEach((item) => {
      const details = item.details;
      const key = detailText(details.displayGroupKey) || [
          item.type,
          detailText(details.idTask),
          detailText(details.parentItemId ?? details.idParent),
          detailText(details.featureId ?? item.idFeature),
          detailText(details.featureCandidateId),
        ].join(":");
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });

  return [...groups.entries()].map(([key, issues]) => {
    const sample = issues[0];
    const details = sample.details;
    const launchIds = new Set(
      issues.flatMap((item) => item.affectedLaunchIds.length ? item.affectedLaunchIds : item.idLancamento ? [item.idLancamento] : []),
    );
    return {
      key,
      type: sample.type,
      message: sample.message,
      originalText: sample.originalText,
      taskId: detailText(details.idTask),
      taskTitle: detailText(details.taskTitle),
      parentItemId: detailText(details.parentItemId ?? details.idParent),
      parentItemType: detailText(details.parentItemType),
      parentItemTitle: detailText(details.parentItemTitle),
      featureId: detailText(details.featureId ?? sample.idFeature),
      featureType: detailText(details.featureType),
      featureTitle: detailText(details.featureTitle),
      featureCandidateId: detailText(details.featureCandidateId),
      featureCandidateType: detailText(details.featureCandidateType),
      featureCandidateTitle: detailText(details.featureCandidateTitle),
      foundParentType: detailText(details.featureCandidateType ?? details.parentItemType),
      hasClassificationConsequence: issueHasDerivedClassification(
        sample,
        consultation.inconsistencies.items,
      ),
      launchCount: launchIds.size,
      hours: issues.reduce((total, item) => total + Number(item.details.affectedHours ?? 0), 0),
    };
  });
}

function groupLaunchIssues(consultation: GeneralIndicatorConsultationResponse) {
  const groups = new Map<string, typeof consultation.inconsistencies.items>();
  visibleOperationalIssues(consultation.inconsistencies.items)
    .filter((item) => item.scope === "launch" && !hierarchyIssueTypes.has(item.type))
    .forEach((item) => {
    groups.set(item.type, [...(groups.get(item.type) ?? []), item]);
  });
  return [...groups.entries()].map(([type, issues]) => ({
    type,
    launchCount: new Set(issues.flatMap((item) => item.affectedLaunchIds.length ? item.affectedLaunchIds : item.idLancamento ? [item.idLancamento] : [])).size,
    messages: [...new Set(issues.map((item) => item.message))],
  }));
}

function HierarchyField({ label, value }: { label: string; value: string }) {
  return <div className="hierarchy-context-field"><span>{label}</span><strong>{value}</strong></div>;
}

function formatWorkItem(id: string, title: string, type?: string, missingLabel = "N\u00e3o localizado") {
  if (!id) return missingLabel;
  return `${type ? `${type} ` : ""}${id}${title ? ` \u2014 ${title}` : ""}`;
}

function formatFoundItem(id: string, type: string, title: string) {
  return `${id}${type ? ` - ${type}` : ""}${title ? ` \u2014 ${title}` : ""}`;
}

function hierarchyDescription(group: {
  type: string;
  taskId: string;
  parentItemId: string;
  featureCandidateId: string;
  foundParentType: string;
}) {
  const task = group.taskId ? `A Task ${group.taskId}` : "A Task";
  if (group.type === "feature_type_invalid") {
    const foundItem = group.featureCandidateId ? ` ao item ${group.featureCandidateId}` : " a um item";
    const foundType = group.foundParentType ? ` do tipo ${group.foundParentType}` : " de tipo n\u00e3o identificado";
    return `${task} est\u00e1 vinculada incorretamente${foundItem}${foundType}; era esperada uma Feature.`;
  }
  if (group.type === "parent_not_found") return `${task} n\u00e3o possui um PBI ou Bug pai localizado.`;
  if (group.type === "feature_not_found") return `N\u00e3o foi localizada uma Feature acima do PBI/Bug ${group.parentItemId || "informado"}.`;
  if (group.type === "task_not_found") return "A Task informada no lan\u00e7amento n\u00e3o foi localizada no TFS.";
  if (group.type === "hierarchy_ambiguous") return `${task} possui mais de um caminho de hierarquia poss\u00edvel.`;
  if (group.type === "classification_impossible") return `${task} n\u00e3o possui contexto suficiente para determinar a classifica\u00e7\u00e3o.`;
  return `${task} possui um v\u00ednculo de hierarquia que precisa ser corrigido no TFS.`;
}

function detailText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function correctionFor(type: string) {
  if (type === "launch_id_missing") return "Corrija a origem do lan\u00e7amento e refa\u00e7a a consulta completa.";
  if (type === "distribution_impossible") return "Inclua ou corrija horas da base mensal e refa\u00e7a a consulta completa.";
  if (type === "task_not_found") return "Confirme se a Task existe no TFS e corrija o ID da Task informado no lan\u00e7amento.";
  if (type === "parent_not_found") return "Vincule a Task como filha do PBI ou Bug correto no TFS.";
  if (type === "parent_type_not_identified") return "Revise o item pai da Task e confirme se o tipo dele est\u00e1 definido como PBI ou Bug.";
  if (type === "parent_type_unsupported") return "Remova o v\u00ednculo incorreto e vincule a Task diretamente a um PBI ou Bug.";
  if (type === "hierarchy_ambiguous") return "Revise os v\u00ednculos da Task e mantenha apenas o caminho correto at\u00e9 o PBI/Bug e a Feature.";
  if (type === "feature_not_found") return "Vincule o PBI ou Bug a uma Feature no TFS.";
  if (type === "feature_type_invalid") return "O pai do PBI/Bug deve ser uma Feature; substitua o v\u00ednculo com o tipo exibido acima.";
  if (type === "classification_impossible") return "Revise os v\u00ednculos Task \u2192 PBI/Bug \u2192 Feature e as TAGs obrigat\u00f3rias da Feature.";
  if (type.startsWith("tag_") || type === "category_unrecognized") return "Ajuste as TAGs obrigat\u00f3rias da Feature no TFS.";
  if (type.startsWith("duration_")) return "Corrija a dura\u00e7\u00e3o do lan\u00e7amento.";
  if (type.startsWith("date_")) return "Corrija a data ou consulte o per\u00edodo adequado.";
  if (type.includes("duplicate")) return "Revise os registros duplicados e mantenha um lan\u00e7amento consistente.";
  return "Corrija a hierarquia relacionada no TFS.";
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatHours(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}h`;
}
