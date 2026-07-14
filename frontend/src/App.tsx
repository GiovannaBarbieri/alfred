import { AppShell } from "./components/AppShell";
import { ImportWizard } from "./components/ImportWizard";
import type { ImportWizardStep } from "./components/ImportWizard";
import { ImportSuccessPanel } from "./components/validation/ImportSuccessPanel";
import type { SettingsTab } from "./pages/SettingsPage";
import { useDashboardData } from "./hooks/useDashboardData";
import { useImportFlow } from "./hooks/useImportFlow";
import type { ImportCompletionSnapshot } from "./hooks/useImportFlow";
import { useSettings } from "./hooks/useSettings";
import { getImportDetail } from "./services/api";
import type {
  ImportCompleteResponse,
  ImportDetail,
} from "./types";
import type { SectionId } from "./types/navigation";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

const HistoryPage = lazy(() => import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage })));
const ImportPage = lazy(() => import("./pages/ImportPage").then((module) => ({ default: module.ImportPage })));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then((module) => ({ default: module.AuditPage })));
const ValidationPage = lazy(() =>
  import("./pages/ValidationPage").then((module) => ({ default: module.ValidationPage })),
);

const defaultCategoryOptions = [
  "Desenvolvimento",
  "Reuniao",
  "Alinhamento",
  "Definicao",
  "Homologacao",
  "Testes cruzados",
  "Retrabalho",
  "Analise",
  "Outros",
  "Nao classificado",
];

const defaultSubcategoryOptions = ["Back", "Front", "QA", "Nao aplicavel", "Nao classificado"];
const activeSectionStorageKey = "analise-horas:active-section";
const restorableSections: SectionId[] = ["import", "reports", "settings"];

function getInitialActiveSection(): SectionId {
  const storedSection = window.localStorage.getItem(activeSectionStorageKey) as SectionId | null;
  return storedSection && restorableSections.includes(storedSection) ? storedSection : "import";
}

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>(getInitialActiveSection);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("categories");
  const dashboard = useDashboardData();
  const [selectedImport, setSelectedImport] = useState<ImportDetail | null>(null);
  const [completedImport, setCompletedImport] = useState<{
    response: ImportCompleteResponse;
    snapshot: ImportCompletionSnapshot;
  } | null>(null);
  const [completedImportRedirectError, setCompletedImportRedirectError] = useState<string | null>(null);
  const [isOpeningCompletedImport, setIsOpeningCompletedImport] = useState(false);
  const completedImportRedirectRef = useRef<number | null>(null);
  const [isLoadingImportDetail, setIsLoadingImportDetail] = useState(false);
  const settings = useSettings(dashboard.refreshFilterOptions);
  const categoryOptions = useMemo(() => {
    const active = settings.settingsCategories.filter((category) => category.active).map((category) => category.name);
    return active.length > 0 ? active : defaultCategoryOptions;
  }, [settings.settingsCategories]);
  const subcategoryOptions = useMemo(() => {
    const active = settings.settingsSubcategories
      .filter((subcategory) => subcategory.active)
      .map((subcategory) => subcategory.name);
    return active.length > 0 ? active : defaultSubcategoryOptions;
  }, [settings.settingsSubcategories]);
  const importFlow = useImportFlow({
    categoryOptions,
    onValidationReady: () => setActiveSection("validation"),
    onCompleted: async (response, snapshot) => {
      await dashboard.refreshDashboard(dashboard.filters);
      await dashboard.refreshFilterOptions();
      setCompletedImportRedirectError(null);
      setIsOpeningCompletedImport(true);
      setCompletedImport({ response, snapshot });
      setActiveSection("validation");
    },
    onCancelled: () => {
      setCompletedImport(null);
      setActiveSection("import");
    },
    subcategoryOptions,
  });
  const collaboratorLoginOptions = useMemo(() => {
    const logins = new Set<string>();
    dashboard.filterOptions.users.forEach((option) => logins.add(option.value));
    importFlow.result?.classifications.forEach((classification) => logins.add(classification.loginUsuario));
    settings.collaboratorProfiles.forEach((profile) => logins.add(profile.loginUsuario));
    return Array.from(logins).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [dashboard.filterOptions.users, importFlow.result, settings.collaboratorProfiles]);
  const unprofiledCollaborators = useMemo(() => {
    const profiled = new Set(
      settings.collaboratorProfiles
        .filter((profile) => profile.active)
        .map((profile) => profile.loginUsuario.trim().toLowerCase()),
    );
    const ignored = new Set(settings.ignoredCollaborators.map((item) => item.loginUsuario.trim().toLowerCase()));
    return collaboratorLoginOptions.filter((login) => {
      const normalized = login.trim().toLowerCase();
      return !profiled.has(normalized) && !ignored.has(normalized);
    });
  }, [collaboratorLoginOptions, settings.collaboratorProfiles, settings.ignoredCollaborators]);
  const hasUnprofiledCollaboratorsInCurrentImport = useMemo(() => {
    if (!importFlow.result) return false;
    const unprofiled = new Set(unprofiledCollaborators.map((login) => login.trim().toLowerCase()));
    return importFlow.result.classifications.some((classification) =>
      unprofiled.has(classification.loginUsuario.trim().toLowerCase()),
    );
  }, [importFlow.result, unprofiledCollaborators]);
  const availableImportWizardSteps = useMemo(() => {
    if (!hasUnprofiledCollaboratorsInCurrentImport || importFlow.availableWizardSteps.includes("classification")) {
      return importFlow.availableWizardSteps;
    }
    const steps = [...importFlow.availableWizardSteps];
    const confirmIndex = steps.indexOf("confirm");
    if (confirmIndex >= 0) {
      steps.splice(confirmIndex, 0, "classification");
    } else {
      steps.push("classification");
    }
    return steps;
  }, [hasUnprofiledCollaboratorsInCurrentImport, importFlow.availableWizardSteps]);
  useEffect(() => {
    void dashboard.refreshDashboard(dashboard.filters);
    void dashboard.refreshFilterOptions();
    void settings.refreshSettings();
  }, []);

  useEffect(() => {
    if (restorableSections.includes(activeSection)) {
      window.localStorage.setItem(activeSectionStorageKey, activeSection);
    }
  }, [activeSection]);

  useEffect(() => {
    if (!completedImport) return;

    const importId = completedImport.response.importId;
    if (!importId) {
      setCompletedImportRedirectError("A importação foi concluída, mas o identificador do projeto não foi retornado.");
      setIsOpeningCompletedImport(false);
      return;
    }
    if (completedImportRedirectRef.current === importId) return;

    completedImportRedirectRef.current = importId;
    setCompletedImportRedirectError(null);
    setIsOpeningCompletedImport(true);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          await dashboard.handleOpenReportProject(importId);
          setCompletedImport(null);
          setActiveSection("reports");
        } catch (err) {
          setCompletedImportRedirectError(err instanceof Error ? err.message : "Não foi possível abrir o projeto automaticamente.");
        } finally {
          setIsOpeningCompletedImport(false);
        }
      })();
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [completedImport]);

  async function handleOpenImport(importId: number) {
    setIsLoadingImportDetail(true);
    importFlow.setError(null);

    try {
      setSelectedImport(await getImportDetail(importId));
    } catch (err) {
      importFlow.setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsLoadingImportDetail(false);
    }
  }

  function handleClearImport() {
    setSelectedImport(null);
    setIsLoadingImportDetail(false);
  }

  function handleImportWizardStepChange(step: ImportWizardStep) {
    if (!availableImportWizardSteps.includes(step)) {
      return;
    }
    setCompletedImport(null);
    importFlow.setImportWizardStep(step);
    setActiveSection(step === "upload" ? "import" : "validation");
  }

  function handleNewImportAfterSuccess() {
    setCompletedImport(null);
    setCompletedImportRedirectError(null);
    setIsOpeningCompletedImport(false);
    setActiveSection("import");
  }

  const headerOverride =
    activeSection === "validation" && importFlow.importWizardStep === "confirm" && !completedImport
      ? {
          title: "Confirmação da importação",
          description: "Revise os dados antes de gravá-los definitivamente.",
        }
      : null;

  async function handleViewCompletedImport() {
    if (!completedImport) return;
    setCompletedImportRedirectError(null);
    setIsOpeningCompletedImport(true);
    try {
      await dashboard.handleOpenReportProject(completedImport.response.importId);
      setCompletedImport(null);
      setActiveSection("reports");
    } catch (err) {
      setCompletedImportRedirectError(err instanceof Error ? err.message : "Não foi possível abrir o projeto.");
    } finally {
      setIsOpeningCompletedImport(false);
    }
  }

  return (
    <AppShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      headerOverride={headerOverride}
      headerBackAction={
        activeSection === "reports" && dashboard.selectedReportImportId
          ? { label: "Relatórios", onClick: dashboard.handleBackToReportProjects }
          : null
      }
    >
      <Suspense fallback={<section className="panel loading-panel">Carregando tela...</section>}>
        {(activeSection === "import" || activeSection === "validation") && !completedImport && (
          <ImportWizard
            activeStep={importFlow.importWizardStep}
            availableSteps={availableImportWizardSteps}
            completed={Boolean(importFlow.result)}
            disabled={!importFlow.result}
            onStepChange={handleImportWizardStepChange}
          />
        )}

        {activeSection === "import" && (
          <ImportPage
            file={importFlow.file}
            importSource={importFlow.importSource}
            sqlServerIds={importFlow.sqlServerIds}
            sqlServerIdType={importFlow.sqlServerIdType}
            sqlServerProjectName={importFlow.sqlServerProjectName}
            isTestingSqlServer={importFlow.isTestingSqlServer}
            sqlServerStatusMessage={importFlow.sqlServerStatusMessage}
            sqlServerConnectionValidated={importFlow.sqlServerConnectionValidated}
            isLoading={importFlow.isLoading}
            error={importFlow.error}
            processingMessage={importFlow.processingMessage}
            processingStepIndex={importFlow.processingStepIndex}
            successMessage={importFlow.successMessage}
            result={importFlow.result}
            onImportSourceChange={importFlow.setImportSource}
            onFileChange={importFlow.handleSelectImportFile}
            onValidate={importFlow.handleValidate}
            onSqlServerIdsChange={importFlow.setSqlServerIds}
            onSqlServerIdTypeChange={importFlow.setSqlServerIdType}
            onSqlServerProjectNameChange={importFlow.setSqlServerProjectName}
            onValidateSqlServer={importFlow.handleValidateSqlServer}
            onTestSqlServerConnection={importFlow.handleTestSqlServerConnection}
          />
        )}

        {activeSection === "validation" && completedImport && (
          <ImportSuccessPanel
            completion={completedImport}
            isOpeningProject={isOpeningCompletedImport}
            redirectError={completedImportRedirectError}
            onNewImport={handleNewImportAfterSuccess}
            onViewImport={handleViewCompletedImport}
          />
        )}

        {activeSection === "validation" && !completedImport && (
          <ValidationPage
            result={importFlow.result}
            fileName={importFlow.file?.name ?? importFlow.currentSession?.filename ?? null}
            currentSession={importFlow.currentSession}
            blockingIssues={importFlow.blockingIssues}
            alertIssues={importFlow.alertIssues}
            classificationReviewGroups={importFlow.classificationReviewGroups}
            showAllClassifications={importFlow.showAllClassifications}
            classificationOverrides={importFlow.classificationOverrides}
            categoryOptions={categoryOptions}
            subcategoryOptions={subcategoryOptions}
            collaboratorProfileOptions={settings.settingsSubcategories.filter((subcategory) => subcategory.active)}
            unprofiledCollaborators={unprofiledCollaborators}
            hasUnprofiledCollaborators={hasUnprofiledCollaboratorsInCurrentImport}
            duplicateSelections={importFlow.duplicateSelections}
            processingMessage={importFlow.processingMessage}
            error={importFlow.error}
            isLoading={importFlow.isLoading}
            isCompleting={importFlow.isCompleting}
            canCompleteImport={importFlow.canCompleteImport}
            onGoToImport={() => setActiveSection("import")}
            importWizardStep={importFlow.importWizardStep}
            onImportWizardStepChange={handleImportWizardStepChange}
            onCreateImportCollaboratorProfile={settings.handleCreateImportCollaboratorProfile}
            onToggleShowAllClassifications={importFlow.setShowAllClassifications}
            onClassificationOverridesChange={importFlow.setClassificationOverrides}
            onDuplicateSelectionsChange={importFlow.setDuplicateSelections}
            onCancel={importFlow.handleCancelSession}
            onComplete={importFlow.handleComplete}
          />
        )}

        {activeSection === "reports" && (
          <ReportsPage
            imports={dashboard.imports}
            landingCollaboratorsCount={dashboard.overview.summary.collaboratorsCount}
            selectedImportId={dashboard.selectedReportImportId}
            projectTimelineCharts={dashboard.projectTimelineCharts}
            projectExecutiveSummary={dashboard.projectExecutiveSummary}
            projectInsights={dashboard.projectInsights}
            projectRecommendations={dashboard.projectRecommendations}
            onOpenProject={dashboard.handleOpenReportProject}
          />
        )}

        {activeSection === "history" && (
          <HistoryPage
            imports={dashboard.imports}
            selectedImport={selectedImport}
            isLoadingImportDetail={isLoadingImportDetail}
            onOpenImport={handleOpenImport}
            onClearImport={handleClearImport}
          />
        )}

        {activeSection === "audit" && <AuditPage />}

        {activeSection === "settings" && (
          <SettingsPage
            settingsTab={settingsTab}
            onSettingsTabChange={setSettingsTab}
            settingsCategories={settings.settingsCategories}
            settingsSubcategories={settings.settingsSubcategories}
            settingsKeywords={settings.settingsKeywords}
            classificationRules={settings.classificationRules}
            collaboratorProfiles={settings.collaboratorProfiles}
            ignoredCollaborators={settings.ignoredCollaborators}
            unprofiledCollaborators={unprofiledCollaborators}
            newCategory={settings.newCategory}
            newCategoryDescription={settings.newCategoryDescription}
            newSubcategory={settings.newSubcategory}
            newSubcategoryActive={settings.newSubcategoryActive}
            newSubcategoryGroup={settings.newSubcategoryGroup}
            newKeyword={settings.newKeyword}
            newKeywordCategoryId={settings.newKeywordCategoryId}
            newRuleName={settings.newRuleName}
            newRuleCategoryId={settings.newRuleCategoryId}
            newRuleSubcategoryId={settings.newRuleSubcategoryId}
            newRuleKeywords={settings.newRuleKeywords}
            newRulePriority={settings.newRulePriority}
            newRuleVersion={settings.newRuleVersion}
            newCollaboratorLogin={settings.newCollaboratorLogin}
            newCollaboratorSubcategoryId={settings.newCollaboratorSubcategoryId}
            newCollaboratorActive={settings.newCollaboratorActive}
            categoryDrafts={settings.categoryDrafts}
            categoryDescriptionDrafts={settings.categoryDescriptionDrafts}
            subcategoryDrafts={settings.subcategoryDrafts}
            subcategoryActiveDrafts={settings.subcategoryActiveDrafts}
            subcategoryGroupDrafts={settings.subcategoryGroupDrafts}
            keywordDrafts={settings.keywordDrafts}
            keywordCategoryDrafts={settings.keywordCategoryDrafts}
            ruleNameDrafts={settings.ruleNameDrafts}
            ruleCategoryDrafts={settings.ruleCategoryDrafts}
            ruleSubcategoryDrafts={settings.ruleSubcategoryDrafts}
            ruleKeywordDrafts={settings.ruleKeywordDrafts}
            rulePriorityDrafts={settings.rulePriorityDrafts}
            ruleVersionDrafts={settings.ruleVersionDrafts}
            profileLoginDrafts={settings.profileLoginDrafts}
            profileSubcategoryDrafts={settings.profileSubcategoryDrafts}
            profileActiveDrafts={settings.profileActiveDrafts}
            availableProfileSubcategoryDrafts={settings.availableProfileSubcategoryDrafts}
            onNewCategoryChange={settings.setNewCategory}
            onNewCategoryDescriptionChange={settings.setNewCategoryDescription}
            onNewSubcategoryChange={settings.setNewSubcategory}
            onNewSubcategoryActiveChange={settings.setNewSubcategoryActive}
            onNewSubcategoryGroupChange={settings.setNewSubcategoryGroup}
            onNewKeywordChange={settings.setNewKeyword}
            onNewKeywordCategoryIdChange={settings.setNewKeywordCategoryId}
            onNewRuleNameChange={settings.setNewRuleName}
            onNewRuleCategoryIdChange={settings.setNewRuleCategoryId}
            onNewRuleSubcategoryIdChange={settings.setNewRuleSubcategoryId}
            onNewRuleKeywordsChange={settings.setNewRuleKeywords}
            onNewRulePriorityChange={settings.setNewRulePriority}
            onNewRuleVersionChange={settings.setNewRuleVersion}
            onNewCollaboratorLoginChange={settings.setNewCollaboratorLogin}
            onNewCollaboratorSubcategoryIdChange={settings.setNewCollaboratorSubcategoryId}
            onNewCollaboratorActiveChange={settings.setNewCollaboratorActive}
            onCategoryDraftsChange={settings.setCategoryDrafts}
            onCategoryDescriptionDraftsChange={settings.setCategoryDescriptionDrafts}
            onSubcategoryDraftsChange={settings.setSubcategoryDrafts}
            onSubcategoryActiveDraftsChange={settings.setSubcategoryActiveDrafts}
            onSubcategoryGroupDraftsChange={settings.setSubcategoryGroupDrafts}
            onKeywordDraftsChange={settings.setKeywordDrafts}
            onKeywordCategoryDraftsChange={settings.setKeywordCategoryDrafts}
            onRuleNameDraftsChange={settings.setRuleNameDrafts}
            onRuleCategoryDraftsChange={settings.setRuleCategoryDrafts}
            onRuleSubcategoryDraftsChange={settings.setRuleSubcategoryDrafts}
            onRuleKeywordDraftsChange={settings.setRuleKeywordDrafts}
            onRulePriorityDraftsChange={settings.setRulePriorityDrafts}
            onRuleVersionDraftsChange={settings.setRuleVersionDrafts}
            onProfileLoginDraftsChange={settings.setProfileLoginDrafts}
            onProfileSubcategoryDraftsChange={settings.setProfileSubcategoryDrafts}
            onProfileActiveDraftsChange={settings.setProfileActiveDrafts}
            onAvailableProfileSubcategoryDraftsChange={settings.setAvailableProfileSubcategoryDrafts}
            onCreateCategory={settings.handleCreateCategory}
            onRenameCategory={settings.handleRenameCategory}
            onToggleCategory={settings.handleToggleCategory}
            onDeleteCategory={settings.handleDeleteCategory}
            onCreateSubcategory={settings.handleCreateSubcategory}
            onRenameSubcategory={settings.handleRenameSubcategory}
            onToggleSubcategory={settings.handleToggleSubcategory}
            onDeleteSubcategory={settings.handleDeleteSubcategory}
            onCreateKeyword={settings.handleCreateKeyword}
            onUpdateKeyword={settings.handleUpdateKeyword}
            onToggleKeyword={settings.handleToggleKeyword}
            onBulkToggleKeywords={settings.handleBulkToggleKeywords}
            onBulkUpdateKeywordCategory={settings.handleBulkUpdateKeywordCategory}
            onCreateClassificationRule={settings.handleCreateClassificationRule}
            onUpdateClassificationRule={settings.handleUpdateClassificationRule}
            onToggleClassificationRule={settings.handleToggleClassificationRule}
            onCreateCollaboratorProfile={settings.handleCreateCollaboratorProfile}
            onCreateAvailableCollaboratorProfile={settings.handleCreateAvailableCollaboratorProfile}
            onIgnoreAvailableCollaborator={settings.handleIgnoreAvailableCollaborator}
            onRestoreIgnoredCollaborator={settings.handleRestoreIgnoredCollaborator}
            onUpdateCollaboratorProfile={settings.handleUpdateCollaboratorProfile}
            onToggleCollaboratorProfile={settings.handleToggleCollaboratorProfile}
            onDeleteCollaboratorProfile={settings.handleDeleteCollaboratorProfile}
          />
        )}
      </Suspense>
    </AppShell>
  );
}


export default App;
