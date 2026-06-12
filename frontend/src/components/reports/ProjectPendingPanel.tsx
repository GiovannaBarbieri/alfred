import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  Filter,
  History,
  ListChecks,
  MessageSquare,
  PanelRightClose,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Tag,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { PendingStatusFilter, PendingTypeFilter } from "./reportsConfig";
import type { PendingActionItem } from "../../hooks/useProjectPendingQueue";

const visiblePendingLimit = 60;

type PriorityFilter = "all" | PendingActionItem["priority"];
type ImpactFilter = "all" | "with_hours" | "without_hours" | "high_impact";

type ProjectPendingPanelProps = {
  pendingQueue: PendingActionItem[];
  filteredPendingQueue: PendingActionItem[];
  pendingUsers: string[];
  openPendingByType: {
    unclassified: number;
    lowConfidence: number;
    zeroDuration: number;
    alerts: number;
  };
  pendingStatusSummary: {
    open: number;
    reviewed: number;
    ignored: number;
  };
  pendingImpactSummary: {
    totalHours: string;
    topHours: string;
    topRecords: number;
    openItems: number;
  };
  selectedPendingIds: string[];
  selectedPendingSummary: {
    count: number;
    hours: string;
    records: number;
  };
  pendingSearch: string;
  pendingTypeFilter: PendingTypeFilter;
  pendingStatusFilter: PendingStatusFilter;
  pendingUserFilter: string;
  pendingActionError: string | null;
  updatingAlertId: number | null;
  updatingReviewId: string | null;
  isBulkUpdatingPending: boolean;
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: PendingTypeFilter) => void;
  onUserFilterChange: (value: string) => void;
  onStatusFilterChange: (value: PendingStatusFilter) => void;
  onSelectVisible: () => void;
  onSelectItems: (itemIds: string[]) => void;
  onClearSelection: () => void;
  onToggleSelection: (itemId: string) => void;
  onBulkUpdate: (status: "revisado" | "ignorado") => void;
  onResolveAlert: (alertId: number) => void;
  onUpdateReview: (
    type: "unclassified" | "low_confidence" | "zero_duration",
    key: string,
    status: "pendente" | "revisado" | "ignorado",
  ) => void;
};

const priorityLabels: Record<PendingActionItem["priority"], string> = {
  alta: "Alta",
  media: "Media",
  baixa: "Baixa",
};

const priorityOrder: PendingActionItem["priority"][] = ["alta", "media", "baixa"];
const statusFilterLabels: Record<PendingStatusFilter, string> = {
  all: "todos os status",
  pendente: "pendentes",
  revisado: "revisadas",
  ignorado: "ignoradas",
};

function matchesImpactFilter(item: PendingActionItem, filter: ImpactFilter) {
  if (filter === "with_hours") return item.impactSeconds > 0;
  if (filter === "without_hours") return item.impactSeconds === 0;
  if (filter === "high_impact") return item.impactHours >= 1;
  return true;
}

export function ProjectPendingPanel({
  pendingQueue,
  filteredPendingQueue,
  pendingUsers,
  openPendingByType,
  pendingStatusSummary,
  pendingImpactSummary,
  selectedPendingIds,
  selectedPendingSummary,
  pendingSearch,
  pendingTypeFilter,
  pendingStatusFilter,
  pendingUserFilter,
  pendingActionError,
  updatingAlertId,
  updatingReviewId,
  isBulkUpdatingPending,
  onSearchChange,
  onTypeFilterChange,
  onUserFilterChange,
  onStatusFilterChange,
  onSelectVisible,
  onSelectItems,
  onClearSelection,
  onToggleSelection,
  onBulkUpdate,
  onResolveAlert,
  onUpdateReview,
}: ProjectPendingPanelProps) {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [activePendingId, setActivePendingId] = useState<string | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsByPending, setCommentsByPending] = useState<Record<string, string[]>>({});
  const [collapsedPriorities, setCollapsedPriorities] = useState<PendingActionItem["priority"][]>(["baixa"]);

  const operationalQueue = useMemo(
    () =>
      filteredPendingQueue.filter((item) => {
        const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
        return matchesPriority && matchesImpactFilter(item, impactFilter);
      }),
    [filteredPendingQueue, impactFilter, priorityFilter],
  );

  const visiblePendingQueue = operationalQueue.slice(0, visiblePendingLimit);
  const selectedPendingItems = useMemo(
    () => pendingQueue.filter((item) => selectedPendingIds.includes(item.id)),
    [pendingQueue, selectedPendingIds],
  );
  const activePending = useMemo(
    () => pendingQueue.find((item) => item.id === activePendingId) ?? null,
    [activePendingId, pendingQueue],
  );
  const activeFilterCount =
    (pendingTypeFilter !== "all" ? 1 : 0) +
    (pendingStatusFilter !== "all" ? 1 : 0) +
    (pendingUserFilter ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (impactFilter !== "all" ? 1 : 0);
  const hasAnyFilter = activeFilterCount > 0 || pendingSearch.trim().length > 0;

  const visibleByPriority = useMemo(
    () =>
      priorityOrder
        .map((priority) => ({
          priority,
          items: operationalQueue.filter((item) => item.priority === priority),
          total: operationalQueue.filter((item) => item.priority === priority).length,
        }))
        .filter((group) => group.total > 0),
    [operationalQueue],
  );

  const operationalInsights = useMemo(() => {
    const critical = pendingQueue.filter((item) => item.priority === "alta" && item.reviewStatus === "pendente").length;
    const impactedUsers = new Set(pendingQueue.filter((item) => item.reviewStatus === "pendente" && item.user).map((item) => item.user)).size;
    const recurring = pendingQueue.filter((item) => item.reviewStatus === "pendente" && item.impactRecords > 1).length;
    return { critical, impactedUsers, recurring };
  }, [pendingQueue]);

  const clearFilters = () => {
    onSearchChange("");
    onTypeFilterChange("all");
    onUserFilterChange("");
    onStatusFilterChange("all");
    setPriorityFilter("all");
    setImpactFilter("all");
  };

  const selectOperationalVisible = () => {
    if (priorityFilter === "all" && impactFilter === "all") {
      onSelectVisible();
      return;
    }
    onSelectItems(operationalQueue.map((item) => item.id));
  };

  const reviewPending = (item: PendingActionItem) => {
    if (item.type === "alert") {
      onResolveAlert(item.alertId);
      return;
    }
    onUpdateReview(item.type, item.reviewKey, "revisado");
  };

  const ignorePending = (item: PendingActionItem) => {
    if (item.type === "alert") return;
    onUpdateReview(item.type, item.reviewKey, "ignorado");
  };

  const exportSelected = () => {
    if (selectedPendingItems.length === 0) return;
    const header = ["titulo", "tipo", "criticidade", "usuario", "status", "horas", "registros", "detalhe"];
    const rows = selectedPendingItems.map((item) =>
      [item.title, item.typeLabel, priorityLabels[item.priority], item.user, item.reviewStatus, item.impactHours.toFixed(2), String(item.impactRecords), item.detail]
        .map((value) => `"${value.replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pendencias-selecionadas.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const addComment = () => {
    if (!activePending || !commentDraft.trim()) return;
    setCommentsByPending((current) => ({
      ...current,
      [activePending.id]: [...(current[activePending.id] ?? []), commentDraft.trim()],
    }));
    setCommentDraft("");
  };

  useEffect(() => {
    if (priorityFilter !== "all") {
      setCollapsedPriorities((current) => current.filter((priority) => priority !== priorityFilter));
      return;
    }
    setCollapsedPriorities((current) => (current.length === 0 ? ["baixa"] : current));
  }, [priorityFilter]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button")) return;
      if (event.key === "Escape") {
        setActivePendingId(null);
        setIsFilterDrawerOpen(false);
        return;
      }
      const currentIndex = activePendingId ? visiblePendingQueue.findIndex((item) => item.id === activePendingId) : -1;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.max(0, Math.min(visiblePendingQueue.length - 1, currentIndex + direction));
        setActivePendingId(visiblePendingQueue[nextIndex]?.id ?? null);
      }
      if (event.key === " " && activePending) {
        event.preventDefault();
        onToggleSelection(activePending.id);
      }
      if (event.key.toLowerCase() === "r" && activePending) reviewPending(activePending);
      if (event.key.toLowerCase() === "i" && activePending) ignorePending(activePending);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePending, activePendingId, onToggleSelection, visiblePendingQueue]);

  const togglePriorityGroup = (priority: PendingActionItem["priority"]) => {
    setCollapsedPriorities((current) =>
      current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority],
    );
  };

  return (
    <section className="panel pending-project-panel">
      <div className="pending-project-heading">
        <div>
          <h2>Pendencias do projeto</h2>
          <p className="muted">Fila operacional para revisar classificacoes, alertas e impactos do projeto.</p>
        </div>
        <strong>{operationalQueue.length} {statusFilterLabels[pendingStatusFilter]}</strong>
      </div>

      <div className="pending-project-counts">
        <span className="critical">
          <ShieldAlert size={18} />
          <strong>{pendingStatusSummary.open}</strong>
          <small>Pendentes</small>
        </span>
        <span>
          <Clock3 size={18} />
          <strong>{pendingImpactSummary.totalHours}h</strong>
          <small>Horas impactadas</small>
        </span>
        <span>
          <CheckCircle2 size={18} />
          <strong>{openPendingByType.unclassified + openPendingByType.lowConfidence}</strong>
          <small>Classificacao</small>
        </span>
        <span>
          <AlertTriangle size={18} />
          <strong>{openPendingByType.zeroDuration + openPendingByType.alerts}</strong>
          <small>Alertas operacionais</small>
        </span>
      </div>

      <div className="pending-insights-strip">
        <span><ShieldAlert size={14} /><strong>{operationalInsights.critical}</strong> criticas abertas</span>
        <span><UserRound size={14} /><strong>{operationalInsights.impactedUsers}</strong> colaboradores impactados</span>
        <span><Clock3 size={14} /><strong>{pendingImpactSummary.totalHours}h</strong> afetadas</span>
        <span><History size={14} /><strong>{operationalInsights.recurring}</strong> recorrentes</span>
      </div>

      <div className="pending-filter-bar">
        <label className="pending-search-control">
          <Search size={15} />
          <input
            aria-label="Buscar pendencia"
            placeholder="Buscar task, linha ou mensagem"
            value={pendingSearch}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        <select aria-label="Filtrar criticidade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}>
          <option value="all">Criticidade</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baixa">Baixa</option>
        </select>
        <select
          aria-label="Filtrar status"
          value={pendingStatusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as PendingStatusFilter)}
        >
          <option value="all">Status</option>
          <option value="pendente">Pendentes</option>
          <option value="revisado">Revisados</option>
          <option value="ignorado">Ignorados</option>
        </select>
        <select
          aria-label="Filtrar tipo de pendencia"
          value={pendingTypeFilter}
          onChange={(event) => onTypeFilterChange(event.target.value as PendingTypeFilter)}
        >
          <option value="all">Tipo</option>
          <option value="unclassified">Sem classificacao</option>
          <option value="low_confidence">Baixa confianca</option>
          <option value="zero_duration">Duracao zerada</option>
          <option value="alert">Alertas</option>
        </select>
        <select aria-label="Filtrar horas impactadas" value={impactFilter} onChange={(event) => setImpactFilter(event.target.value as ImpactFilter)}>
          <option value="all">Horas</option>
          <option value="with_hours">Com horas</option>
          <option value="without_hours">Sem horas</option>
          <option value="high_impact">1h ou mais</option>
        </select>
        <div className="pending-filter-menu">
          <button type="button" onClick={() => setIsFilterDrawerOpen(true)}>
            <Filter size={14} />
            Mais filtros
            {pendingUserFilter && <span>1</span>}
          </button>
        </div>
        {hasAnyFilter && (
          <button className="icon-button compact" type="button" onClick={clearFilters} aria-label="Limpar filtros">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="pending-list-context">
        <span>
          {operationalQueue.length} pendencia(s) em {statusFilterLabels[pendingStatusFilter]}
          {activeFilterCount > 0 && ` - ${activeFilterCount} filtro(s) ativo(s)`}
        </span>
        <button className="pending-subtle-action" type="button" onClick={selectOperationalVisible}>
          <ListChecks size={14} />
          Selecionar todos visiveis
        </button>
      </div>

      {selectedPendingIds.length > 0 && (
        <div className="pending-operations-toolbar">
          <span>
            <strong>{selectedPendingSummary.count}</strong> selecionada(s)
            {` - ${selectedPendingSummary.hours}h / ${selectedPendingSummary.records} registro(s)`}
          </span>
          <div>
            <button
              className="primary-button compact action-primary"
              type="button"
              onClick={() => onBulkUpdate("revisado")}
              disabled={isBulkUpdatingPending}
            >
              <Check size={14} />
              {isBulkUpdatingPending ? "Salvando..." : "Revisar"}
            </button>
            <button className="secondary-button compact" type="button" onClick={() => onBulkUpdate("ignorado")} disabled={isBulkUpdatingPending}>
              <X size={14} />
              Ignorar
            </button>
            <button className="secondary-button compact" type="button" disabled title="Criticidade calculada pela regra atual">
              <SlidersHorizontal size={14} />
              Criticidade
            </button>
            <button className="secondary-button compact" type="button" onClick={exportSelected}>
              <Download size={14} />
              Exportar
            </button>
            <button className="secondary-button compact" type="button" onClick={onClearSelection}>
              <X size={14} />
              Limpar
            </button>
          </div>
        </div>
      )}
      {pendingActionError && <p className="error-text">{pendingActionError}</p>}

      {operationalQueue.length === 0 ? (
        <div className="task-empty-state">Nenhuma pendencia encontrada com os filtros aplicados.</div>
      ) : (
        <div className="pending-action-list">
          {visibleByPriority.map((group) => (
            <div className={`pending-priority-group ${group.priority}`} key={group.priority}>
              <button
                className="pending-priority-heading"
                type="button"
                aria-expanded={!collapsedPriorities.includes(group.priority)}
                onClick={() => togglePriorityGroup(group.priority)}
              >
                <span className="pending-priority-title">
                  <span className="pending-priority-dot" aria-hidden="true" />
                  {priorityLabels[group.priority]} ({group.total})
                </span>
                <small>
                  Criticidade em {statusFilterLabels[pendingStatusFilter]}
                  <ChevronDown size={16} />
                </small>
              </button>
              {!collapsedPriorities.includes(group.priority) && (
              <div className="pending-priority-items">
                {group.items.slice(0, visiblePendingLimit).map((item) => {
                  const isSelected = selectedPendingIds.includes(item.id);

                  return (
                    <article
                      className={`pending-action-card ${item.priority} ${isSelected ? "selected" : ""} ${activePendingId === item.id ? "active" : ""}`}
                      key={item.id}
                      onClick={() => setActivePendingId(item.id)}
                      tabIndex={0}
                    >
                      <label className="pending-select-control" title="Selecionar pendencia" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar pendencia ${item.title}`}
                          checked={isSelected}
                          onChange={() => onToggleSelection(item.id)}
                        />
                      </label>
                      <div className="pending-card-content">
                        <div className="pending-card-topline">
                          <span className={`pending-chip priority ${item.priority}`}>{priorityLabels[item.priority]}</span>
                          <small className={`pending-chip type ${item.type}`}>{item.typeLabel}</small>
                          {item.user && <small className="pending-chip user">{item.user}</small>}
                          <small className={`pending-chip status ${item.reviewStatus}`}>{item.reviewStatus}</small>
                        </div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                      <div className="pending-card-impact">
                        <strong>{item.impactHours.toFixed(2)}h</strong>
                        <small>{item.impactRecords} reg.</small>
                      </div>
                      <div className="pending-review-actions" onClick={(event) => event.stopPropagation()}>
                        {item.type === "alert" ? (
                          <button
                            className="secondary-button compact"
                            type="button"
                            disabled={updatingAlertId === item.alertId}
                            onClick={() => onResolveAlert(item.alertId)}
                          >
                            {updatingAlertId === item.alertId ? "..." : "Revisar"}
                          </button>
                        ) : (
                          <>
                            {item.reviewStatus !== "revisado" && (
                              <button
                                className="secondary-button compact"
                                type="button"
                                disabled={updatingReviewId === `${item.type}-${item.reviewKey}`}
                                onClick={() => onUpdateReview(item.type, item.reviewKey, "revisado")}
                              >
                                Revisar
                              </button>
                            )}
                            {item.reviewStatus !== "ignorado" && (
                              <button
                                className="secondary-button compact"
                                type="button"
                                disabled={updatingReviewId === `${item.type}-${item.reviewKey}`}
                                onClick={() => onUpdateReview(item.type, item.reviewKey, "ignorado")}
                              >
                                Ignorar
                              </button>
                            )}
                            {item.reviewStatus !== "pendente" && (
                              <button
                                className="secondary-button compact"
                                type="button"
                                disabled={updatingReviewId === `${item.type}-${item.reviewKey}`}
                                onClick={() => onUpdateReview(item.type, item.reviewKey, "pendente")}
                              >
                                Reabrir
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
                {group.total > visiblePendingLimit && (
                  <p className="pending-list-note">
                    Mostrando {visiblePendingLimit} de {group.total} pendencias {priorityLabels[group.priority].toLowerCase()}. Refine os filtros para reduzir a lista.
                  </p>
                )}
              </div>
              )}
            </div>
          ))}
        </div>
      )}
      {isFilterDrawerOpen && (
        <div className="pending-drawer-backdrop" onClick={() => setIsFilterDrawerOpen(false)}>
          <aside className="pending-side-drawer filter" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>Filtros avancados</strong>
                <small>Refine a fila sem sair da tela</small>
              </div>
              <button type="button" onClick={() => setIsFilterDrawerOpen(false)} aria-label="Fechar filtros">
                <PanelRightClose size={18} />
              </button>
            </header>
            <div className="pending-drawer-fields">
              <label>Criticidade
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}>
                  <option value="all">Todas</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baixa">Baixa</option>
                </select>
              </label>
              <label>Status
                <select value={pendingStatusFilter} onChange={(event) => onStatusFilterChange(event.target.value as PendingStatusFilter)}>
                  <option value="all">Todos</option>
                  <option value="pendente">Pendentes</option>
                  <option value="revisado">Revisados</option>
                  <option value="ignorado">Ignorados</option>
                </select>
              </label>
              <label>Tipo
                <select value={pendingTypeFilter} onChange={(event) => onTypeFilterChange(event.target.value as PendingTypeFilter)}>
                  <option value="all">Todos</option>
                  <option value="unclassified">Sem classificacao</option>
                  <option value="low_confidence">Baixa confianca</option>
                  <option value="zero_duration">Duracao zerada</option>
                  <option value="alert">Alertas</option>
                </select>
              </label>
              <label>Horas
                <select value={impactFilter} onChange={(event) => setImpactFilter(event.target.value as ImpactFilter)}>
                  <option value="all">Todas</option>
                  <option value="with_hours">Com horas</option>
                  <option value="without_hours">Sem horas</option>
                  <option value="high_impact">1h ou mais</option>
                </select>
              </label>
              <label>Colaborador
                <select value={pendingUserFilter} onChange={(event) => onUserFilterChange(event.target.value)}>
                  <option value="">Todos</option>
                  {pendingUsers.map((user) => <option key={user} value={user}>{user}</option>)}
                </select>
              </label>
              <label>Categoria
                <input value="Todas as categorias" readOnly />
              </label>
              <label>Subcategoria
                <input value="Todas as subcategorias" readOnly />
              </label>
              <label>Periodo
                <input value="Todo o periodo importado" readOnly />
              </label>
            </div>
            <footer>
              <button className="secondary-button compact" type="button" onClick={clearFilters}>Limpar filtros</button>
              <button className="primary-button compact" type="button" onClick={() => setIsFilterDrawerOpen(false)}>Aplicar</button>
            </footer>
          </aside>
        </div>
      )}

      {activePending && (
        <div className="pending-drawer-backdrop details" onClick={() => setActivePendingId(null)}>
          <aside className="pending-side-drawer details" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className={`pending-chip priority ${activePending.priority}`}>{priorityLabels[activePending.priority]}</span>
                <strong>{activePending.title}</strong>
              </div>
              <button type="button" onClick={() => setActivePendingId(null)} aria-label="Fechar detalhes">
                <PanelRightClose size={18} />
              </button>
            </header>
            <section className="pending-detail-section">
              <p>{activePending.detail}</p>
              <div className="pending-detail-grid">
                <span><Tag size={14} />Tipo<strong>{activePending.typeLabel}</strong></span>
                <span><Clock3 size={14} />Horas<strong>{activePending.impactHours.toFixed(2)}h</strong></span>
                <span><ListChecks size={14} />Registros<strong>{activePending.impactRecords}</strong></span>
                <span><CheckCircle2 size={14} />Status<strong>{activePending.reviewStatus}</strong></span>
                <span><UserRound size={14} />Colaborador<strong>{activePending.user || "Nao informado"}</strong></span>
                <span><AlertTriangle size={14} />Linha afetada<strong>{activePending.detail.includes("Linha") ? activePending.detail.split(" - ")[0] : "Consolidada"}</strong></span>
              </div>
            </section>
            <section className="pending-detail-section">
              <h3>Acoes rapidas</h3>
              <div className="pending-detail-actions">
                <button className="primary-button compact" type="button" onClick={() => reviewPending(activePending)}>
                  <Check size={14} /> Revisar
                </button>
                {activePending.type !== "alert" && (
                  <button className="secondary-button compact" type="button" onClick={() => ignorePending(activePending)}>
                    <X size={14} /> Ignorar
                  </button>
                )}
                <button className="secondary-button compact" type="button" onClick={() => onToggleSelection(activePending.id)}>
                  <ListChecks size={14} /> {selectedPendingIds.includes(activePending.id) ? "Desmarcar" : "Selecionar"}
                </button>
              </div>
            </section>
            <section className="pending-detail-section">
              <h3>Historico</h3>
              <ol className="pending-timeline">
                <li><span />Criada a partir da importacao</li>
                <li><span />Status atual: {activePending.reviewStatus}</li>
                {(commentsByPending[activePending.id] ?? []).map((comment, index) => (
                  <li key={`${activePending.id}-comment-${index}`}><span />Comentario: {comment}</li>
                ))}
              </ol>
            </section>
            <section className="pending-detail-section">
              <h3>Comentarios internos</h3>
              <div className="pending-comment-box">
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Adicionar comentario operacional..."
                />
                <button className="secondary-button compact" type="button" onClick={addComment}>
                  <MessageSquare size={14} /> Comentar
                </button>
              </div>
            </section>
          </aside>
        </div>
      )}
    </section>
  );
}
