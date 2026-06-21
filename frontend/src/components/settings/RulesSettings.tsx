import { Filter, Search } from "lucide-react";
import { useMemo, useState, type SetStateAction } from "react";
import type { ClassificationRuleItem, SettingItem } from "../../types";

type RulesSettingsProps = {
  categories: SettingItem[];
  subcategories: SettingItem[];
  rules: ClassificationRuleItem[];
  search: string;
  newRuleName: string;
  newRuleCategoryId: string;
  newRuleSubcategoryId: string;
  newRuleKeywords: string;
  newRulePriority: string;
  newRuleVersion: string;
  ruleNameDrafts: Record<number, string>;
  ruleCategoryDrafts: Record<number, string>;
  ruleSubcategoryDrafts: Record<number, string>;
  ruleKeywordDrafts: Record<number, string>;
  rulePriorityDrafts: Record<number, string>;
  ruleVersionDrafts: Record<number, string>;
  onNewRuleNameChange: (value: string) => void;
  onNewRuleCategoryIdChange: (value: string) => void;
  onNewRuleSubcategoryIdChange: (value: string) => void;
  onNewRuleKeywordsChange: (value: string) => void;
  onNewRulePriorityChange: (value: string) => void;
  onNewRuleVersionChange: (value: string) => void;
  onRuleNameDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleCategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleSubcategoryDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleKeywordDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRulePriorityDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onRuleVersionDraftsChange: (updater: SetStateAction<Record<number, string>>) => void;
  onCreateRule: () => void;
  onUpdateRule: (rule: ClassificationRuleItem) => void;
  onToggleRule: (rule: ClassificationRuleItem) => void;
};

export function RulesSettings({
  categories,
  subcategories,
  rules,
  search,
  newRuleName,
  newRuleCategoryId,
  newRuleSubcategoryId,
  newRuleKeywords,
  newRulePriority,
  newRuleVersion,
  ruleNameDrafts,
  ruleCategoryDrafts,
  ruleSubcategoryDrafts,
  ruleKeywordDrafts,
  rulePriorityDrafts,
  ruleVersionDrafts,
  onNewRuleNameChange,
  onNewRuleCategoryIdChange,
  onNewRuleSubcategoryIdChange,
  onNewRuleKeywordsChange,
  onNewRulePriorityChange,
  onNewRuleVersionChange,
  onRuleNameDraftsChange,
  onRuleCategoryDraftsChange,
  onRuleSubcategoryDraftsChange,
  onRuleKeywordDraftsChange,
  onRulePriorityDraftsChange,
  onRuleVersionDraftsChange,
  onCreateRule,
  onUpdateRule,
  onToggleRule,
}: RulesSettingsProps) {
  const activeCategories = categories.filter((category) => category.active);
  const activeSubcategories = subcategories.filter((subcategory) => subcategory.active);
  const [ruleSearch, setRuleSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const filteredRules = useMemo(() => {
    const normalizedSearch = [ruleSearch, search].join(" ").trim().toLowerCase();
    return rules.filter((rule) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && rule.active) ||
        (statusFilter === "inactive" && !rule.active);
      const matchesCategory = categoryFilter === "all" || String(rule.categoryId) === categoryFilter;
      const searchable = [rule.name, rule.category, rule.subcategory ?? "", rule.keywords.join(" ")]
        .join(" ")
        .toLowerCase();
      return matchesStatus && matchesCategory && (!normalizedSearch || searchable.includes(normalizedSearch));
    });
  }, [categoryFilter, ruleSearch, rules, statusFilter]);

  return (
    <div className="settings-column wide">
      <div className="rules-heading">
        <div>
          <h3>Regras de classificação</h3>
          <p className="muted">
            Regras combinam palavras-chave, prioridade, categoria e versao do classificador.
          </p>
        </div>
        <span>{filteredRules.length} de {rules.length} regras</span>
      </div>

      <div className="settings-rule-create">
        <input placeholder="Nome da regra" value={newRuleName} onChange={(event) => onNewRuleNameChange(event.target.value)} />
        <select value={newRuleCategoryId} onChange={(event) => onNewRuleCategoryIdChange(event.target.value)}>
          <option value="" disabled>Categoria</option>
          {activeCategories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select value={newRuleSubcategoryId} onChange={(event) => onNewRuleSubcategoryIdChange(event.target.value)}>
          <option value="">Cargo opcional</option>
          {activeSubcategories.map((subcategory) => (
            <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
          ))}
        </select>
        <input placeholder="palavras, separadas, por virgula" value={newRuleKeywords} onChange={(event) => onNewRuleKeywordsChange(event.target.value)} />
        <input aria-label="Prioridade da regra" type="number" value={newRulePriority} onChange={(event) => onNewRulePriorityChange(event.target.value)} />
        <input aria-label="Versao da regra" value={newRuleVersion} onChange={(event) => onNewRuleVersionChange(event.target.value)} />
        <button className="primary-button" type="button" onClick={onCreateRule}>Adicionar</button>
      </div>

      <div className="rules-toolbar">
        <label className="rules-search">
          <Search size={16} />
          <input
            placeholder="Buscar regra, categoria ou palavra-chave"
            value={ruleSearch}
            onChange={(event) => setRuleSearch(event.target.value)}
          />
        </label>
        <label>
          <Filter size={15} />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}>
          <option value="all">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="inactive">Inativas</option>
        </select>
      </div>

      <div className="settings-rule-list">
        {filteredRules.length === 0 && (
          <div className="dashboard-empty-state">
            <strong>Nenhuma regra encontrada</strong>
            <p className="muted">Ajuste os filtros ou crie uma nova regra para essa categoria.</p>
          </div>
        )}
        {filteredRules.map((rule) => {
          const changed =
            (ruleNameDrafts[rule.id] ?? rule.name) !== rule.name ||
            Number(ruleCategoryDrafts[rule.id] || rule.categoryId) !== rule.categoryId ||
            Number(ruleSubcategoryDrafts[rule.id] || "") !== (rule.subcategoryId ?? 0) ||
            (ruleKeywordDrafts[rule.id] ?? rule.keywords.join(", ")) !== rule.keywords.join(", ") ||
            Number(rulePriorityDrafts[rule.id] ?? rule.priority) !== rule.priority ||
            (ruleVersionDrafts[rule.id] ?? rule.version) !== rule.version;

          return (
            <article className={`settings-rule-row ${rule.active ? "" : "inactive"}`} key={rule.id}>
              <div className="settings-rule-card-heading">
                <div>
                  <strong>{rule.name}</strong>
                  <small>{rule.category}{rule.subcategory ? ` / ${rule.subcategory}` : ""} - prioridade {rule.priority} - v{rule.version}</small>
                </div>
                <span className={`settings-status ${rule.active ? "active" : "inactive"}`}>{rule.active ? "Ativa" : "Inativa"}</span>
              </div>
              <div className="settings-rule-readable-meta">
                <span><strong>Resultado</strong>{rule.category}{rule.subcategory ? ` / ${rule.subcategory}` : ""}</span>
                <span><strong>Prioridade</strong>{rule.priority}</span>
                <span><strong>Versao</strong>{rule.version}</span>
                <span><strong>Uso</strong>Uso real pendente</span>
              </div>
              <div className="settings-rule-main">
                <input value={ruleNameDrafts[rule.id] ?? rule.name} onChange={(event) => onRuleNameDraftsChange((current) => ({ ...current, [rule.id]: event.target.value }))} />
                <div className="settings-rule-meta">
                  <select value={ruleCategoryDrafts[rule.id] ?? String(rule.categoryId)} onChange={(event) => onRuleCategoryDraftsChange((current) => ({ ...current, [rule.id]: event.target.value }))}>
                    {activeCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                  <select value={ruleSubcategoryDrafts[rule.id] ?? String(rule.subcategoryId ?? "")} onChange={(event) => onRuleSubcategoryDraftsChange((current) => ({ ...current, [rule.id]: event.target.value }))}>
                    <option value="">Sem cargo</option>
                    {activeSubcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                    ))}
                  </select>
                  <input type="number" value={rulePriorityDrafts[rule.id] ?? String(rule.priority)} onChange={(event) => onRulePriorityDraftsChange((current) => ({ ...current, [rule.id]: event.target.value }))} />
                  <input value={ruleVersionDrafts[rule.id] ?? rule.version} onChange={(event) => onRuleVersionDraftsChange((current) => ({ ...current, [rule.id]: event.target.value }))} />
                </div>
                <input value={ruleKeywordDrafts[rule.id] ?? rule.keywords.join(", ")} onChange={(event) => onRuleKeywordDraftsChange((current) => ({ ...current, [rule.id]: event.target.value }))} />
              </div>
              <div className="settings-rule-actions">
                <button className="secondary-button compact" disabled={!changed} type="button" onClick={() => onUpdateRule(rule)}>Salvar</button>
                <button className="secondary-button compact" type="button" onClick={() => onToggleRule(rule)}>
                  {rule.active ? "Inativar" : "Ativar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
