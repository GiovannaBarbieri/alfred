import { BarChart3, ChevronLeft, ChevronRight, Clock3, Layers3, ListChecks, Trophy, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProjectCollaboratorTask, ProjectTimelinePoint } from "../../types";
import { formatPeriodBR } from "../../utils/date";
import { ChartExportButton } from "../general-indicators/ChartExportButton";
import { projectAdjustmentColor } from "./projectChartStyles";
import type { TaskSortId } from "./reportsConfig";

type ProjectCollaboratorTasksPanelProps = {
  collaboratorOptions: string[];
  selectedCollaborator: string;
  collaboratorTasks: ProjectCollaboratorTask[];
  collaboratorCategoryTimeline: ProjectTimelinePoint[];
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
  collaboratorCategoryTimeline,
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
          <p className="muted">Lista agrupada por ID, categoria e duração total.</p>
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
            <CollaboratorCategoryTimelineChart
              collaborator={selectedCollaborator}
              data={collaboratorCategoryTimeline}
            />

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
                  <small>Horas trabalhadas</small>
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
                placeholder="Buscar por ID ou título"
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
                <option value="duration_desc">Maior duração</option>
                <option value="duration_asc">Menor duração</option>
                <option value="title_asc">Título A-Z</option>
                <option value="category_asc">Categoria A-Z</option>
              </select>
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
                        <th>TÍTULO</th>
                        <th>Categoria</th>
                        <th>Subcategoria</th>
                        <th>DURAÇÃO</th>
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
                <div className="task-pagination" aria-label="Paginação de Tasks">
                  <button
                    className="task-page-button nav"
                    type="button"
                    aria-label="Página anterior"
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
                    aria-label="Próxima página"
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

type CollaboratorChartPeriodicity = "daily" | "weekly" | "monthly";

function CollaboratorCategoryTimelineChart({
  collaborator,
  data,
}: {
  collaborator: string;
  data: ProjectTimelinePoint[];
}) {
  const [periodicity, setPeriodicity] = useState<CollaboratorChartPeriodicity>("daily");
  const categoryOptions = useMemo(() => buildCategoryTotals(data), [data]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    setSelectedCategories(categoryOptions.map((category) => category.name));
    setPeriodicity("daily");
  }, [collaborator, categoryOptions]);

  const activeCategories = selectedCategories.filter((category) => categoryOptions.some((option) => option.name === category));
  const chartData = useMemo(() => buildCollaboratorCategoryChartRows(data, activeCategories, periodicity), [activeCategories, data, periodicity]);

  function toggleCategory(category: string) {
    setSelectedCategories((current) => {
      if (current.includes(category)) {
        return current.length === 1 ? current : current.filter((item) => item !== category);
      }
      return [...current, category];
    });
  }

  return (
    <section
      className="panel collaborator-category-timeline-panel"
      data-chart-export-card="true"
      data-chart-export-period=""
      data-chart-export-title={`Evolução das Horas por Categoria - ${collaborator}`}
    >
      <div className="panel-heading timeline-chart-heading">
        <BarChart3 size={20} />
        <div>
          <h2>Evolução das Horas por Categoria</h2>
          <p className="muted">Distribuição das horas apontadas pelo colaborador ao longo do projeto.</p>
        </div>
        <div className="chart-periodicity-control" data-export-exclude>
          <span>Linha do tempo</span>
          <select value={periodicity} onChange={(event) => setPeriodicity(event.target.value as CollaboratorChartPeriodicity)}>
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
        <ChartExportButton compact />
      </div>

      {categoryOptions.length === 0 ? (
        <div className="chart-empty-state compact">Sem categorias para exibir.</div>
      ) : (
        <>
          <div className="collaborator-category-chart-options" aria-label="Categorias do colaborador" data-export-exclude>
            {categoryOptions.map((category) => (
              <label key={category.name}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category.name)}
                  onChange={() => toggleCategory(category.name)}
                />
                <i style={{ background: categoryColor(category.name) }} />
                <span>{category.name}</span>
                <strong>{category.totalHours.toFixed(2)}h</strong>
                {isDevelopmentCategory(category.name) && category.adjustmentHours > 0 && (
                  <em>Ajustes: {category.adjustmentHours.toFixed(2)}h</em>
                )}
              </label>
            ))}
          </div>

          <div className="chart-wrap project-chart-wrap collaborator-category-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 2, right: 10, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<CollaboratorCategoryTooltip />} />
                {activeCategories.length > 1 && <Legend verticalAlign="bottom" height={32} />}
                {activeCategories.map((category) => (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={category}
                    stroke={categoryColor(category)}
                    strokeWidth={2.5}
                    dot={<CollaboratorCategoryDot />}
                    activeDot={<CollaboratorCategoryDot active />}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </section>
  );
}

function CollaboratorCategoryTooltip({ active, payload }: { active?: boolean; payload?: Array<Record<string, any>> }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};
  const visiblePayload = payload.filter((item) => item.dataKey !== "__periodTotal" && Number(item.value ?? 0) > 0);

  return (
    <div className="timeline-tooltip">
      <strong>{formatPeriodBR(String(row.period ?? ""))}</strong>
      <div className="timeline-tooltip-series">
        {visiblePayload.map((item) => {
          const category = String(item.dataKey);
          const totalHours = Number(item.value ?? 0);
          const adjustmentHours = getAdjustmentHours(row, category);
          if (isDevelopmentCategory(category) && adjustmentHours > 0) {
            const regularHours = Math.max(totalHours - adjustmentHours, 0);
            return (
              <div className="timeline-tooltip-composition" key={category}>
                <span>
                  <i style={{ background: String(item.color ?? "#2563eb") }} />
                  <small>{String(item.name)}</small>
                  <b>{formatHoursDuration(totalHours)}</b>
                </span>
                <span>
                  <i style={{ background: String(item.color ?? "#2563eb") }} />
                  <small>Desenvolvimento sem ajustes</small>
                  <b>{formatHoursDuration(regularHours)}</b>
                </span>
                <span className="adjustment">
                  <i style={{ background: projectAdjustmentColor }} />
                  <small>Ajustes de testes cruzados</small>
                  <b>{formatHoursDuration(adjustmentHours)}</b>
                </span>
              </div>
            );
          }

          return (
            <span key={category}>
              <i style={{ background: String(item.color ?? "#2563eb") }} />
              <small>{String(item.name)}</small>
              <b>{formatHoursDuration(totalHours)}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CollaboratorCategoryDot(props: Record<string, any> & { active?: boolean }) {
  const cx = Number(props.cx);
  const cy = Number(props.cy);
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;

  const category = String(props.dataKey ?? "");
  const hasAdjustment = isDevelopmentCategory(category) && getAdjustmentHours(props.payload ?? {}, category) > 0;
  const radius = props.active ? (hasAdjustment ? 6 : 5) : (hasAdjustment ? 5 : 3);
  const color = hasAdjustment ? projectAdjustmentColor : "#ffffff";
  const stroke = hasAdjustment ? projectAdjustmentColor : String(props.stroke ?? "#2563eb");

  return (
    <circle
      cx={cx}
      cy={cy}
      fill={color}
      r={radius}
      stroke={stroke}
      strokeWidth={hasAdjustment ? 2.5 : 2}
    />
  );
}

function buildCategoryTotals(data: ProjectTimelinePoint[]) {
  const totals = new Map<string, { totalHours: number; adjustmentHours: number }>();
  data.forEach((point) => {
    const category = point.series ?? "Nao classificado";
    const current = totals.get(category) ?? { totalHours: 0, adjustmentHours: 0 };
    current.totalHours += Number(point.horas ?? 0);
    current.adjustmentHours += Number(point.adjustmentHours ?? 0);
    totals.set(category, current);
  });
  return Array.from(totals.entries())
    .map(([name, values]) => ({ name, ...values }))
    .filter((category) => category.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours || a.name.localeCompare(b.name));
}

function buildCollaboratorCategoryChartRows(
  data: ProjectTimelinePoint[],
  activeCategories: string[],
  periodicity: CollaboratorChartPeriodicity,
) {
  const rowsByPeriod = new Map<string, Record<string, string | number>>();
  const active = new Set(activeCategories);

  function ensurePeriodRow(period: string) {
    const current = rowsByPeriod.get(period) ?? {
      period,
      label: formatPeriodBR(period),
      __periodTotal: 0,
    };
    activeCategories.forEach((category) => {
      current[category] = Number(current[category] ?? 0);
      if (isDevelopmentCategory(category)) {
        current[adjustmentKey(category)] = Number(current[adjustmentKey(category)] ?? 0);
      }
    });
    rowsByPeriod.set(period, current);
    return current;
  }

  data.forEach((point) => {
    const category = point.series ?? "Nao classificado";
    if (!active.has(category)) return;
    const period = normalizeTimelinePeriod(point.period, periodicity);
    const current = ensurePeriodRow(period);
    const hours = Number(point.horas ?? 0);
    current[category] = Number(current[category] ?? 0) + hours;
    if (isDevelopmentCategory(category)) {
      current[adjustmentKey(category)] = Number(current[adjustmentKey(category)] ?? 0) + Number(point.adjustmentHours ?? 0);
    }
    current.__periodTotal = Number(current.__periodTotal ?? 0) + hours;
  });

  return Array.from(rowsByPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}

function adjustmentKey(category: string) {
  return `${category}AdjustmentHours`;
}

function getAdjustmentHours(row: Record<string, any>, category: string) {
  return Number(row[adjustmentKey(category)] ?? 0);
}

function isDevelopmentCategory(category: string) {
  return categoryClassName(category) === "development";
}

function formatHoursDuration(hours: number) {
  const totalMinutes = Math.round(Math.max(hours, 0) * 60);
  const fullHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${fullHours}h${String(minutes).padStart(2, "0")}` : `${fullHours}h`;
}

function normalizeTimelinePeriod(period: string, periodicity: CollaboratorChartPeriodicity) {
  if (periodicity === "monthly") return `${period.slice(0, 7)}-01`;
  if (periodicity === "weekly") return startOfWeek(period);
  return period;
}

function startOfWeek(period: string) {
  const date = new Date(`${period}T00:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function categoryColor(value: string) {
  const className = categoryClassName(value);
  const colors: Record<string, string> = {
    development: "#2563eb",
    quality: "#16a34a",
    definition: "#d97706",
    followup: "#f97316",
    blocked: "#ef4444",
    rework: "#7c3aed",
    neutral: "#64748b",
  };
  return colors[className] ?? colors.neutral;
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
