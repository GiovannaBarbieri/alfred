import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Check,
  CheckCircle2,
  FileText,
  Layers3,
  Lightbulb,
  ListChecks,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SetStateAction } from "react";
import type { ImportWizardStep } from "../ImportWizard";
import type { ImportValidationResponse } from "../../types";
import type { ClassificationReviewGroup } from "../../types/validation";

type ClassificationReviewPanelProps = {
  result: ImportValidationResponse;
  classificationReviewGroups: ClassificationReviewGroup[];
  showAllClassifications: boolean;
  classificationOverrides: Record<number, { category: string; subcategory: string }>;
  categoryOptions: string[];
  subcategoryOptions: string[];
  onStepChange: (step: ImportWizardStep) => void;
  onToggleShowAllClassifications: (showAll: boolean) => void;
  onClassificationOverridesChange: (
    updater: SetStateAction<Record<number, { category: string; subcategory: string }>>,
  ) => void;
};

type QuickFilter =
  | "all"
  | "smart"
  | "unclassified"
  | "conflict"
  | "accepted"
  | `category:${string}`
  | `subcategory:${string}`
  | `origin:${string}`;

type CardModel = {
  key: string;
  item: ClassificationReviewGroup;
  representativeLine: number;
  affectedLines: number[];
  users: string[];
  category: string;
  subcategory: string;
  origin: string;
  classifierVersion?: string;
  factors: string[];
  matchedKeywords: string[];
  unclassified: boolean;
  conflict: boolean;
  needsAttention: boolean;
  accepted: boolean;
};

const UNCLASSIFIED_VALUES = ["nao classificado", "não classificado", ""];
const DEFAULT_ACTIVITIES_PER_PAGE = 25;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function normalizeText(value: string | undefined | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isUnclassifiedValue(value: string | undefined | null) {
  return UNCLASSIFIED_VALUES.includes(normalizeText(value));
}

function isConflictFactor(factor: string) {
  const normalized = normalizeText(factor);
  return normalized.includes("multipl") || normalized.includes("conflit");
}

function matchesAdvancedFilter(model: CardModel, filter: QuickFilter) {
  if (filter.startsWith("category:")) {
    return normalizeText(model.category) === normalizeText(filter.replace("category:", ""));
  }
  if (filter.startsWith("subcategory:")) {
    return normalizeText(model.subcategory) === normalizeText(filter.replace("subcategory:", ""));
  }
  if (filter.startsWith("origin:")) {
    return normalizeText(model.origin) === normalizeText(filter.replace("origin:", ""));
  }
  if (filter === "accepted") {
    return model.accepted;
  }
  return true;
}

function collaboratorInitials(name: string) {
  const parts = name
    .replace(/[._-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

type SearchableSelectProps = {
  ariaLabel: string;
  disabled?: boolean;
  emptyLabel?: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  value: string;
};

function SearchableSelect({
  ariaLabel,
  disabled = false,
  emptyLabel,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Buscar...",
  value,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredOptions = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return options;
    return options.filter((option) => normalizeText(option || emptyLabel).includes(term));
  }, [emptyLabel, options, search]);

  function selectOption(option: string) {
    onChange(option);
    setOpen(false);
    setSearch("");
  }

  return (
    <div
      className={`classification-search-select ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setSearch("");
        }
      }}
    >
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? "" : "placeholder"}>{value || placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {open && !disabled && (
        <div className="classification-search-select-menu">
          <label className="classification-search-select-input">
            <Search size={15} />
            <input
              autoFocus
              placeholder={searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="classification-search-select-options" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="classification-search-select-empty">Nenhuma opção encontrada.</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  className={option === value ? "active" : ""}
                  key={option || "__empty"}
                  role="option"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <span>{option || emptyLabel || placeholder}</span>
                  {option === value && <Check size={14} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ClassificationReviewPanel({
  result,
  classificationReviewGroups,
  showAllClassifications,
  classificationOverrides,
  categoryOptions,
  subcategoryOptions,
  onStepChange,
  onToggleShowAllClassifications,
  onClassificationOverridesChange,
}: ClassificationReviewPanelProps) {
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("smart");
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [acceptedTasks, setAcceptedTasks] = useState<string[]>([]);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [detailTasks, setDetailTasks] = useState<string[]>([]);
  const [editDrafts, setEditDrafts] = useState<Record<string, { category: string; subcategory: string }>>({});
  const [taskSearch, setTaskSearch] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activitiesPerPage, setActivitiesPerPage] = useState(DEFAULT_ACTIVITIES_PER_PAGE);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [collaboratorComboboxOpen, setCollaboratorComboboxOpen] = useState(false);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const selectVisibleCheckboxRef = useRef<HTMLInputElement | null>(null);

  const classificationsByLine = useMemo(
    () => new Map(result.classifications.map((classification) => [classification.line, classification])),
    [result.classifications],
  );

  const collaboratorOptions = useMemo(
    () =>
      Array.from(new Set(classificationReviewGroups.flatMap((group) => group.users).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [classificationReviewGroups],
  );
  const filteredCollaboratorOptions = useMemo(() => {
    const search = normalizeText(collaboratorSearch);
    if (!search) return collaboratorOptions;
    return collaboratorOptions.filter((user) => normalizeText(user).includes(search));
  }, [collaboratorOptions, collaboratorSearch]);

  const cardModels = useMemo<CardModel[]>(() => {
    return classificationReviewGroups.map((item) => {
      const representativeLine =
        item.lines.find((line) => {
          const classification = classificationsByLine.get(line);
          return selectedCollaborator ? classification?.loginUsuario === selectedCollaborator : true;
        }) ?? item.lines[0];
      const representativeClassification = classificationsByLine.get(representativeLine);
      const affectedLines = selectedCollaborator
        ? item.lines.filter((line) => classificationsByLine.get(line)?.loginUsuario === selectedCollaborator)
        : item.lines;
      const selected = classificationOverrides[representativeLine] ?? {
        category: representativeClassification?.category ?? item.category,
        subcategory: representativeClassification?.subcategory ?? item.subcategory,
      };
      const factors = representativeClassification?.confidenceFactors ?? item.suggestionReasons;
      const matchedKeywords = representativeClassification?.matchedKeywords ?? item.matchedKeywords;
      const conflict = factors.some(isConflictFactor);
      const unclassified = isUnclassifiedValue(selected.category);
      const key = `${item.idTask}-${selectedCollaborator || "all"}`;
      const accepted = acceptedTasks.includes(key);

      return {
        key,
        item,
        representativeLine,
        affectedLines,
        users: selectedCollaborator ? [selectedCollaborator] : item.users,
        category: selected.category,
        subcategory: selected.subcategory,
        origin: representativeClassification?.origin ?? item.origin,
        classifierVersion: representativeClassification?.classifierVersion,
        factors,
        matchedKeywords,
        unclassified,
        conflict,
        needsAttention: !accepted && (unclassified || conflict || item.needsReview),
        accepted,
      };
    });
  }, [acceptedTasks, classificationReviewGroups, classificationsByLine, classificationOverrides, selectedCollaborator]);

  const visibleCards = useMemo(() => {
    const search = normalizeText(taskSearch);
    return cardModels.filter((model) => {
      if (selectedCollaborator && model.affectedLines.length === 0) return false;
      if (search) {
        const searchable = normalizeText(`${model.item.idTask} ${model.item.title}`);
        if (!searchable.includes(search)) return false;
      }
      if (quickFilter === "smart") return model.needsAttention;
      if (quickFilter === "unclassified") return model.unclassified;
      if (quickFilter === "conflict") return model.conflict;
      return matchesAdvancedFilter(model, quickFilter);
    });
  }, [cardModels, quickFilter, selectedCollaborator, taskSearch]);

  const totalPages = Math.max(1, Math.ceil(visibleCards.length / activitiesPerPage));
  const pageStartIndex = visibleCards.length === 0 ? 0 : (currentPage - 1) * activitiesPerPage;
  const pageEndIndex = Math.min(pageStartIndex + activitiesPerPage, visibleCards.length);
  const paginatedCards = visibleCards.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [quickFilter, selectedCollaborator, showAllClassifications, taskSearch]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const summary = useMemo(() => {
    const total = cardModels.length;
    const unclassified = cardModels.filter((model) => model.unclassified).length;
    const conflicts = cardModels.filter((model) => model.conflict).length;
    const attention = cardModels.filter((model) => model.needsAttention).length;
    const reviewed = cardModels.filter((model) => model.accepted).length;
    return { total, unclassified, conflicts, attention, reviewed };
  }, [cardModels]);

  const categoryDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    cardModels.forEach((model) => {
      counts.set(model.category || "Nao classificado", (counts.get(model.category || "Nao classificado") ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [cardModels]);

  const selectedVisibleCount = visibleCards.filter((model) => selectedTasks.includes(model.key)).length;
  const allVisibleSelected = visibleCards.length > 0 && selectedVisibleCount === visibleCards.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  const paginationPages = buildPaginationPages(currentPage, totalPages);

  useEffect(() => {
    if (selectVisibleCheckboxRef.current) {
      selectVisibleCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  function updateLines(lines: number[], category: string, subcategory: string) {
    onClassificationOverridesChange((current) => {
      const next = { ...current };
      lines.forEach((line) => {
        next[line] = { category, subcategory };
      });
      return next;
    });
  }

  function acceptSuggestion(model: CardModel) {
    updateLines(model.affectedLines, model.category, model.subcategory);
    setAcceptedTasks((current) => (current.includes(model.key) ? current : [...current, model.key]));
    setSelectedTasks((current) => current.filter((key) => key !== model.key));
    setExpandedTasks((current) => current.filter((key) => key !== model.key));
    setDetailTasks((current) => current.filter((key) => key !== model.key));
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[model.key];
      return next;
    });
    setActionNotice(`Sugestao aceita para Task ${model.item.idTask}.`);
    window.setTimeout(() => setActionNotice(""), 2600);
  }

  function undoSuggestion(model: CardModel) {
    setAcceptedTasks((current) => current.filter((key) => key !== model.key));
    setActionNotice(`Aceite desfeito para Task ${model.item.idTask}.`);
    window.setTimeout(() => setActionNotice(""), 2600);
  }

  function toggleTaskSelection(taskKey: string) {
    setSelectedTasks((current) =>
      current.includes(taskKey) ? current.filter((key) => key !== taskKey) : [...current, taskKey],
    );
  }

  function toggleTaskEdit(model: CardModel) {
    const isOpen = expandedTasks.includes(model.key);
    if (isOpen) {
      cancelTaskEdit(model.key);
      return;
    }

    setEditDrafts((current) => ({
      ...current,
      [model.key]: { category: model.category, subcategory: model.subcategory },
    }));
    setDetailTasks((current) => current.filter((key) => key !== model.key));
    setExpandedTasks((current) => [...current, model.key]);
  }

  function toggleTaskDetails(taskKey: string) {
    setExpandedTasks((current) => current.filter((key) => key !== taskKey));
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[taskKey];
      return next;
    });
    setDetailTasks((current) =>
      current.includes(taskKey) ? current.filter((key) => key !== taskKey) : [...current, taskKey],
    );
  }

  function updateTaskEditDraft(taskKey: string, field: "category" | "subcategory", value: string) {
    setEditDrafts((current) => ({
      ...current,
      [taskKey]: {
        category: current[taskKey]?.category ?? "",
        subcategory: current[taskKey]?.subcategory ?? "",
        [field]: value,
      },
    }));
  }

  function saveTaskEdit(model: CardModel) {
    const draft = editDrafts[model.key] ?? { category: model.category, subcategory: model.subcategory };
    updateLines(model.affectedLines, draft.category, draft.subcategory);
    cancelTaskEdit(model.key);
    setActionNotice(`Classificação atualizada para Task ${model.item.idTask}.`);
    window.setTimeout(() => setActionNotice(""), 2600);
  }

  function cancelTaskEdit(taskKey: string) {
    setExpandedTasks((current) => current.filter((key) => key !== taskKey));
    setEditDrafts((current) => {
      const next = { ...current };
      delete next[taskKey];
      return next;
    });
  }

  function toggleVisibleSelection() {
    const visibleKeys = visibleCards.map((model) => model.key);
    setSelectedTasks((current) => {
      if (allVisibleSelected) return current.filter((key) => !visibleKeys.includes(key));
      return Array.from(new Set([...current, ...visibleKeys]));
    });
  }

  function applyBulkChange() {
    if (selectedTasks.length === 0 || (!bulkCategory && !bulkSubcategory)) return;
    const selectedModels = cardModels.filter((model) => selectedTasks.includes(model.key));
    onClassificationOverridesChange((current) => {
      const next = { ...current };
      selectedModels.forEach((model) => {
        model.affectedLines.forEach((line) => {
          next[line] = {
            category: bulkCategory || current[line]?.category || model.category,
            subcategory: bulkSubcategory || current[line]?.subcategory || model.subcategory,
          };
        });
      });
      return next;
    });
  }

  if (result.classifications.length === 0) return null;

  const categoryCounts = new Map(categoryDistribution.map((item) => [normalizeText(item.category), item.count]));
  const categoryQuickFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = categoryOptions
    .filter((category) => !isUnclassifiedValue(category))
    .map((category) => ({
      id: `category:${category}` as QuickFilter,
      label: category,
      count: categoryCounts.get(normalizeText(category)) ?? 0,
      icon: <Tags size={15} />,
    }));

  const subcategoryCounts = new Map<string, number>();
  const originCounts = new Map<string, number>();
  cardModels.forEach((model) => {
    if (model.subcategory) {
      const key = normalizeText(model.subcategory);
      subcategoryCounts.set(key, (subcategoryCounts.get(key) ?? 0) + 1);
    }
    if (model.origin) {
      originCounts.set(model.origin, (originCounts.get(model.origin) ?? 0) + 1);
    }
  });
  const subcategoryQuickFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> =
    subcategoryOptions
      .filter(Boolean)
      .map((subcategory) => ({
        id: `subcategory:${subcategory}` as QuickFilter,
        label: subcategory,
        count: subcategoryCounts.get(normalizeText(subcategory)) ?? 0,
        icon: <Tags size={15} />,
      }));
  const originQuickFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = Array.from(
    originCounts.entries(),
  )
    .sort((a, b) => b[1] - a[1])
    .map(([origin, count]) => ({
      id: `origin:${origin}` as QuickFilter,
      label: origin,
      count,
      icon: <FileText size={15} />,
    }));
  const statusQuickFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = [
    { id: "all", label: "Todas as atividades", count: summary.total, icon: <ListChecks size={15} /> },
    { id: "accepted", label: "Revisadas", count: summary.reviewed, icon: <Check size={15} /> },
  ];
  const pendingFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = [
    { id: "smart", label: "Pendências", count: summary.attention, icon: <Sparkles size={15} /> },
    { id: "unclassified", label: "Sem categoria", count: summary.unclassified, icon: <AlertTriangle size={15} /> },
    { id: "conflict", label: "Conflitos", count: summary.conflicts, icon: <Layers3 size={15} /> },
  ];
  const hasPendingItems = summary.attention > 0;
  const hasActiveAdvancedFilter =
    quickFilter === "all" ||
    quickFilter === "accepted" ||
    quickFilter.startsWith("category:") ||
    quickFilter.startsWith("subcategory:") ||
    quickFilter.startsWith("origin:");
  const hasActiveToolbarFilter = Boolean(taskSearch || selectedCollaborator || quickFilter !== "smart");

  function selectFilter(filterId: QuickFilter) {
    if (
      filterId === "all" ||
      filterId === "accepted" ||
      filterId.startsWith("category:") ||
      filterId.startsWith("subcategory:") ||
      filterId.startsWith("origin:")
    ) {
      onToggleShowAllClassifications(true);
    }
    setQuickFilter(filterId);
  }

  function reviewAllActivities() {
    onToggleShowAllClassifications(true);
    setQuickFilter("all");
    setShowMoreFilters(true);
  }

  function clearFilters() {
    setTaskSearch("");
    setSelectedCollaborator("");
    setCollaboratorSearch("");
    setCollaboratorComboboxOpen(false);
    setShowMoreFilters(false);
    onToggleShowAllClassifications(false);
    setQuickFilter("smart");
  }

  return (
    <section className="classification-workspace">
      <div className="classification-layout">
        <div className="classification-main">
          <div className="classification-stage-header">
            <div>
              <span className="eyebrow">Fase 4 - Classificação</span>
              <h2>Fila de revisão inteligente</h2>
              <p>Revise sugestões da IA em lote, sem editar registro por registro.</p>
            </div>
            <div className="classification-stage-actions">
              <button className="ghost-button compact" type="button" onClick={() => onStepChange("preview")}>
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button className="primary-button compact" type="button" onClick={() => onStepChange("confirm")}>
                Confirmar revisão
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="classification-toolbar-card">
            <div className="classification-filter-toolbar" aria-label="Filtros da fila de revisão">
              <label className="classification-search-control">
                <Search size={16} />
                <input
                  aria-label="Pesquisar por ID ou título"
                  placeholder="Pesquisar por ID ou título..."
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                />
              </label>

              <div
                className="classification-collaborator-combobox"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setCollaboratorComboboxOpen(false);
                    setCollaboratorSearch("");
                  }
                }}
              >
                <Search size={16} />
                <input
                  aria-expanded={collaboratorComboboxOpen}
                  aria-label="Filtrar por colaborador"
                  placeholder={collaboratorComboboxOpen ? "Pesquisar colaborador..." : undefined}
                  role="combobox"
                  value={collaboratorComboboxOpen ? collaboratorSearch : selectedCollaborator || "Todos os colaboradores"}
                  onChange={(event) => {
                    setCollaboratorSearch(event.target.value);
                    setCollaboratorComboboxOpen(true);
                  }}
                  onFocus={() => {
                    setCollaboratorComboboxOpen(true);
                    setCollaboratorSearch("");
                  }}
                />
                <button
                  aria-label="Abrir lista de colaboradores"
                  type="button"
                  onClick={() => {
                    setCollaboratorComboboxOpen((current) => !current);
                    setCollaboratorSearch("");
                  }}
                >
                  <ChevronDown size={15} />
                </button>
                {collaboratorComboboxOpen && (
                  <div className="classification-combobox-menu" role="listbox">
                    <button
                      className={selectedCollaborator === "" ? "active" : ""}
                      role="option"
                      type="button"
                      onClick={() => {
                        setSelectedCollaborator("");
                        setCollaboratorComboboxOpen(false);
                        setCollaboratorSearch("");
                      }}
                    >
                      <span className="classification-collaborator-avatar">
                        <UserRound size={13} />
                      </span>
                      <span>Todos os colaboradores</span>
                    </button>
                    {filteredCollaboratorOptions.length === 0 && (
                      <div className="classification-combobox-empty">Nenhum colaborador encontrado.</div>
                    )}
                    {filteredCollaboratorOptions.map((user) => (
                      <button
                        className={selectedCollaborator === user ? "active" : ""}
                        key={user}
                        role="option"
                        type="button"
                        onClick={() => {
                          setSelectedCollaborator(user);
                          setCollaboratorComboboxOpen(false);
                          setCollaboratorSearch("");
                        }}
                      >
                        <span className="classification-collaborator-avatar">{collaboratorInitials(user)}</span>
                        <span>{user}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {pendingFilters.map((filter) => (
                <button
                  className={`classification-chip ${quickFilter === filter.id ? "active" : ""}`}
                  key={filter.id}
                  type="button"
                  onClick={() => selectFilter(filter.id)}
                >
                  {filter.icon}
                  {filter.label}
                  {typeof filter.count === "number" && <span>{filter.count}</span>}
                </button>
              ))}
              <button
                className={`classification-chip more-filter ${showMoreFilters ? "active" : ""}`}
                aria-expanded={showMoreFilters}
                type="button"
                onClick={() => setShowMoreFilters((current) => !current)}
              >
                <ChevronDown size={15} />
                {showMoreFilters ? "Menos filtros" : "Mais filtros"}
              </button>

              {hasActiveToolbarFilter && (
                <button className="classification-clear-filters" type="button" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>

            {showMoreFilters && (
              <div
                className={`classification-advanced-filters ${hasActiveAdvancedFilter ? "has-active-filter" : ""}`}
                aria-label="Filtros avançados"
              >
                <div className="classification-advanced-filter-heading">
                  <span>Filtros secundários</span>
                  <small>Refine a fila por classificação, origem ou revisão.</small>
                </div>
                {[
                  { label: "Status de revisão", filters: statusQuickFilters },
                  { label: "Categoria", filters: categoryQuickFilters },
                  { label: "Subcategoria", filters: subcategoryQuickFilters },
                  { label: "Origem", filters: originQuickFilters },
                ].map((group) => (
                  <div className="classification-advanced-filter-group" key={group.label}>
                    <span>{group.label}</span>
                    <div className="classification-chip-row">
                      {group.filters.map((filter) => (
                        <button
                          className={`classification-chip subtle ${quickFilter === filter.id ? "active" : ""}`}
                          key={filter.id}
                          type="button"
                          onClick={() => selectFilter(filter.id)}
                        >
                          {filter.icon}
                          {filter.label}
                          {typeof filter.count === "number" && <span>{filter.count}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTasks.length > 0 && (
              <div className="classification-bulk-bar active">
                <strong>{selectedTasks.length} selecionada{selectedTasks.length === 1 ? "" : "s"}</strong>
                <SearchableSelect
                  ariaLabel="Selecionar categoria em lote"
                  emptyLabel="Sem categoria em lote"
                  options={["", ...categoryOptions]}
                  placeholder="Categoria"
                  searchPlaceholder="Buscar categoria..."
                  value={bulkCategory}
                  onChange={setBulkCategory}
                />
                <SearchableSelect
                  ariaLabel="Selecionar subcategoria em lote"
                  emptyLabel="Sem subcategoria em lote"
                  options={["", ...subcategoryOptions]}
                  placeholder="Subcategoria"
                  searchPlaceholder="Buscar subcategoria..."
                  value={bulkSubcategory}
                  onChange={setBulkSubcategory}
                />
                <button className="primary-button compact" type="button" onClick={applyBulkChange}>
                  Aplicar em selecionadas
                </button>
                <button className="secondary-button compact" type="button" onClick={() => setSelectedTasks([])}>
                  Limpar
                </button>
              </div>
            )}
          </div>

          <div className="classification-card-list">
            <div className="classification-list-header">
              <label className="classification-select-visible">
                <input
                  ref={selectVisibleCheckboxRef}
                  checked={allVisibleSelected}
                  disabled={visibleCards.length === 0}
                  type="checkbox"
                  onChange={toggleVisibleSelection}
                />
                <span />
                <strong>Selecionar visíveis</strong>
              </label>
              <span>
                {selectedVisibleCount} de {visibleCards.length} atividade{visibleCards.length === 1 ? "" : "s"} visível
                {visibleCards.length === 1 ? "" : "is"} selecionada{selectedVisibleCount === 1 ? "" : "s"}
              </span>
            </div>

            <div className="classification-list-column-header" aria-hidden="true">
              <span />
              <strong>Atividade</strong>
              <strong>Categoria</strong>
              <strong>Subcategoria</strong>
              <strong>Ações</strong>
            </div>

            {visibleCards.length === 0 && (
              <div className="classification-empty-state">
                <CheckCircle2 size={24} />
                <strong>{hasPendingItems ? "Nenhuma pendência neste filtro." : "Todas as pendências foram resolvidas."}</strong>
                <span>
                  {hasPendingItems
                    ? "Altere o filtro de pendências para continuar a revisão."
                    : "Se quiser, revise também as atividades classificadas automaticamente."}
                </span>
                {!hasPendingItems && (
                  <button className="secondary-button compact" type="button" onClick={reviewAllActivities}>
                    Revisar todas as atividades
                  </button>
                )}
              </div>
            )}

            {paginatedCards.map((model) => {
              const isSelected = selectedTasks.includes(model.key);
              const pendingReasons = [
                model.unclassified ? "Sem categoria" : null,
                model.conflict ? "Conflito" : null,
                model.item.needsReview ? "Revisão necessária" : null,
              ].filter(Boolean);
              const pendingLabel = pendingReasons.length > 0 ? pendingReasons.join(" · ") : "Sugestão pronta";
              const editExpanded = expandedTasks.includes(model.key);
              const detailsExpanded = detailTasks.includes(model.key);
              const editDraft = editDrafts[model.key] ?? { category: model.category, subcategory: model.subcategory };
              const reasons = [
                ...model.factors,
                ...model.matchedKeywords.slice(0, 3).map((keyword) => `Palavra-chave: ${keyword}`),
              ].slice(0, 6);

              return (
                <article
                  className={`classification-task-row ${model.needsAttention ? "attention" : ""} ${isSelected ? "selected" : ""} ${
                    model.accepted ? "accepted" : ""
                  }`}
                  key={model.key}
                >
                  <div className="classification-row-main">
                    <label className="classification-card-check" aria-label={`Selecionar task ${model.item.idTask}`}>
                      <input
                        checked={isSelected}
                        disabled={model.accepted}
                        type="checkbox"
                        onChange={() => toggleTaskSelection(model.key)}
                      />
                      <span />
                    </label>

                    <div className="classification-row-task">
                      <span>Task {model.item.idTask}</span>
                      <strong title={model.item.title}>{model.item.title}</strong>
                    </div>

                    <div className="classification-row-value">
                      <span>Categoria</span>
                      <strong>{model.category || "Não classificado"}</strong>
                    </div>

                    <div className="classification-row-value">
                      <span>Subcategoria</span>
                      <strong>{model.subcategory || "Sem subcategoria"}</strong>
                    </div>

                    <div className="classification-row-actions">
                      {model.accepted ? (
                        <>
                          <button className="accepted-action-button compact" disabled type="button">
                            <CheckCircle2 size={14} />
                            Aceito
                          </button>
                          <button className="secondary-button compact icon-only" type="button" onClick={() => undoSuggestion(model)} title="Desfazer aceite">
                            <RotateCcw size={14} />
                          </button>
                          <button
                            aria-expanded={detailsExpanded}
                            className="secondary-button compact"
                            type="button"
                            onClick={() => toggleTaskDetails(model.key)}
                          >
                            Ver detalhes
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="primary-button compact" type="button" onClick={() => acceptSuggestion(model)}>
                            <Check size={14} />
                            Aceitar
                          </button>
                          <button
                            aria-expanded={editExpanded}
                            className="secondary-button compact"
                            type="button"
                            onClick={() => toggleTaskEdit(model)}
                          >
                            Editar classificação
                          </button>
                          <button
                            aria-expanded={detailsExpanded}
                            className="secondary-button compact"
                            type="button"
                            onClick={() => toggleTaskDetails(model.key)}
                          >
                            Ver detalhes
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className={`classification-row-details ${editExpanded ? "open" : ""}`} aria-hidden={!editExpanded}>
                    <div className="classification-row-edit-panel">
                      <label>
                        <span>Categoria</span>
                        <SearchableSelect
                          ariaLabel={`Selecionar categoria da task ${model.item.idTask}`}
                          disabled={model.accepted}
                          options={categoryOptions}
                          placeholder="Categoria"
                          searchPlaceholder="Buscar categoria..."
                          value={editDraft.category}
                          onChange={(category) => updateTaskEditDraft(model.key, "category", category)}
                        />
                      </label>
                      <label>
                        <span>Subcategoria</span>
                        <SearchableSelect
                          ariaLabel={`Selecionar subcategoria da task ${model.item.idTask}`}
                          disabled={model.accepted}
                          options={subcategoryOptions}
                          placeholder="Subcategoria"
                          searchPlaceholder="Buscar subcategoria..."
                          value={editDraft.subcategory}
                          onChange={(subcategory) => updateTaskEditDraft(model.key, "subcategory", subcategory)}
                        />
                      </label>
                      <div className="classification-row-edit-actions">
                        <button className="primary-button compact" type="button" onClick={() => saveTaskEdit(model)}>
                          Salvar
                        </button>
                        <button className="secondary-button compact" type="button" onClick={() => cancelTaskEdit(model.key)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`classification-row-details technical ${detailsExpanded ? "open" : ""}`} aria-hidden={!detailsExpanded}>
                    <div className="classification-row-detail-panel">
                      <div className="classification-meta-row">
                        <span className="classification-badge neutral detail">
                          <UserRound size={14} />
                          <small>Colaborador</small>
                          <strong>{model.users.join(", ")}</strong>
                        </span>
                        <span className="classification-badge neutral detail">
                          <MapPin size={14} />
                          <small>Linhas da planilha</small>
                          <strong>{model.affectedLines.join(", ")}</strong>
                        </span>
                        <span className="classification-badge info detail">
                          <FileText size={14} />
                          <small>Registros</small>
                          <strong>{model.affectedLines.length}</strong>
                        </span>
                        <span className="classification-badge neutral detail">
                          <Tags size={14} />
                          <small>Origem</small>
                          <strong>{model.origin}</strong>
                        </span>
                        <span className="classification-badge neutral detail">
                          <Layers3 size={14} />
                          <small>Versão</small>
                          <strong>{model.classifierVersion || "Atual"}</strong>
                        </span>
                      </div>
                      <div className="classification-reasons compact" role="note" aria-label="Motivo da classificação">
                        <strong>
                          <Lightbulb size={14} />
                          Motivo da classificação
                        </strong>
                        {reasons.length > 0 ? (
                          <ul>
                            {reasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>Nenhum motivo detalhado retornado pelo classificador.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

          </div>

          <div className="classification-review-footer">
            {visibleCards.length > 0 && (
              <div className="classification-footer-pagination" aria-label="Paginação das atividades">
                <div className="classification-pagination-summary">
                  <strong>{pageStartIndex + 1}–{pageEndIndex}</strong>
                  <span>de</span>
                  <strong>{visibleCards.length}</strong>
                  <span>atividades</span>
                </div>
                <div className="classification-pagination-controls">
                  <button
                    className="classification-page-arrow"
                    disabled={currentPage === 1}
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <div className="classification-page-numbers">
                    {paginationPages.map((page) => (
                      <button
                        className={currentPage === page ? "active" : ""}
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    className="classification-page-arrow"
                    disabled={currentPage === totalPages}
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
                <label className="classification-page-size">
                  <span>por página</span>
                  <select
                    aria-label="Atividades por página"
                    value={activitiesPerPage}
                    onChange={(event) => {
                      setActivitiesPerPage(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="classification-action-toast" role="status" aria-live="polite">
          <CheckCircle2 size={16} />
          {actionNotice}
        </div>
      )}
    </section>
  );
}

function buildPaginationPages(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}
