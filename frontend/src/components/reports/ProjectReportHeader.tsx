import type { ImportSummary } from "../../types";
import { ProjectDownloadMenu } from "./ProjectDownloadMenu";

type ProjectReportHeaderProps = {
  projectTitle: string;
  selectedImport: ImportSummary;
  excelExportUrl: string;
};

export function ProjectReportHeader({
  projectTitle,
  selectedImport,
  excelExportUrl,
}: ProjectReportHeaderProps) {
  return (
    <section className="panel report-project-header">
      <div className="report-project-title-block">
        <span>Projeto</span>
        <strong>{projectTitle}</strong>
        <small>{selectedImport.filename}</small>
      </div>
      <ProjectDownloadMenu excelExportUrl={excelExportUrl} />
    </section>
  );
}
