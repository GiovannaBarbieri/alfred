import type { ImportSummary } from "../../types";
import { ProjectDownloadMenu } from "./ProjectDownloadMenu";
import { RefreshCw } from "lucide-react";

type ProjectReportHeaderProps = {
  projectTitle: string;
  selectedImport: ImportSummary;
  excelExportUrl: string;
  isRefreshing?: boolean;
  onRefreshData?: () => void;
};

export function ProjectReportHeader({
  projectTitle,
  selectedImport,
  excelExportUrl,
  isRefreshing = false,
  onRefreshData,
}: ProjectReportHeaderProps) {
  return (
    <section className="panel report-project-header">
      <div className="report-project-title-block">
        <span>Projeto</span>
        <strong>{projectTitle}</strong>
        <small>{selectedImport.filename}</small>
      </div>
      <div className="report-project-header-actions">
        <button
          className="report-download-icon-button"
          disabled={isRefreshing}
          onClick={onRefreshData}
          type="button"
        >
          <RefreshCw size={18} className={isRefreshing ? "spin-icon" : undefined} />
          <span>{isRefreshing ? "Atualizando..." : "Atualizar dados"}</span>
        </button>
        <ProjectDownloadMenu excelExportUrl={excelExportUrl} />
      </div>
    </section>
  );
}
