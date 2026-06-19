import type { ImportSummary } from "../../types";
import { ProjectDownloadMenu, type ProjectPdfOptions } from "./ProjectDownloadMenu";

type ProjectReportHeaderProps = {
  projectTitle: string;
  selectedImport: ImportSummary;
  importedAt: string;
  excelExportUrl: string;
  showDownloadMenu: boolean;
  isPreparingPdf: boolean;
  pdfOptions: ProjectPdfOptions;
  hasSelectedCollaborator: boolean;
  onToggleDownloadMenu: () => void;
  onCloseDownloadMenu: () => void;
  onShowPdfOptions: () => void;
  onClosePdfOptions: () => void;
  onPdfOptionsChange: (options: ProjectPdfOptions) => void;
  onPreparePdf: () => void;
};

export function ProjectReportHeader({
  projectTitle,
  selectedImport,
  importedAt,
  excelExportUrl,
  showDownloadMenu,
  isPreparingPdf,
  pdfOptions,
  hasSelectedCollaborator,
  onToggleDownloadMenu,
  onCloseDownloadMenu,
  onShowPdfOptions,
  onClosePdfOptions,
  onPdfOptionsChange,
  onPreparePdf,
}: ProjectReportHeaderProps) {
  return (
    <section className="panel report-project-header">
      <div className="report-project-title-block">
        <span>Projeto</span>
        <strong>{projectTitle}</strong>
        <small>{selectedImport.filename}</small>
      </div>
      <div className="report-project-metrics">
        <span><strong>{selectedImport.totalHours}h</strong><small>Horas</small></span>
        <span><strong>{selectedImport.validRows}</strong><small>Registros</small></span>
        <span><strong>{importedAt}</strong><small>{selectedImport.status}</small></span>
      </div>
      <ProjectDownloadMenu
        excelExportUrl={excelExportUrl}
        showDownloadMenu={showDownloadMenu}
        showPdfOptions={false}
        isPreparingPdf={isPreparingPdf}
        pdfOptions={pdfOptions}
        hasSelectedCollaborator={hasSelectedCollaborator}
        onToggleDownloadMenu={onToggleDownloadMenu}
        onCloseDownloadMenu={onCloseDownloadMenu}
        onShowPdfOptions={onShowPdfOptions}
        onClosePdfOptions={onClosePdfOptions}
        onPdfOptionsChange={onPdfOptionsChange}
        onPreparePdf={onPreparePdf}
      />
    </section>
  );
}
