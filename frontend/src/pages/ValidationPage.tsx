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
  const [roleComboboxOpen, setRoleComboboxOpen] = useState<string | null>(null);
  const [roleSearchDrafts, setRoleSearchDrafts] = useState<Record<string, string>>({});
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
  const linkedCollaboratorsCount = activeUnprofiledCollaborators.filter((login) => Boolean(collaboratorRoleDrafts[login])).length;
  const collaboratorProgressPercentage =
    activeUnprofiledCollaborators.length > 0
      ? Math.round((linkedCollaboratorsCount / activeUnprofiledCollaborators.length) * 100)
      : 0;
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
      setRoleComboboxOpen(null);
      setRoleSearchDrafts({});
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
    setRoleComboboxOpen(null);
    setRoleSearchDrafts({});
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
            <div className="import-collaborator-header">
              <div className="settings-modal-header">
                <span>👥</span>
                <div>
                  <h3 id="import-collaborator-title">Novos colaboradores encontrados</h3>
                  <p>
                    Foram encontrados {activeUnprofiledCollaborators.length} colaborador
                    {activeUnprofiledCollaborators.length === 1 ? "" : "es"} que ainda não existem no sistema.
                    Associe um cargo para cada um antes de continuar.
                  </p>
                </div>
              </div>
              <span className="import-collaborator-count-badge">
                {activeUnprofiledCollaborators.length - linkedCollaboratorsCount} pendente
                {activeUnprofiledCollaborators.length - linkedCollaboratorsCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="import-collaborator-progress">
              <strong>Cadastro concluído</strong>
              <span>
                {linkedCollaboratorsCount} de {activeUnprofiledCollaborators.length} colaboradores
              </span>
              <div aria-hidden="true">
                <i style={{ width: `${collaboratorProgressPercentage}%` }} />
              </div>
            </div>

            <div className="import-collaborator-list">
              {activeUnprofiledCollaborators.map((login) => {
                const selectedRole = collaboratorProfileOptions.find((role) => role.id === Number(collaboratorRoleDrafts[login]));
                const roleSearch = roleSearchDrafts[login] ?? "";
                const filteredRoles = collaboratorProfileOptions
                  .filter((role) => role.active)
                  .filter((role) => {
                    if (!roleSearch.trim()) return true;
                    const normalizedSearch = normalizeLogin(roleSearch);
                    return normalizeLogin(`${role.name} ${role.group ?? ""}`).includes(normalizedSearch);
                  });
                const hasSelectedRole = Boolean(selectedRole);
                return (
                  <div className={`import-collaborator-row ${hasSelectedRole ? "complete" : "pending"}`} key={login}>
                    <div className="import-collaborator-identity">
                      <span>Nome</span>
                      <strong>{formatCollaboratorName(login)}</strong>
                      <small>{login}</small>
                    </div>

                    <div
                      className="import-role-combobox"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setRoleComboboxOpen((current) => (current === login ? null : current));
                          setRoleSearchDrafts((current) => ({ ...current, [login]: "" }));
                        }
                      }}
                    >
                      <span>Cargo</span>
                      <button
                        aria-expanded={roleComboboxOpen === login}
                        className="import-role-trigger"
                        type="button"
                        onClick={() => {
                          setRoleComboboxOpen((current) => (current === login ? null : login));
                          setRoleSearchDrafts((current) => ({ ...current, [login]: "" }));
                        }}
                      >
                        <strong>{selectedRole?.name || "Selecione ou pesquise um cargo..."}</strong>
                        <i aria-hidden="true" />
                      </button>
                      {roleComboboxOpen === login && (
                        <div className="import-role-menu">
                          <input
                            autoFocus
                            placeholder="Buscar cargo..."
                            value={roleSearch}
                            onChange={(event) => setRoleSearchDrafts((current) => ({ ...current, [login]: event.target.value }))}
                          />
                          <span>Digite para pesquisar ou selecione uma opção.</span>
                          <div>
                            {filteredRoles.length === 0 && <p>Nenhum cargo encontrado.</p>}
                            {filteredRoles.map((role) => (
                              <button
                                className={selectedRole?.id === role.id ? "active" : ""}
                                key={role.id}
                                type="button"
                                onClick={() => {
                                  setCollaboratorRoleDrafts((current) => ({ ...current, [login]: String(role.id) }));
                                  setRoleComboboxOpen(null);
                                  setRoleSearchDrafts((current) => ({ ...current, [login]: "" }));
                                }}
                              >
                                <strong>{role.name}</strong>
                                <small>{role.group || "Sem grupo"}</small>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className={`import-collaborator-status ${hasSelectedRole ? "complete" : "pending"}`}>
                      {hasSelectedRole ? "Cadastrado" : "Pendente"}
                    </span>
                  </div>
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
                Ignorar por enquanto
              </button>
              <button className="primary-button compact" disabled={!canSaveCollaborators || isSavingCollaborators} type="submit">
                {isSavingCollaborators ? "Cadastrando..." : "Cadastrar e continuar"}
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
