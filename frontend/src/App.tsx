import { AppShell } from "./components/AppShell";
import { ImportWizard } from "./components/ImportWizard";
import type { ImportWizardStep } from "./components/ImportWizard";
import { DashboardPage } from "./pages/DashboardPage";
import type { SettingsTab } from "./pages/SettingsPage";
import { useDashboardData } from "./hooks/useDashboardData";
import { useImportFlow } from "./hooks/useImportFlow";
import { useSettings } from "./hooks/useSettings";
import { getImportDetail } from "./services/api";
import type {
  ImportDetail,
} from "./types";
import type { SectionId } from "./types/navigation";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

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
const restorableSections: SectionId[] = ["dashboard", "import", "reports", "settings"];

function getInitialActiveSection(): SectionId {
  const storedSection = window.localStorage.getItem(activeSectionStorageKey) as SectionId | null;
  return storedSection && restorableSections.includes(storedSection) ? storedSection : "dashboard";
}

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>(getInitialActiveSection);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("categories");
  const dashboard = useDashboardData();
  const [selectedImport, setSelectedImport] = useState<ImportDetail | null>(null);
  const [isLoadingImportDetail, setIsLoadingImportDetail] = useState(false);
  const settings = useSettings(dashboard.refreshFilterOptions);
  const importFlow = useImportFlow({
    onValidationReady: () => setActiveSection("validation"),
    onCompleted: async (response) => {
      await dashboard.refreshDashboard(dashboard.filters);
      await dashboard.refreshFilterOptions();
      await dashboard.handleOpenReportProject(response.importId);
      setActiveSection("reports");
    },
    onCancelled: () => setActiveSection("import"),
  });
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
    if (!importFlow.availableWizardSteps.includes(step)) {
      return;
    }
    importFlow.setImportWizardStep(step);
    setActiveSection(step === "upload" ? "import" : "validation");
  }

  return (
    <AppShell
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      headerBackAction={
        activeSection === "reports" && dashboard.selectedReportImportId
          ? { label: "Relatórios", onClick: dashboard.handleBackToReportProjects }
          : null
      }
    >
      <Suspense fallback={<section className="panel loading-panel">Carregando tela...</section>}>
        {(activeSection === "import" || activeSection === "validation") && (
          <ImportWizard
            activeStep={importFlow.importWizardStep}
            availableSteps={importFlow.availableWizardSteps}
            completed={Boolean(importFlow.result)}
            disabled={!importFlow.result}
            onStepChange={handleImportWizardStepChange}
          />
        )}

        {activeSection === "dashboard" && (
          <DashboardPage overview={dashboard.overview} />
        )}

        {activeSection === "import" && (
          <ImportPage
            file={importFlow.file}
            isLoading={importFlow.isLoading}
            error={importFlow.error}
            processingMessage={importFlow.processingMessage}
            processingStepIndex={importFlow.processingStepIndex}
            successMessage={importFlow.successMessage}
            result={importFlow.result}
            onFileChange={importFlow.handleSelectImportFile}
            onValidate={importFlow.handleValidate}
          />
        )}

        {activeSection === "validation" && (
          <ValidationPage
            result={importFlow.result}
            fileName={importFlow.file?.name ?? null}
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
            onReprocess={importFlow.handleReprocessSession}
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
            projectPendingItems={dashboard.projectPendingItems}
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
