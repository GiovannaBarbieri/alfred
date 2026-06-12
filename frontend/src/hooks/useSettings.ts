import { useState } from "react";

import {
  createCategory,
  createClassificationRule,
  createCollaboratorProfile,
  createKeyword,
  createSubcategory,
  getCategories,
  getClassificationRules,
  getCollaboratorProfiles,
  getIgnoredCollaborators,
  getKeywords,
  getSubcategories,
  ignoreCollaborator,
  restoreIgnoredCollaborator,
  updateCategory,
  updateClassificationRule,
  updateCollaboratorProfile,
  updateKeyword,
  updateSubcategory,
} from "../services/api";
import type {
  ClassificationRuleItem,
  CollaboratorProfileItem,
  IgnoredCollaboratorItem,
  KeywordItem,
  SettingItem,
} from "../types";

export function useSettings(onCategoryChanged: () => Promise<void>) {
  const [settingsCategories, setSettingsCategories] = useState<SettingItem[]>([]);
  const [settingsSubcategories, setSettingsSubcategories] = useState<SettingItem[]>([]);
  const [settingsKeywords, setSettingsKeywords] = useState<KeywordItem[]>([]);
  const [classificationRules, setClassificationRules] = useState<ClassificationRuleItem[]>([]);
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfileItem[]>([]);
  const [ignoredCollaborators, setIgnoredCollaborators] = useState<IgnoredCollaboratorItem[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordCategoryId, setNewKeywordCategoryId] = useState("");
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [newRuleSubcategoryId, setNewRuleSubcategoryId] = useState("");
  const [newRuleKeywords, setNewRuleKeywords] = useState("");
  const [newRulePriority, setNewRulePriority] = useState("10");
  const [newRuleVersion, setNewRuleVersion] = useState("1.0.0");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, string>>({});
  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<number, string>>({});
  const [keywordDrafts, setKeywordDrafts] = useState<Record<number, string>>({});
  const [keywordCategoryDrafts, setKeywordCategoryDrafts] = useState<Record<number, string>>({});
  const [ruleNameDrafts, setRuleNameDrafts] = useState<Record<number, string>>({});
  const [ruleCategoryDrafts, setRuleCategoryDrafts] = useState<Record<number, string>>({});
  const [ruleSubcategoryDrafts, setRuleSubcategoryDrafts] = useState<Record<number, string>>({});
  const [ruleKeywordDrafts, setRuleKeywordDrafts] = useState<Record<number, string>>({});
  const [rulePriorityDrafts, setRulePriorityDrafts] = useState<Record<number, string>>({});
  const [ruleVersionDrafts, setRuleVersionDrafts] = useState<Record<number, string>>({});
  const [profileLoginDrafts, setProfileLoginDrafts] = useState<Record<number, string>>({});
  const [profileSubcategoryDrafts, setProfileSubcategoryDrafts] = useState<Record<number, string>>({});
  const [availableProfileSubcategoryDrafts, setAvailableProfileSubcategoryDrafts] = useState<Record<string, string>>({});

  async function refreshSettings() {
    const [categories, subcategories, keywords, rules, profiles, ignored] = await Promise.all([
      getCategories(),
      getSubcategories(),
      getKeywords(),
      getClassificationRules(),
      getCollaboratorProfiles(),
      getIgnoredCollaborators(),
    ]);
    setSettingsCategories(categories);
    setSettingsSubcategories(subcategories);
    setSettingsKeywords(keywords);
    setClassificationRules(rules);
    setCollaboratorProfiles(profiles);
    setIgnoredCollaborators(ignored);
    setCategoryDrafts(Object.fromEntries(categories.map((category) => [category.id, category.name])));
    setSubcategoryDrafts(Object.fromEntries(subcategories.map((subcategory) => [subcategory.id, subcategory.name])));
    setKeywordDrafts(Object.fromEntries(keywords.map((keyword) => [keyword.id, keyword.keyword])));
    setKeywordCategoryDrafts(
      Object.fromEntries(keywords.map((keyword) => [keyword.id, String(keyword.categoryId)])),
    );
    setRuleNameDrafts(Object.fromEntries(rules.map((rule) => [rule.id, rule.name])));
    setRuleCategoryDrafts(Object.fromEntries(rules.map((rule) => [rule.id, String(rule.categoryId)])));
    setRuleSubcategoryDrafts(
      Object.fromEntries(rules.map((rule) => [rule.id, rule.subcategoryId ? String(rule.subcategoryId) : ""])),
    );
    setRuleKeywordDrafts(Object.fromEntries(rules.map((rule) => [rule.id, rule.keywords.join(", ")])));
    setRulePriorityDrafts(Object.fromEntries(rules.map((rule) => [rule.id, String(rule.priority)])));
    setRuleVersionDrafts(Object.fromEntries(rules.map((rule) => [rule.id, rule.version])));
    setProfileLoginDrafts(Object.fromEntries(profiles.map((profile) => [profile.id, profile.loginUsuario])));
    setProfileSubcategoryDrafts(
      Object.fromEntries(profiles.map((profile) => [profile.id, String(profile.subcategoryId)])),
    );
    setNewKeywordCategoryId((current) => {
      if (categories.some((category) => category.active && String(category.id) === current)) return current;
      return String(categories.find((category) => category.active)?.id ?? "");
    });
    setNewRuleCategoryId((current) => {
      if (categories.some((category) => category.active && String(category.id) === current)) return current;
      return String(categories.find((category) => category.active)?.id ?? "");
    });
  }

  async function handleCreateCategory() {
    if (!newCategory.trim()) return;
    await createCategory(newCategory);
    setNewCategory("");
    await refreshSettings();
    await onCategoryChanged();
  }

  async function handleCreateSubcategory() {
    if (!newSubcategory.trim()) return;
    await createSubcategory(newSubcategory);
    setNewSubcategory("");
    await refreshSettings();
  }

  async function handleCreateKeyword() {
    if (!newKeyword.trim() || !newKeywordCategoryId) return;
    const category = settingsCategories.find((item) => item.id === Number(newKeywordCategoryId));
    if (!category?.active) return;
    await createKeyword(Number(newKeywordCategoryId), newKeyword);
    setNewKeyword("");
    await refreshSettings();
  }

  async function handleCreateAvailableCollaboratorProfile(loginUsuario: string) {
    const subcategoryId = Number(availableProfileSubcategoryDrafts[loginUsuario] || "");
    if (!loginUsuario || !subcategoryId) return;
    await createCollaboratorProfile(loginUsuario, subcategoryId);
    await refreshSettings();
  }

  async function handleIgnoreAvailableCollaborator(loginUsuario: string) {
    await ignoreCollaborator(loginUsuario);
    await refreshSettings();
  }

  async function handleRestoreIgnoredCollaborator(ignoredId: number) {
    await restoreIgnoredCollaborator(ignoredId);
    await refreshSettings();
  }

  async function handleRenameCategory(category: SettingItem) {
    const name = categoryDrafts[category.id]?.trim();
    if (!name || name === category.name) return;
    await updateCategory(category.id, { name });
    await refreshSettings();
    await onCategoryChanged();
  }

  async function handleToggleCategory(category: SettingItem) {
    await updateCategory(category.id, { active: !category.active });
    await refreshSettings();
    await onCategoryChanged();
  }

  async function handleRenameSubcategory(subcategory: SettingItem) {
    const name = subcategoryDrafts[subcategory.id]?.trim();
    if (!name || name === subcategory.name) return;
    await updateSubcategory(subcategory.id, { name });
    await refreshSettings();
  }

  async function handleToggleSubcategory(subcategory: SettingItem) {
    await updateSubcategory(subcategory.id, { active: !subcategory.active });
    await refreshSettings();
  }

  async function handleUpdateKeyword(keyword: KeywordItem) {
    const nextKeyword = keywordDrafts[keyword.id]?.trim();
    const nextCategoryId = Number(keywordCategoryDrafts[keyword.id] || keyword.categoryId);
    if (!nextKeyword || !nextCategoryId) return;
    const category = settingsCategories.find((item) => item.id === nextCategoryId);
    if (!category?.active) return;
    if (nextKeyword === keyword.keyword && nextCategoryId === keyword.categoryId) return;
    await updateKeyword(keyword.id, { categoryId: nextCategoryId, keyword: nextKeyword });
    await refreshSettings();
  }

  async function handleToggleKeyword(keyword: KeywordItem) {
    await updateKeyword(keyword.id, { active: !keyword.active });
    await refreshSettings();
  }

  async function handleBulkToggleKeywords(keywordIds: number[], active: boolean) {
    if (keywordIds.length === 0) return;
    await Promise.all(keywordIds.map((keywordId) => updateKeyword(keywordId, { active })));
    await refreshSettings();
  }

  async function handleBulkUpdateKeywordCategory(keywordIds: number[], categoryId: number) {
    if (keywordIds.length === 0 || !categoryId) return;
    const category = settingsCategories.find((item) => item.id === categoryId);
    if (!category?.active) return;
    await Promise.all(keywordIds.map((keywordId) => updateKeyword(keywordId, { categoryId })));
    await refreshSettings();
  }

  async function handleCreateClassificationRule() {
    const categoryId = Number(newRuleCategoryId);
    const subcategoryId = Number(newRuleSubcategoryId || "");
    const keywords = splitKeywords(newRuleKeywords);
    if (!newRuleName.trim() || !categoryId || keywords.length === 0) return;
    await createClassificationRule({
      name: newRuleName,
      categoryId,
      subcategoryId: subcategoryId || null,
      keywords,
      priority: Number(newRulePriority || 0),
      version: newRuleVersion || "1.0.0",
    });
    setNewRuleName("");
    setNewRuleKeywords("");
    setNewRulePriority("10");
    await refreshSettings();
  }

  async function handleUpdateClassificationRule(rule: ClassificationRuleItem) {
    const name = ruleNameDrafts[rule.id]?.trim();
    const categoryId = Number(ruleCategoryDrafts[rule.id] || rule.categoryId);
    const subcategoryId = Number(ruleSubcategoryDrafts[rule.id] || "");
    const keywords = splitKeywords(ruleKeywordDrafts[rule.id] ?? rule.keywords.join(", "));
    const priority = Number(rulePriorityDrafts[rule.id] ?? rule.priority);
    const version = ruleVersionDrafts[rule.id]?.trim() || "1.0.0";
    if (!name || !categoryId || keywords.length === 0) return;
    await updateClassificationRule(rule.id, {
      name,
      categoryId,
      subcategoryId: subcategoryId || null,
      keywords,
      priority,
      version,
    });
    await refreshSettings();
  }

  async function handleToggleClassificationRule(rule: ClassificationRuleItem) {
    await updateClassificationRule(rule.id, { active: !rule.active });
    await refreshSettings();
  }

  async function handleUpdateCollaboratorProfile(profile: CollaboratorProfileItem) {
    const loginUsuario = profileLoginDrafts[profile.id]?.trim();
    const subcategoryId = Number(profileSubcategoryDrafts[profile.id] || profile.subcategoryId);
    if (!loginUsuario || !subcategoryId) return;
    if (loginUsuario === profile.loginUsuario && subcategoryId === profile.subcategoryId) return;
    await updateCollaboratorProfile(profile.id, { loginUsuario, subcategoryId });
    await refreshSettings();
  }

  async function handleToggleCollaboratorProfile(profile: CollaboratorProfileItem) {
    await updateCollaboratorProfile(profile.id, { active: !profile.active });
    await refreshSettings();
  }

  return {
    settingsCategories,
    settingsSubcategories,
    settingsKeywords,
    classificationRules,
    collaboratorProfiles,
    ignoredCollaborators,
    newCategory,
    newSubcategory,
    newKeyword,
    newKeywordCategoryId,
    newRuleName,
    newRuleCategoryId,
    newRuleSubcategoryId,
    newRuleKeywords,
    newRulePriority,
    newRuleVersion,
    categoryDrafts,
    subcategoryDrafts,
    keywordDrafts,
    keywordCategoryDrafts,
    ruleNameDrafts,
    ruleCategoryDrafts,
    ruleSubcategoryDrafts,
    ruleKeywordDrafts,
    rulePriorityDrafts,
    ruleVersionDrafts,
    profileLoginDrafts,
    profileSubcategoryDrafts,
    availableProfileSubcategoryDrafts,
    setNewCategory,
    setNewSubcategory,
    setNewKeyword,
    setNewKeywordCategoryId,
    setNewRuleName,
    setNewRuleCategoryId,
    setNewRuleSubcategoryId,
    setNewRuleKeywords,
    setNewRulePriority,
    setNewRuleVersion,
    setCategoryDrafts,
    setSubcategoryDrafts,
    setKeywordDrafts,
    setKeywordCategoryDrafts,
    setRuleNameDrafts,
    setRuleCategoryDrafts,
    setRuleSubcategoryDrafts,
    setRuleKeywordDrafts,
    setRulePriorityDrafts,
    setRuleVersionDrafts,
    setProfileLoginDrafts,
    setProfileSubcategoryDrafts,
    setAvailableProfileSubcategoryDrafts,
    refreshSettings,
    handleCreateCategory,
    handleCreateSubcategory,
    handleCreateKeyword,
    handleCreateAvailableCollaboratorProfile,
    handleIgnoreAvailableCollaborator,
    handleRestoreIgnoredCollaborator,
    handleRenameCategory,
    handleToggleCategory,
    handleRenameSubcategory,
    handleToggleSubcategory,
    handleUpdateKeyword,
    handleToggleKeyword,
    handleBulkToggleKeywords,
    handleBulkUpdateKeywordCategory,
    handleCreateClassificationRule,
    handleUpdateClassificationRule,
    handleToggleClassificationRule,
    handleUpdateCollaboratorProfile,
    handleToggleCollaboratorProfile,
  };
}

function splitKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}
