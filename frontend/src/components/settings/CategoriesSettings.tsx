import type { SetStateAction } from "react";
import type { SettingItem } from "../../types";

type CategoriesSettingsProps = {
  categories: SettingItem[];
  search: string;
  newCategory: string;
  categoryDrafts: Record<number, string>;
  onNewCategoryChange: (value: string) => void;
  onCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onCreateCategory: () => void;
  onRenameCategory: (category: SettingItem) => void;
  onToggleCategory: (category: SettingItem) => void;
};

export function CategoriesSettings({
  categories,
  search,
  newCategory,
  categoryDrafts,
  onNewCategoryChange,
  onCategoryDraftsChange,
  onCreateCategory,
  onRenameCategory,
  onToggleCategory,
}: CategoriesSettingsProps) {
  const filteredCategories = categories.filter((category) => category.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="settings-column wide">
      <h3>Categorias</h3>
      <p className="muted">Categorias principais usadas para classificar as atividades e montar os relatorios.</p>
      <div className="settings-create-row">
        <input placeholder="Nova categoria" value={newCategory} onChange={(event) => onNewCategoryChange(event.target.value)} />
        <button className="primary-button compact" type="button" onClick={onCreateCategory}>
          Adicionar
        </button>
      </div>
      <div className="settings-list settings-data-table categories-table">
        <div className="settings-table-header">
          <span>Nome</span>
          <span>Status</span>
          <span>Uso</span>
          <span>Ultima alteracao</span>
          <span>Acoes</span>
        </div>
        {filteredCategories.map((category) => (
          <div className={`settings-item settings-table-row ${category.active ? "" : "inactive"}`} key={category.id}>
            <input
              value={categoryDrafts[category.id] ?? category.name}
              onChange={(event) => onCategoryDraftsChange((current) => ({ ...current, [category.id]: event.target.value }))}
            />
            <span className={`settings-status ${category.active ? "active" : "inactive"}`}>{category.active ? "Ativa" : "Inativa"}</span>
            <span className="settings-muted-cell">Uso real pendente</span>
            <span className="settings-muted-cell">Nao informado</span>
            <div className="settings-row-actions">
              <button
                className="secondary-button compact"
                disabled={(categoryDrafts[category.id] ?? category.name).trim() === category.name}
                type="button"
                onClick={() => onRenameCategory(category)}
              >
                Salvar
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onToggleCategory(category)}>
                {category.active ? "Inativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
