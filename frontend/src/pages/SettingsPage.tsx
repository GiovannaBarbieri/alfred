import { FolderTree, Layers3, Plus, Search, UsersRound } from "lucide-react";
import { useState, type ReactNode, type SetStateAction } from "react";
import { CategoriesSettings } from "../components/settings/CategoriesSettings";
import { CollaboratorsSettings } from "../components/settings/CollaboratorsSettings";
import { SubcategoriesSettings } from "../components/settings/SubcategoriesSettings";
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
  newSubcategory: string;
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
  subcategoryDrafts: Record<number, string>;
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
  onNewSubcategoryChange: (value: string) => void;
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
  onSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
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
  onCreateSubcategory: () => void;
  onRenameSubcategory: (subcategory: SettingItem) => void;
  onToggleSubcategory: (subcategory: SettingItem) => void;
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
  { id: "subcategories", label: "Subcategorias", icon: <Layers3 size={16} /> },
  { id: "collaborators", label: "Colaboradores", icon: <UsersRound size={16} /> },
];

export function SettingsPage(props: SettingsPageProps) {
  const [settingsSearch, setSettingsSearch] = useState("");
  const [isCategoryCreateOpen, setIsCategoryCreateOpen] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const activeTab = settingsTabs.find((tab) => tab.id === props.settingsTab) ?? settingsTabs[0];
  const searchPlaceholder = props.settingsTab === "categories" ? "Buscar categoria..." : `Buscar em ${activeTab.label.toLowerCase()}`;

  const tabCounts: Record<SettingsTab, number> = {
    categories: props.settingsCategories.length,
    subcategories: props.settingsSubcategories.length,
    collaborators: props.collaboratorProfiles.length,
  };

  function handleOpenCategoryCreate() {
    props.onNewCategoryChange("");
    setSettingsFeedback(null);
    setIsCategoryCreateOpen(true);
  }

  async function handleSaveCategoryCreate() {
    if (!props.newCategory.trim()) return;
    await props.onCreateCategory();
    setIsCategoryCreateOpen(false);
    setSettingsFeedback("Categoria criada com sucesso.");
  }

  return (
    <section className="settings-ai-page">
      <div className="settings-ai-hero">
        <div>
          <h2>Configurações</h2>
          <p>Gerencie categorias, subcategorias e colaboradores utilizados na classificação das atividades.</p>
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
            <span className="settings-tab-count">{tabCounts[tab.id]}</span>
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
      </div>
      {settingsFeedback && <p className="settings-feedback" role="status">{settingsFeedback}</p>}
      <div className="settings-grid">
        {props.settingsTab === "categories" && (
          <CategoriesSettings
            categories={props.settingsCategories}
            search={settingsSearch}
            categoryDrafts={props.categoryDrafts}
            onCategoryDraftsChange={props.onCategoryDraftsChange}
            onRenameCategory={props.onRenameCategory}
            onToggleCategory={props.onToggleCategory}
          />
        )}

        {props.settingsTab === "subcategories" && (
          <SubcategoriesSettings
            subcategories={props.settingsSubcategories}
            search={settingsSearch}
            newSubcategory={props.newSubcategory}
            subcategoryDrafts={props.subcategoryDrafts}
            onNewSubcategoryChange={props.onNewSubcategoryChange}
            onSubcategoryDraftsChange={props.onSubcategoryDraftsChange}
            onCreateSubcategory={props.onCreateSubcategory}
            onRenameSubcategory={props.onRenameSubcategory}
            onToggleSubcategory={props.onToggleSubcategory}
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
              <h3 id="category-create-title">Nova Categoria</h3>
              <p>Informe o nome da categoria que será usada na classificação das atividades.</p>
            </header>
            <label>
              <span>Nome da categoria</span>
              <input
                autoFocus
                value={props.newCategory}
                onChange={(event) => props.onNewCategoryChange(event.target.value)}
                placeholder="Ex: Desenvolvimento"
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

    </section>
  );
}
