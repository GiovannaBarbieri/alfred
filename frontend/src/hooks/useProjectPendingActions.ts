import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  updateProjectPendingAlert,
  updateProjectPendingReview,
} from "../services/api";
import type { PendingActionItem } from "./useProjectPendingQueue";

type ReportNotice = { tone: "success" | "error"; message: string };

type UseProjectPendingActionsParams = {
  selectedImportId: number | null;
  pendingQueue: PendingActionItem[];
  filteredPendingQueue: PendingActionItem[];
  selectedPendingItems: PendingActionItem[];
  selectedPendingIds: string[];
  setSelectedPendingIds: Dispatch<SetStateAction<string[]>>;
  onReloadProject: (importId: number) => Promise<void> | void;
  onKeepPendingTab: () => void;
  onNotice: (notice: ReportNotice) => void;
};

export function useProjectPendingActions({
  selectedImportId,
  pendingQueue,
  filteredPendingQueue,
  selectedPendingItems,
  selectedPendingIds,
  setSelectedPendingIds,
  onReloadProject,
  onKeepPendingTab,
  onNotice,
}: UseProjectPendingActionsParams) {
  const [updatingAlertId, setUpdatingAlertId] = useState<number | null>(null);
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [isBulkUpdatingPending, setIsBulkUpdatingPending] = useState(false);
  const [pendingActionError, setPendingActionError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPendingIds((current) => current.filter((id) => pendingQueue.some((item) => item.id === id)));
  }, [pendingQueue]);

  function resetPendingActions() {
    setUpdatingAlertId(null);
    setUpdatingReviewId(null);
    setSelectedPendingIds([]);
    setIsBulkUpdatingPending(false);
    setPendingActionError(null);
  }

  async function resolveAlert(alertId: number) {
    if (!selectedImportId) return;
    setUpdatingAlertId(alertId);
    setPendingActionError(null);
    try {
      await updateProjectPendingAlert(alertId, true);
      await onReloadProject(selectedImportId);
      onKeepPendingTab();
      onNotice({ tone: "success", message: "Alerta revisado. Ele saiu da fila de pendentes." });
    } catch (err) {
      setPendingActionError(err instanceof Error ? err.message : "Nao foi possivel atualizar o alerta.");
      onNotice({ tone: "error", message: "Nao foi possivel atualizar o alerta." });
    } finally {
      setUpdatingAlertId(null);
    }
  }

  async function updateReview(
    type: "unclassified" | "low_confidence" | "zero_duration",
    key: string,
    status: "pendente" | "revisado" | "ignorado",
  ) {
    if (!selectedImportId) return;
    const updatingKey = `${type}-${key}`;
    setUpdatingReviewId(updatingKey);
    setPendingActionError(null);
    try {
      await updateProjectPendingReview(selectedImportId, type, key, status);
      await onReloadProject(selectedImportId);
      onKeepPendingTab();
      const statusMessage =
        status === "revisado"
          ? "Pendencia revisada. Ela saiu da fila de pendentes."
          : status === "ignorado"
            ? "Pendencia ignorada. Ela saiu da fila de pendentes."
            : "Pendencia reaberta e voltou para a fila de pendentes.";
      onNotice({ tone: "success", message: statusMessage });
    } catch (err) {
      setPendingActionError(err instanceof Error ? err.message : "Nao foi possivel atualizar a pendencia.");
      onNotice({ tone: "error", message: "Nao foi possivel atualizar a pendencia." });
    } finally {
      setUpdatingReviewId(null);
    }
  }

  function togglePendingSelection(itemId: string) {
    setSelectedPendingIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  function selectVisiblePendingItems() {
    setSelectedPendingIds(filteredPendingQueue.map((item) => item.id));
  }

  function selectTopImpactPendingItems() {
    setSelectedPendingIds(
      pendingQueue
        .filter((item) => item.reviewStatus === "pendente")
        .sort((a, b) => b.impactSeconds - a.impactSeconds)
        .slice(0, 10)
        .map((item) => item.id),
    );
  }

  async function bulkUpdatePending(status: "revisado" | "ignorado") {
    if (!selectedImportId || selectedPendingItems.length === 0) return;
    if (status === "ignorado") {
      const confirmed = window.confirm(`Ignorar ${selectedPendingItems.length} pendencia(s) selecionada(s)?`);
      if (!confirmed) return;
    }
    if (status === "revisado" && selectedPendingItems.length > 5) {
      const confirmed = window.confirm(`Marcar ${selectedPendingItems.length} pendencia(s) como revisada(s)?`);
      if (!confirmed) return;
    }
    setIsBulkUpdatingPending(true);
    setPendingActionError(null);
    try {
      await Promise.all(
        selectedPendingItems.map((item) =>
          item.type === "alert"
            ? updateProjectPendingAlert(item.alertId, status === "revisado")
            : updateProjectPendingReview(selectedImportId, item.type, item.reviewKey, status),
        ),
      );
      setSelectedPendingIds([]);
      await onReloadProject(selectedImportId);
      onKeepPendingTab();
      onNotice({
        tone: "success",
        message: `${selectedPendingItems.length} pendencia(s) ${status === "revisado" ? "revisada(s)" : "ignorada(s)"}. A fila de pendentes foi atualizada.`,
      });
    } catch (err) {
      setPendingActionError(err instanceof Error ? err.message : "Nao foi possivel atualizar as pendencias selecionadas.");
      onNotice({ tone: "error", message: "Nao foi possivel atualizar as pendencias selecionadas." });
    } finally {
      setIsBulkUpdatingPending(false);
    }
  }

  return {
    updatingAlertId,
    updatingReviewId,
    isBulkUpdatingPending,
    pendingActionError,
    resetPendingActions,
    resolveAlert,
    updateReview,
    togglePendingSelection,
    selectVisiblePendingItems,
    selectTopImpactPendingItems,
    clearPendingSelection: () => setSelectedPendingIds([]),
    bulkUpdatePending,
  };
}
