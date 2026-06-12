import { useMemo } from "react";

import type { ProjectCollaboratorTask } from "../types";
import type { TaskSortId } from "../components/reports/reportsConfig";

type UseProjectCollaboratorTasksParams = {
  collaboratorTasks: ProjectCollaboratorTask[];
  taskSearch: string;
  taskCategoryFilter: string;
  taskSort: TaskSortId;
};

function formatSecondsAsDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function useProjectCollaboratorTasks({
  collaboratorTasks,
  taskSearch,
  taskCategoryFilter,
  taskSort,
}: UseProjectCollaboratorTasksParams) {
  const taskCategoryOptions = useMemo(
    () => Array.from(new Set(collaboratorTasks.map((task) => task.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [collaboratorTasks],
  );

  const filteredCollaboratorTasks = useMemo(() => {
    const search = taskSearch.trim().toLowerCase();
    return collaboratorTasks
      .filter((task) => {
        const matchesSearch =
          !search ||
          task.idTask.toLowerCase().includes(search) ||
          task.tituloTask.toLowerCase().includes(search);
        const matchesCategory = !taskCategoryFilter || task.categoria === taskCategoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (taskSort === "duration_asc") return a.totalSeconds - b.totalSeconds;
        if (taskSort === "title_asc") return a.tituloTask.localeCompare(b.tituloTask);
        if (taskSort === "category_asc") return a.categoria.localeCompare(b.categoria) || b.totalSeconds - a.totalSeconds;
        return b.totalSeconds - a.totalSeconds;
      });
  }, [collaboratorTasks, taskCategoryFilter, taskSearch, taskSort]);

  const collaboratorTasksTotal = useMemo(() => {
    const totalSeconds = filteredCollaboratorTasks.reduce((sum, task) => sum + task.totalSeconds, 0);
    return formatSecondsAsDuration(totalSeconds);
  }, [filteredCollaboratorTasks]);

  return {
    taskCategoryOptions,
    filteredCollaboratorTasks,
    collaboratorTasksTotal,
  };
}
