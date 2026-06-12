import type { SetStateAction } from "react";
import { ClassificationReviewPanel } from "../components/validation/ClassificationReviewPanel";
import { DuplicatesPanel } from "../components/validation/DuplicatesPanel";
import { ImportPreviewPanel } from "../components/validation/ImportPreviewPanel";
import { ValidationActions } from "../components/validation/ValidationActions";
import { ValidationEmptyState } from "../components/validation/ValidationEmptyState";
import { ValidationResultsGrid } from "../components/validation/ValidationResultsGrid";
import { ValidationSummary } from "../components/validation/ValidationSummary";
import type { ImportIssue, ImportSessionSummary, ImportValidationResponse } from "../types";
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
  duplicateSelections: Record<string, number>;
  processingMessage: string | null;
  error: string | null;
  isLoading: boolean;
  isCompleting: boolean;
  canCompleteImport: boolean;
  onGoToImport: () => void;
  importWizardStep: ImportWizardStep;
  onImportWizardStepChange: (step: ImportWizardStep) => void;
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
  duplicateSelections,
  processingMessage,
  error,
  isLoading,
  isCompleting,
  canCompleteImport,
  onGoToImport,
  importWizardStep,
  onImportWizardStepChange,
  onToggleShowAllClassifications,
  onClassificationOverridesChange,
  onDuplicateSelectionsChange,
  onReprocess,
  onCancel,
  onComplete,
}: ValidationPageProps) {
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
    </>
  );
}
