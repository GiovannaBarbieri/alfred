import { FolderTree, Layers3, Search, UsersRound } from "lucide-react";
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
  onCreateCategory: () => void;
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
  const activeTab = settingsTabs.find((tab) => tab.id === props.settingsTab) ?? settingsTabs[0];
  const searchPlaceholder = `Buscar em ${activeTab.label.toLowerCase()}`;

  const tabCounts: Record<SettingsTab, number> = {
    categories: props.settingsCategories.length,
    subcategories: props.settingsSubcategories.length,
    collaborators: props.collaboratorProfiles.length,
  };

  return (
    <section className="settings-ai-page">
      <div className="settings-ai-hero">
        <div>
          <span className="eyebrow">Padrao operacional de classificacao</span>
          <h2>Configuracoes de Classificacao</h2>
          <p>Gerencie as categorias aceitas no primeiro colchete e os perfis operacionais usados nas analises por colaborador.</p>
        </div>
        <span className="settings-base-badge">base</span>
      </div>

      <div className="settings-ai-workbench">
        <div className="settings-ai-main">
      <div className="settings-tabs" role="tablist" aria-label="Configuracoes de classificacao">
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
      </div>
      <div className="settings-grid">
        {props.settingsTab === "categories" && (
          <CategoriesSettings
            categories={props.settingsCategories}
            search={settingsSearch}
            newCategory={props.newCategory}
            categoryDrafts={props.categoryDrafts}
            onNewCategoryChange={props.onNewCategoryChange}
            onCategoryDraftsChange={props.onCategoryDraftsChange}
            onCreateCategory={props.onCreateCategory}
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

    </section>
  );
}
