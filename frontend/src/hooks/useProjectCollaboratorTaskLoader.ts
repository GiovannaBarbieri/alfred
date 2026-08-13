import { useEffect, useState } from "react";

import { getProjectCollaboratorCategoryTimeline, getProjectCollaboratorTasks } from "../services/api";
import type { ProjectCollaboratorTask, ProjectTimelinePoint } from "../types";
import type { TaskSortId } from "../components/reports/reportsConfig";

export function useProjectCollaboratorTaskLoader(selectedImportId: number | null) {
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  const [collaboratorTasks, setCollaboratorTasks] = useState<ProjectCollaboratorTask[]>([]);
  const [collaboratorCategoryTimeline, setCollaboratorCategoryTimeline] = useState<ProjectTimelinePoint[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskCategoryFilter, setTaskCategoryFilter] = useState("");
  const [taskSort, setTaskSort] = useState<TaskSortId>("duration_desc");
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  function resetCollaboratorTasks() {
    setSelectedCollaborator("");
    setCollaboratorTasks([]);
    setCollaboratorCategoryTimeline([]);
    setTaskSearch("");
    setTaskCategoryFilter("");
    setTaskSort("duration_desc");
    setTasksError(null);
  }

  useEffect(() => {
    if (!selectedImportId || !selectedCollaborator) {
      setCollaboratorTasks([]);
      setCollaboratorCategoryTimeline([]);
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
        if (!active) return;
        setCollaboratorTasks(tasks);

        getProjectCollaboratorCategoryTimeline(selectedImportId, selectedCollaborator)
          .then((timeline) => {
            if (active) setCollaboratorCategoryTimeline(timeline);
          })
          .catch(() => {
            if (active) setCollaboratorCategoryTimeline([]);
          });
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
    collaboratorCategoryTimeline,
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
