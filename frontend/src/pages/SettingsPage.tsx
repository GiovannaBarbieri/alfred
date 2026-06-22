import { FolderTree, Layers3, Plus, Search, UserRound, UsersRound } from "lucide-react";
import { useState, type ReactNode, type SetStateAction } from "react";
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
};

const settingsTabs: Array<{ id: SettingsTab; label: string; icon: ReactNode }> = [
  { id: "categories", label: "Categorias", icon: <FolderTree size={16} /> },
  { id: "subcategories", label: "Cargos", icon: <Layers3 size={16} /> },
  { id: "collaborators", label: "Colaboradores", icon: <UsersRound size={16} /> },
];

const DEFAULT_ROLE_GROUPS = ["Desenvolvimento", "Gestão", "Qualidade", "Dados", "Operações", "Infraestrutura"];
const CUSTOM_GROUP_VALUE = "__custom_group__";

export function SettingsPage(props: SettingsPageProps) {
  const [settingsSearch, setSettingsSearch] = useState("");
  const [isCategoryCreateOpen, setIsCategoryCreateOpen] = useState(false);
  const [isSubcategoryCreateOpen, setIsSubcategoryCreateOpen] = useState(false);
  const [isCustomSubcategoryGroup, setIsCustomSubcategoryGroup] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const activeTab = settingsTabs.find((tab) => tab.id === props.settingsTab) ?? settingsTabs[0];
  const searchPlaceholder =
    props.settingsTab === "categories"
      ? "Buscar categoria..."
      : props.settingsTab === "subcategories"
        ? "Buscar cargo..."
        : `Buscar em ${activeTab.label.toLowerCase()}`;

  const tabCounts: Record<SettingsTab, number> = {
    categories: props.settingsCategories.length,
    subcategories: props.settingsSubcategories.length,
    collaborators: props.collaboratorProfiles.length,
  };
  const roleGroups = Array.from(
    new Set([...DEFAULT_ROLE_GROUPS, ...props.settingsSubcategories.map((subcategory) => subcategory.group).filter(Boolean) as string[]]),
  ).sort((first, second) => first.localeCompare(second, "pt-BR"));

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
      const confirmed = window.confirm("Já existe um registro semelhante cadastrado.\n\nDeseja continuar?");
      if (!confirmed) return;
    }
    await props.onCreateSubcategory();
    setIsSubcategoryCreateOpen(false);
    setSettingsFeedback("Cargo criado com sucesso.");
  }

  return (
    <section className="settings-ai-page">
      <div className="settings-ai-hero">
        <div>
          <h2>Configurações</h2>
          <p>Gerencie categorias, cargos e colaboradores utilizados na classificação das atividades.</p>
        </div>
      </div>

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
            ignoredCollaborators={props.ignoredCollaborators}
            unprofiledCollaborators={props.unprofiledCollaborators}
            search={settingsSearch}
            profileLoginDrafts={props.profileLoginDrafts}
            profileSubcategoryDrafts={props.profileSubcategoryDrafts}
            availableProfileSubcategoryDrafts={props.availableProfileSubcategoryDrafts}
            newCollaboratorLogin={props.newCollaboratorLogin}
            newCollaboratorSubcategoryId={props.newCollaboratorSubcategoryId}
            onNewCollaboratorLoginChange={props.onNewCollaboratorLoginChange}
            onNewCollaboratorSubcategoryIdChange={props.onNewCollaboratorSubcategoryIdChange}
            onProfileLoginDraftsChange={props.onProfileLoginDraftsChange}
            onProfileSubcategoryDraftsChange={props.onProfileSubcategoryDraftsChange}
            onAvailableProfileSubcategoryDraftsChange={props.onAvailableProfileSubcategoryDraftsChange}
            onCreateCollaboratorProfile={props.onCreateCollaboratorProfile}
            onCreateAvailableCollaboratorProfile={props.onCreateAvailableCollaboratorProfile}
            onIgnoreAvailableCollaborator={props.onIgnoreAvailableCollaborator}
            onRestoreIgnoredCollaborator={props.onRestoreIgnoredCollaborator}
            onUpdateCollaboratorProfile={props.onUpdateCollaboratorProfile}
            onToggleCollaboratorProfile={props.onToggleCollaboratorProfile}
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
              <h3 id="category-create-title">
                <FolderTree size={18} />
                Nova Categoria
              </h3>
              <p>Informe o nome da categoria que será usada na classificação das atividades.</p>
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
                placeholder="Utilizada para apontamentos relacionados ao desenvolvimento de funcionalidades."
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
              <h3 id="cargo-create-title">
                <UserRound size={18} />
                Novo Cargo
              </h3>
              <p>Cadastre um cargo para segmentar as horas apontadas pelos colaboradores.</p>
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
              <span>Grupo (opcional)</span>
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
                <option value="">Sem grupo</option>
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

    </section>
  );
}
