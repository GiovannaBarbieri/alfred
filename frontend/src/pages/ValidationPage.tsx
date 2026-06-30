import { useEffect, useMemo, useState } from "react";
import type { SetStateAction } from "react";
import { ClassificationReviewPanel } from "../components/validation/ClassificationReviewPanel";
import { DuplicatesPanel } from "../components/validation/DuplicatesPanel";
import { ImportPreviewPanel } from "../components/validation/ImportPreviewPanel";
import { ValidationActions } from "../components/validation/ValidationActions";
import { ValidationEmptyState } from "../components/validation/ValidationEmptyState";
import { ValidationResultsGrid } from "../components/validation/ValidationResultsGrid";
import { ValidationSummary } from "../components/validation/ValidationSummary";
import type { ImportIssue, ImportSessionSummary, ImportValidationResponse, SettingItem } from "../types";
import type { ClassificationReviewGroup } from "../types/validation";
import type { ImportWizardStep } from "../components/ImportWizard";

type ValidationPageProps = {
  result: ImportValidationResponse | null;
  fileName: string | null;
  currentSession: ImportSessionSummary | null;
  blockingIssues: ImportIssue[];
  alertIssues: ImportIssue[];
  classificationReviewGroups: ClassificationReviewGroup[];
  showAllClassifications: boolean;
  classificationOverrides: Record<number, { category: string; subcategory: string }>;
  categoryOptions: string[];
  subcategoryOptions: string[];
  collaboratorProfileOptions: SettingItem[];
  unprofiledCollaborators: string[];
  duplicateSelections: Record<string, number>;
  processingMessage: string | null;
  error: string | null;
  isLoading: boolean;
  isCompleting: boolean;
  canCompleteImport: boolean;
  onGoToImport: () => void;
  importWizardStep: ImportWizardStep;
  onImportWizardStepChange: (step: ImportWizardStep) => void;
  onCreateImportCollaboratorProfile: (loginUsuario: string, subcategoryId: number) => Promise<void>;
  onToggleShowAllClassifications: (showAll: boolean) => void;
  onClassificationOverridesChange: (
    updater: SetStateAction<Record<number, { category: string; subcategory: string }>>,
  ) => void;
  onDuplicateSelectionsChange: (updater: SetStateAction<Record<string, number>>) => void;
  onReprocess: () => void;
  onCancel: () => void;
  onComplete: () => void;
};

export function ValidationPage({
  result,
  fileName,
  currentSession,
  blockingIssues,
  alertIssues,
  classificationReviewGroups,
  showAllClassifications,
  classificationOverrides,
  categoryOptions,
  subcategoryOptions,
  collaboratorProfileOptions,
  unprofiledCollaborators,
  duplicateSelections,
  processingMessage,
  error,
  isLoading,
  isCompleting,
  canCompleteImport,
  onGoToImport,
  importWizardStep,
  onImportWizardStepChange,
  onCreateImportCollaboratorProfile,
  onToggleShowAllClassifications,
  onClassificationOverridesChange,
  onDuplicateSelectionsChange,
  onReprocess,
  onCancel,
  onComplete,
}: ValidationPageProps) {
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);
  const [dismissedCollaboratorSession, setDismissedCollaboratorSession] = useState<number | null>(null);
  const [collaboratorRoleDrafts, setCollaboratorRoleDrafts] = useState<Record<string, string>>({});
  const [collaboratorModalError, setCollaboratorModalError] = useState<string | null>(null);
  const [isSavingCollaborators, setIsSavingCollaborators] = useState(false);

  const activeUnprofiledCollaborators = useMemo(
    () =>
      unprofiledCollaborators.filter((login) =>
        result?.classifications.some((classification) => normalizeLogin(classification.loginUsuario) === normalizeLogin(login)),
      ),
    [result?.classifications, unprofiledCollaborators],
  );
  const hasAvailableRoles = collaboratorProfileOptions.some((option) => option.active);
  const canSaveCollaborators =
    activeUnprofiledCollaborators.length > 0 &&
    activeUnprofiledCollaborators.every((login) => Boolean(collaboratorRoleDrafts[login])) &&
    hasAvailableRoles;

  useEffect(() => {
    if (
      importWizardStep === "classification" &&
      result &&
      activeUnprofiledCollaborators.length > 0 &&
      dismissedCollaboratorSession !== result.sessionId
    ) {
      setCollaboratorRoleDrafts((current) => {
        const next: Record<string, string> = {};
        activeUnprofiledCollaborators.forEach((login) => {
          next[login] = current[login] ?? "";
        });
        return next;
      });
      setCollaboratorModalError(null);
      setIsCollaboratorModalOpen(true);
    }
  }, [activeUnprofiledCollaborators, dismissedCollaboratorSession, importWizardStep, result?.sessionId]);

  async function handleSaveMissingCollaborators() {
    if (!result) return;
    if (!canSaveCollaborators) return;
    setIsSavingCollaborators(true);
    setCollaboratorModalError(null);

    try {
      const roleByLogin = new Map<string, SettingItem>();
      activeUnprofiledCollaborators.forEach((login) => {
        const role = collaboratorProfileOptions.find((option) => option.id === Number(collaboratorRoleDrafts[login]));
        if (role) roleByLogin.set(normalizeLogin(login), role);
      });

      for (const login of activeUnprofiledCollaborators) {
        await onCreateImportCollaboratorProfile(login, Number(collaboratorRoleDrafts[login]));
      }

      onClassificationOverridesChange((current) => {
        const next = { ...current };
        result.classifications.forEach((classification) => {
          const role = roleByLogin.get(normalizeLogin(classification.loginUsuario));
          if (!role) return;
          if (!isMissingOperationalProfile(classification.subcategory)) return;
          next[classification.line] = {
            category: current[classification.line]?.category ?? classification.category,
            subcategory: role.name,
          };
        });
        return next;
      });

      setDismissedCollaboratorSession(result.sessionId);
      setIsCollaboratorModalOpen(false);
    } catch (err) {
      setCollaboratorModalError(err instanceof Error ? err.message : "Não foi possível cadastrar os colaboradores.");
    } finally {
      setIsSavingCollaborators(false);
    }
  }

  function handleSkipMissingCollaborators() {
    if (!result) return;
    setDismissedCollaboratorSession(result.sessionId);
    setIsCollaboratorModalOpen(false);
    setCollaboratorModalError(null);
  }

  if (!result) {
    return <ValidationEmptyState onGoToImport={onGoToImport} />;
  }

  const classifierVersions = Array.from(
    new Set(result.classifications.map((classification) => classification.classifierVersion).filter(Boolean)),
  );
  const classifierVersion = classifierVersions.length === 1 ? classifierVersions[0] : classifierVersions.length > 1 ? "multi" : undefined;

  if (importWizardStep === "preview") {
    return <ImportPreviewPanel result={result} onStepChange={onImportWizardStepChange} />;
  }

  return (
    <>
      {importWizardStep === "validation" && (
        <>
          <ValidationSummary
            totalRows={result.totalRows}
            validRows={result.validRows}
            alertCount={alertIssues.length}
            blockingCount={blockingIssues.length}
            classifierVersion={classifierVersion}
          />

          <ValidationResultsGrid result={result} blockingIssues={blockingIssues} alertIssues={alertIssues} />
        </>
      )}

      {importWizardStep === "classification" && (
        <ClassificationReviewPanel
          result={result}
          classificationReviewGroups={classificationReviewGroups}
          showAllClassifications={showAllClassifications}
          classificationOverrides={classificationOverrides}
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
          onStepChange={onImportWizardStepChange}
          onToggleShowAllClassifications={onToggleShowAllClassifications}
          onClassificationOverridesChange={onClassificationOverridesChange}
        />
      )}

      {importWizardStep === "duplicates" && (
        <DuplicatesPanel
          duplicates={result.duplicates}
          duplicateSelections={duplicateSelections}
          onDuplicateSelectionsChange={onDuplicateSelectionsChange}
        />
      )}

      {importWizardStep === "confirm" && (
        <ValidationActions
          fileName={fileName ?? result.filename}
          session={currentSession}
          sessionId={result.sessionId}
          processingMessage={processingMessage}
          error={error}
          isLoading={isLoading}
          isCompleting={isCompleting}
          canCompleteImport={canCompleteImport}
          onReprocess={onReprocess}
          onCancel={onCancel}
          onComplete={onComplete}
        />
      )}

      {isCollaboratorModalOpen && importWizardStep === "classification" && (
        <div className="settings-modal-backdrop import-collaborator-backdrop" role="presentation">
          <form
            aria-labelledby="import-collaborator-title"
            className="settings-modal-dialog import-collaborator-modal"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveMissingCollaborators();
            }}
          >
            <div className="settings-modal-header">
              <span>👥</span>
              <div>
                <h3 id="import-collaborator-title">Colaboradores não cadastrados</h3>
                <p>Vincule os novos colaboradores a um cargo antes de revisar as atividades.</p>
              </div>
            </div>

            <div className="import-collaborator-list">
              {activeUnprofiledCollaborators.map((login) => {
                const selectedRole = collaboratorProfileOptions.find((role) => role.id === Number(collaboratorRoleDrafts[login]));
                return (
                  <label className="import-collaborator-row" key={login}>
                    <span>
                      <strong>{formatCollaboratorName(login)}</strong>
                      <small>{login}</small>
                    </span>
                    <select
                      value={collaboratorRoleDrafts[login] ?? ""}
                      onChange={(event) =>
                        setCollaboratorRoleDrafts((current) => ({ ...current, [login]: event.target.value }))
                      }
                    >
                      <option value="">Selecione um cargo</option>
                      {collaboratorProfileOptions
                        .filter((role) => role.active)
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}{role.group ? ` - ${role.group}` : ""}
                          </option>
                        ))}
                    </select>
                    <em>{selectedRole?.group || "Grupo automático"}</em>
                  </label>
                );
              })}
            </div>

            {!hasAvailableRoles && (
              <p className="settings-feedback error" role="alert">
                Cadastre ao menos um cargo ativo em Configurações para vincular colaboradores.
              </p>
            )}
            {collaboratorModalError && (
              <p className="settings-feedback error" role="alert">
                {collaboratorModalError}
              </p>
            )}

            <div className="settings-modal-actions">
              <button className="secondary-button compact" disabled={isSavingCollaborators} type="button" onClick={handleSkipMissingCollaborators}>
                Continuar sem cadastrar
              </button>
              <button className="primary-button compact" disabled={!canSaveCollaborators || isSavingCollaborators} type="submit">
                {isSavingCollaborators ? "Cadastrando..." : "Cadastrar e aplicar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function normalizeLogin(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isMissingOperationalProfile(value: string): boolean {
  const normalized = normalizeLogin(value);
  return normalized === "" || normalized === "nao aplicavel" || normalized === "nao classificado";
}

function formatCollaboratorName(login: string): string {
  return login
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}
