import { useMemo, useState } from "react";
import type { SetStateAction } from "react";
import { X } from "lucide-react";
import type { KeywordItem, SettingItem } from "../../types";

type KeywordsSettingsProps = {
  categories: SettingItem[];
  keywords: KeywordItem[];
  search: string;
  newKeyword: string;
  newKeywordCategoryId: string;
  keywordDrafts: Record<number, string>;
  keywordCategoryDrafts: Record<number, string>;
  onNewKeywordChange: (value: string) => void;
  onNewKeywordCategoryIdChange: (value: string) => void;
  onKeywordDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onKeywordCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onCreateKeyword: () => void;
  onUpdateKeyword: (keyword: KeywordItem) => void;
  onToggleKeyword: (keyword: KeywordItem) => void;
  onBulkToggleKeywords: (keywordIds: number[], active: boolean) => void;
  onBulkUpdateKeywordCategory: (keywordIds: number[], categoryId: number) => void;
};

export function KeywordsSettings({
  categories,
  keywords,
  search,
  newKeyword,
  newKeywordCategoryId,
  keywordDrafts,
  keywordCategoryDrafts,
  onNewKeywordChange,
  onNewKeywordCategoryIdChange,
  onKeywordDraftsChange,
  onKeywordCategoryDraftsChange,
  onCreateKeyword,
  onUpdateKeyword,
  onToggleKeyword,
  onBulkToggleKeywords,
  onBulkUpdateKeywordCategory,
}: KeywordsSettingsProps) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedKeywordIds, setSelectedKeywordIds] = useState<number[]>([]);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const activeCategories = categories.filter((category) => category.active);
  const categoryOptions = activeCategories.length > 0 ? activeCategories : categories;
  const selectValueForKeyword = (keyword: KeywordItem) => {
    const draftValue = keywordCategoryDrafts[keyword.id] ?? String(keyword.categoryId);
    return categoryOptions.some((category) => String(category.id) === draftValue) ? draftValue : "";
  };
  const filteredKeywords = useMemo(
    () =>
      keywords.filter((keyword) => {
        const hasActiveCategory = categoryOptions.some((category) => category.id === keyword.categoryId);
        const searchable = `${keyword.keyword} ${keyword.category}`.toLowerCase();
        const matchesSearch = !search.trim() || searchable.includes(search.trim().toLowerCase());
        if (categoryFilter === "__uncategorized") return !hasActiveCategory;
        return matchesSearch && (!categoryFilter || String(keyword.categoryId) === categoryFilter);
      }),
    [categoryFilter, categoryOptions, keywords, search],
  );
  const visibleKeywords = filteredKeywords.slice(0, 36);
  const visibleKeywordIds = visibleKeywords.map((keyword) => keyword.id);
  const allVisibleSelected = visibleKeywordIds.length > 0 && visibleKeywordIds.every((id) => selectedKeywordIds.includes(id));
  const toggleKeywordSelection = (keywordId: number) => {
    setSelectedKeywordIds((current) =>
      current.includes(keywordId) ? current.filter((id) => id !== keywordId) : [...current, keywordId],
    );
  };
  const toggleVisibleSelection = () => {
    setSelectedKeywordIds((current) => {
      if (allVisibleSelected) return current.filter((id) => !visibleKeywordIds.includes(id));
      return Array.from(new Set([...current, ...visibleKeywordIds]));
    });
  };
  const applyBulkStatus = (active: boolean) => {
    onBulkToggleKeywords(selectedKeywordIds, active);
    setSelectedKeywordIds([]);
  };
  const applyBulkCategory = () => {
    if (!bulkCategoryId) return;
    onBulkUpdateKeywordCategory(selectedKeywordIds, Number(bulkCategoryId));
    setSelectedKeywordIds([]);
    setBulkCategoryId("");
  };
  const clearBulkSelection = () => {
    setSelectedKeywordIds([]);
    setBulkCategoryId("");
  };

  return (
    <div className="settings-column wide">
      <h3>Palavras-chave</h3>
      <p className="muted">Palavras-chave ajudam o sistema a sugerir uma categoria automaticamente pelo titulo da Task.</p>
      <div className="keyword-toolbar">
        <label className="keyword-filter-field">
          <span>Filtrar categoria</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Todas</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
            <option value="__uncategorized">Sem categoria ativa</option>
          </select>
        </label>
        <small>{filteredKeywords.length} palavra(s) encontradas</small>
        <div className="keyword-bulk-actions">
          <button className="secondary-button compact" type="button" onClick={toggleVisibleSelection} disabled={visibleKeywordIds.length === 0}>
            {allVisibleSelected ? "Desmarcar visiveis" : "Selecionar visiveis"}
          </button>
        </div>
      </div>
      {selectedKeywordIds.length > 0 && (
        <div className="keyword-selection-bar">
          <strong>{selectedKeywordIds.length} selecionada(s)</strong>
          <select
            aria-label="Categoria para aplicar nas palavras-chave selecionadas"
            value={bulkCategoryId}
            onChange={(event) => setBulkCategoryId(event.target.value)}
          >
            <option value="">Mover para...</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <button className="primary-button compact" type="button" onClick={applyBulkCategory} disabled={!bulkCategoryId}>
            Aplicar
          </button>
          <button className="secondary-button compact" type="button" onClick={() => applyBulkStatus(true)}>
            Ativar
          </button>
          <button className="secondary-button compact" type="button" onClick={() => applyBulkStatus(false)}>
            Inativar
          </button>
          <button
            aria-label="Limpar selecao"
            className="keyword-clear-selection"
            title="Limpar selecao"
            type="button"
            onClick={clearBulkSelection}
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
      )}
      <div className="settings-keyword-row">
        <select value={newKeywordCategoryId} onChange={(event) => onNewKeywordCategoryIdChange(event.target.value)}>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <input placeholder="Nova palavra-chave" value={newKeyword} onChange={(event) => onNewKeywordChange(event.target.value)} />
        <button className="primary-button compact" type="button" onClick={onCreateKeyword}>
          Adicionar
        </button>
      </div>
      <div className="keyword-list settings-data-table keywords-table">
        <div className="settings-table-header">
          <span></span>
          <span>Status</span>
          <span>Categoria</span>
          <span>Palavra-chave</span>
          <span>Uso</span>
          <span>Acoes</span>
        </div>
        {visibleKeywords.map((keyword) => (
          <div className={`keyword-item settings-table-row ${keyword.active ? "" : "inactive"}`} key={keyword.id}>
            <label className="keyword-select-control" title="Selecionar palavra-chave">
              <input
                type="checkbox"
                checked={selectedKeywordIds.includes(keyword.id)}
                onChange={() => toggleKeywordSelection(keyword.id)}
              />
            </label>
            <span className={`settings-status ${keyword.active ? "active" : "inactive"}`}>{keyword.active ? "Ativa" : "Inativa"}</span>
            <select
              title={categories.find((category) => category.id === keyword.categoryId)?.name ?? "Selecione uma categoria ativa"}
              value={selectValueForKeyword(keyword)}
              onChange={(event) => onKeywordCategoryDraftsChange((current) => ({ ...current, [keyword.id]: event.target.value }))}
            >
              <option value="" disabled>Selecione uma categoria ativa</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <input
              value={keywordDrafts[keyword.id] ?? keyword.keyword}
              onChange={(event) => onKeywordDraftsChange((current) => ({ ...current, [keyword.id]: event.target.value }))}
            />
            <span className="settings-muted-cell">Uso real pendente</span>
            <div className="settings-row-actions">
              <button
                className="secondary-button compact"
                disabled={
                  (keywordDrafts[keyword.id] ?? keyword.keyword).trim() === keyword.keyword &&
                  Number(selectValueForKeyword(keyword) || keyword.categoryId) === keyword.categoryId
                }
                type="button"
                onClick={() => onUpdateKeyword(keyword)}
              >
                Salvar
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onToggleKeyword(keyword)}>
                {keyword.active ? "Inativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
