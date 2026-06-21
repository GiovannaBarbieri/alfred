import { AlertTriangle, CheckCircle2, FileSpreadsheet, GitCompareArrows } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Metric } from "../components/Metric";
import { applyImportReprocess, getImportReprocessPreview } from "../services/api";
import type { ImportDetail, ImportReprocessPreview, ImportSummary } from "../types";
import { formatDateTimeBR } from "../utils/date";

const recordPageSize = 20;
const visibleTaskGroupLimit = 80;

export function HistoryPage({
  imports,
  selectedImport,
  isLoadingImportDetail,
  onOpenImport,
  onClearImport,
}: {
  imports: ImportSummary[];
  selectedImport: ImportDetail | null;
  isLoadingImportDetail: boolean;
  onOpenImport: (importId: number) => void;
  onClearImport: () => void;
}) {
  const [search, setSearch] = useState("");
  const [reprocessPreview, setReprocessPreview] = useState<ImportReprocessPreview | null>(null);
  const [isLoadingReprocessPreview, setIsLoadingReprocessPreview] = useState(false);
  const [isApplyingReprocess, setIsApplyingReprocess] = useState(false);
  const [reprocessPreviewError, setReprocessPreviewError] = useState<string | null>(null);
  const [reprocessApplyMessage, setReprocessApplyMessage] = useState<string | null>(null);
  const [selectedTaskKeys, setSelectedTaskKeys] = useState<Set<string>>(new Set());
  const [taskSearch, setTaskSearch] = useState("");
  const [currentCategoryFilter, setCurrentCategoryFilter] = useState("");
  const [newCategoryFilter, setNewCategoryFilter] = useState("");
  const [taskSelectionFilter, setTaskSelectionFilter] = useState<"all" | "selected" | "unselected">("all");
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [isReprocessConfirmOpen, setIsReprocessConfirmOpen] = useState(false);
  const [recordPage, setRecordPage] = useState(1);

  const filteredImports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return imports;
    return imports.filter((item) =>
      [`#${item.id}`, item.filename, item.status]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [imports, search]);
  const totalRecordPages = selectedImport ? Math.max(1, Math.ceil(selectedImport.records.length / recordPageSize)) : 1;
  const safeRecordPage = Math.min(recordPage, totalRecordPages);
  const firstVisibleRecord = selectedImport && selectedImport.records.length > 0 ? (safeRecordPage - 1) * recordPageSize + 1 : 0;
  const lastVisibleRecord = selectedImport ? Math.min(safeRecordPage * recordPageSize, selectedImport.records.length) : 0;
  const visibleRecords = selectedImport?.records.slice(firstVisibleRecord - 1, lastVisibleRecord) ?? [];
  const recordPageNumbers = compactPageNumbers(safeRecordPage, totalRecordPages);
  const taskCurrentCategoryOptions = useMemo(() => {
    if (!reprocessPreview) return [];
    return Array.from(new Set(reprocessPreview.taskGroups.map((group) => group.currentCategory).filter(Boolean))).sort();
  }, [reprocessPreview]);
  const taskNewCategoryOptions = useMemo(() => {
    if (!reprocessPreview) return [];
    return Array.from(new Set(reprocessPreview.taskGroups.map((group) => group.newCategory).filter(Boolean))).sort();
  }, [reprocessPreview]);
  const filteredTaskGroups = useMemo(() => {
    if (!reprocessPreview) return [];
    const normalizedSearch = taskSearch.trim().toLowerCase();
    return reprocessPreview.taskGroups.filter((group) => {
      const matchesSearch =
        !normalizedSearch ||
        [
          group.idTask,
          group.tituloTask,
          group.firstLine,
          group.currentCategory,
          group.newCategory,
          ...group.collaborators,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesCurrentCategory = !currentCategoryFilter || group.currentCategory === currentCategoryFilter;
      const matchesNewCategory = !newCategoryFilter || group.newCategory === newCategoryFilter;
      const isSelected = selectedTaskKeys.has(group.taskKey);
      const matchesSelection =
        taskSelectionFilter === "all" ||
        (taskSelectionFilter === "selected" && isSelected) ||
        (taskSelectionFilter === "unselected" && !isSelected);
      const matchesConfidence = !lowConfidenceOnly || group.averageNewConfidence < 0.7;

      return matchesSearch && matchesCurrentCategory && matchesNewCategory && matchesSelection && matchesConfidence;
    });
  }, [
    currentCategoryFilter,
    lowConfidenceOnly,
    newCategoryFilter,
    reprocessPreview,
    selectedTaskKeys,
    taskSearch,
    taskSelectionFilter,
  ]);
  const visibleTaskGroups = filteredTaskGroups.slice(0, visibleTaskGroupLimit);
  const filteredRecordCount = filteredTaskGroups.reduce((total, group) => total + group.totalRecords, 0);
  const hasTaskFilters =
    taskSearch.trim() !== "" ||
    currentCategoryFilter !== "" ||
    newCategoryFilter !== "" ||
    taskSelectionFilter !== "all" ||
    lowConfidenceOnly;
  const selectedTaskCount = reprocessPreview
    ? reprocessPreview.taskGroups.filter((group) => selectedTaskKeys.has(group.taskKey)).length
    : 0;
  const selectedRecordCount = reprocessPreview
    ? reprocessPreview.taskGroups
      .filter((group) => selectedTaskKeys.has(group.taskKey))
      .reduce((total, group) => total + group.totalRecords, 0)
    : 0;
  const selectedCategoryChanges = useMemo(() => {
    if (!reprocessPreview) return [];
    const changes = new Map<string, { fromCategory: string; toCategory: string; totalRecords: number }>();
    reprocessPreview.taskGroups
      .filter((group) => selectedTaskKeys.has(group.taskKey))
      .forEach((group) => {
        const key = `${group.currentCategory}->${group.newCategory}`;
        const current = changes.get(key) ?? {
          fromCategory: group.currentCategory,
          toCategory: group.newCategory,
          totalRecords: 0,
        };
        current.totalRecords += group.totalRecords;
        changes.set(key, current);
      });
    return Array.from(changes.values()).sort((a, b) => b.totalRecords - a.totalRecords);
  }, [reprocessPreview, selectedTaskKeys]);
  useEffect(() => {
    setReprocessPreview(null);
    setReprocessPreviewError(null);
    setReprocessApplyMessage(null);
    setSelectedTaskKeys(new Set());
    setIsReprocessConfirmOpen(false);
    clearTaskFilters();
    setIsLoadingReprocessPreview(false);
    setIsApplyingReprocess(false);
    setRecordPage(1);
  }, [selectedImport?.id]);

  async function handleReprocessPreview() {
    if (!selectedImport) return;
    setIsLoadingReprocessPreview(true);
    setReprocessPreviewError(null);
    try {
      const preview = await getImportReprocessPreview(selectedImport.id);
      setReprocessPreview(preview);
      setSelectedTaskKeys(new Set(preview.taskGroups.map((group) => group.taskKey)));
      setIsReprocessConfirmOpen(false);
      clearTaskFilters();
      setReprocessApplyMessage(null);
    } catch (err) {
      setReprocessPreviewError(err instanceof Error ? err.message : "Erro inesperado ao gerar a previa.");
    } finally {
      setIsLoadingReprocessPreview(false);
    }
  }

  function handleRequestApplyReprocess() {
    if (!selectedImport || !reprocessPreview || reprocessPreview.changedRecords === 0) return;
    if (selectedTaskKeys.size === 0) {
      setReprocessPreviewError("Selecione pelo menos uma Task para aplicar.");
      return;
    }
    setIsReprocessConfirmOpen(true);
  }

  async function handleApplyReprocess() {
    if (!selectedImport || !reprocessPreview || reprocessPreview.changedRecords === 0) return;
    const taskKeys = Array.from(selectedTaskKeys);
    if (taskKeys.length === 0) {
      setReprocessPreviewError("Selecione pelo menos uma Task para aplicar.");
      setIsReprocessConfirmOpen(false);
      return;
    }

    setIsApplyingReprocess(true);
    setReprocessPreviewError(null);
    try {
      const response = await applyImportReprocess(selectedImport.id, taskKeys);
      setReprocessApplyMessage(response.message);
      setReprocessPreview(null);
      setIsReprocessConfirmOpen(false);
      onOpenImport(selectedImport.id);
    } catch (err) {
      setReprocessPreviewError(err instanceof Error ? err.message : "Erro inesperado ao aplicar o reprocessamento.");
    } finally {
      setIsApplyingReprocess(false);
    }
  }

  function handleToggleTask(taskKey: string) {
    setSelectedTaskKeys((current) => {
      const next = new Set(current);
      if (next.has(taskKey)) {
        next.delete(taskKey);
      } else {
        next.add(taskKey);
      }
      return next;
    });
  }

  function handleSelectAllTasks() {
    if (!reprocessPreview) return;
    setSelectedTaskKeys(new Set(reprocessPreview.taskGroups.map((group) => group.taskKey)));
  }

  function handleClearSelectedTasks() {
    setSelectedTaskKeys(new Set());
  }

  function clearTaskFilters() {
    setTaskSearch("");
    setCurrentCategoryFilter("");
    setNewCategoryFilter("");
    setTaskSelectionFilter("all");
    setLowConfidenceOnly(false);
  }

  return (
    <>
      <section className="panel history-panel">
        <div className="result-heading">
          <h2>Historico de importacoes</h2>
          <span>{filteredImports.length}</span>
        </div>
        <div className="history-toolbar">
          <input
            placeholder="Buscar por projeto, arquivo ou status"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button className="secondary-button compact" type="button" onClick={() => setSearch("")}>
              Limpar
            </button>
          )}
        </div>
        <div className="history-list">
          {imports.length === 0 ? (
            <p className="muted">Nenhuma importacao salva ainda.</p>
          ) : filteredImports.length === 0 ? (
            <p className="muted">Nenhuma importacao encontrada para esse filtro.</p>
          ) : (
            filteredImports.slice(0, 12).map((item) => (
              <div className={`history-row ${selectedImport?.id === item.id ? "active" : ""}`} key={item.id}>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => (selectedImport?.id === item.id ? onClearImport() : onOpenImport(item.id))}
                >
                  #{item.id} - {item.filename}
                </button>
                <span>{formatDateTimeBR(item.importedAt)}</span>
              </div>
            ))
          )}
          {filteredImports.length > 12 && (
            <p className="muted">Mostrando 12 de {filteredImports.length} importacoes encontradas. Refine a busca para localizar um projeto especifico.</p>
          )}
        </div>
      </section>

      <section className="panel import-detail-panel">
        <div className="result-heading">
          <h2>Detalhe da importacao</h2>
          {selectedImport ? (
            <div className="detail-heading-actions">
              <span>#{selectedImport.id}</span>
              <button className="secondary-button compact" type="button" onClick={onClearImport}>
                Fechar
              </button>
            </div>
          ) : (
            <span>vazio</span>
          )}
        </div>
        {isLoadingImportDetail ? (
          <p className="muted">Carregando importacao...</p>
        ) : !selectedImport ? (
          <p className="muted">Selecione uma importacao no historico para ver os lancamentos.</p>
        ) : (
          <div className="import-detail-content">
            <div className="detail-summary">
              <Metric label="Registros" value={String(selectedImport.totalRows)} icon={<FileSpreadsheet size={18} />} />
              <Metric label="Validos" value={String(selectedImport.validRows)} icon={<CheckCircle2 size={18} />} />
            </div>
            {reprocessPreviewError && <p className="error-message">{reprocessPreviewError}</p>}
            {reprocessApplyMessage && <p className="success-message">{reprocessApplyMessage}</p>}
            {reprocessPreview && (
              <div className="reprocess-preview-panel">
                <div className="reprocess-preview-heading">
                  <div>
                    <h3>Previa de reprocessamento</h3>
                    <p>
                      Comparacao sem persistencia: classificador v{reprocessPreview.currentClassifierVersion} para v{reprocessPreview.newClassifierVersion}.
                    </p>
                  </div>
                  <span>{reprocessPreview.changedRecords} mudanca(s)</span>
                </div>
                <div className="reprocess-preview-metrics">
                  <Metric label="Registros analisados" value={String(reprocessPreview.totalRecords)} icon={<FileSpreadsheet size={18} />} />
                  <Metric label="Registros mudariam" value={String(reprocessPreview.changedRecords)} icon={<GitCompareArrows size={18} />} />
                  <Metric label="Tasks impactadas" value={String(reprocessPreview.changedTasks)} icon={<AlertTriangle size={18} />} />
                  <Metric
                    label="Confianca media"
                    value={`${Math.round(reprocessPreview.averageCurrentConfidence * 100)}% -> ${Math.round(reprocessPreview.averageNewConfidence * 100)}%`}
                    icon={<CheckCircle2 size={18} />}
                  />
                </div>
                {reprocessPreview.categoryChanges.length > 0 && (
                  <div className="reprocess-category-changes">
                    {reprocessPreview.categoryChanges.slice(0, 6).map((change) => (
                      <span key={`${change.fromCategory}-${change.toCategory}`}>
                        {change.fromCategory} {"->"} {change.toCategory}
                        <strong>{change.totalRecords}</strong>
                      </span>
                    ))}
                  </div>
                )}
                {reprocessPreview.changedRecords === 0 ? (
                  <p className="muted">As regras atuais nao alterariam a classificacao consolidada deste projeto.</p>
                ) : (
                  <div className="reprocess-task-preview">
                    <div className="detail-subsection-heading">
                      <h3>Tasks impactadas</h3>
                      <span>{selectedTaskCount} de {reprocessPreview.taskGroups.length}</span>
                    </div>
                    <div className="reprocess-selection-toolbar">
                      <strong>{selectedRecordCount} lancamento(s) selecionado(s)</strong>
                      <div>
                        <button className="secondary-button compact" type="button" onClick={handleSelectAllTasks}>
                          Selecionar todas
                        </button>
                        <button className="secondary-button compact" type="button" onClick={handleClearSelectedTasks}>
                          Limpar selecao
                        </button>
                      </div>
                    </div>
                    <div className="reprocess-task-filters">
                      <label className="reprocess-filter-search">
                        <span>Buscar</span>
                        <input
                          placeholder="Task, titulo ou colaborador"
                          value={taskSearch}
                          onChange={(event) => setTaskSearch(event.target.value)}
                        />
                      </label>
                      <label>
                        <span>Atual</span>
                        <select
                          value={currentCategoryFilter}
                          onChange={(event) => setCurrentCategoryFilter(event.target.value)}
                        >
                          <option value="">Todas</option>
                          {taskCurrentCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Nova</span>
                        <select value={newCategoryFilter} onChange={(event) => setNewCategoryFilter(event.target.value)}>
                          <option value="">Todas</option>
                          {taskNewCategoryOptions.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Selecao</span>
                        <select
                          value={taskSelectionFilter}
                          onChange={(event) => setTaskSelectionFilter(event.target.value as "all" | "selected" | "unselected")}
                        >
                          <option value="all">Todas</option>
                          <option value="selected">Selecionadas</option>
                          <option value="unselected">Nao selecionadas</option>
                        </select>
                      </label>
                      <button
                        className={`reprocess-filter-toggle ${lowConfidenceOnly ? "active" : ""}`}
                        type="button"
                        onClick={() => setLowConfidenceOnly((value) => !value)}
                      >
                        Baixa confianca
                      </button>
                      <div className="reprocess-filter-summary">
                        <strong>{filteredTaskGroups.length}</strong>
                        <span>Task(s) / {filteredRecordCount} lancamento(s)</span>
                      </div>
                      {hasTaskFilters && (
                        <button className="reprocess-filter-clear" type="button" onClick={clearTaskFilters}>
                          Limpar
                        </button>
                      )}
                    </div>
                    <div className="reprocess-preview-list">
                      {visibleTaskGroups.length === 0 ? (
                        <p className="muted">Nenhuma Task encontrada para os filtros aplicados.</p>
                      ) : visibleTaskGroups.map((group) => (
                        <div
                          className={`reprocess-preview-item reprocess-task-group ${selectedTaskKeys.has(group.taskKey) ? "selected" : ""}`}
                          key={group.taskKey}
                        >
                          <label className="reprocess-task-check">
                            <input
                              type="checkbox"
                              checked={selectedTaskKeys.has(group.taskKey)}
                              onChange={() => handleToggleTask(group.taskKey)}
                              aria-label={`Selecionar Task ${group.idTask || group.firstLine}`}
                            />
                          </label>
                          <div>
                            <span>
                              Task {group.idTask || "sem ID"} - {group.totalRecords} lancamento(s) - Linha {group.firstLine}
                            </span>
                            <strong>{group.tituloTask}</strong>
                            <small>
                              {group.collaborators.slice(0, 4).join(", ") || "Sem colaborador"}
                              {group.collaborators.length > 4 ? ` +${group.collaborators.length - 4}` : ""}
                            </small>
                          </div>
                          <div className="reprocess-preview-change">
                            <span>
                              Atual: <strong>{group.currentCategory} / {group.currentSubcategory}</strong>
                            </span>
                            <span>
                              Novo: <strong>{group.newCategory} / {group.newSubcategory}</strong>
                            </span>
                            <small>
                              Confianca media: {Math.round(group.averageCurrentConfidence * 100)}% {"->"} {Math.round(group.averageNewConfidence * 100)}%
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                    {filteredTaskGroups.length > visibleTaskGroups.length && (
                      <p className="muted">
                        Mostrando {visibleTaskGroups.length} de {filteredTaskGroups.length} Tasks filtradas.
                      </p>
                    )}
                    <details className="reprocess-record-details">
                      <summary>Ver amostra de lancamentos</summary>
                      <div className="reprocess-preview-list">
                        {reprocessPreview.items.slice(0, 40).map((item) => (
                          <div className="reprocess-preview-item" key={item.recordId}>
                            <div>
                              <span>Linha {item.line} - {item.loginUsuario} - Task {item.idTask || "sem ID"}</span>
                              <strong>{item.tituloTask}</strong>
                              <small>
                                {item.confidenceFactors.slice(0, 2).join(" | ") || "Sem fator de confianca detalhado"}
                              </small>
                            </div>
                            <div className="reprocess-preview-change">
                              <span>
                                Atual: <strong>{item.currentCategory} / {item.currentSubcategory}</strong>
                              </span>
                              <span>
                                Novo: <strong>{item.newCategory} / {item.newSubcategory}</strong>
                              </span>
                              <small>
                                {Math.round(item.currentConfidence * 100)}% {"->"} {Math.round(item.newConfidence * 100)}%
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
                <div className="reprocess-preview-actions">
                  <p className="muted">
                    Revise as Tasks impactadas antes de aplicar. A acao cria historico de reprocessamento por lancamento.
                  </p>
                  <button
                    className="primary-button compact"
                    type="button"
                    onClick={handleRequestApplyReprocess}
                    disabled={isApplyingReprocess || reprocessPreview.changedRecords === 0 || selectedTaskCount === 0}
                  >
                    {isApplyingReprocess ? "Aplicando..." : `Aplicar ${selectedTaskCount} Task(s)`}
                  </button>
                </div>
              </div>
            )}

            {reprocessPreview && isReprocessConfirmOpen && (
              <div className="reprocess-confirm-backdrop" role="presentation" onClick={() => setIsReprocessConfirmOpen(false)}>
                <section
                  aria-labelledby="reprocess-confirm-title"
                  aria-modal="true"
                  className="reprocess-confirm-dialog"
                  role="dialog"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header>
                    <span>
                      <AlertTriangle size={18} />
                    </span>
                    <div>
                      <h3 id="reprocess-confirm-title">Confirmar reprocessamento</h3>
                      <p>Revise o impacto antes de salvar a nova classificacao nos lancamentos consolidados.</p>
                    </div>
                  </header>
                  <div className="reprocess-confirm-grid">
                    <span>
                      <strong>{selectedTaskCount}</strong>
                      <small>Tasks selecionadas</small>
                    </span>
                    <span>
                      <strong>{selectedRecordCount}</strong>
                      <small>Lancamentos afetados</small>
                    </span>
                    <span>
                      <strong>v{reprocessPreview.currentClassifierVersion} {"->"} v{reprocessPreview.newClassifierVersion}</strong>
                      <small>Versao do classificador</small>
                    </span>
                  </div>
                  <div className="reprocess-confirm-changes">
                    <strong>Principais mudancas</strong>
                    {selectedCategoryChanges.length === 0 ? (
                      <p className="muted">Nenhuma mudanca de categoria selecionada.</p>
                    ) : (
                      selectedCategoryChanges.slice(0, 5).map((change) => (
                        <span key={`${change.fromCategory}-${change.toCategory}`}>
                          {change.fromCategory} {"->"} {change.toCategory}
                          <strong>{change.totalRecords}</strong>
                        </span>
                      ))
                    )}
                  </div>
                  <p className="reprocess-confirm-note">
                    Esta acao registra historico de reprocessamento e atualiza somente as Tasks selecionadas.
                  </p>
                  <footer>
                    <button
                      className="secondary-button compact"
                      type="button"
                      onClick={() => setIsReprocessConfirmOpen(false)}
                      disabled={isApplyingReprocess}
                    >
                      Cancelar
                    </button>
                    <button
                      className="primary-button compact"
                      type="button"
                      onClick={handleApplyReprocess}
                      disabled={isApplyingReprocess}
                    >
                      {isApplyingReprocess ? "Aplicando..." : "Confirmar"}
                    </button>
                  </footer>
                </section>
              </div>
            )}

            <div className="detail-subsection">
              <h3>Lancamentos</h3>
              <div className="detail-table-wrap">
                <table className="detail-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>Duracao</th>
                      <th>Epic</th>
                      <th>Task</th>
                      <th>Categoria</th>
                      <th>Confianca</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((record) => (
                      <tr key={`${selectedImport.id}-${record.idLancamento}-${record.task}`}>
                        <td>{record.idLancamento}</td>
                        <td>{record.loginUsuario}</td>
                        <td>{record.duracao}</td>
                        <td>{record.epic}</td>
                        <td>{record.task}</td>
                        <td>{record.categoria} / {record.subcategoria}</td>
                        <td>{record.confidenceLevel} - {Math.round(record.confidence * 100)}% - v{record.classifierVersion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedImport.records.length > 0 && (
                <>
                  <div className="task-pagination-summary">
                    Mostrando {firstVisibleRecord}-{lastVisibleRecord} de {selectedImport.records.length} lancamentos
                  </div>
                  <div className="task-pagination" aria-label="Paginacao de lancamentos">
                    <button
                      className="task-page-button nav"
                      type="button"
                      aria-label="Pagina anterior"
                      disabled={safeRecordPage <= 1}
                      onClick={() => setRecordPage(safeRecordPage - 1)}
                    >
                      {"<"}
                    </button>
                    {recordPageNumbers.map((page) => (
                      <button
                        className={page === safeRecordPage ? "task-page-button active" : "task-page-button"}
                        type="button"
                        key={page}
                        aria-current={page === safeRecordPage ? "page" : undefined}
                        onClick={() => setRecordPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      className="task-page-button nav"
                      type="button"
                      aria-label="Proxima pagina"
                      disabled={safeRecordPage >= totalRecordPages}
                      onClick={() => setRecordPage(safeRecordPage + 1)}
                    >
                      {">"}
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        )}
      </section>
    </>
  );
}

function compactPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 3) return [1, 2, 3, 4, 5];
  if (currentPage >= totalPages - 2) return Array.from({ length: 5 }, (_, index) => totalPages - 4 + index);
  return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
}
