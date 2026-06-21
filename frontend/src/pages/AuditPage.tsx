import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";

import { getAuditLogs } from "../services/api";
import type { AuditLogItem } from "../types";
import { formatDateTimeBR } from "../utils/date";

const entityLabels: Record<string, string> = {
  import_session: "Sessão de importação",
  import: "Importação",
  pending_alert: "Alerta",
  pending_review: "Pendência",
  category: "Categoria",
  subcategory: "Subcategoria",
  keyword: "Palavra-chave",
  collaborator_profile: "Perfil técnico",
  ignored_collaborator: "Colaborador ignorado",
};

const actionLabels: Record<string, string> = {
  created: "Criado",
  updated: "Atualizado",
  completed: "Confirmado",
  cancelled: "Cancelado",
  reprocessed: "Reprocessado",
  completion_blocked: "Bloqueado",
};

function compactPayload(value: Record<string, unknown> | null) {
  if (!value) return "Sem dados";
  const entries = Object.entries(value).slice(0, 4);
  return entries.map(([key, item]) => `${key}: ${String(item)}`).join(" | ");
}

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [entity, setEntity] = useState("");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entities = useMemo(
    () => Array.from(new Set(logs.map((item) => item.entity))).sort((a, b) => a.localeCompare(b)),
    [logs],
  );

  async function loadAudit() {
    setIsLoading(true);
    setError(null);
    try {
      setLogs(await getAuditLogs({ entity: entity || undefined, search: search || undefined, limit: 150 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar a auditoria.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  return (
    <section className="panel audit-panel">
      <div className="audit-heading">
        <div>
          <h2>Trilha de auditoria</h2>
          <p className="muted">Eventos operacionais registrados para suporte, rastreabilidade e governanca.</p>
        </div>
        <span><ShieldCheck size={16} /> {logs.length} evento(s)</span>
      </div>

      <div className="audit-toolbar">
        <label>
          <Search size={15} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por entidade, acao, registro ou usuario"
          />
        </label>
        <select value={entity} onChange={(event) => setEntity(event.target.value)}>
          <option value="">Todas as entidades</option>
          {entities.map((item) => (
            <option key={item} value={item}>{entityLabels[item] ?? item}</option>
          ))}
        </select>
        <button className="secondary-button compact" type="button" onClick={() => void loadAudit()} disabled={isLoading}>
          {isLoading ? "Carregando..." : "Filtrar"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="audit-list">
        {logs.length === 0 && !isLoading && <div className="task-empty-state">Nenhum evento de auditoria encontrado.</div>}
        {logs.map((item) => (
          <article className="audit-row" key={item.id}>
            <div>
              <span>{entityLabels[item.entity] ?? item.entity}</span>
              <strong>{actionLabels[item.action] ?? item.action}</strong>
              <small>Registro {item.recordId ?? "-"} | {item.user}</small>
            </div>
            <p>{compactPayload(item.after)}</p>
            <time>{formatDateTimeBR(item.createdAt)}</time>
          </article>
        ))}
      </div>
    </section>
  );
}
