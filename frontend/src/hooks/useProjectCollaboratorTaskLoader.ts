import { useEffect, useState } from "react";

import { getProjectCollaboratorTasks } from "../services/api";
import type { ProjectCollaboratorTask } from "../types";
import type { TaskSortId } from "../components/reports/reportsConfig";

export function useProjectCollaboratorTaskLoader(selectedImportId: number | null) {
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  const [collaboratorTasks, setCollaboratorTasks] = useState<ProjectCollaboratorTask[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("");
  const [taskSort, setTaskSort] = useState<TaskSortId>("duration_desc");
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  function resetCollaboratorTasks() {
    setSelectedCollaborator("");
    setCollaboratorTasks([]);
    setTaskSearch("");
    setTaskCategoryFilter("");
    setTaskSort("duration_desc");
    setTasksError(null);
  }

  useEffect(() => {
    if (!selectedImportId || !selectedCollaborator) {
      setCollaboratorTasks([]);
      setTaskSearch("");
      setTaskCategoryFilter("");
      setTaskSort("duration_desc");
      setTasksError(null);
      return;
    }

    let active = true;
    setIsLoadingTasks(true);
    setTasksError(null);
    setTaskSearch("");
    setTaskCategoryFilter("");
    setTaskSort("duration_desc");

    getProjectCollaboratorTasks(selectedImportId, selectedCollaborator)
      .then((tasks) => {
        if (active) setCollaboratorTasks(tasks);
      })
      .catch((err) => {
        if (active) setTasksError(err instanceof Error ? err.message : "Erro inesperado.");
      })
      .finally(() => {
        if (active) setIsLoadingTasks(false);
      });

    return () => {
      active = false;
    };
  }, [selectedImportId, selectedCollaborator]);

  return {
    selectedCollaborator,
    collaboratorTasks,
    taskSearch,
    taskCategoryFilter,
    taskSort,
    isLoadingTasks,
    tasksError,
    setSelectedCollaborator,
    setTaskSearch,
    setTaskCategoryFilter,
    setTaskSort,
    resetCollaboratorTasks,
  };
}
