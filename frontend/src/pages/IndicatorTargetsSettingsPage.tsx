import { CalendarRange, Edit3, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { useIndicatorTargets } from "../hooks/useIndicatorTargets";
import type { IndicatorTargetPeriod, IndicatorTargetPeriodPayload } from "../types/indicatorTargets";

type TargetDraft = IndicatorTargetPeriodPayload;

const emptyDraft: TargetDraft = {
  startDate: "",
  endDate: "",
  projectsTarget: "",
  errorsLimit: "",
};

export function IndicatorTargetsSettingsPage() {
  const targets = useIndicatorTargets();
  const [editing, setEditing] = useState<IndicatorTargetPeriod | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<TargetDraft>(emptyDraft);
  const draftError = validateDraft(draft);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft);
    setIsModalOpen(true);
  }

  function openEdit(item: IndicatorTargetPeriod) {
    setEditing(item);
    setDraft({
      startDate: item.startDate,
      endDate: item.endDate,
      projectsTarget: String(item.projectsTarget),
      errorsLimit: String(item.errorsLimit),
    });
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (draftError) return;
    const success = editing
      ? await targets.update(editing.id, normalizeDraft(draft))
      : await targets.create(normalizeDraft(draft));
    if (success) setIsModalOpen(false);
  }

  async function handleDelete(item: IndicatorTargetPeriod) {
    const confirmed = window.confirm(`Excluir a vigência de ${formatDate(item.startDate)} a ${formatDate(item.endDate)}?`);
    if (confirmed) await targets.remove(item.id);
  }

  if (targets.isLoading) {
    return (
      <section className="distribution-weights-state" aria-live="polite">
        <RefreshCw className="spin" size={20} />
        Carregando metas dos indicadores...
      </section>
    );
  }

  if (targets.error && targets.items.length === 0) {
    return (
      <section className="distribution-weights-state error" role="alert">
        <strong>Não foi possível carregar as metas dos indicadores.</strong>
        <span>{targets.error}</span>
        <button className="secondary-button compact" type="button" onClick={() => void targets.load()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="distribution-weights-page">
      <p className="distribution-weights-scope">
        As alterações afetam somente novas consultas. Relatórios já finalizados preservam as metas capturadas no snapshot.
      </p>

      <div className="distribution-weights-panel">
        <div className="target-periods-toolbar">
          <strong>Vigências cadastradas</strong>
          <button className="primary-button compact" type="button" onClick={openCreate} disabled={targets.isSaving}>
            <Plus size={16} />
            Nova vigência
          </button>
        </div>

        {targets.items.length === 0 ? (
          <div className="target-periods-empty">
            <CalendarRange size={20} />
            <span>Nenhuma vigência cadastrada.</span>
          </div>
        ) : (
          <div className="distribution-weights-table target-periods-table" role="table" aria-label="Metas dos indicadores">
            <div className="distribution-weights-row target-periods-row header" role="row">
              <span role="columnheader">Vigência</span>
              <span role="columnheader">Novos projetos + melhorias</span>
              <span role="columnheader">Erro TI + Bugs</span>
              <span role="columnheader">Atualização</span>
              <span role="columnheader">Ações</span>
            </div>
            {targets.items.map((item) => (
              <div className="distribution-weights-row target-periods-row" role="row" key={item.id}>
                <strong role="cell">{formatDate(item.startDate)} a {formatDate(item.endDate)}</strong>
                <span role="cell">Meta ≥ {formatPercent(item.projectsTarget)}</span>
                <span role="cell">Limite ≤ {formatPercent(item.errorsLimit)}</span>
                <span className="settings-muted-cell" role="cell">
                  {formatDateTime(item.updatedAt)}
                </span>
                <div className="target-periods-actions" role="cell">
                  <button className="secondary-button compact" type="button" onClick={() => openEdit(item)} disabled={targets.isSaving}>
                    <Edit3 size={15} />
                    Editar
                  </button>
                  <button className="danger-button compact" type="button" onClick={() => void handleDelete(item)} disabled={targets.isSaving}>
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {targets.error && <p className="settings-feedback error" role="alert">{targets.error}</p>}
        {targets.success && <p className="settings-feedback" role="status">{targets.success}</p>}
      </div>

      <aside className="distribution-weights-help">
        <CalendarRange size={20} />
        <div>
          <strong>Como funciona?</strong>
          <p>
            Cada consulta dos Indicadores Gerais deve estar totalmente coberta por uma única vigência. O Alfred não escolhe
            metas automaticamente quando o período atravessa configurações diferentes.
          </p>
          <p>
            A meta utilizada no momento da finalização é congelada no snapshot do relatório e não muda quando esta configuração
            for alterada depois.
          </p>
        </div>
      </aside>

      {isModalOpen && (
        <div className="settings-modal-backdrop" role="presentation" onClick={() => setIsModalOpen(false)}>
          <section
            className="settings-modal-dialog target-periods-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Editar vigência de metas" : "Nova vigência de metas"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="settings-modal-header">
              <div>
                <strong>{editing ? "Editar vigência" : "Nova vigência"}</strong>
                <span>Informe o período e os limites dos indicadores.</span>
              </div>
            </div>
            <div className="target-periods-form">
              <label>
                <span>Data inicial</span>
                <input
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>
              <label>
                <span>Data final</span>
                <input
                  type="date"
                  value={draft.endDate}
                  onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                />
              </label>
              <label>
                <span>Novos projetos + melhorias (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={draft.projectsTarget}
                  onChange={(event) => setDraft((current) => ({ ...current, projectsTarget: event.target.value }))}
                />
              </label>
              <label>
                <span>Erro TI + Bugs (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={draft.errorsLimit}
                  onChange={(event) => setDraft((current) => ({ ...current, errorsLimit: event.target.value }))}
                />
              </label>
            </div>
            {draftError && <p className="settings-feedback error" role="alert">{draftError}</p>}
            <footer className="settings-modal-actions">
              <button className="secondary-button" type="button" onClick={() => setIsModalOpen(false)} disabled={targets.isSaving}>
                Cancelar
              </button>
              <button className="primary-button" type="button" onClick={() => void handleSave()} disabled={targets.isSaving || Boolean(draftError)}>
                {targets.isSaving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
                {targets.isSaving ? "Salvando..." : "Salvar vigência"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}

function normalizeDraft(draft: TargetDraft): TargetDraft {
  return {
    startDate: draft.startDate,
    endDate: draft.endDate,
    projectsTarget: Number(draft.projectsTarget).toFixed(2),
    errorsLimit: Number(draft.errorsLimit).toFixed(2),
  };
}

function validateDraft(draft: TargetDraft): string | null {
  if (!draft.startDate || !draft.endDate || !draft.projectsTarget || !draft.errorsLimit) {
    return "Preencha todas as informações da vigência.";
  }
  if (draft.endDate < draft.startDate) {
    return "A data final não pode ser anterior à data inicial.";
  }
  if (!isPercent(draft.projectsTarget) || !isPercent(draft.errorsLimit)) {
    return "Informe percentuais entre 0 e 100.";
  }
  return null;
}

function isPercent(value: string): boolean {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100;
}

function formatPercent(value: string): string {
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatDate(value: string): string {
  if (!value) return "-";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
