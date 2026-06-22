import { ChevronLeft, ChevronRight, Clock3, Layers3, ListChecks, Trophy, UserRound } from "lucide-react";
import type { ProjectCollaboratorTask } from "../../types";
import type { TaskSortId } from "./reportsConfig";

type ProjectCollaboratorTasksPanelProps = {
  collaboratorOptions: string[];
  selectedCollaborator: string;
  collaboratorTasks: ProjectCollaboratorTask[];
  filteredCollaboratorTasks: ProjectCollaboratorTask[];
  paginatedCollaboratorTasks: ProjectCollaboratorTask[];
  taskCategoryOptions: string[];
  taskSearch: string;
  taskCategoryFilter: string;
  taskSort: TaskSortId;
  collaboratorTasksTotal: string;
  taskPage: number;
  totalTaskPages: number;
  taskPageSize: number;
  isLoadingTasks: boolean;
  tasksError: string | null;
  onCollaboratorChange: (value: string) => void;
  onTaskSearchChange: (value: string) => void;
  onTaskCategoryFilterChange: (value: string) => void;
  onTaskSortChange: (value: TaskSortId) => void;
  onTaskPageChange: (value: number) => void;
};

export function ProjectCollaboratorTasksPanel({
  collaboratorOptions,
  selectedCollaborator,
  collaboratorTasks,
  filteredCollaboratorTasks,
  paginatedCollaboratorTasks,
  taskCategoryOptions,
  taskSearch,
  taskCategoryFilter,
  taskSort,
  collaboratorTasksTotal,
  taskPage,
  totalTaskPages,
  taskPageSize,
  isLoadingTasks,
  tasksError,
  onCollaboratorChange,
  onTaskSearchChange,
  onTaskCategoryFilterChange,
  onTaskSortChange,
  onTaskPageChange,
}: ProjectCollaboratorTasksPanelProps) {
  const firstVisibleTask = filteredCollaboratorTasks.length === 0 ? 0 : (taskPage - 1) * taskPageSize + 1;
  const lastVisibleTask = Math.min(taskPage * taskPageSize, filteredCollaboratorTasks.length);
  const collaboratorSummary = buildCollaboratorSummary(collaboratorTasks);
  const maxFilteredTaskSeconds = Math.max(...filteredCollaboratorTasks.map((task) => task.totalSeconds), 0);
  const pageNumbers = compactPageNumbers(taskPage, totalTaskPages);

  return (
    <>
      <section className="panel collaborator-filter-panel">
        <div className="collaborator-tasks-header">
          <div>
            <h2>Detalhes por colaborador</h2>
            <p className="muted">Selecione um colaborador para ver as Tasks trabalhadas neste projeto.</p>
          </div>
          <select
            aria-label="Selecionar colaborador"
            value={selectedCollaborator}
            onChange={(event) => onCollaboratorChange(event.target.value)}
          >
            <option value="">Selecione um colaborador</option>
            {collaboratorOptions.map((collaborator) => (
              <option key={collaborator} value={collaborator}>
                {collaborator}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="panel collaborator-tasks-panel">
        <div className="collaborator-tasks-title">
          <h2>Tasks por colaborador</h2>
          <p className="muted">Lista agrupada por ID, categoria e duracao total.</p>
        </div>

        {!selectedCollaborator && (
          <div className="task-empty-state">Escolha um colaborador para carregar a lista de Tasks.</div>
        )}
        {selectedCollaborator && isLoadingTasks && (
          <div className="task-empty-state">Carregando Tasks do colaborador...</div>
        )}
        {selectedCollaborator && tasksError && (
          <div className="task-empty-state error-text">{tasksError}</div>
        )}
        {selectedCollaborator && !isLoadingTasks && !tasksError && collaboratorTasks.length === 0 && (
          <div className="task-empty-state">Nenhuma Task encontrada para este colaborador.</div>
        )}
        {selectedCollaborator && !isLoadingTasks && !tasksError && collaboratorTasks.length > 0 && (
          <>
            <section className="collaborator-summary-card" aria-label="Resumo do colaborador selecionado">
              <div className="collaborator-summary-identity">
                <span className="collaborator-avatar"><UserRound size={22} /></span>
                <div>
                  <small>Colaborador</small>
                  <strong>{selectedCollaborator}</strong>
                </div>
              </div>
              <div className="collaborator-summary-kpis">
                <span>
                  <Clock3 size={18} />
                  <strong>{collaboratorSummary.totalDuration}</strong>
                  <small>trabalhadas</small>
                </span>
                <span>
                  <ListChecks size={18} />
                  <strong>{collaboratorTasks.length}</strong>
                  <small>Tasks executadas</small>
                </span>
                <span>
                  <Trophy size={18} />
                  <strong>{collaboratorSummary.predominantCategory}</strong>
                  <small>Categoria predominante</small>
                </span>
              </div>
              <div className="collaborator-category-summary">
                <span><Layers3 size={16} /> Categorias principais</span>
                <div>
                  {collaboratorSummary.categories.map((category) => (
                    <strong key={category.name}>
                      {category.count} <span className={`report-category-chip ${categoryClassName(category.name)}`}>{category.name}</span>
                    </strong>
                  ))}
                </div>
              </div>
            </section>

            <div className="task-list-toolbar">
              <input
                aria-label="Buscar Task"
                placeholder="Buscar por ID ou titulo"
                value={taskSearch}
                onChange={(event) => onTaskSearchChange(event.target.value)}
              />
              <select
                aria-label="Filtrar por categoria"
                value={taskCategoryFilter}
                onChange={(event) => onTaskCategoryFilterChange(event.target.value)}
              >
                <option value="">Todas as categorias</option>
                {taskCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                aria-label="Ordenar Tasks"
                value={taskSort}
                onChange={(event) => onTaskSortChange(event.target.value as TaskSortId)}
              >
                <option value="duration_desc">Maior duracao</option>
                <option value="duration_asc">Menor duracao</option>
                <option value="title_asc">Titulo A-Z</option>
                <option value="category_asc">Categoria A-Z</option>
              </select>
              <span>{taskPageSize} por pagina</span>
            </div>
            {filteredCollaboratorTasks.length === 0 ? (
              <div className="task-empty-state">Nenhuma Task encontrada com os filtros aplicados.</div>
            ) : (
              <>
                <div className="task-table-wrap">
                  <table className="task-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Titulo</th>
                        <th>Categoria</th>
                        <th>Subcategoria</th>
                        <th>Duracao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCollaboratorTasks.map((task) => (
                        <tr key={`${task.idTask}-${task.categoria}-${task.subcategoria}`}>
                          <td>{task.idTask}</td>
                          <td>{task.tituloTask}</td>
                          <td>
                            <span className={`report-category-chip ${categoryClassName(task.categoria)}`}>
                              {task.categoria || "Não classificado"}
                            </span>
                          </td>
                          <td>{task.subcategoria}</td>
                          <td>
                            <div className="duration-cell">
                              <div className="duration-track" aria-hidden="true">
                                <span
                                  className="duration-bar"
                                  style={{ width: `${durationPercentage(task.totalSeconds, maxFilteredTaskSeconds)}%` }}
                                />
                              </div>
                              <span>{formatDurationShort(task.totalSeconds)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total filtrado</td>
                        <td colSpan={3}></td>
                        <td>{collaboratorTasksTotal}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="task-pagination-summary">
                  Mostrando {firstVisibleTask}-{lastVisibleTask} de {filteredCollaboratorTasks.length} registros
                </div>
                <div className="task-pagination" aria-label="Paginacao de Tasks">
                  <button
                    className="task-page-button nav"
                    type="button"
                    aria-label="Pagina anterior"
                    disabled={taskPage <= 1}
                    onClick={() => onTaskPageChange(taskPage - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {pageNumbers.map((page) => (
                    <button
                      className={page === taskPage ? "task-page-button active" : "task-page-button"}
                      type="button"
                      key={page}
                      aria-current={page === taskPage ? "page" : undefined}
                      onClick={() => onTaskPageChange(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    className="task-page-button nav"
                    type="button"
                    aria-label="Proxima pagina"
                    disabled={taskPage >= totalTaskPages}
                    onClick={() => onTaskPageChange(taskPage + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </>
  );
}

function buildCollaboratorSummary(tasks: ProjectCollaboratorTask[]) {
  const totalSeconds = tasks.reduce((sum, task) => sum + task.totalSeconds, 0);
  const categoryMap = new Map<string, { name: string; count: number; totalSeconds: number }>();

  tasks.forEach((task) => {
    const name = task.categoria || "Nao classificado";
    const current = categoryMap.get(name) ?? { name, count: 0, totalSeconds: 0 };
    current.count += 1;
    current.totalSeconds += task.totalSeconds;
    categoryMap.set(name, current);
  });

  const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds || a.name.localeCompare(b.name));
  const predominant = [...categories].sort((a, b) => b.totalSeconds - a.totalSeconds || b.count - a.count)[0];

  return {
    totalDuration: formatDurationCompact(totalSeconds),
    categories: categories.slice(0, 4),
    predominantCategory: predominant?.name ?? "Sem dados",
  };
}

function formatDurationCompact(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function formatDurationShort(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function durationPercentage(totalSeconds: number, maxSeconds: number) {
  if (maxSeconds <= 0 || totalSeconds <= 0) return 0;
  return Math.max(6, Math.min(100, (totalSeconds / maxSeconds) * 100));
}

function compactPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, 4, 5];
  if (currentPage >= totalPages - 2) return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
}

function categoryClassName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("desenvolvimento")) return "development";
  if (normalized.includes("homologacao")) return "quality";
  if (normalized.includes("definicao")) return "definition";
  if (normalized.includes("acompanhamento")) return "followup";
  if (normalized.includes("impedimento")) return "blocked";
  if (normalized.includes("retrabalho")) return "rework";
  return "neutral";
}
