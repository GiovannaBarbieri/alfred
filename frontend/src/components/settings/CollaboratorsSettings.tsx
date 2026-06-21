import type { SetStateAction } from "react";
import type { CollaboratorProfileItem, IgnoredCollaboratorItem, SettingItem } from "../../types";

type CollaboratorsSettingsProps = {
  subcategories: SettingItem[];
  collaboratorProfiles: CollaboratorProfileItem[];
  ignoredCollaborators: IgnoredCollaboratorItem[];
  unprofiledCollaborators: string[];
  search: string;
  profileLoginDrafts: Record<number, string>;
  profileSubcategoryDrafts: Record<number, string>;
  availableProfileSubcategoryDrafts: Record<string, string>;
  newCollaboratorLogin: string;
  newCollaboratorSubcategoryId: string;
  onNewCollaboratorLoginChange: (value: string) => void;
  onNewCollaboratorSubcategoryIdChange: (value: string) => void;
  onProfileLoginDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onProfileSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onAvailableProfileSubcategoryDraftsChange: (updater: SetStateAction<Record<string, string>>) => void;
  onCreateCollaboratorProfile: () => void;
  onCreateAvailableCollaboratorProfile: (loginUsuario: string) => void;
  onIgnoreAvailableCollaborator: (loginUsuario: string) => void;
  onRestoreIgnoredCollaborator: (ignoredId: number) => void;
  onUpdateCollaboratorProfile: (profile: CollaboratorProfileItem) => void;
  onToggleCollaboratorProfile: (profile: CollaboratorProfileItem) => void;
};

export function CollaboratorsSettings({
  subcategories,
  collaboratorProfiles,
  ignoredCollaborators,
  unprofiledCollaborators,
  search,
  profileLoginDrafts,
  profileSubcategoryDrafts,
  availableProfileSubcategoryDrafts,
  newCollaboratorLogin,
  newCollaboratorSubcategoryId,
  onNewCollaboratorLoginChange,
  onNewCollaboratorSubcategoryIdChange,
  onProfileLoginDraftsChange,
  onProfileSubcategoryDraftsChange,
  onAvailableProfileSubcategoryDraftsChange,
  onCreateCollaboratorProfile,
  onCreateAvailableCollaboratorProfile,
  onIgnoreAvailableCollaborator,
  onRestoreIgnoredCollaborator,
  onUpdateCollaboratorProfile,
  onToggleCollaboratorProfile,
}: CollaboratorsSettingsProps) {
  const normalizedSearch = search.trim().toLowerCase();
  const filteredUnprofiledCollaborators = unprofiledCollaborators.filter((login) =>
    login.toLowerCase().includes(normalizedSearch),
  );
  const filteredIgnoredCollaborators = ignoredCollaborators.filter((item) =>
    item.loginUsuario.toLowerCase().includes(normalizedSearch),
  );
  const filteredProfiles = collaboratorProfiles.filter((profile) =>
    `${profile.loginUsuario} ${profile.subcategory}`.toLowerCase().includes(normalizedSearch),
  );

  return (
    <div className="settings-column wide">
      <h3>Perfil dos colaboradores</h3>
      <p className="muted">Associe colaboradores a perfis operacionais para analisar horas por Back, Front, Analista ou QA.</p>
      <div className="settings-create-row collaborator-create-row">
        <input
          placeholder="Login do colaborador"
          value={newCollaboratorLogin}
          onChange={(event) => onNewCollaboratorLoginChange(event.target.value)}
        />
        <select
          value={newCollaboratorSubcategoryId}
          onChange={(event) => onNewCollaboratorSubcategoryIdChange(event.target.value)}
        >
          <option value="">Perfil</option>
          {subcategories
            .filter((subcategory) => subcategory.active)
            .map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
            ))}
        </select>
        <button
          className="primary-button compact"
          disabled={!newCollaboratorLogin.trim() || !newCollaboratorSubcategoryId}
          type="button"
          onClick={onCreateCollaboratorProfile}
        >
          Adicionar
        </button>
      </div>
      {filteredUnprofiledCollaborators.length > 0 && (
        <div className="available-collaborators">
          <h4>Colaboradores sem perfil</h4>
          {filteredUnprofiledCollaborators.map((login) => (
            <div className="available-collaborator-row" key={login}>
              <strong>{login}</strong>
              <select
                value={availableProfileSubcategoryDrafts[login] || ""}
                onChange={(event) =>
                  onAvailableProfileSubcategoryDraftsChange((current) => ({
                    ...current,
                    [login]: event.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                ))}
              </select>
              <button
                className="secondary-button compact"
                disabled={!availableProfileSubcategoryDrafts[login]}
                type="button"
                onClick={() => onCreateAvailableCollaboratorProfile(login)}
              >
                Classificar
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onIgnoreAvailableCollaborator(login)}>
                Ignorar
              </button>
            </div>
          ))}
        </div>
      )}
      {filteredIgnoredCollaborators.length > 0 && (
        <div className="available-collaborators ignored-collaborators">
          <h4>Colaboradores ignorados</h4>
          {filteredIgnoredCollaborators.map((item) => (
            <div className="available-collaborator-row ignored-row" key={item.id}>
              <strong>{item.loginUsuario}</strong>
              <span className="muted">Fora da fila de classificação</span>
              <button className="secondary-button compact" type="button" onClick={() => onRestoreIgnoredCollaborator(item.id)}>
                Restaurar
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="keyword-list settings-data-table collaborators-table">
        <h4>Perfis cadastrados</h4>
        <div className="settings-table-header">
          <span>Colaborador</span>
          <span>Perfil</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        {filteredProfiles.map((profile) => (
          <div className={`collaborator-profile-row settings-table-row ${profile.active ? "" : "inactive"}`} key={profile.id}>
            <input
              value={profileLoginDrafts[profile.id] ?? profile.loginUsuario}
              onChange={(event) => onProfileLoginDraftsChange((current) => ({ ...current, [profile.id]: event.target.value }))}
            />
            <select
              value={profileSubcategoryDrafts[profile.id] ?? String(profile.subcategoryId)}
              onChange={(event) => onProfileSubcategoryDraftsChange((current) => ({ ...current, [profile.id]: event.target.value }))}
            >
              {subcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
              ))}
            </select>
            <span className={`settings-status ${profile.active ? "active" : "inactive"}`}>{profile.active ? "Ativo" : "Inativo"}</span>
            <div className="settings-row-actions">
              <button
                className="secondary-button compact"
                disabled={
                  (profileLoginDrafts[profile.id] ?? profile.loginUsuario).trim() === profile.loginUsuario &&
                  Number(profileSubcategoryDrafts[profile.id] || profile.subcategoryId) === profile.subcategoryId
                }
                type="button"
                onClick={() => onUpdateCollaboratorProfile(profile)}
              >
                Salvar
              </button>
              <button className="secondary-button compact" type="button" onClick={() => onToggleCollaboratorProfile(profile)}>
                {profile.active ? "Inativar" : "Ativar"}
              </button>
            </div>
          </div>
        ))}
        {filteredProfiles.length === 0 && (
          <p className="muted">
            Cadastre colaboradores Back, Front, Analista ou QA para analisar horas por perfil operacional.
          </p>
        )}
      </div>
    </div>
  );
}
