import { useMemo } from "react";

import type { ProjectPendingItems } from "../types";
import type { PendingStatusFilter, PendingTypeFilter } from "../components/reports/reportsConfig";

type PendingReviewStatus = "pendente" | "revisado" | "ignorado";
type PendingPriority = "alta" | "media" | "baixa";

type PendingBaseItem = {
  id: string;
  typeLabel: string;
  priority: PendingPriority;
  title: string;
  user: string;
  detail: string;
  action: string;
  impactSeconds: number;
  impactHours: number;
  impactRecords: number;
  reviewKey: string;
};

export type PendingActionItem =
  | (PendingBaseItem & {
      type: "alert";
      alertId: number;
      reviewStatus: "pendente";
    })
  | (PendingBaseItem & {
      type: "unclassified" | "low_confidence" | "zero_duration";
      reviewStatus: PendingReviewStatus;
    });

type UseProjectPendingQueueParams = {
  projectPendingItems: ProjectPendingItems;
  pendingSearch: string;
  pendingTypeFilter: PendingTypeFilter;
  pendingStatusFilter: PendingStatusFilter;
  pendingUserFilter: string;
  selectedPendingIds: string[];
};

const alertTitleByCode: Record<string, string> = {
  duration_zero: "Duracao zerada",
  title_multiple_categories: "Titulo sugere mais de uma categoria",
  title_outside_pattern: "Titulo fora do padrao",
  missing_technical_profile: "Colaborador sem perfil operacional",
  conflicting_category: "Categoria possivelmente conflitante",
  missing_project_link: "Vinculo do projeto incompleto",
};

function friendlyAlertTitle(code: string): string {
  return alertTitleByCode[code] ?? code.replace(/_/g, " ");
}

export function useProjectPendingQueue({
  projectPendingItems,
  pendingSearch,
  pendingTypeFilter,
  pendingStatusFilter,
  pendingUserFilter,
  selectedPendingIds,
}: UseProjectPendingQueueParams) {
  const pendingQueue = useMemo(() => {
    const unclassified = projectPendingItems.unclassifiedTasks.map((item) => ({
      id: `unclassified-${item.idTask}-${item.loginUsuario}`,
      type: "unclassified" as const,
      typeLabel: "Sem classificacao",
      priority: "alta" as const,
      title: `${item.idTask} - ${item.tituloTask}`,
      user: item.loginUsuario,
      detail: `${item.totalDuration} - ${item.totalRecords} lanc.`,
      action: "Classificar categoria e subcategoria da Task.",
      impactSeconds: item.impactSeconds,
      impactHours: item.impactHours,
      impactRecords: item.impactRecords,
      reviewKey: item.reviewKey,
      reviewStatus: item.reviewStatus,
    }));
    const lowConfidence = projectPendingItems.lowConfidence.map((item) => ({
      id: `confidence-${item.idTask}-${item.loginUsuario}-${item.confidence}`,
      type: "low_confidence" as const,
      typeLabel: "Baixa confianca",
      priority: "media" as const,
      title: `${item.idTask} - ${item.tituloTask}`,
      user: item.loginUsuario,
      detail: `${item.categoria} - ${(item.confidence * 100).toFixed(0)}% - ${item.impactDuration}`,
      action: "Revisar se a classificacao sugerida faz sentido.",
      impactSeconds: item.impactSeconds,
      impactHours: item.impactHours,
      impactRecords: item.impactRecords,
      reviewKey: item.reviewKey,
      reviewStatus: item.reviewStatus,
    }));
    const zeroDuration = projectPendingItems.zeroDuration.map((item) => ({
      id: `zero-${item.idLancamento}`,
      type: "zero_duration" as const,
      typeLabel: "Duracao zerada",
      priority: "media" as const,
      title: `${item.idTask} - ${item.tituloTask}`,
      user: item.loginUsuario,
      detail: `Lancamento ${item.idLancamento}`,
      action: "Verificar se a duracao zero foi intencional.",
      impactSeconds: item.impactSeconds,
      impactHours: item.impactHours,
      impactRecords: item.impactRecords,
      reviewKey: item.reviewKey,
      reviewStatus: item.reviewStatus,
    }));
    const alerts = projectPendingItems.alerts.map((item) => ({
      id: `alert-${item.id}`,
      alertId: item.id,
      type: "alert" as const,
      typeLabel: "Alerta operacional",
      priority: "baixa" as const,
      title: friendlyAlertTitle(item.code),
      user: "",
      detail: `${item.line ? `Linha ${item.line} - ` : ""}${item.message}`,
      action: "Revisar mensagem e decidir se exige correcao.",
      impactSeconds: item.impactSeconds,
      impactHours: item.impactHours,
      impactRecords: item.impactRecords,
      reviewKey: String(item.id),
      reviewStatus: "pendente" as const,
    }));
    return [...unclassified, ...lowConfidence, ...zeroDuration, ...alerts].sort((a, b) => {
      const priorityOrder = { alta: 0, media: 1, baixa: 2 };
      const statusOrder = { pendente: 0, revisado: 1, ignorado: 2 };
      return (
        statusOrder[a.reviewStatus] - statusOrder[b.reviewStatus] ||
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        b.impactSeconds - a.impactSeconds ||
        a.typeLabel.localeCompare(b.typeLabel)
      );
    });
  }, [projectPendingItems]);

  const pendingUsers = useMemo(
    () => Array.from(new Set(pendingQueue.map((item) => item.user).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [pendingQueue],
  );

  const pendingStatusSummary = useMemo(
    () =>
      pendingQueue.reduce(
        (summary, item) => {
          if (item.reviewStatus === "pendente") summary.open += 1;
          if (item.reviewStatus === "revisado") summary.reviewed += 1;
          if (item.reviewStatus === "ignorado") summary.ignored += 1;
          return summary;
        },
        { open: 0, reviewed: 0, ignored: 0 },
      ),
    [pendingQueue],
  );

  const openPendingByType = useMemo(
    () => ({
      unclassified: pendingQueue.filter((item) => item.type === "unclassified" && item.reviewStatus === "pendente").length,
      lowConfidence: pendingQueue.filter((item) => item.type === "low_confidence" && item.reviewStatus === "pendente").length,
      zeroDuration: pendingQueue.filter((item) => item.type === "zero_duration" && item.reviewStatus === "pendente").length,
      alerts: pendingQueue.filter((item) => item.type === "alert" && item.reviewStatus === "pendente").length,
    }),
    [pendingQueue],
  );

  const filteredPendingQueue = useMemo(() => {
    const search = pendingSearch.trim().toLowerCase();
    return pendingQueue.filter((item) => {
      const matchesType = pendingTypeFilter === "all" || item.type === pendingTypeFilter;
      const matchesStatus = pendingStatusFilter === "all" || item.reviewStatus === pendingStatusFilter;
      const matchesUser = !pendingUserFilter || item.user === pendingUserFilter;
      const matchesSearch =
        !search ||
        item.title.toLowerCase().includes(search) ||
        item.detail.toLowerCase().includes(search) ||
        item.action.toLowerCase().includes(search);
      return matchesType && matchesStatus && matchesUser && matchesSearch;
    });
  }, [pendingQueue, pendingSearch, pendingStatusFilter, pendingTypeFilter, pendingUserFilter]);

  const openPendingPreview = useMemo(
    () => pendingQueue.filter((item) => item.reviewStatus === "pendente").slice(0, 20),
    [pendingQueue],
  );

  const pendingImpactSummary = useMemo(() => {
    const openItems = pendingQueue.filter((item) => item.reviewStatus === "pendente");
    const totalSeconds = openItems.reduce((sum, item) => sum + item.impactSeconds, 0);
    const topItems = [...openItems].sort((a, b) => b.impactSeconds - a.impactSeconds).slice(0, 10);
    const topSeconds = topItems.reduce((sum, item) => sum + item.impactSeconds, 0);
    return {
      openItems: openItems.length,
      totalHours: (totalSeconds / 3600).toFixed(2),
      topHours: (topSeconds / 3600).toFixed(2),
      topRecords: topItems.reduce((sum, item) => sum + item.impactRecords, 0),
    };
  }, [pendingQueue]);

  const selectedPendingItems = useMemo(
    () => pendingQueue.filter((item) => selectedPendingIds.includes(item.id)),
    [pendingQueue, selectedPendingIds],
  );

  const selectedPendingSummary = useMemo(() => {
    const totalSeconds = selectedPendingItems.reduce((sum, item) => sum + item.impactSeconds, 0);
    return {
      count: selectedPendingItems.length,
      hours: (totalSeconds / 3600).toFixed(2),
      records: selectedPendingItems.reduce((sum, item) => sum + item.impactRecords, 0),
    };
  }, [selectedPendingItems]);

  return {
    pendingQueue,
    pendingUsers,
    pendingStatusSummary,
    openPendingByType,
    filteredPendingQueue,
    openPendingPreview,
    pendingImpactSummary,
    selectedPendingItems,
    selectedPendingSummary,
  };
}
