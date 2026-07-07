import { useEffect, useMemo, useState } from "react";

import {
  cancelImportSession,
  completeImportSession,
  createImportSession,
  createSqlServerImportSession,
  reprocessImportSession,
  testSqlServerConnection,
} from "../services/api";
import type { ImportWizardStep } from "../components/ImportWizard";
import type { ImportCompleteResponse, ImportSessionSummary, ImportValidationResponse } from "../types";
import type { ClassificationReviewGroup } from "../types/validation";

export const importProcessingSteps = [
  "Enviando arquivo para processamento temporario",
  "Lendo planilha e conferindo colunas obrigatórias",
  "Validando registros, durações e duplicidades",
  "Classificando categorias e subcategorias",
  "Montando a sessão de revisão",
] as const;

export const sqlServerProcessingSteps = [
  "Consultando SQL Server...",
  "Carregando Tasks...",
  "Montando estrutura...",
  "Preparando pre-visualizacao...",
] as const;

const CLASSIFICATION_REVIEW_THRESHOLD = 0.9;

function parseSqlServerIds(value: string): number[] {
  const parts = value
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Informe ao menos um ID para consultar no SQL Server.");
  }

  const invalid = parts.find((part) => !/^\d+$/.test(part));
  if (invalid) {
    throw new Error("Informe apenas IDs numericos para consultar no SQL Server.");
  }

  return Array.from(new Set(parts.map((part) => Number(part))));
}

export function useImportFlow({
  onValidationReady,
  onCompleted,
  onCancelled,
}: {
  onValidationReady: () => void;
  onCompleted: (response: ImportCompleteResponse) => Promise<void>;
  onCancelled: () => void;
}) {
  const [importWizardStep, setImportWizardStep] = useState<ImportWizardStep>("upload");
  const [currentSession, setCurrentSession] = useState<ImportSessionSummary | null>(null);
  const [importSource, setImportSource] = useState<"file" | "sqlserver">("file");
  const [file, setFile] = useState<File | null>(null);
  const [sqlServerIds, setSqlServerIds] = useState("");
  const [sqlServerIdType, setSqlServerIdType] = useState<"auto" | "epic" | "feature">("auto");
  const [sqlServerProjectName, setSqlServerProjectName] = useState("");
  const [isTestingSqlServer, setIsTestingSqlServer] = useState(false);
  const [sqlServerStatusMessage, setSqlServerStatusMessage] = useState<string | null>(null);
  const [sqlServerConnectionValidated, setSqlServerConnectionValidated] = useState(false);
  const [result, setResult] = useState<ImportValidationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [processingStepIndex, setProcessingStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showAllClassifications, setShowAllClassifications] = useState(false);
  const [duplicateSelections, setDuplicateSelections] = useState<Record<string, number>>({});
  const [classificationOverrides, setClassificationOverrides] = useState<
    Record<number, { category: string; subcategory: string }>
  >({});

  const blockingIssues = useMemo(
    () => result?.issues.filter((issue) => issue.severity === "bloqueio") ?? [],
    [result],
  );
  const alertIssues = useMemo(
    () => result?.issues.filter((issue) => issue.severity === "alerta") ?? [],
    [result],
  );
  const nonDuplicateBlockingIssues = useMemo(
    () => blockingIssues.filter((issue) => issue.code !== "duplicate_id"),
    [blockingIssues],
  );
  const duplicateKeepLines = useMemo(() => Object.values(duplicateSelections), [duplicateSelections]);
  const classificationOverridePayload = useMemo(() => {
    if (!result) return [];

    return result.classifications
      .filter((classification) => {
        const selected = classificationOverrides[classification.line];
        return (
          selected &&
          (selected.category !== classification.category || selected.subcategory !== classification.subcategory)
        );
      })
      .map((classification) => ({
        line: classification.line,
        category: classificationOverrides[classification.line].category,
        subcategory: classificationOverrides[classification.line].subcategory,
      }));
  }, [classificationOverrides, result]);
  const allDuplicatesResolved = useMemo(() => {
    if (!result || result.duplicates.length === 0) return false;
    return result.duplicates.every((duplicate) => Boolean(duplicateSelections[duplicate.idLancamento]));
  }, [duplicateSelections, result]);
  const canCompleteImport = Boolean(
    result && currentSession && (result.canComplete || (allDuplicatesResolved && nonDuplicateBlockingIssues.length === 0)),
  );
  const classificationReviewGroups = useMemo<ClassificationReviewGroup[]>(() => {
    const grouped = new Map<string, ClassificationReviewGroup>();
    for (const classification of result?.classifications ?? []) {
      const key = classification.idTask || `linha-${classification.line}`;
      const existing = grouped.get(key);
      const needsReview =
        classification.category === "Nao classificado" ||
        classification.subcategory === "Nao classificado" ||
        classification.confidence < CLASSIFICATION_REVIEW_THRESHOLD ||
        classification.confidenceLevel === "baixa";

      if (!existing) {
        grouped.set(key, {
          idTask: classification.idTask || "Sem IdTask",
          lines: [classification.line],
          title: classification.tituloTask,
          users: [classification.loginUsuario],
          category: classification.category,
          subcategory: classification.subcategory,
          origin: classification.origin,
          confidence: classification.confidence,
          confidenceLevel: classification.confidenceLevel,
          confidenceFactors: classification.confidenceFactors ?? [],
          matchedKeywords: classification.matchedKeywords ?? [],
          totalRecords: 1,
          needsReview,
        });
        continue;
      }

      existing.lines.push(classification.line);
      existing.totalRecords += 1;
      existing.needsReview = existing.needsReview || needsReview;
      existing.confidence = Math.min(existing.confidence, classification.confidence);
      if (classification.confidenceLevel === "baixa") {
        existing.confidenceLevel = "baixa";
      } else if (classification.confidenceLevel === "media" && existing.confidenceLevel !== "baixa") {
        existing.confidenceLevel = "media";
      }
      if (!existing.users.includes(classification.loginUsuario)) {
        existing.users.push(classification.loginUsuario);
      }
      for (const factor of classification.confidenceFactors ?? []) {
        if (!existing.confidenceFactors.includes(factor)) {
          existing.confidenceFactors.push(factor);
        }
      }
      for (const keyword of classification.matchedKeywords ?? []) {
        if (!existing.matchedKeywords.includes(keyword)) {
          existing.matchedKeywords.push(keyword);
        }
      }
      if (existing.category === "Nao classificado" && classification.category !== "Nao classificado") {
        existing.category = classification.category;
        existing.subcategory = classification.subcategory;
        existing.origin = classification.origin;
        existing.title = classification.tituloTask;
      }
    }

    return Array.from(grouped.values())
      .filter((group) => showAllClassifications || group.needsReview)
      .sort((a, b) => a.idTask.localeCompare(b.idTask));
  }, [result, showAllClassifications]);
  const availableWizardSteps = useMemo<ImportWizardStep[]>(() => {
    const steps: ImportWizardStep[] = ["upload"];
    if (!result) return steps;

    steps.push("preview");
    if (result.duplicates.length > 0) {
      steps.push("duplicates");
    }
    if (classificationReviewGroups.length > 0) {
      steps.push("classification");
    }
    steps.push("confirm");
    return steps;
  }, [classificationReviewGroups.length, result]);

  useEffect(() => {
    if (!isLoading) {
      setProcessingStepIndex(0);
      return undefined;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const stepsLength = importSource === "sqlserver" ? sqlServerProcessingSteps.length : importProcessingSteps.length;
      const nextIndex = Math.min(Math.floor(elapsed / 1400), stepsLength - 1);
      setProcessingStepIndex(nextIndex);
    }, 250);

    return () => window.clearInterval(interval);
  }, [importSource, isLoading]);

  function setInitialClassificationOverrides(validation: ImportValidationResponse) {
    setClassificationOverrides(
      Object.fromEntries(
        validation.classifications.map((classification) => [
          classification.line,
          {
            category: classification.category,
            subcategory: classification.subcategory,
          },
        ]),
      ),
    );
  }

  function handleSelectImportFile(selectedFile: File | null) {
    setFile(selectedFile);
    setCurrentSession(null);
    setImportWizardStep("upload");
    setResult(null);
    setDuplicateSelections({});
    setClassificationOverrides({});
    setShowAllClassifications(false);
    setProcessingMessage(null);
    setError(null);
    setSuccessMessage(null);
  }

  function handleSelectImportSource(source: "file" | "sqlserver") {
    setImportSource(source);
    setCurrentSession(null);
    setImportWizardStep("upload");
    setResult(null);
    setDuplicateSelections({});
    setClassificationOverrides({});
    setShowAllClassifications(false);
    setProcessingMessage(null);
    setError(null);
    setSuccessMessage(null);
    setSqlServerStatusMessage(null);
    setSqlServerConnectionValidated(false);
  }

  function resetSqlServerConnectionState() {
    setSqlServerStatusMessage(null);
    setSqlServerConnectionValidated(false);
  }

  function handleSqlServerProjectNameChange(value: string) {
    setSqlServerProjectName(value);
    resetSqlServerConnectionState();
  }

  function handleSqlServerIdsChange(value: string) {
    setSqlServerIds(value);
    resetSqlServerConnectionState();
  }

  function handleSqlServerIdTypeChange(value: "auto" | "epic" | "feature") {
    setSqlServerIdType(value);
    resetSqlServerConnectionState();
  }

  async function handleTestSqlServerConnection() {
    setIsTestingSqlServer(true);
    setError(null);
    setSqlServerStatusMessage(null);
    setSqlServerConnectionValidated(false);

    try {
      const response = await testSqlServerConnection();
      setSqlServerStatusMessage(response.message);
      setSqlServerConnectionValidated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setSqlServerConnectionValidated(false);
    } finally {
      setIsTestingSqlServer(false);
    }
  }

  async function handleValidate() {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setProcessingStepIndex(0);
    setProcessingMessage("Processando planilha. Isso pode levar alguns segundos em arquivos maiores.");
    setResult(null);
    setCurrentSession(null);
    setDuplicateSelections({});
    setClassificationOverrides({});
    setShowAllClassifications(false);

    try {
      const response = await createImportSession(file);
      const validation = response.validation;
      setCurrentSession(response.session);
      setResult(validation);
      setImportWizardStep("preview");
      setProcessingMessage("Sessão temporária criada. Revise os pontos encontrados antes de confirmar.");
      setInitialClassificationOverrides(validation);
      onValidationReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setProcessingMessage(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleValidateSqlServer() {
    if (!sqlServerConnectionValidated) {
      setError("Teste a conexao com o SQL Server antes de importar.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSqlServerStatusMessage(null);
    setProcessingStepIndex(0);
    setProcessingMessage("Consultando SQL Server...");
    setResult(null);
    setCurrentSession(null);
    setDuplicateSelections({});
    setClassificationOverrides({});
    setShowAllClassifications(false);

    try {
      const ids = parseSqlServerIds(sqlServerIds);
      const response = await createSqlServerImportSession({
        ids,
        idType: sqlServerIdType,
        projectName: sqlServerProjectName.trim() || undefined,
      });
      const validation = response.validation;
      setFile(null);
      setCurrentSession(response.session);
      setResult(validation);
      setImportWizardStep("preview");
      setProcessingMessage("Importacao concluida. Revise os pontos encontrados antes de confirmar.");
      setInitialClassificationOverrides(validation);
      onValidationReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setProcessingMessage(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleComplete() {
    if (!currentSession || !canCompleteImport) return;
    setIsCompleting(true);
    setError(null);
    setSuccessMessage(null);
    setProcessingMessage("Salvando importação e consolidando os lançamentos...");

    try {
      const response = await completeImportSession(
        currentSession.sessionId,
        duplicateKeepLines,
        classificationOverridePayload,
      );
      setFile(null);
      setResult(null);
      setSuccessMessage(null);
      setProcessingMessage(null);
      setCurrentSession(null);
      setDuplicateSelections({});
      setClassificationOverrides({});
      setShowAllClassifications(false);
      setImportWizardStep("upload");
      await onCompleted(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setProcessingMessage(null);
    } finally {
      setIsCompleting(false);
    }
  }

  async function handleReprocessSession() {
    if (!currentSession) return;
    setIsLoading(true);
    setError(null);
    setProcessingMessage("Reprocessando a sessão com categorias e perfis atuais...");

    try {
      const response = await reprocessImportSession(currentSession.sessionId);
      setCurrentSession(response.session);
      setResult(response.validation);
      setDuplicateSelections({});
      setInitialClassificationOverrides(response.validation);
      setProcessingMessage("Reprocessamento concluido. Revise novamente antes de confirmar.");
      setImportWizardStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setProcessingMessage(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancelSession() {
    if (!currentSession) return;
    setIsLoading(true);
    setError(null);

    try {
      await cancelImportSession(currentSession.sessionId);
      setCurrentSession(null);
      setResult(null);
      setFile(null);
      setDuplicateSelections({});
      setClassificationOverrides({});
      setProcessingMessage(null);
      setSuccessMessage("Importação temporária cancelada.");
      setImportWizardStep("upload");
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsLoading(false);
    }
  }

  return {
    importWizardStep,
    availableWizardSteps,
    setImportWizardStep,
    currentSession,
    importSource,
    setImportSource: handleSelectImportSource,
    file,
    sqlServerIds,
    setSqlServerIds: handleSqlServerIdsChange,
    sqlServerIdType,
    setSqlServerIdType: handleSqlServerIdTypeChange,
    sqlServerProjectName,
    setSqlServerProjectName: handleSqlServerProjectNameChange,
    isTestingSqlServer,
    sqlServerStatusMessage,
    sqlServerConnectionValidated,
    result,
    isLoading,
    isCompleting,
    processingMessage,
    processingStepIndex,
    error,
    setError,
    successMessage,
    showAllClassifications,
    setShowAllClassifications,
    duplicateSelections,
    setDuplicateSelections,
    classificationOverrides,
    setClassificationOverrides,
    blockingIssues,
    alertIssues,
    canCompleteImport,
    classificationReviewGroups,
    handleSelectImportFile,
    handleValidate,
    handleValidateSqlServer,
    handleTestSqlServerConnection,
    handleComplete,
    handleReprocessSession,
    handleCancelSession,
  };
}
