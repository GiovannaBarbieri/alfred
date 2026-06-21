import { useEffect, useMemo, useState } from "react";

import {
  buildProjectComparisonExportUrl,
  createSavedProjectComparison,
  deleteSavedProjectComparison,
  getProjectComparison,
  getSavedProjectComparison,
  getSavedProjectComparisons,
} from "../services/api";
import type { ImportSummary, ProjectComparison, ProjectEvolution, SavedProjectComparisonSummary } from "../types";

type ReportNotice = { tone: "success" | "error"; message: string };

type UseProjectComparisonsParams = {
  imports: ImportSummary[];
  projectEvolution: ProjectEvolution | null;
  onNotice: (notice: ReportNotice) => void;
};

export function useProjectComparisons({ imports, projectEvolution, onNotice }: UseProjectComparisonsParams) {
  const [comparisonSelection, setComparisonSelection] = useState<number[]>([]);
  const [projectComparison, setProjectComparison] = useState<ProjectComparison | null>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [savedComparisons, setSavedComparisons] = useState<SavedProjectComparisonSummary[]>([]);
  const [saveComparisonName, setSaveComparisonName] = useState("");
  const [isLoadingSavedComparisons, setIsLoadingSavedComparisons] = useState(false);
  const [savedComparisonActionId, setSavedComparisonActionId] = useState<number | null>(null);
  const [isSavingComparison, setIsSavingComparison] = useState(false);
  const [savedComparisonError, setSavedComparisonError] = useState<string | null>(null);

  const comparisonExportUrl = comparisonSelection.length >= 2 ? buildProjectComparisonExportUrl(comparisonSelection) : "#";
  const comparisonProjectOptions = useMemo(() => imports.slice(0, 8), [imports]);

  async function loadSavedComparisons() {
    setIsLoadingSavedComparisons(true);
    setSavedComparisonError(null);
    try {
      setSavedComparisons(await getSavedProjectComparisons());
    } catch (err) {
      setSavedComparisonError(err instanceof Error ? err.message : "Não foi possível carregar os comparativos salvos.");
    } finally {
      setIsLoadingSavedComparisons(false);
    }
  }

  function toggleComparisonSelection(importId: number) {
    setComparisonSelection((current) =>
      current.includes(importId) ? current.filter((item) => item !== importId) : [...current, importId],
    );
    setComparisonError(null);
  }

  function clearComparison() {
    setComparisonSelection([]);
    setProjectComparison(null);
    setComparisonError(null);
  }

  async function compareProjects() {
    if (comparisonSelection.length < 2) {
      setComparisonError("Selecione pelo menos dois projetos para comparar.");
      return;
    }

    setIsLoadingComparison(true);
    setComparisonError(null);
    try {
      setProjectComparison(await getProjectComparison(comparisonSelection));
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Não foi possível comparar os projetos.");
    } finally {
      setIsLoadingComparison(false);
    }
  }

  async function compareEvolutionImports() {
    if (!projectEvolution || projectEvolution.points.length < 2) return;
    const first = projectEvolution.points[0];
    const latest = projectEvolution.points[projectEvolution.points.length - 1];
    const importIds = [first.importId, latest.importId];

    setComparisonSelection(importIds);
    setIsLoadingComparison(true);
    setComparisonError(null);
    try {
      setProjectComparison(await getProjectComparison(importIds));
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Não foi possível comparar as importações.");
    } finally {
      setIsLoadingComparison(false);
    }
  }

  async function saveComparison() {
    const name = saveComparisonName.trim();
    if (!name) {
      setSavedComparisonError("Informe um nome para salvar o comparativo.");
      return;
    }
    if (comparisonSelection.length < 2) {
      setSavedComparisonError("Selecione pelo menos dois projetos para salvar.");
      return;
    }

    setIsSavingComparison(true);
    setSavedComparisonError(null);
    try {
      await createSavedProjectComparison(name, comparisonSelection);
      setSaveComparisonName("");
      await loadSavedComparisons();
      onNotice({ tone: "success", message: "Comparativo salvo." });
    } catch (err) {
      setSavedComparisonError(err instanceof Error ? err.message : "Não foi possível salvar o comparativo.");
      onNotice({ tone: "error", message: "Não foi possível salvar o comparativo." });
    } finally {
      setIsSavingComparison(false);
    }
  }

  async function openSavedComparison(comparisonId: number) {
    setSavedComparisonActionId(comparisonId);
    setSavedComparisonError(null);
    try {
      const detail = await getSavedProjectComparison(comparisonId);
      setComparisonSelection(detail.importIds);
      setProjectComparison(detail.comparison);
      setSaveComparisonName(detail.name);
      onNotice({ tone: "success", message: "Comparativo aberto." });
    } catch (err) {
      setSavedComparisonError(err instanceof Error ? err.message : "Não foi possível abrir o comparativo salvo.");
      onNotice({ tone: "error", message: "Não foi possível abrir o comparativo salvo." });
    } finally {
      setSavedComparisonActionId(null);
    }
  }

  async function deleteSavedComparison(comparisonId: number) {
    const confirmed = window.confirm("Excluir este comparativo salvo?");
    if (!confirmed) return;

    setSavedComparisonActionId(comparisonId);
    setSavedComparisonError(null);
    try {
      await deleteSavedProjectComparison(comparisonId);
      await loadSavedComparisons();
      onNotice({ tone: "success", message: "Comparativo excluido." });
    } catch (err) {
      setSavedComparisonError(err instanceof Error ? err.message : "Não foi possível excluir o comparativo.");
      onNotice({ tone: "error", message: "Não foi possível excluir o comparativo." });
    } finally {
      setSavedComparisonActionId(null);
    }
  }

  useEffect(() => {
    loadSavedComparisons();
  }, []);

  useEffect(() => {
    setComparisonSelection((current) => {
      const availableIds = new Set(imports.map((item) => item.id));
      const next = current.filter((importId) => availableIds.has(importId));
      if (next.length > 0 || imports.length < 2) return next;
      return imports.slice(0, 2).map((item) => item.id);
    });
  }, [imports]);

  return {
    comparisonSelection,
    projectComparison,
    isLoadingComparison,
    comparisonError,
    savedComparisons,
    saveComparisonName,
    isLoadingSavedComparisons,
    savedComparisonActionId,
    isSavingComparison,
    savedComparisonError,
    comparisonExportUrl,
    comparisonProjectOptions,
    setSaveComparisonName,
    toggleComparisonSelection,
    clearComparison,
    compareProjects,
    compareEvolutionImports,
    saveComparison,
    openSavedComparison,
    deleteSavedComparison,
  };
}
