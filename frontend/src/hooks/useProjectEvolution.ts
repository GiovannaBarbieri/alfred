import { useEffect, useState } from "react";

import {
  buildProjectEvolutionExportUrl,
  getProjectEvolution,
  getProjectEvolutionOptions,
} from "../services/api";
import type { ProjectEvolution, ProjectEvolutionOption } from "../types";

export function useProjectEvolution() {
  const [evolutionOptions, setEvolutionOptions] = useState<ProjectEvolutionOption[]>([]);
  const [selectedEvolutionProject, setSelectedEvolutionProject] = useState("");
  const [projectEvolution, setProjectEvolution] = useState<ProjectEvolution | null>(null);
  const [isLoadingEvolution, setIsLoadingEvolution] = useState(false);
  const [evolutionError, setEvolutionError] = useState<string | null>(null);

  const evolutionExportUrl = selectedEvolutionProject ? buildProjectEvolutionExportUrl(selectedEvolutionProject) : "#";

  async function loadEvolutionOptions() {
    setEvolutionError(null);
    try {
      const options = await getProjectEvolutionOptions();
      setEvolutionOptions(options);
      if (options.length > 0) setSelectedEvolutionProject((current) => current || options[0].projectName);
    } catch (err) {
      setEvolutionError(err instanceof Error ? err.message : "Não foi possível carregar projetos com histórico.");
    }
  }

  async function loadEvolution(projectName = selectedEvolutionProject) {
    if (!projectName) {
      setEvolutionError("Selecione um projeto para analisar a evolução.");
      return;
    }
    setIsLoadingEvolution(true);
    setEvolutionError(null);
    try {
      setProjectEvolution(await getProjectEvolution(projectName));
    } catch (err) {
      setEvolutionError(err instanceof Error ? err.message : "Não foi possível carregar a evolução.");
    } finally {
      setIsLoadingEvolution(false);
    }
  }

  useEffect(() => {
    loadEvolutionOptions();
  }, []);

  return {
    evolutionOptions,
    selectedEvolutionProject,
    projectEvolution,
    isLoadingEvolution,
    evolutionError,
    evolutionExportUrl,
    setSelectedEvolutionProject,
    setProjectEvolution,
    loadEvolution,
  };
}
