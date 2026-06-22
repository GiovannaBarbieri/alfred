import { FolderTree, Layers3, Plus, Search, UsersRound } from "lucide-react";
import { useEffect, useState, type ReactNode, type SetStateAction } from "react";
import { CategoriesSettings } from "../components/settings/CategoriesSettings";
import { CollaboratorsSettings } from "../components/settings/CollaboratorsSettings";
import { SubcategoriesSettings } from "../components/settings/SubcategoriesSettings";
import { hasSimilarSettingName } from "../utils/settingsValidation";
import type {
  ClassificationRuleItem,
  CollaboratorProfileItem,
  IgnoredCollaboratorItem,
  KeywordItem,
  SettingItem,
} from "../types";

export type SettingsTab = "categories" | "subcategories" | "collaborators";

type SettingsPageProps = {
  settingsTab: SettingsTab;
  onSettingsTabChange: (tab: SettingsTab) => void;
  settingsCategories: SettingItem[];
  settingsSubcategories: SettingItem[];
  settingsKeywords: KeywordItem[];
  classificationRules: ClassificationRuleItem[];
  collaboratorProfiles: CollaboratorProfileItem[];
  ignoredCollaborators: IgnoredCollaboratorItem[];
  unprofiledCollaborators: string[];
  newCategory: string;
  newCategoryDescription: string;
  newSubcategory: string;
  newSubcategoryActive: boolean;
  newSubcategoryGroup: string;
  newKeyword: string;
  newKeywordCategoryId: string;
  newRuleName: string;
  newRuleCategoryId: string;
  newRuleSubcategoryId: string;
  newRuleKeywords: string;
  newRulePriority: string;
  newRuleVersion: string;
  newCollaboratorLogin: string;
  newCollaboratorSubcategoryId: string;
  newCollaboratorActive: boolean;
  categoryDrafts: Record<number, string>;
  categoryDescriptionDrafts: Record<number, string>;
  subcategoryDrafts: Record<number, string>;
  subcategoryActiveDrafts: Record<number, boolean>;
  subcategoryGroupDrafts: Record<number, string>;
  keywordDrafts: Record<number, string>;
  keywordCategoryDrafts: Record<number, string>;
  ruleNameDrafts: Record<number, string>;
  ruleCategoryDrafts: Record<number, string>;
  ruleSubcategoryDrafts: Record<number, string>;
  ruleKeywordDrafts: Record<number, string>;
  rulePriorityDrafts: Record<number, string>;
  ruleVersionDrafts: Record<number, string>;
  profileLoginDrafts: Record<number, string>;
  profileSubcategoryDrafts: Record<number, string>;
  profileActiveDrafts: Record<number, boolean>;
  availableProfileSubcategoryDrafts: Record<string, string>;
  onNewCategoryChange: (value: string) => void;
  onNewCategoryDescriptionChange: (value: string) => void;
  onNewSubcategoryChange: (value: string) => void;
  onNewSubcategoryActiveChange: (value: boolean) => void;
  onNewSubcategoryGroupChange: (value: string) => void;
  onNewKeywordChange: (value: string) => void;
  onNewKeywordCategoryIdChange: (value: string) => void;
  onNewRuleNameChange: (value: string) => void;
  onNewRuleCategoryIdChange: (value: string) => void;
  onNewRuleSubcategoryIdChange: (value: string) => void;
  onNewRuleKeywordsChange: (value: string) => void;
  onNewRulePriorityChange: (value: string) => void;
  onNewRuleVersionChange: (value: string) => void;
  onNewCollaboratorLoginChange: (value: string) => void;
  onNewCollaboratorSubcategoryIdChange: (value: string) => void;
  onNewCollaboratorActiveChange: (value: boolean) => void;
  onCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onCategoryDescriptionDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onSubcategoryActiveDraftsChange: (updater: SetStateAction<Record<number, boolean>>) => void;
  onSubcategoryGroupDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onKeywordDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onKeywordCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleNameDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleKeywordDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRulePriorityDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleVersionDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onProfileLoginDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onProfileSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onProfileActiveDraftsChange: (updater: SetStateAction<Record<number, boolean>>) => void;
  onAvailableProfileSubcategoryDraftsChange: (updater: SetStateAction<Record<string, string>>) => void;
  onCreateCategory: () => Promise<void> | void;
  onRenameCategory: (category: SettingItem) => void;
  onToggleCategory: (category: SettingItem) => void;
  onDeleteCategory: (category: SettingItem) => void;
  onCreateSubcategory: () => void;
  onRenameSubcategory: (subcategory: SettingItem) => void;
  onToggleSubcategory: (subcategory: SettingItem) => void;
  onDeleteSubcategory: (subcategory: SettingItem) => void;
  onCreateKeyword: () => void;
  onUpdateKeyword: (keyword: KeywordItem) => void;
  onToggleKeyword: (keyword: KeywordItem) => void;
  onBulkToggleKeywords: (keywordIds: number[], active: boolean) => void;
  onBulkUpdateKeywordCategory: (keywordIds: number[], categoryId: number) => void;
  onCreateClassificationRule: () => void;
  onUpdateClassificationRule: (rule: ClassificationRuleItem) => void;
  onToggleClassificationRule: (rule: ClassificationRuleItem) => void;
  onCreateCollaboratorProfile: () => void;
  onCreateAvailableCollaboratorProfile: (loginUsuario: string) => void;
  onIgnoreAvailableCollaborator: (loginUsuario: string) => void;
  onRestoreIgnoredCollaborator: (ignoredId: number) => void;
  onUpdateCollaboratorProfile: (profile: CollaboratorProfileItem) => void;
  onToggleCollaboratorProfile: (profile: CollaboratorProfileItem) => void;
  onDeleteCollaboratorProfile: (profile: CollaboratorProfileItem) => void;
};

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: "categories", label: "Categorias", icon: <FolderTree size={16} /> },
  { id: "subcategories", label: "Cargos", icon: <Layers3 size={16} /> },
  { id: "collaborators", label: "Colaboradores", icon: <UsersRound size={16} /> },
];

const DEFAULT_ROLE_GROUPS = ["Desenvolvimento", "Gestão", "Qualidade", "Dados", "Operações", "Infraestrutura"];
const CUSTOM_GROUP_VALUE = "__custom_group__";
const FEEDBACK_DISMISS_MS = 4000;

function normalizeCollaboratorLogin(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function SettingsPage(props: SettingsPageProps) {
  const [settingsSearch, setSettingsSearch] = useState("");
  const [isCategoryCreateOpen, setIsCategoryCreateOpen] = useState(false);
  const [isSubcategoryCreateOpen, setIsSubcategoryCreateOpen] = useState(false);
  const [isCollaboratorCreateOpen, setIsCollaboratorCreateOpen] = useState(false);
  const [isCustomSubcategoryGroup, setIsCustomSubcategoryGroup] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const activeTab = settingsTabs.find((tab) => tab.id === props.settingsTab) ?? settingsTabs[0];
  const searchPlaceholder =
    props.settingsTab === "categories"
      ? "Buscar categoria..."
      : props.settingsTab === "subcategories"
        ? "Buscar cargo..."
        : "Buscar colaborador...";

  const tabCounts: Record<SettingsTab, number> = {
    categories: props.settingsCategories.length,
    subcategories: props.settingsSubcategories.length,
    collaborators: props.collaboratorProfiles.length,
  };
  const roleGroups = Array.from(
    new Set([...DEFAULT_ROLE_GROUPS, ...props.settingsSubcategories.map((subcategory) => subcategory.group).filter(Boolean) as string[]]),
  ).sort((first, second) => first.localeCompare(second, "pt-BR"));

  useEffect(() => {
    if (!settingsFeedback) return;
    const timeout = window.setTimeout(() => setSettingsFeedback(null), FEEDBACK_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [settingsFeedback]);

  function handleOpenCategoryCreate() {
    props.onNewCategoryChange("");
    props.onNewCategoryDescriptionChange("");
    setSettingsFeedback(null);
    setIsCategoryCreateOpen(true);
  }

  function handleOpenSubcategoryCreate() {
    props.onNewSubcategoryChange("");
    props.onNewSubcategoryActiveChange(true);
    props.onNewSubcategoryGroupChange("");
    setIsCustomSubcategoryGroup(false);
    setSettingsFeedback(null);
    setIsSubcategoryCreateOpen(true);
  }

  function handleOpenCollaboratorCreate() {
    props.onNewCollaboratorLoginChange("");
    props.onNewCollaboratorSubcategoryIdChange("");
    props.onNewCollaboratorActiveChange(true);
    setSettingsFeedback(null);
    setIsCollaboratorCreateOpen(true);
  }

  async function handleSaveCategoryCreate() {
    if (!props.newCategory.trim()) return;
    if (hasSimilarSettingName(props.settingsCategories, props.newCategory)) {
      const confirmed = window.confirm("Já existe um registro semelhante cadastrado.\n\nDeseja continuar?");
      if (!confirmed) return;
    }
    await props.onCreateCategory();
    setIsCategoryCreateOpen(false);
    setSettingsFeedback("Categoria criada com sucesso.");
  }

  async function handleSaveSubcategoryCreate() {
    if (!props.newSubcategory.trim()) return;
    if (hasSimilarSettingName(props.settingsSubcategories, props.newSubcategory)) {
      window.alert("Já existe um cargo semelhante cadastrado.");
      return;
    }
    await props.onCreateSubcategory();
    setIsSubcategoryCreateOpen(false);
    setSettingsFeedback("Cargo criado com sucesso.");
  }

  async function handleSaveCollaboratorCreate() {
    if (!props.newCollaboratorLogin.trim() || !props.newCollaboratorSubcategoryId) return;
    const normalizedLogin = normalizeCollaboratorLogin(props.newCollaboratorLogin);
    const hasActiveLink = props.collaboratorProfiles.some(
      (profile) => profile.active && normalizeCollaboratorLogin(profile.loginUsuario) === normalizedLogin,
    );
    if (hasActiveLink) {
      window.alert("Este colaborador já possui um vínculo ativo cadastrado.");
      return;
    }
    try {
      await props.onCreateCollaboratorProfile();
      setIsCollaboratorCreateOpen(false);
      setSettingsFeedback("Vínculo criado com sucesso.");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível criar o vínculo.");
    }
  }

  return (
    <section className="settings-ai-page">
      <div className="settings-ai-workbench">
        <div className="settings-ai-main">
      <div className="settings-tabs" role="tablist" aria-label="Configurações de classificação">
        {settingsTabs.map((tab) => (
          <button
            className={props.settingsTab === tab.id ? "active" : ""}
            key={tab.id}
            type="button"
            onClick={() => props.onSettingsTabChange(tab.id)}
          >
            {tab.icon}
            {tab.label}
            <span className="settings-tab-count">({tabCounts[tab.id]})</span>
          </button>
        ))}
      </div>
      <div className="settings-ai-toolbar">
        <label>
          <Search size={16} />
          <input value={settingsSearch} onChange={(event) => setSettingsSearch(event.target.value)} placeholder={searchPlaceholder} />
        </label>
        {props.settingsTab === "categories" && (
          <button className="primary-button compact settings-add-button" type="button" onClick={handleOpenCategoryCreate}>
            <Plus size={15} />
            Nova Categoria
          </button>
        )}
        {props.settingsTab === "subcategories" && (
          <button className="primary-button compact settings-add-button" type="button" onClick={handleOpenSubcategoryCreate}>
            <Plus size={15} />
            Novo Cargo
          </button>
        )}
        {props.settingsTab === "collaborators" && (
          <button className="primary-button compact settings-add-button" type="button" onClick={handleOpenCollaboratorCreate}>
            <Plus size={15} />
            Novo Colaborador
          </button>
        )}
      </div>
      {settingsFeedback && <p className="settings-feedback" role="status">{settingsFeedback}</p>}
      <div className="settings-grid">
        {props.settingsTab === "categories" && (
          <CategoriesSettings
            categories={props.settingsCategories}
            search={settingsSearch}
            categoryDrafts={props.categoryDrafts}
            categoryDescriptionDrafts={props.categoryDescriptionDrafts}
            onCategoryDraftsChange={props.onCategoryDraftsChange}
            onCategoryDescriptionDraftsChange={props.onCategoryDescriptionDraftsChange}
            onRenameCategory={props.onRenameCategory}
            onToggleCategory={props.onToggleCategory}
            onDeleteCategory={props.onDeleteCategory}
          />
        )}

        {props.settingsTab === "subcategories" && (
          <SubcategoriesSettings
            subcategories={props.settingsSubcategories}
            search={settingsSearch}
            subcategoryDrafts={props.subcategoryDrafts}
            subcategoryActiveDrafts={props.subcategoryActiveDrafts}
            subcategoryGroupDrafts={props.subcategoryGroupDrafts}
            availableGroups={roleGroups}
            onSubcategoryDraftsChange={props.onSubcategoryDraftsChange}
            onSubcategoryActiveDraftsChange={props.onSubcategoryActiveDraftsChange}
            onSubcategoryGroupDraftsChange={props.onSubcategoryGroupDraftsChange}
            onRenameSubcategory={props.onRenameSubcategory}
            onToggleSubcategory={props.onToggleSubcategory}
            onDeleteSubcategory={props.onDeleteSubcategory}
          />
        )}

        {props.settingsTab === "collaborators" && (
          <CollaboratorsSettings
            subcategories={props.settingsSubcategories}
            collaboratorProfiles={props.collaboratorProfiles}
            search={settingsSearch}
            profileLoginDrafts={props.profileLoginDrafts}
            profileSubcategoryDrafts={props.profileSubcategoryDrafts}
            profileActiveDrafts={props.profileActiveDrafts}
            onProfileLoginDraftsChange={props.onProfileLoginDraftsChange}
            onProfileSubcategoryDraftsChange={props.onProfileSubcategoryDraftsChange}
            onProfileActiveDraftsChange={props.onProfileActiveDraftsChange}
            onUpdateCollaboratorProfile={props.onUpdateCollaboratorProfile}
            onToggleCollaboratorProfile={props.onToggleCollaboratorProfile}
            onDeleteCollaboratorProfile={props.onDeleteCollaboratorProfile}
          />
        )}
      </div>
        </div>
      </div>

      {isCategoryCreateOpen && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsCategoryCreateOpen(false)}>
          <form
            aria-labelledby="category-create-title"
            aria-modal="true"
            className="settings-modal-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCategoryCreate();
            }}
          >
            <header>
              <h3 id="category-create-title">📂 Nova Categoria</h3>
              <p>Defina uma categoria para organizar e classificar as atividades apontadas pelos colaboradores.</p>
            </header>
            <label>
              <span>Nome da categoria</span>
              <input
                autoFocus
                value={props.newCategory}
                onChange={(event) => props.onNewCategoryChange(event.target.value)}
                placeholder="Digite o nome da categoria"
              />
            </label>
            <label>
              <span>Descrição (opcional)</span>
              <textarea
                maxLength={255}
                value={props.newCategoryDescription}
                onChange={(event) => props.onNewCategoryDescriptionChange(event.target.value)}
                placeholder="Descreva quando esta categoria deve ser utilizada."
              />
            </label>
            <footer>
              <button className="secondary-button compact" type="button" onClick={() => setIsCategoryCreateOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={!props.newCategory.trim()} type="submit">
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}

      {isSubcategoryCreateOpen && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsSubcategoryCreateOpen(false)}>
          <form
            aria-labelledby="cargo-create-title"
            aria-modal="true"
            className="settings-modal-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveSubcategoryCreate();
            }}
          >
            <header>
              <h3 id="cargo-create-title">👤 Novo Cargo</h3>
              <p>Defina os cargos utilizados para classificar e segmentar as horas apontadas pelos colaboradores.</p>
            </header>
            <label>
              <span>Nome do cargo</span>
              <input
                autoFocus
                value={props.newSubcategory}
                onChange={(event) => props.onNewSubcategoryChange(event.target.value)}
                placeholder="Digite o nome do cargo"
              />
            </label>
            <label>
              <span>Situação</span>
              <select
                value={String(props.newSubcategoryActive)}
                onChange={(event) => props.onNewSubcategoryActiveChange(event.target.value === "true")}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
            <label>
              <span>Grupo</span>
              <select
                value={isCustomSubcategoryGroup ? CUSTOM_GROUP_VALUE : props.newSubcategoryGroup}
                onChange={(event) => {
                  if (event.target.value === CUSTOM_GROUP_VALUE) {
                    setIsCustomSubcategoryGroup(true);
                    props.onNewSubcategoryGroupChange("");
                    return;
                  }
                  setIsCustomSubcategoryGroup(false);
                  props.onNewSubcategoryGroupChange(event.target.value);
                }}
              >
                <option value="">Selecione um grupo</option>
                {roleGroups.map((group) => (
                  <option key={group} value={group}>
                    {group}
                  </option>
                ))}
                <option value={CUSTOM_GROUP_VALUE}>Adicionar novo grupo</option>
              </select>
            </label>
            {isCustomSubcategoryGroup && (
              <label>
                <span>Novo grupo</span>
                <input
                  value={props.newSubcategoryGroup}
                  onChange={(event) => props.onNewSubcategoryGroupChange(event.target.value)}
                  placeholder="Digite o nome do grupo"
                />
              </label>
            )}
            <footer>
              <button className="secondary-button compact" type="button" onClick={() => setIsSubcategoryCreateOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button compact" disabled={!props.newSubcategory.trim()} type="submit">
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}

      {isCollaboratorCreateOpen && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsCollaboratorCreateOpen(false)}>
          <form
            aria-labelledby="collaborator-create-title"
            aria-modal="true"
            className="settings-modal-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCollaboratorCreate();
            }}
          >
            <header>
              <h3 id="collaborator-create-title">👤 Novo Colaborador</h3>
              <p>Vincule um colaborador ao cargo utilizado na classificação e análise das horas apontadas.</p>
            </header>
            <label>
              <span>Colaborador</span>
              <input
                autoFocus
                value={props.newCollaboratorLogin}
                onChange={(event) => props.onNewCollaboratorLoginChange(event.target.value)}
                placeholder="Buscar colaborador..."
              />
            </label>
            <label>
              <span>Cargo</span>
              <select
                value={props.newCollaboratorSubcategoryId}
                onChange={(event) => props.onNewCollaboratorSubcategoryIdChange(event.target.value)}
              >
                <option value="">Selecione um cargo</option>
                {props.settingsSubcategories
                  .filter((subcategory) => subcategory.active)
                  .map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Situação</span>
              <select
                value={String(props.newCollaboratorActive)}
                onChange={(event) => props.onNewCollaboratorActiveChange(event.target.value === "true")}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </label>
            <footer>
              <button className="secondary-button compact" type="button" onClick={() => setIsCollaboratorCreateOpen(false)}>
                Cancelar
              </button>
              <button
                className="primary-button compact"
                disabled={!props.newCollaboratorLogin.trim() || !props.newCollaboratorSubcategoryId}
                type="submit"
              >
                Salvar
              </button>
            </footer>
          </form>
        </div>
      )}

    </section>
  );
}
