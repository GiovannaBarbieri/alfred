import type { ImportSummary } from "../../types";
import { ProjectDownloadMenu, type ProjectPdfOptions } from "./ProjectDownloadMenu";
import type { ProjectExecutiveSummary } from "../../types";

type ProjectReportHeaderProps = {
  projectTitle: string;
  selectedImport: ImportSummary;
  projectExecutiveSummary: ProjectExecutiveSummary;
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
