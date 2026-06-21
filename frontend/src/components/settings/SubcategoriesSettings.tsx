import type { SetStateAction } from "react";
import type { SettingItem } from "../../types";

type SubcategoriesSettingsProps = {
  subcategories: SettingItem[];
  search: string;
  newSubcategory: string;
  subcategoryDrafts: Record<number, string>;
  onNewSubcategoryChange: (value: string) => void;
  onSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onCreateSubcategory: () => void;
  onRenameSubcategory: (subcategory: SettingItem) => void;
  onToggleSubcategory: (subcategory: SettingItem) => void;
};

export function SubcategoriesSettings({
  subcategories,
  search,
  newSubcategory,
  subcategoryDrafts,
  onNewSubcategoryChange,
  onSubcategoryDraftsChange,
  onCreateSubcategory,
  onRenameSubcategory,
  onToggleSubcategory,
}: SubcategoriesSettingsProps) {
  const filteredSubcategories = subcategories.filter((subcategory) =>
    subcategory.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="settings-column wide">
      <h3>Subcategorias</h3>
      <p className="muted">Subcategorias representam o perfil operacional do colaborador, como Back, Front, Analista ou QA.</p>
      <div className="settings-create-row">
        <input placeholder="Nova subcategoria" value={newSubcategory} onChange={(event) => onNewSubcategoryChange(event.target.value)} />
        <button className="primary-button compact" type="button" onClick={onCreateSubcategory}>
          Adicionar
        </button>
      </div>
      <div className="settings-list settings-data-table categories-table">
        <div className="settings-table-header">
          <span>Nome</span>
          <span>Status</span>
          <span>Acoes</span>
        </div>
        {filteredSubcategories.map((subcategory) => (
          <div className={`settings-item settings-table-row ${subcategory.active ? "" : "inactive"}`} key={subcategory.id}>
            <input
              value={subcategoryDrafts[subcategory.id] ?? subcategory.name}
              onChange={(event) => onSubcategoryDraftsChange((current) => ({ ...current, [subcategory.id]: event.target.value }))}
            />
            <span className={`settings-status ${subcategory.active ? "active" : "inactive"}`}>{subcategory.active ? "Ativa" : "Inativa"}</span>
            <div className="settings-row-actions">
              <button
                className="secondary-button compact"
                disabled={(subcategoryDrafts[subcategory.id] ?? subcategory.name).trim() === subcategory.name}
                type="button"
                onClick={() => onRenameSubcategory(subcategory)}
              >
                Salvar
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onToggleSubcategory(subcategory)}>
                {subcategory.active ? "Inativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
