import { MoreVertical } from "lucide-react";
import { useEffect, useMemo, useState, type SetStateAction } from "react";
import type { CollaboratorProfileItem, SettingItem } from "../../types";

type CollaboratorsSettingsProps = {
  subcategories: SettingItem[];
  collaboratorProfiles: CollaboratorProfileItem[];
  search: string;
  profileLoginDrafts: Record<number, string>;
  profileSubcategoryDrafts: Record<number, string>;
  profileActiveDrafts: Record<number, boolean>;
  onProfileLoginDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onProfileSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onProfileActiveDraftsChange: (updater: SetStateAction<Record<number, boolean>>) => void;
  onUpdateCollaboratorProfile: (profile: CollaboratorProfileItem) => Promise<void> | void;
  onToggleCollaboratorProfile: (profile: CollaboratorProfileItem) => Promise<void> | void;
  onDeleteCollaboratorProfile: (profile: CollaboratorProfileItem) => Promise<void> | void;
};

const FEEDBACK_DISMISS_MS = 4000;

export function CollaboratorsSettings({
  subcategories,
  collaboratorProfiles,
  search,
  profileLoginDrafts,
  profileSubcategoryDrafts,
  profileActiveDrafts,
  onProfileLoginDraftsChange,
  onProfileSubcategoryDraftsChange,
  onProfileActiveDraftsChange,
  onUpdateCollaboratorProfile,
  onToggleCollaboratorProfile,
  onDeleteCollaboratorProfile,
}: CollaboratorsSettingsProps) {
  const [activeActionId, setActiveActionId] = useState<number | null>(null);
  const [editingProfile, setEditingProfile] = useState<CollaboratorProfileItem | null>(null);
  const [collaboratorFeedback, setCollaboratorFeedback] = useState<string | null>(null);
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null);
  const subcategoryById = useMemo(
    () => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory])),
    [subcategories],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredProfiles = collaboratorProfiles.filter((profile) => {
    const cargo = subcategoryById.get(profile.subcategoryId);
    const group = cargo?.group ?? "";
    return `${profile.loginUsuario} ${profile.subcategory} ${group}`.toLowerCase().includes(normalizedSearch);
  });
  const activeProfiles = collaboratorProfiles.filter((profile) => profile.active).length;
  const inactiveProfiles = collaboratorProfiles.length - activeProfiles;
  const groupsCount = new Set(
    collaboratorProfiles
      .map((profile) => subcategoryById.get(profile.subcategoryId)?.group)
      .filter(Boolean),
  ).size;

  useEffect(() => {
    if (!collaboratorFeedback) return;
    const timeout = window.setTimeout(() => setCollaboratorFeedback(null), FEEDBACK_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [collaboratorFeedback]);

  useEffect(() => {
    if (!collaboratorError) return;
    const timeout = window.setTimeout(() => setCollaboratorError(null), FEEDBACK_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [collaboratorError]);

  function handleOpenEdit(profile: CollaboratorProfileItem) {
    onProfileLoginDraftsChange((current) => ({ ...current, [profile.id]: current[profile.id] ?? profile.loginUsuario }));
    onProfileSubcategoryDraftsChange((current) => ({ ...current, [profile.id]: current[profile.id] ?? String(profile.subcategoryId) }));
    onProfileActiveDraftsChange((current) => ({ ...current, [profile.id]: current[profile.id] ?? profile.active }));
    setActiveActionId(null);
    setCollaboratorFeedback(null);
    setCollaboratorError(null);
    setEditingProfile(profile);
  }

  async function handleSaveEdit() {
    if (!editingProfile) return;
    await onUpdateCollaboratorProfile(editingProfile);
    setEditingProfile(null);
    setCollaboratorFeedback("Colaborador atualizado com sucesso.");
  }

  async function handleToggleProfile(profile: CollaboratorProfileItem) {
    setActiveActionId(null);
    setCollaboratorError(null);
    await onToggleCollaboratorProfile(profile);
    setCollaboratorFeedback(profile.active ? "Colaborador inativado com sucesso." : "Colaborador ativado com sucesso.");
  }

  async function handleDeleteProfile(profile: CollaboratorProfileItem) {
    setActiveActionId(null);
    setCollaboratorFeedback(null);
    setCollaboratorError(null);
    const confirmed = window.confirm(`Excluir o colaborador "${profile.loginUsuario}"?`);
    if (!confirmed) return;
    try {
      await onDeleteCollaboratorProfile(profile);
      setCollaboratorFeedback("Colaborador excluído com sucesso.");
    } catch (error) {
      setCollaboratorError(error instanceof Error ? error.message : "Não foi possível excluir o colaborador.");
    }
  }

  return (
    <div className="settings-column wide">
      <div className="settings-section-heading">
        <h3>Colaboradores</h3>
        <p className="muted">Associe colaboradores aos cargos utilizados na classificação e análise das horas apontadas.</p>
      </div>
      {collaboratorFeedback && <p className="settings-feedback" role="status">{collaboratorFeedback}</p>}
      {collaboratorError && <p className="settings-feedback error" role="alert">{collaboratorError}</p>}
      <div className="settings-management-summary" aria-label="Resumo de colaboradores">
        <div>
          <strong>{collaboratorProfiles.length}</strong>
          <span>Colaboradores</span>
        </div>
        <div>
          <strong>{activeProfiles}</strong>
          <span>Ativos</span>
        </div>
        <div>
          <strong>{inactiveProfiles}</strong>
          <span>Inativos</span>
        </div>
        <div>
          <strong>{groupsCount}</strong>
          <span>Grupos</span>
        </div>
      </div>
      <div className="settings-list settings-data-table collaborators-table">
        <div className="settings-table-header">
          <span>Colaborador</span>
          <span>Cargo</span>
          <span>Grupo</span>
          <span>Situação</span>
          <span>Ações</span>
        </div>
        {filteredProfiles.map((profile) => {
          const cargo = subcategoryById.get(profile.subcategoryId);
          const group = cargo?.group || "Não informado";

          return (
            <div className={`settings-item settings-table-row ${profile.active ? "" : "inactive"}`} key={profile.id}>
              <strong className="settings-primary-cell">{profile.loginUsuario}</strong>
              <span className="settings-muted-cell">{profile.subcategory}</span>
              <span className="settings-muted-cell">{group}</span>
              <span className={`settings-status ${profile.active ? "active" : "inactive"}`}>
                <i aria-hidden="true" />
                {profile.active ? "Ativo" : "Inativo"}
              </span>
              <div className="settings-action-menu">
                <button
                  aria-expanded={activeActionId === profile.id}
                  aria-label={`Ações do colaborador ${profile.loginUsuario}`}
                  className="settings-menu-button"
                  title="Ações"
                  type="button"
                  onClick={() => setActiveActionId((current) => (current === profile.id ? null : profile.id))}
                >
                  <MoreVertical size={17} />
                </button>
                {activeActionId === profile.id && (
                  <div className="settings-menu-list">
                    <button type="button" onClick={() => handleOpenEdit(profile)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => void handleToggleProfile(profile)}>
                      Alterar situação
                    </button>
                    <button type="button" onClick={() => void handleDeleteProfile(profile)}>
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {filteredProfiles.length === 0 && <p className="muted">Nenhum colaborador encontrado.</p>}
      </div>

      {editingProfile && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setEditingProfile(null)}>
          <form
            aria-labelledby="collaborator-edit-title"
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
              <h3 id="collaborator-edit-title">Editar Colaborador</h3>
              <p>Atualize o colaborador, cargo e situação utilizados na análise das horas.</p>
            </header>
            <label>
              <span>Nome/Login do colaborador</span>
              <input
                autoFocus
                value={profileLoginDrafts[editingProfile.id] ?? editingProfile.loginUsuario}
                onChange={(event) => onProfileLoginDraftsChange((current) => ({ ...current, [editingProfile.id]: event.target.value }))}
                placeholder="Digite o nome ou login do colaborador"
              />
            </label>
            <label>
              <span>Cargo</span>
              <select
                value={profileSubcategoryDrafts[editingProfile.id] ?? String(editingProfile.subcategoryId)}
                onChange={(event) => onProfileSubcategoryDraftsChange((current) => ({ ...current, [editingProfile.id]: event.target.value }))}
              >
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Situação</span>
              <select
                value={String(profileActiveDrafts[editingProfile.id] ?? editingProfile.active)}
                onChange={(event) =>
                  onProfileActiveDraftsChange((current) => ({ ...current, [editingProfile.id]: event.target.value === "true" }))
                }
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
            <footer>
              <button className="secondary-button compact" type="button" onClick={() => setEditingProfile(null)}>
                Cancelar
              </button>
              <button className="primary-button compact" type="submit">
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
