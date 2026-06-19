import { FileSpreadsheet, Search, X } from "lucide-react";

import type { ImportSummary } from "../../types";
import { formatDateBR } from "../../utils/date";
import { projectIdentityFromFilename, projectTitleFromFilename } from "../../utils/project";

type ReportsProjectListProps = {
  imports: ImportSummary[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenProject: (importId: number) => void;
};

export function ReportsProjectList({ imports, search, onSearchChange, onOpenProject }: ReportsProjectListProps) {
  const projectVersions = imports.reduce<Record<string, ImportSummary[]>>((grouped, item) => {
    const key = projectIdentityFromFilename(item.filename);
    grouped[key] = [...(grouped[key] ?? []), item];
    return grouped;
  }, {});

  Object.values(projectVersions).forEach((items) => {
    items.sort((a, b) => new Date(a.importedAt).getTime() - new Date(b.importedAt).getTime());
  });

  return (
    <section className="panel reports-projects-panel">
      <div className="reports-projects-toolbar">
        <div>
          <h2>Projetos importados</h2>
          <p className="muted">{imports.length} projeto(s) encontrados. Escolha um projeto para abrir as analises operacionais.</p>
        </div>
        <div className="reports-search-box">
          <Search size={16} />
          <input
            aria-label="Buscar projeto"
            placeholder="Buscar projeto"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {search && (
            <button aria-label="Limpar busca" type="button" onClick={() => onSearchChange("")}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="reports-project-list" aria-label="Projetos importados">
        {imports.map((item) => {
          const sameProjectImports = projectVersions[projectIdentityFromFilename(item.filename)] ?? [];
          const hasVersions = sameProjectImports.length > 1;
          const versionNumber = hasVersions ? sameProjectImports.findIndex((version) => version.id === item.id) + 1 : 0;

          return (
            <article className={`reports-project-row ${hasVersions ? "has-versions" : ""}`} key={item.id}>
              <span className="reports-project-icon"><FileSpreadsheet size={20} /></span>
              <span className="reports-project-name">
                <strong>
                  {projectTitleFromFilename(item.filename)}
                  {hasVersions && <em>v{versionNumber}</em>}
                </strong>
                <small>{item.filename}</small>
                {hasVersions && (
                  <small className="project-version-note">
                    Mesmo projeto com {sameProjectImports.length} importacoes. Esta e a versao {versionNumber}.
                  </small>
                )}
              </span>
              <span>
                <strong>{item.totalHours}h</strong>
                <small>Horas</small>
              </span>
              <span>
                <strong>{item.validRows}</strong>
                <small>Registros</small>
              </span>
              <span>
                <strong>{item.alertRows}</strong>
                <small>Alertas</small>
              </span>
              <span>
                <strong>{formatDateBR(item.importedAt)}</strong>
                <small className="status-badge">{item.status}</small>
              </span>
              <button className="secondary-button compact" type="button" onClick={() => onOpenProject(item.id)}>
                Abrir relatorio
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
