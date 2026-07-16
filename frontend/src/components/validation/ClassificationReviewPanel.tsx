import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Check,
  CheckCircle2,
  FileText,
  RotateCcw,
  Search,
  Sparkles,
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

type QuickFilter = "smart";

type CardModel = {
  key: string;
  item: ClassificationReviewGroup;
  representativeLine: number;
  affectedLines: number[];
  users: string[];
  category: string;
  subcategory: string;
  reviewReasons: string[];
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
  buttonRef?: (element: HTMLButtonElement | null) => void;
  disabled?: boolean;
  emptyLabel?: string;
  onChange: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  options: string[];
  open?: boolean;
  placeholder: string;
  searchPlaceholder?: string;
  value: string;
};

function SearchableSelect({
  ariaLabel,
  buttonRef,
  disabled = false,
  emptyLabel,
  onChange,
  onOpenChange,
  options,
  open,
  placeholder,
  searchPlaceholder = "Buscar...",
  value,
}: SearchableSelectProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const isOpen = open ?? internalOpen;
  const filteredOptions = useMemo(() => {
    const term = normalizeText(search);
    if (!term) return options;
    return options.filter((option) => normalizeText(option || emptyLabel).includes(term));
  }, [emptyLabel, options, search]);

  function setSelectOpen(nextOpen: boolean) {
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }
    setInternalOpen(nextOpen);
  }

  function selectOption(option: string) {
    onChange(option);
    setSelectOpen(false);
    setSearch("");
  }

  return (
    <div
      className={`classification-search-select ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setSelectOpen(false);
          setSearch("");
        }
      }}
    >
      <button
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        ref={buttonRef}
        type="button"
        onClick={() => setSelectOpen(!isOpen)}
      >
        <span className={value ? "" : "placeholder"}>{value || placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && !disabled && (
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
  const [actionNotice, setActionNotice] = useState("");
  const [isCompletingReview, setIsCompletingReview] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activitiesPerPage, setActivitiesPerPage] = useState(DEFAULT_ACTIVITIES_PER_PAGE);
  const [collaboratorComboboxOpen, setCollaboratorComboboxOpen] = useState(false);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [openSelectKey, setOpenSelectKey] = useState("");
  const categorySelectRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const subcategorySelectRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const acceptButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const completionStartedRef = useRef(false);
  const completionTimeoutRef = useRef<number | null>(null);
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
      const reviewReasons = item.reviewReasons;
      const conflict = factors.some(isConflictFactor) || reviewReasons.some(isConflictFactor);
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
        reviewReasons,
        unclassified,
        conflict,
        needsAttention: !accepted && (unclassified || conflict || item.needsReview),
        accepted,
      };
    });
  }, [acceptedTasks, classificationReviewGroups, classificationsByLine, classificationOverrides, selectedCollaborator]);

  const visibleCards = useMemo(() => {
    return cardModels.filter((model) => {
      if (selectedCollaborator && model.affectedLines.length === 0) return false;
      if (quickFilter === "smart") return model.needsAttention;
      return true;
    });
  }, [cardModels, quickFilter, selectedCollaborator]);

  const globalMandatoryPendingCount = useMemo(() => {
    return classificationReviewGroups.filter((item) => {
      const representativeLine = item.lines[0];
      const representativeClassification = classificationsByLine.get(representativeLine);
      const selected = classificationOverrides[representativeLine] ?? {
        category: representativeClassification?.category ?? item.category,
        subcategory: representativeClassification?.subcategory ?? item.subcategory,
      };
      const factors = representativeClassification?.confidenceFactors ?? item.suggestionReasons;
      const reviewReasons = item.reviewReasons;
      const conflict = factors.some(isConflictFactor) || reviewReasons.some(isConflictFactor);
      const unclassified = isUnclassifiedValue(selected.category);
      const accepted = acceptedTasks.includes(`${item.idTask}-all`);
      return !accepted && (unclassified || conflict || item.needsReview);
    }).length;
  }, [acceptedTasks, classificationReviewGroups, classificationsByLine, classificationOverrides]);

  const totalPages = Math.max(1, Math.ceil(visibleCards.length / activitiesPerPage));
  const pageStartIndex = visibleCards.length === 0 ? 0 : (currentPage - 1) * activitiesPerPage;
  const pageEndIndex = Math.min(pageStartIndex + activitiesPerPage, visibleCards.length);
  const paginatedCards = visibleCards.slice(pageStartIndex, pageEndIndex);
  const hasMultiplePages = totalPages > 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [quickFilter, selectedCollaborator, showAllClassifications]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const summary = useMemo(() => {
    const total = cardModels.length;
    const unclassified = cardModels.filter((model) => model.unclassified).length;
    const attention = cardModels.filter((model) => model.needsAttention).length;
    const reviewed = cardModels.filter((model) => model.accepted).length;
    return { total, unclassified, attention, reviewed };
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

  useEffect(() => {
    if (result.classifications.length > 0 && globalMandatoryPendingCount === 0) {
      startCompletionFlow();
    }
  }, [globalMandatoryPendingCount, result.classifications.length]);

  useEffect(() => {
    return () => {
      if (completionTimeoutRef.current) {
        window.clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  function startCompletionFlow() {
    if (completionStartedRef.current) return;
    completionStartedRef.current = true;
    setIsCompletingReview(true);
    setSelectedTasks([]);
    setOpenSelectKey("");
    setActionNotice("Todas as pendências foram resolvidas. Abrindo a confirmação da importação...");
    completionTimeoutRef.current = window.setTimeout(() => {
      onStepChange("confirm");
    }, 850);
  }

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
    if (isCompletingReview) return;
    updateLines(model.affectedLines, model.category, model.subcategory);
    setAcceptedTasks((current) => (current.includes(model.key) ? current : [...current, model.key]));
    setSelectedTasks((current) => current.filter((key) => key !== model.key));
    setOpenSelectKey("");
    setActionNotice(`Sugestao aceita para Task ${model.item.idTask}.`);
    window.setTimeout(() => {
      if (!completionStartedRef.current) setActionNotice("");
    }, 2600);
  }

  function undoSuggestion(model: CardModel) {
    if (isCompletingReview) return;
    setAcceptedTasks((current) => current.filter((key) => key !== model.key));
    setActionNotice(`Aceite desfeito para Task ${model.item.idTask}.`);
    window.setTimeout(() => {
      if (!completionStartedRef.current) setActionNotice("");
    }, 2600);
  }

  function toggleTaskSelection(taskKey: string) {
    if (isCompletingReview) return;
    setSelectedTasks((current) =>
      current.includes(taskKey) ? current.filter((key) => key !== taskKey) : [...current, taskKey],
    );
  }

  function toggleVisibleSelection() {
    if (isCompletingReview) return;
    const visibleKeys = visibleCards.map((model) => model.key);
    setSelectedTasks((current) => {
      if (allVisibleSelected) return current.filter((key) => !visibleKeys.includes(key));
      return Array.from(new Set([...current, ...visibleKeys]));
    });
  }

  function applyBulkChange() {
    if (isCompletingReview || selectedTasks.length === 0 || (!bulkCategory && !bulkSubcategory)) return;
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
    setSelectedTasks([]);
  }

  if (result.classifications.length === 0) return null;

  const pendingFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = [
    { id: "smart", label: "Pendências", count: summary.attention, icon: <Sparkles size={15} /> },
  ];
  const hasActiveToolbarFilter = Boolean(selectedCollaborator || quickFilter !== "smart");

  function selectFilter(filterId: QuickFilter) {
    if (isCompletingReview) return;
    setQuickFilter(filterId);
  }

  function clearFilters() {
    if (isCompletingReview) return;
    setSelectedCollaborator("");
    setCollaboratorSearch("");
    setCollaboratorComboboxOpen(false);
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
              <button className="ghost-button compact" disabled={isCompletingReview} type="button" onClick={() => onStepChange("preview")}>
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button className="primary-button compact" disabled={isCompletingReview} type="button" onClick={() => onStepChange("confirm")}>
                Confirmar revisão
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="classification-toolbar-card">
            {selectedTasks.length === 0 ? (
            <div className="classification-filter-toolbar" aria-label="Filtros da fila de revisão">
              <label className="classification-select-visible">
                <input
                  ref={selectVisibleCheckboxRef}
                  checked={allVisibleSelected}
                  disabled={visibleCards.length === 0 || isCompletingReview}
                  type="checkbox"
                  onChange={toggleVisibleSelection}
                />
                <span />
                <strong>Selecionar visíveis</strong>
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
                  disabled={isCompletingReview}
                  placeholder={collaboratorComboboxOpen ? "Pesquisar colaborador..." : undefined}
                  role="combobox"
                  value={collaboratorComboboxOpen ? collaboratorSearch : selectedCollaborator || "Todos os colaboradores"}
                  onChange={(event) => {
                    if (isCompletingReview) return;
                    setCollaboratorSearch(event.target.value);
                    setCollaboratorComboboxOpen(true);
                  }}
                  onFocus={() => {
                    if (isCompletingReview) return;
                    setCollaboratorComboboxOpen(true);
                    setCollaboratorSearch("");
                  }}
                />
                <button
                  aria-label="Abrir lista de colaboradores"
                  disabled={isCompletingReview}
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
                  disabled={isCompletingReview}
                  type="button"
                  onClick={() => selectFilter(filter.id)}
                >
                  {filter.icon}
                  {filter.label}
                  {typeof filter.count === "number" && <span>{filter.count}</span>}
                </button>
              ))}
              {hasActiveToolbarFilter && (
                <button className="classification-clear-filters" disabled={isCompletingReview} type="button" onClick={clearFilters}>
                  Limpar filtros
                </button>
              )}
            </div>
            ) : (
              <div className="classification-bulk-bar active" role="region" aria-label="Ações em massa">
                <div className="classification-bulk-controls">
                  <strong>{selectedTasks.length} atividade{selectedTasks.length === 1 ? "" : "s"} selecionada{selectedTasks.length === 1 ? "" : "s"}</strong>
                  <SearchableSelect
                    ariaLabel="Selecionar categoria em lote"
                    emptyLabel="Sem categoria em lote"
                    open={openSelectKey === "bulk:category"}
                    options={["", ...categoryOptions]}
                    placeholder="Categoria"
                    searchPlaceholder="Buscar categoria..."
                    value={bulkCategory}
                    disabled={isCompletingReview}
                    onChange={setBulkCategory}
                    onOpenChange={(open) => setOpenSelectKey(open ? "bulk:category" : "")}
                  />
                  <SearchableSelect
                    ariaLabel="Selecionar subcategoria em lote"
                    emptyLabel="Sem subcategoria em lote"
                    open={openSelectKey === "bulk:subcategory"}
                    options={["", ...subcategoryOptions]}
                    placeholder="Subcategoria"
                    searchPlaceholder="Buscar subcategoria..."
                    value={bulkSubcategory}
                    disabled={isCompletingReview}
                    onChange={setBulkSubcategory}
                    onOpenChange={(open) => setOpenSelectKey(open ? "bulk:subcategory" : "")}
                  />
                </div>
                <div className="classification-bulk-actions">
                  <button className="secondary-button compact" disabled={isCompletingReview} type="button" onClick={() => setSelectedTasks([])}>
                    Limpar seleção
                  </button>
                  <button className="primary-button compact" disabled={isCompletingReview} type="button" onClick={applyBulkChange}>
                    Aplicar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="classification-card-list">
            {visibleCards.length === 0 && (
              <div className={`classification-empty-state ${isCompletingReview || globalMandatoryPendingCount === 0 ? "completion" : ""}`} role="status" aria-live="polite">
                {isCompletingReview || globalMandatoryPendingCount === 0 ? (
                  <>
                    <span className="classification-completion-spinner" aria-hidden="true" />
                    <strong>Todas as pendências foram resolvidas.</strong>
                    <span>Abrindo a confirmação da importação...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={24} />
                    <strong>Nenhuma pendência neste filtro.</strong>
                    <span>Altere ou limpe os filtros para continuar a revisão.</span>
                    {hasActiveToolbarFilter && (
                      <button className="secondary-button compact" type="button" onClick={clearFilters}>
                        Limpar filtros
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {paginatedCards.map((model) => {
              const isSelected = selectedTasks.includes(model.key);
              const categorySelectKey = `${model.key}:category`;
              const subcategorySelectKey = `${model.key}:subcategory`;
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
                        disabled={model.accepted || isCompletingReview}
                        type="checkbox"
                        onChange={() => toggleTaskSelection(model.key)}
                      />
                      <span />
                    </label>

                    <div className="classification-row-task">
                      <span className="classification-task-id">#{model.item.idTask}</span>
                      <strong title={model.item.title}>{model.item.title}</strong>
                      <div className="classification-row-meta-inline">
                        <span title={model.users.join(", ")}>
                          <UserRound size={13} />
                          {model.users.join(", ")}
                        </span>
                        <span>
                          <FileText size={13} />
                          {model.affectedLines.length} registro{model.affectedLines.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>

                    <div className="classification-row-value">
                      <SearchableSelect
                        ariaLabel={`Selecionar categoria da task ${model.item.idTask}`}
                        buttonRef={(element) => {
                          categorySelectRefs.current[model.key] = element;
                        }}
                        disabled={model.accepted || isCompletingReview}
                        open={openSelectKey === categorySelectKey}
                        options={categoryOptions}
                        placeholder="Categoria"
                        searchPlaceholder="Buscar categoria..."
                        value={model.category}
                        onChange={(category) => {
                          updateLines(model.affectedLines, category, model.subcategory);
                          window.setTimeout(() => subcategorySelectRefs.current[model.key]?.focus(), 0);
                        }}
                        onOpenChange={(open) => setOpenSelectKey(open ? categorySelectKey : "")}
                      />
                    </div>

                    <div className="classification-row-value">
                      <SearchableSelect
                        ariaLabel={`Selecionar subcategoria da task ${model.item.idTask}`}
                        buttonRef={(element) => {
                          subcategorySelectRefs.current[model.key] = element;
                        }}
                        disabled={model.accepted || isCompletingReview}
                        open={openSelectKey === subcategorySelectKey}
                        options={subcategoryOptions}
                        placeholder="Subcategoria"
                        searchPlaceholder="Buscar subcategoria..."
                        value={model.subcategory}
                        onChange={(subcategory) => {
                          updateLines(model.affectedLines, model.category, subcategory);
                          window.setTimeout(() => acceptButtonRefs.current[model.key]?.focus(), 0);
                        }}
                        onOpenChange={(open) => setOpenSelectKey(open ? subcategorySelectKey : "")}
                      />
                    </div>

                    <div className="classification-row-actions">
                      {model.accepted ? (
                        <>
                          <button className="accepted-action-button compact" disabled type="button">
                            <CheckCircle2 size={14} />
                            Aceito
                          </button>
                          <button className="secondary-button compact icon-only" disabled={isCompletingReview} type="button" onClick={() => undoSuggestion(model)} title="Desfazer aceite">
                            <RotateCcw size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="primary-button compact"
                            ref={(element) => {
                              acceptButtonRefs.current[model.key] = element;
                            }}
                            disabled={isCompletingReview}
                            type="button"
                            onClick={() => acceptSuggestion(model)}
                          >
                            <Check size={14} />
                            Aceitar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

          </div>

          <div className="classification-review-footer">
            {visibleCards.length > 0 && (
              <div className={`classification-footer-pagination ${hasMultiplePages ? "" : "single-page"}`} aria-label="Paginação das atividades">
                <div className="classification-pagination-summary">
                  <strong>{pageStartIndex + 1}–{pageEndIndex}</strong>
                  <span>de</span>
                  <strong>{visibleCards.length}</strong>
                  <span>atividades</span>
                </div>
                {hasMultiplePages && (
                  <>
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
                  </>
                )}
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
