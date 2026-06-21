import { MoreVertical } from "lucide-react";
import { useState, type SetStateAction } from "react";
import type { SettingItem } from "../../types";
import { hasSimilarSettingName } from "../../utils/settingsValidation";

type CategoriesSettingsProps = {
  categories: SettingItem[];
  search: string;
  categoryDrafts: Record<number, string>;
  categoryDescriptionDrafts: Record<number, string>;
  onCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onCategoryDescriptionDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRenameCategory: (category: SettingItem) => Promise<void> | void;
  onToggleCategory: (category: SettingItem) => Promise<void> | void;
  onDeleteCategory: (category: SettingItem) => Promise<void> | void;
};

export function CategoriesSettings({
  categories,
  search,
  categoryDrafts,
  categoryDescriptionDrafts,
  onCategoryDraftsChange,
  onCategoryDescriptionDraftsChange,
  onRenameCategory,
  onToggleCategory,
  onDeleteCategory,
}: CategoriesSettingsProps) {
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState<SettingItem | null>(null);
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const filteredCategories = categories.filter((category) => category.name.toLowerCase().includes(search.trim().toLowerCase()));
  const activeCategories = categories.filter((category) => category.active).length;
  const inactiveCategories = categories.length - activeCategories;

  function handleOpenEdit(category: SettingItem) {
    onCategoryDraftsChange((current) => ({ ...current, [category.id]: current[category.id] ?? category.name }));
    onCategoryDescriptionDraftsChange((current) => ({ ...current, [category.id]: current[category.id] ?? category.description ?? "" }));
    setActiveActionId(null);
    setCategoryFeedback(null);
    setCategoryError(null);
    setEditingCategory(category);
  }

  async function handleSaveEdit() {
    if (!editingCategory) return;
    const nextName = categoryDrafts[editingCategory.id] ?? editingCategory.name;
    if (hasSimilarSettingName(categories, nextName, editingCategory.id)) {
      const confirmed = window.confirm("Já existe um registro semelhante cadastrado.\n\nDeseja continuar?");
      if (!confirmed) return;
    }
    await onRenameCategory(editingCategory);
    setEditingCategory(null);
    setCategoryFeedback("Categoria atualizada com sucesso.");
  }

  async function handleToggleCategory(category: SettingItem) {
    setActiveActionId(null);
    setCategoryError(null);
    await onToggleCategory(category);
    setCategoryFeedback(category.active ? "Categoria inativada com sucesso." : "Categoria ativada com sucesso.");
  }

  async function handleDeleteCategory(category: SettingItem) {
    setActiveActionId(null);
    setCategoryFeedback(null);
    setCategoryError(null);
    const confirmed = window.confirm(`Excluir a categoria "${category.name}"? Esta ação só será concluída se ela não estiver vinculada a dados existentes.`);
    if (!confirmed) return;
    try {
      await onDeleteCategory(category);
      setCategoryFeedback("Categoria excluída com sucesso.");
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : "Não foi possível excluir a categoria.");
    }
  }

  return (
    <div className="settings-column wide">
      <div className="settings-section-heading">
        <h3>Categorias</h3>
        <p className="muted">Defina as categorias utilizadas para classificar as atividades apontadas pelos colaboradores.</p>
      </div>
      {categoryFeedback && <p className="settings-feedback" role="status">{categoryFeedback}</p>}
      {categoryError && <p className="settings-feedback error" role="alert">{categoryError}</p>}
      <div className="settings-management-summary" aria-label="Resumo de categorias">
        <div>
          <strong>{categories.length}</strong>
          <span>Categorias</span>
        </div>
        <div>
          <strong>{activeCategories}</strong>
          <span>Ativas</span>
        </div>
        <div>
          <strong>{inactiveCategories}</strong>
          <span>Inativas</span>
        </div>
      </div>
      <div className="settings-list settings-data-table categories-table">
        <div className="settings-table-header">
          <span>Categoria</span>
          <span>Situação</span>
          <span>Ações</span>
        </div>
        {filteredCategories.map((category) => (
          <div className={`settings-item settings-table-row ${category.active ? "" : "inactive"}`} key={category.id}>
            <strong className="settings-primary-cell">{category.name}</strong>
            <span className={`settings-status ${category.active ? "active" : "inactive"}`}>
              <i aria-hidden="true" />
              {category.active ? "Ativa" : "Inativa"}
            </span>
            <div className="settings-action-menu">
              <button
                aria-expanded={activeActionId === category.id}
                aria-label={`Ações da categoria ${category.name}`}
                className="settings-menu-button"
                title="Ações"
                type="button"
                onClick={() => setActiveActionId((current) => (current === category.id ? null : category.id))}
              >
                <MoreVertical size={17} />
              </button>
              {activeActionId === category.id && (
                <div className="settings-menu-list">
                  <button type="button" onClick={() => handleOpenEdit(category)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => void handleToggleCategory(category)}>
                    Alterar situação
                  </button>
                  <button type="button" onClick={() => void handleDeleteCategory(category)}>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredCategories.length === 0 && <p className="muted">Nenhuma categoria encontrada.</p>}
      </div>

      {editingCategory && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setEditingCategory(null)}>
          <form
            aria-labelledby="category-edit-title"
            aria-modal="true"
            className="settings-modal-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveEdit();
            }}
          >
            <header>
              <h3 id="category-edit-title">Editar Categoria</h3>
              <p>Atualize o nome exibido para esta categoria.</p>
            </header>
            <label>
              <span>Nome da categoria</span>
              <input
                autoFocus
                value={categoryDrafts[editingCategory.id] ?? editingCategory.name}
                onChange={(event) =>
                  onCategoryDraftsChange((current) => ({ ...current, [editingCategory.id]: event.target.value }))
                }
                placeholder="Digite o nome da categoria"
              />
            </label>
            <label>
              <span>Descrição (opcional)</span>
              <textarea
                maxLength={255}
                value={categoryDescriptionDrafts[editingCategory.id] ?? editingCategory.description ?? ""}
                onChange={(event) =>
                  onCategoryDescriptionDraftsChange((current) => ({ ...current, [editingCategory.id]: event.target.value }))
                }
                placeholder="Utilizada para apontamentos relacionados ao desenvolvimento de funcionalidades."
              />
            </label>
            <footer>
              <button className="secondary-button compact" type="button" onClick={() => setEditingCategory(null)}>
                Cancelar
              </button>
              <button
                className="primary-button compact"
                disabled={
                  !(categoryDrafts[editingCategory.id] ?? editingCategory.name).trim() ||
                  (categoryDrafts[editingCategory.id] ?? editingCategory.name).trim() === editingCategory.name
                }
                type="submit"
              >
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
