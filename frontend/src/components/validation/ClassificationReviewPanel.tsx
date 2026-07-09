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
  ShieldAlert,
  Sparkles,
  Tags,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  | "low"
  | "unclassified"
  | "conflict"
  | `category:${string}`;

type CardModel = {
  key: string;
  item: ClassificationReviewGroup;
  representativeLine: number;
  affectedLines: number[];
  users: string[];
  category: string;
  subcategory: string;
  origin: string;
  confidence: number;
  confidenceLevel: string;
  classifierVersion?: string;
  factors: string[];
  matchedKeywords: string[];
  lowConfidence: boolean;
  unclassified: boolean;
  conflict: boolean;
  needsAttention: boolean;
};

const REVIEW_CONFIDENCE_THRESHOLD = 0.9;
const UNCLASSIFIED_VALUES = ["nao classificado", "não classificado", ""];
const ACTIVITIES_PER_PAGE = 20;

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

function confidenceTone(confidence: number) {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

function matchesCategoryFilter(category: string, filter: QuickFilter) {
  if (filter.startsWith("category:")) {
    return normalizeText(category) === normalizeText(filter.replace("category:", ""));
  }
  return true;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [collaboratorComboboxOpen, setCollaboratorComboboxOpen] = useState(false);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");

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
      const factors = representativeClassification?.confidenceFactors ?? item.confidenceFactors;
      const matchedKeywords = representativeClassification?.matchedKeywords ?? item.matchedKeywords;
      const confidence = representativeClassification?.confidence ?? item.confidence;
      const conflict = factors.some(isConflictFactor);
      const unclassified = isUnclassifiedValue(selected.category);
      const lowConfidence = confidence < REVIEW_CONFIDENCE_THRESHOLD;
      const key = `${item.idTask}-${selectedCollaborator || "all"}`;

      return {
        key,
        item,
        representativeLine,
        affectedLines,
        users: selectedCollaborator ? [selectedCollaborator] : item.users,
        category: selected.category,
        subcategory: selected.subcategory,
        origin: representativeClassification?.origin ?? item.origin,
        confidence,
        confidenceLevel: representativeClassification?.confidenceLevel ?? item.confidenceLevel,
        classifierVersion: representativeClassification?.classifierVersion,
        factors,
        matchedKeywords,
        lowConfidence,
        unclassified,
        conflict,
        needsAttention: !acceptedTasks.includes(key) && (lowConfidence || unclassified || conflict || item.needsReview),
      };
    });
  }, [acceptedTasks, classificationReviewGroups, classificationsByLine, classificationOverrides, selectedCollaborator]);

  const visibleCards = useMemo(() => {
    return cardModels.filter((model) => {
      if (selectedCollaborator && model.affectedLines.length === 0) return false;
      if (quickFilter === "smart") return model.needsAttention;
      if (quickFilter === "low") return model.lowConfidence;
      if (quickFilter === "unclassified") return model.unclassified;
      if (quickFilter === "conflict") return model.conflict;
      return matchesCategoryFilter(model.category, quickFilter);
    });
  }, [cardModels, quickFilter, selectedCollaborator]);

  const totalPages = Math.max(1, Math.ceil(visibleCards.length / ACTIVITIES_PER_PAGE));
  const pageStartIndex = visibleCards.length === 0 ? 0 : (currentPage - 1) * ACTIVITIES_PER_PAGE;
  const pageEndIndex = Math.min(pageStartIndex + ACTIVITIES_PER_PAGE, visibleCards.length);
  const paginatedCards = visibleCards.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [quickFilter, selectedCollaborator, showAllClassifications]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const summary = useMemo(() => {
    const total = cardModels.length;
    const lowConfidence = cardModels.filter((model) => model.lowConfidence).length;
    const unclassified = cardModels.filter((model) => model.unclassified).length;
    const conflicts = cardModels.filter((model) => model.conflict).length;
    const attention = cardModels.filter((model) => model.needsAttention).length;
    return { total, lowConfidence, unclassified, conflicts, attention };
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
  const paginationPages = buildPaginationPages(currentPage, totalPages);

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
    setActionNotice(`Sugestao aceita para Task ${model.item.idTask}.`);
    window.setTimeout(() => setActionNotice(""), 2600);
  }

  function toggleTaskSelection(taskKey: string) {
    setSelectedTasks((current) =>
      current.includes(taskKey) ? current.filter((key) => key !== taskKey) : [...current, taskKey],
    );
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

  const pendingFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = [
    { id: "smart", label: "Pendências", count: summary.attention, icon: <Sparkles size={15} /> },
    { id: "low", label: "Baixa confiança", count: summary.lowConfidence, icon: <ShieldAlert size={15} /> },
    { id: "unclassified", label: "Sem categoria", count: summary.unclassified, icon: <AlertTriangle size={15} /> },
    { id: "conflict", label: "Conflitos", count: summary.conflicts, icon: <Layers3 size={15} /> },
  ];
  const advancedFilters: Array<{ id: QuickFilter; label: string; count?: number; icon: JSX.Element }> = [
    { id: "all", label: "Todas as atividades", count: summary.total, icon: <ListChecks size={15} /> },
    ...categoryQuickFilters,
  ];
  const pendingOnly = !showAllClassifications;
  const hasPendingItems = summary.attention > 0;

  function selectFilter(filterId: QuickFilter) {
    if (filterId === "all" || filterId.startsWith("category:")) {
      onToggleShowAllClassifications(true);
    }
    setQuickFilter(filterId);
  }

  function togglePendingOnly(checked: boolean) {
    onToggleShowAllClassifications(!checked);
    setQuickFilter(checked ? "smart" : "all");
  }

  function reviewAllActivities() {
    onToggleShowAllClassifications(true);
    setQuickFilter("all");
    setShowMoreFilters(true);
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
            <div className="classification-filter-heading">
              <div>
                <span className="eyebrow">Fila de revisão</span>
                <strong>{visibleCards.length} atividade{visibleCards.length === 1 ? "" : "s"} precisam da sua revisão</strong>
                <p>Revise apenas os itens destacados para concluir a importação.</p>
              </div>
              <label className="modern-toggle classification-pending-toggle">
                <input
                  checked={pendingOnly}
                  type="checkbox"
                  onChange={(event) => togglePendingOnly(event.target.checked)}
                />
                Mostrar somente pendências
              </label>
            </div>

            <div className="classification-review-summary" aria-label="Resumo da fila de revisão">
              <span className="warning"><strong>{summary.attention}</strong> Pendências</span>
              <span className={summary.conflicts > 0 ? "danger" : "neutral"}><strong>{summary.conflicts}</strong> Conflitos</span>
              <span className={summary.unclassified > 0 ? "warning" : "neutral"}><strong>{summary.unclassified}</strong> Sem categoria</span>
              <span className={summary.lowConfidence > 0 ? "warning" : "neutral"}><strong>{summary.lowConfidence}</strong> Baixa confiança</span>
            </div>

            <div className="classification-filter-row">
              <div
                className="classification-collaborator-combobox"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setCollaboratorComboboxOpen(false);
                    setCollaboratorSearch("");
                  }
                }}
              >
                <UserRound size={16} />
                <input
                  aria-expanded={collaboratorComboboxOpen}
                  aria-label="Filtrar por colaborador"
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
                        <span>{user}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="classification-filter-group-title">Pendências</div>
            <div className="classification-chip-row" aria-label="Filtros rapidos">
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
            </div>

            {showMoreFilters && (
              <div className="classification-advanced-filters" aria-label="Filtros avançados">
                <span>Categorias e demais classificações</span>
                <div className="classification-chip-row">
                  {advancedFilters.map((filter) => (
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
            )}

            {selectedTasks.length > 0 && (
              <div className="classification-bulk-bar active">
                <button className="link-action" type="button" onClick={toggleVisibleSelection}>
                  {allVisibleSelected ? "Desmarcar visiveis" : "Selecionar todas visiveis"}
                </button>
                <strong>{selectedTasks.length} selecionada{selectedTasks.length === 1 ? "" : "s"}</strong>
                <select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}>
                  <option value="">Categoria</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select value={bulkSubcategory} onChange={(event) => setBulkSubcategory(event.target.value)}>
                  <option value="">Subcategoria</option>
                  {subcategoryOptions.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>
                      {subcategory}
                    </option>
                  ))}
                </select>
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
              const tone = confidenceTone(model.confidence);
              const isSelected = selectedTasks.includes(model.key);
              const pendingReasons = [
                model.unclassified ? "Sem categoria" : null,
                model.lowConfidence ? "Baixa confiança" : null,
                model.conflict ? "Conflito" : null,
                model.item.needsReview ? "Revisão necessária" : null,
              ].filter(Boolean);
              const pendingLabel = pendingReasons.length > 0 ? pendingReasons.join(" · ") : "Sugestão pronta";
              const reasons = [
                ...model.factors,
                ...model.matchedKeywords.slice(0, 3).map((keyword) => `Palavra-chave: ${keyword}`),
              ].slice(0, 6);

              return (
                <article
                  className={`classification-task-card ${tone} ${isSelected ? "selected" : ""}`}
                  key={model.key}
                >
                  <label className="classification-card-check" aria-label={`Selecionar task ${model.item.idTask}`}>
                    <input
                      checked={isSelected}
                      type="checkbox"
                      onChange={() => toggleTaskSelection(model.key)}
                    />
                    <span />
                  </label>

                  <div className="classification-card-body">
                    <div className="classification-card-top">
                      <div className="classification-card-title">
                        <span>Task {model.item.idTask}</span>
                        <h3>{model.item.title}</h3>
                      </div>
                      <div className="classification-card-status">
                        <div className={`confidence-meter ${tone}`}>
                          <div>
                            <strong>{Math.round(model.confidence * 100)}%</strong>
                          </div>
                          <i>
                            <b style={{ width: `${Math.max(4, Math.round(model.confidence * 100))}%` }} />
                          </i>
                        </div>
                      </div>
                    </div>

                    <div className="classification-review-queue">
                      <div className={`classification-review-cell pending ${model.needsAttention ? "attention" : "ready"}`}>
                        <span>Pendência</span>
                        <strong>{pendingLabel}</strong>
                      </div>
                      <div className="classification-review-cell suggestion">
                        <span>Sugestão da IA</span>
                        <strong>{model.category || "Não classificado"}</strong>
                        <small>{model.subcategory || "Sem subcategoria"}</small>
                      </div>
                      <div className="classification-review-cell action">
                        <span>Ação</span>
                        <button
                          className="primary-button compact"
                          type="button"
                          onClick={() => acceptSuggestion(model)}
                        >
                          <Check size={14} />
                          Aceitar sugestão
                        </button>
                      </div>
                    </div>

                    <details className="classification-details">
                      <summary>Ajustar ou ver evidências</summary>
                      <div className="classification-suggestion-grid">
                        <label>
                          <span>Categoria</span>
                          <select
                            value={model.category}
                            onChange={(event) => updateLines(model.affectedLines, event.target.value, model.subcategory)}
                          >
                            {categoryOptions.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Subcategoria</span>
                          <select
                            value={model.subcategory}
                            onChange={(event) => updateLines(model.affectedLines, model.category, event.target.value)}
                          >
                            {subcategoryOptions.map((subcategory) => (
                              <option key={subcategory} value={subcategory}>
                                {subcategory}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="classification-meta-row">
                        <span>
                          <UserRound size={14} />
                          {model.users.join(", ")}
                        </span>
                        <span>
                          <FileText size={14} />
                          {model.affectedLines.length} lançamento{model.affectedLines.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          <MapPin size={14} />
                          {model.affectedLines.length === 1 ? "Linha" : "Linhas"} {model.affectedLines.join(", ")}
                        </span>
                        <span>
                          <Tags size={14} />
                          Origem: {model.origin}
                        </span>
                        {model.classifierVersion && (
                          <span>
                            <Layers3 size={14} />
                            Versão {model.classifierVersion}
                          </span>
                        )}
                      </div>
                      <div className="classification-reasons">
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
                    </details>
                  </div>
                </article>
              );
            })}

          </div>

          <div className="classification-review-footer">
            {visibleCards.length > 0 && (
              <div className="classification-footer-pagination" aria-label="Paginação das atividades">
                <div className="classification-pagination-summary">
                  <span>{pageStartIndex + 1}–{pageEndIndex} de {visibleCards.length} • Página {currentPage}/{totalPages}</span>
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
                  <select aria-label="Itens por página" disabled value={ACTIVITIES_PER_PAGE} onChange={() => undefined}>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
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
