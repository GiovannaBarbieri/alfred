import type { ProjectCollaboratorTask } from "../../types";
import type { TaskSortId } from "./reportsConfig";

type ProjectCollaboratorTasksPanelProps = {
  collaboratorOptions: string[];
  selectedCollaborator: string;
  collaboratorTasks: ProjectCollaboratorTask[];
  filteredCollaboratorTasks: ProjectCollaboratorTask[];
  taskCategoryOptions: string[];
  taskSearch: string;
  taskCategoryFilter: string;
  taskSort: TaskSortId;
  collaboratorTasksTotal: string;
  isLoadingTasks: boolean;
  tasksError: string | null;
  onCollaboratorChange: (value: string) => void;
  onTaskSearchChange: (value: string) => void;
  onTaskCategoryFilterChange: (value: string) => void;
  onTaskSortChange: (value: TaskSortId) => void;
};

export function ProjectCollaboratorTasksPanel({
  collaboratorOptions,
  selectedCollaborator,
  collaboratorTasks,
  filteredCollaboratorTasks,
  taskCategoryOptions,
  taskSearch,
  taskCategoryFilter,
  taskSort,
  collaboratorTasksTotal,
  isLoadingTasks,
  tasksError,
  onCollaboratorChange,
  onTaskSearchChange,
  onTaskCategoryFilterChange,
  onTaskSortChange,
}: ProjectCollaboratorTasksPanelProps) {
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
          <p className="muted">Lista agrupada por IdTask, categoria e duracao total.</p>
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
            <div className="task-list-toolbar">
              <input
                aria-label="Buscar Task"
                placeholder="Buscar por IdTask ou titulo"
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
              <span>{filteredCollaboratorTasks.length} de {collaboratorTasks.length}</span>
            </div>
            {filteredCollaboratorTasks.length === 0 ? (
              <div className="task-empty-state">Nenhuma Task encontrada com os filtros aplicados.</div>
            ) : (
              <div className="task-table-wrap">
                <table className="task-table">
                  <thead>
                    <tr>
                      <th>IdTask</th>
                      <th>Titulo</th>
                      <th>Categoria</th>
                      <th>Subcategoria</th>
                      <th>Duracao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollaboratorTasks.map((task) => (
                      <tr key={`${task.idTask}-${task.categoria}-${task.subcategoria}`}>
                        <td>{task.idTask}</td>
                        <td>{task.tituloTask}</td>
                        <td>{task.categoria}</td>
                        <td>{task.subcategoria}</td>
                        <td>{task.totalDuration}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td colSpan={3}></td>
                      <td>{collaboratorTasksTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
