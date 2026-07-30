import { Boxes, CheckCircle2, Power, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  useGeneralIndicatorModules,
  type ModuleStatusFilter,
} from "../hooks/useGeneralIndicatorModules";
import type { GeneralIndicatorModule } from "../types/generalIndicatorModules";

export function GeneralIndicatorModulesSettingsPage() {
  const modules = useGeneralIndicatorModules();
  const [pending, setPending] = useState<{ module: GeneralIndicatorModule; active: boolean } | null>(null);
  const activeCount = modules.items.filter((item) => item.active).length;

  return (
    <section className="modules-settings-page">
      <header className="page-header modules-settings-header">
        <div>
          <h1>Configuração de Módulos</h1>
          <p>Defina quais módulos serão considerados nos cálculos dos Indicadores Gerais.</p>
        </div>
        <button
          className="secondary-button compact"
          type="button"
          disabled={modules.isSyncing || modules.savingId !== null}
          onClick={() => void modules.synchronize()}
        >
          <RefreshCw className={modules.isSyncing ? "spin" : ""} size={16} />
          {modules.isSyncing ? "Atualizando..." : "Atualizar módulos"}
        </button>
      </header>

      <div className="modules-settings-cards" aria-label="Resumo dos módulos">
        <Summary label="Total de módulos" value={modules.items.length} icon={<Boxes size={18} />} />
        <Summary label="Módulos ativos" value={activeCount} icon={<CheckCircle2 size={18} />} />
        <Summary label="Módulos inativos" value={modules.items.length - activeCount} icon={<Power size={18} />} />
      </div>

      <article className="panel modules-settings-panel">
        <div className="modules-settings-controls">
          <label className="modules-search">
            <Search size={17} />
            <span className="sr-only">Buscar módulo</span>
            <input
              value={modules.search}
              onChange={(event) => modules.setSearch(event.target.value)}
              placeholder="Buscar módulo..."
            />
          </label>
          <div className="modules-status-filter" role="group" aria-label="Filtrar módulos por status">
            {(["all", "active", "inactive"] as ModuleStatusFilter[]).map((filter) => (
              <button
                className={modules.statusFilter === filter ? "active" : ""}
                type="button"
                aria-pressed={modules.statusFilter === filter}
                onClick={() => modules.setStatusFilter(filter)}
                key={filter}
              >
                {{ all: "Todos", active: "Ativos", inactive: "Inativos" }[filter]}
              </button>
            ))}
          </div>
        </div>

        {modules.error && <p className="settings-feedback error" role="alert">{modules.error}</p>}
        {modules.success && <p className="settings-feedback" role="status">{modules.success}</p>}

        {modules.isLoading ? (
          <div className="modules-settings-state" aria-live="polite">
            <RefreshCw className="spin" size={20} /> Carregando módulos...
          </div>
        ) : modules.filteredItems.length === 0 ? (
          <div className="modules-settings-state">
            <strong>Nenhum módulo encontrado.</strong>
            <span>Atualize os módulos ou ajuste os filtros da pesquisa.</span>
          </div>
        ) : (
          <div className="modules-settings-table-wrap">
            <table className="modules-settings-table">
              <thead><tr><th>Módulo</th><th>Status</th><th>Atualizado em</th></tr></thead>
              <tbody>
                {modules.filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.tagName}</strong></td>
                    <td>
                      <label className="module-status-switch">
                        <input
                          type="checkbox"
                          checked={item.active}
                          disabled={modules.savingId !== null || modules.isSyncing}
                          onChange={() => setPending({ module: item, active: !item.active })}
                          aria-label={`${item.active ? "Inativar" : "Ativar"} ${item.tagName}`}
                        />
                        <span aria-hidden="true" />
                        <em>{item.active ? "Ativo" : "Inativo"}</em>
                      </label>
                    </td>
                    <td>{new Date(item.updatedAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {pending && (
        <ModuleConfirmationModal
          pending={pending}
          busy={modules.savingId === pending.module.id}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            if (await modules.changeStatus(pending.module, pending.active)) setPending(null);
          }}
        />
      )}
    </section>
  );
}

function Summary({ label, value, icon }: { label: string; value: number; icon: JSX.Element }) {
  return <article><span>{icon}</span><div><small>{label}</small><strong>{value.toLocaleString("pt-BR")}</strong></div></article>;
}

function ModuleConfirmationModal({
  pending,
  busy,
  onClose,
  onConfirm,
}: {
  pending: { module: GeneralIndicatorModule; active: boolean };
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy, onClose]);
  const action = pending.active ? "Ativar" : "Inativar";
  return (
    <div className="saved-report-modal-backdrop" role="presentation">
      <div ref={dialogRef} className="saved-report-modal module-confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="module-modal-title" tabIndex={-1}>
        <header>
          <span><Power size={20} /></span>
          <div>
            <h2 id="module-modal-title">{action} módulo?</h2>
            <p>
              {pending.active
                ? "O módulo voltará a ser considerado nas novas consultas dos Indicadores Gerais."
                : "O módulo deixará de participar dos cálculos em novas consultas. Os lançamentos continuarão disponíveis para auditoria."}
            </p>
          </div>
          <button type="button" aria-label="Fechar modal" disabled={busy} onClick={onClose}><X size={18} /></button>
        </header>
        <div className="saved-report-modal-report"><strong>{pending.module.tagName}</strong></div>
        <footer>
          <button className="secondary-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button>
          <button className="primary-button" type="button" disabled={busy} onClick={onConfirm}>
            {busy ? "Salvando..." : action}
          </button>
        </footer>
      </div>
    </div>
  );
}
