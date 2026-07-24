export type GeneralIndicatorPresentationIssue = {
  type: string;
  blocking: boolean;
  scope: "feature" | "launch";
  idLancamento: string | null;
  idFeature: string | null;
  affectedLaunchIds: string[];
  details: Record<string, unknown>;
};

const knownRootCauseTypes = new Set([
  "task_not_found",
  "parent_not_found",
  "parent_type_not_identified",
  "parent_type_unsupported",
  "hierarchy_ambiguous",
  "feature_type_invalid",
  "feature_not_found",
  "tag_empty",
  "tag_1_missing",
  "tag_2_missing",
  "tag_3_missing",
  "tag_1_multiple",
  "tag_2_multiple",
  "tag_3_multiple",
  "tag_invalid",
  "category_unrecognized",
]);

export function visibleOperationalIssues<T extends GeneralIndicatorPresentationIssue>(items: T[]) {
  const roots = items.filter((item) => item.blocking && knownRootCauseTypes.has(item.type));
  return items.filter((item) => {
    if (!item.blocking || item.details.isDerived === true) return false;
    if (item.type !== "classification_impossible") return true;
    return !roots.some((root) => issuesShareContext(root, item));
  });
}

export function operationalPendingCount(
  items: GeneralIndicatorPresentationIssue[],
  backendPendingCount: number,
) {
  if (items.some((item) => typeof item.details.isDerived === "boolean")) {
    return backendPendingCount;
  }
  return new Set(visibleOperationalIssues(items).map(operationalKey)).size;
}

export function hasDerivedClassification(
  issue: GeneralIndicatorPresentationIssue,
  items: GeneralIndicatorPresentationIssue[],
) {
  const derivedTypes = issue.details.derivedIssueTypes;
  if (Array.isArray(derivedTypes) && derivedTypes.includes("classification_impossible")) return true;
  return items.some((candidate) => candidate.type === "classification_impossible" && issuesShareContext(issue, candidate));
}

export function issueReferenceKeys(issue: GeneralIndicatorPresentationIssue) {
  const launchReferences = issue.affectedLaunchIds.length
    ? issue.affectedLaunchIds.map((id) => `launch:${id}`)
    : issue.idLancamento ? [`launch:${issue.idLancamento}`] : [];
  const taskId = detailText(issue.details.idTask ?? issue.details.taskId);
  return taskId ? [...launchReferences, `task:${taskId}`] : launchReferences;
}

function issuesShareContext(
  root: GeneralIndicatorPresentationIssue,
  candidate: GeneralIndicatorPresentationIssue,
) {
  const rootGroup = detailText(root.details.displayGroupKey);
  const candidateGroup = detailText(candidate.details.displayGroupKey);
  if (rootGroup && candidateGroup && rootGroup === candidateGroup) return true;
  const rootReferences = new Set(issueReferenceKeys(root));
  if (issueReferenceKeys(candidate).some((reference) => rootReferences.has(reference))) return true;
  const rootFeature = detailText(root.idFeature ?? root.details.featureId);
  const candidateFeature = detailText(candidate.idFeature ?? candidate.details.featureId);
  return Boolean(rootFeature && rootFeature === candidateFeature);
}

function operationalKey(issue: GeneralIndicatorPresentationIssue) {
  const displayGroupKey = detailText(issue.details.displayGroupKey);
  if (displayGroupKey) return displayGroupKey;
  if (issue.scope === "feature" && issue.idFeature) return `${issue.type}:feature:${issue.idFeature}`;
  const taskId = detailText(issue.details.idTask ?? issue.details.taskId);
  const parentId = detailText(issue.details.parentItemId ?? issue.details.idParent);
  const upperId = detailText(issue.details.featureCandidateId ?? issue.details.featureId ?? issue.idFeature);
  if (taskId || parentId || upperId) return `${issue.type}:task:${taskId}:parent:${parentId}:upper:${upperId}`;
  return `${issue.type}:launch:${issue.affectedLaunchIds.join(",") || issue.idLancamento || "unknown"}`;
}

function detailText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}
