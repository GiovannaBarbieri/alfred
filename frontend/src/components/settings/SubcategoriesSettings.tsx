import { MoreVertical } from "lucide-react";
import { useState, type SetStateAction } from "react";
import type { SettingItem } from "../../types";

type SubcategoriesSettingsProps = {
  subcategories: SettingItem[];
  search: string;
  subcategoryDrafts: Record<number, string>;
  subcategoryActiveDrafts: Record<number, boolean>;
  subcategoryGroupDrafts: Record<number, string>;
  onSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onSubcategoryActiveDraftsChange: (updater: SetStateAction<Record<number, boolean>>) => void;
  onSubcategoryGroupDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRenameSubcategory: (subcategory: SettingItem) => Promise<void> | void;
  onToggleSubcategory: (subcategory: SettingItem) => Promise<void> | void;
  onDeleteSubcategory: (subcategory: SettingItem) => Promise<void> | void;
};

export function SubcategoriesSettings({
  subcategories,
  search,
  subcategoryDrafts,
  subcategoryActiveDrafts,
  subcategoryGroupDrafts,
  onSubcategoryDraftsChange,
  onSubcategoryActiveDraftsChange,
  onSubcategoryGroupDraftsChange,
  onRenameSubcategory,
  onToggleSubcategory,
  onDeleteSubcategory,
}: SubcategoriesSettingsProps) {
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<SettingItem | null>(null);
  const [cargoFeedback, setCargoFeedback] = useState<string | null>(null);
  const [cargoError, setCargoError] = useState<string | null>(null);
  const filteredSubcategories = subcategories.filter((subcategory) =>
    subcategory.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function handleOpenEdit(subcategory: SettingItem) {
    onSubcategoryDraftsChange((current) => ({ ...current, [subcategory.id]: current[subcategory.id] ?? subcategory.name }));
    onSubcategoryActiveDraftsChange((current) => ({ ...current, [subcategory.id]: current[subcategory.id] ?? subcategory.active }));
    onSubcategoryGroupDraftsChange((current) => ({ ...current, [subcategory.id]: current[subcategory.id] ?? subcategory.group ?? "" }));
    setActiveActionId(null);
    setCargoFeedback(null);
    setCargoError(null);
    setEditingSubcategory(subcategory);
  }

  async function handleSaveEdit() {
    if (!editingSubcategory) return;
    await onRenameSubcategory(editingSubcategory);
    setEditingSubcategory(null);
    setCargoFeedback("Cargo atualizado com sucesso.");
  }

  async function handleToggleSubcategory(subcategory: SettingItem) {
    setActiveActionId(null);
    setCargoError(null);
    await onToggleSubcategory(subcategory);
    setCargoFeedback(subcategory.active ? "Cargo inativado com sucesso." : "Cargo ativado com sucesso.");
  }

  async function handleDeleteSubcategory(subcategory: SettingItem) {
    setActiveActionId(null);
    setCargoFeedback(null);
    setCargoError(null);
    const confirmed = window.confirm(`Excluir o cargo "${subcategory.name}"? Esta ação só será concluída se ele não estiver vinculado a dados existentes.`);
    if (!confirmed) return;
    try {
      await onDeleteSubcategory(subcategory);
      setCargoFeedback("Cargo excluído com sucesso.");
    } catch (error) {
      setCargoError(error instanceof Error ? error.message : "Não foi possível excluir o cargo.");
    }
  }

  return (
    <div className="settings-column wide">
      <div className="settings-section-heading">
        <h3>Cargos</h3>
        <p className="muted">Defina os cargos utilizados para classificar e segmentar as horas apontadas pelos colaboradores.</p>
      </div>
      {cargoFeedback && <p className="settings-feedback" role="status">{cargoFeedback}</p>}
      {cargoError && <p className="settings-feedback error" role="alert">{cargoError}</p>}
      <div className="settings-list settings-data-table roles-table">
        <div className="settings-table-header">
          <span>Cargo</span>
          <span>Situação</span>
          <span>Ações</span>
        </div>
        {filteredSubcategories.map((subcategory) => (
          <div className={`settings-item settings-table-row ${subcategory.active ? "" : "inactive"}`} key={subcategory.id}>
            <strong className="settings-primary-cell">{subcategory.name}</strong>
            <span className={`settings-status ${subcategory.active ? "active" : "inactive"}`}>
              {subcategory.active ? "Ativo" : "Inativo"}
            </span>
            <div className="settings-action-menu">
              <button
                aria-expanded={activeActionId === subcategory.id}
                aria-label={`Ações do cargo ${subcategory.name}`}
                className="settings-menu-button"
                type="button"
                onClick={() => setActiveActionId((current) => (current === subcategory.id ? null : subcategory.id))}
              >
                <MoreVertical size={17} />
              </button>
              {activeActionId === subcategory.id && (
                <div className="settings-menu-list">
                  <button type="button" onClick={() => handleOpenEdit(subcategory)}>
                    Editar
                  </button>
                  <button type="button" onClick={() => void handleToggleSubcategory(subcategory)}>
                    {subcategory.active ? "Inativar" : "Ativar"}
                  </button>
                  <button type="button" onClick={() => void handleDeleteSubcategory(subcategory)}>
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredSubcategories.length === 0 && <p className="muted">Nenhum cargo encontrado.</p>}
      </div>

      {editingSubcategory && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setEditingSubcategory(null)}>
          <form
            aria-labelledby="cargo-edit-title"
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
              <h3 id="cargo-edit-title">Editar Cargo</h3>
              <p>Atualize os dados usados na segmentação dos colaboradores.</p>
            </header>
            <label>
              <span>Nome do cargo</span>
              <input
                autoFocus
                value={subcategoryDrafts[editingSubcategory.id] ?? editingSubcategory.name}
                onChange={(event) =>
                  onSubcategoryDraftsChange((current) => ({ ...current, [editingSubcategory.id]: event.target.value }))
                }
                placeholder="Ex: Desenvolvedor Back-end"
              />
            </label>
            <label>
              <span>Situação</span>
              <select
                value={String(subcategoryActiveDrafts[editingSubcategory.id] ?? editingSubcategory.active)}
                onChange={(event) =>
                  onSubcategoryActiveDraftsChange((current) => ({
                    ...current,
                    [editingSubcategory.id]: event.target.value === "true",
                  }))
                }
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
            <label>
              <span>Grupo (opcional)</span>
              <input
                value={subcategoryGroupDrafts[editingSubcategory.id] ?? editingSubcategory.group ?? ""}
                onChange={(event) =>
                  onSubcategoryGroupDraftsChange((current) => ({ ...current, [editingSubcategory.id]: event.target.value }))
                }
                placeholder="Ex: Desenvolvimento"
              />
            </label>
            <footer>
              <button className="secondary-button compact" type="button" onClick={() => setEditingSubcategory(null)}>
                Cancelar
              </button>
              <button
                className="primary-button compact"
                disabled={!(subcategoryDrafts[editingSubcategory.id] ?? editingSubcategory.name).trim()}
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
