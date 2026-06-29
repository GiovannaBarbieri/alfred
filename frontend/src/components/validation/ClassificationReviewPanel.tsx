import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  Lightbulb,
  ListChecks,
  Save,
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
  const [saveNotice, setSaveNotice] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

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
    const automatic = cardModels.filter((model) => !model.unclassified && !model.conflict).length;
    const averageConfidence =
      total === 0 ? 0 : cardModels.reduce((sum, model) => sum + model.confidence, 0) / total;
    const attention = cardModels.filter((model) => model.needsAttention).length;
    return { total, automatic, lowConfidence, unclassified, conflicts, averageConfidence, attention };
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
      <div className="classification-hero">
        <div>
          <span className="eyebrow">Fase 4 - Classificação</span>
          <h2>Revisão inteligente das atividades</h2>
          <p>
            Priorize somente o que precisa de atenção. Alterações continuam sendo aplicadas por Task e, quando houver
            colaborador filtrado, apenas nos lançamentos desse colaborador.
          </p>
        </div>
      </div>

      <div className="classification-summary-grid">
        <article>
          <ListChecks size={18} />
          <div>
            <strong>{summary.total}</strong>
            <span>Atividades analisadas</span>
          </div>
        </article>
        <article>
          <CheckCircle2 size={18} />
          <div>
            <strong>{summary.automatic}</strong>
            <span>Classificadas automaticamente</span>
          </div>
        </article>
        <article className={summary.lowConfidence > 0 ? "attention" : ""}>
          <ShieldAlert size={18} />
          <div>
            <strong>{summary.lowConfidence}</strong>
            <span>Abaixo de 90%</span>
          </div>
        </article>
        <article className={summary.unclassified > 0 ? "danger" : ""}>
          <AlertTriangle size={18} />
          <div>
            <strong>{summary.unclassified}</strong>
            <span>Sem categoria</span>
          </div>
        </article>
        <article className={summary.conflicts > 0 ? "attention" : ""}>
          <Layers3 size={18} />
          <div>
            <strong>{summary.conflicts}</strong>
            <span>Conflitos</span>
          </div>
        </article>
        <article>
          <BarChart3 size={18} />
          <div>
            <strong>{Math.round(summary.averageConfidence * 100)}%</strong>
            <span>Confianca media</span>
          </div>
        </article>
      </div>

      <div className="classification-layout">
        <div className="classification-main">
          <div className="classification-toolbar-card">
            <div className="classification-filter-heading">
              <div>
                <span className="eyebrow">Fila de revisão</span>
                <strong>{visibleCards.length} pendência{visibleCards.length === 1 ? "" : "s"} para revisão</strong>
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

            <div className="classification-filter-row">
              <label className="classification-select-filter">
                <UserRound size={16} />
                <select value={selectedCollaborator} onChange={(event) => setSelectedCollaborator(event.target.value)}>
                  <option value="">Todos os colaboradores</option>
                  {collaboratorOptions.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </label>
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
                type="button"
                onClick={() => setShowMoreFilters((current) => !current)}
              >
                <Tags size={15} />
                Mais filtros
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

            <div className={`classification-bulk-bar ${selectedTasks.length > 0 ? "active" : ""}`}>
              <button className="link-action" type="button" onClick={toggleVisibleSelection}>
                {allVisibleSelected ? "Desmarcar visiveis" : "Selecionar todas visiveis"}
              </button>
              {selectedTasks.length > 0 && (
                <>
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
                </>
              )}
            </div>
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
                        <button
                          className="secondary-button compact"
                          type="button"
                          onClick={() => acceptSuggestion(model)}
                        >
                          <Check size={14} />
                          Aceitar
                        </button>
                      </div>
                    </div>

                    <div className="classification-suggestion-grid">
                      <label>
                        <span>Categoria sugerida</span>
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
                        <span>Subcategoria sugerida</span>
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

                    <details className="classification-details">
                      <summary>Ver detalhes</summary>
                      <div className="classification-meta-row">
                        <span>
                          <UserRound size={14} />
                          {model.users.join(", ")}
                        </span>
                        <span>
                          {model.affectedLines.length} lançamento{model.affectedLines.length === 1 ? "" : "s"}
                        </span>
                        <span>Linhas {model.affectedLines.join(", ")}</span>
                        <span>Origem: {model.origin}</span>
                        {model.classifierVersion && <span>Versão {model.classifierVersion}</span>}
                      </div>
                      <div className="classification-reasons">
                        <strong>
                          <Lightbulb size={14} />
                          Motivos:
                        </strong>
                        {reasons.length > 0 ? (
                          <div>
                            {reasons.map((reason) => (
                              <span key={reason}>{reason}</span>
                            ))}
                          </div>
                        ) : (
                          <p>Nenhum motivo detalhado retornado pelo classificador.</p>
                        )}
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}

            {visibleCards.length > ACTIVITIES_PER_PAGE && (
              <div className="classification-pagination" aria-label="Paginação das atividades">
                <span>
                  Mostrando {pageStartIndex + 1}–{pageEndIndex} de {visibleCards.length} atividades para revisão
                </span>
                <div>
                  <button
                    className="secondary-button compact"
                    disabled={currentPage === 1}
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  >
                    Anterior
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
                    className="secondary-button compact"
                    disabled={currentPage === totalPages}
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="classification-side-panel">
          <div className="classification-side-card">
            <span className="eyebrow">Confianca media</span>
            <div className="side-confidence-value">{Math.round(summary.averageConfidence * 100)}%</div>
            <div className={`confidence-meter ${confidenceTone(summary.averageConfidence)}`}>
              <i>
                <b style={{ width: `${Math.round(summary.averageConfidence * 100)}%` }} />
              </i>
            </div>
          </div>

          <div className="classification-side-card">
            <span className="eyebrow">Categorias</span>
            <div className="classification-category-list">
              {categoryDistribution.slice(0, 8).map((item) => (
                <div key={item.category}>
                  <span>{item.category}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="classification-side-actions">
            <button className="secondary-button compact" type="button" onClick={() => onStepChange("preview")}>
              <ArrowLeft size={16} />
              Voltar etapa
            </button>
            <button
              className="secondary-button compact"
              type="button"
              onClick={() => {
                setSaveNotice("Progresso salvo nesta sessao.");
                window.setTimeout(() => setSaveNotice(""), 2200);
              }}
            >
              <Save size={16} />
              Salvar progresso
            </button>
            <button className="primary-button compact" type="button" onClick={() => onStepChange("confirm")}>
              Proxima etapa
              <ArrowRight size={16} />
            </button>
            {saveNotice && <span>{saveNotice}</span>}
          </div>
        </aside>
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
