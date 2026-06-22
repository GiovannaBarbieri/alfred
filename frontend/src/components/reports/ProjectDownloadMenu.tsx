import { Download, FileSpreadsheet, FileText } from "lucide-react";

import type { PdfChartMode } from "./reportsConfig";

export type ProjectPdfOptions = {
  executiveSummary: boolean;
  pendingItems: boolean;
  chartMode: PdfChartMode;
  collaboratorTasks: boolean;
};

type ProjectDownloadMenuProps = {
  excelExportUrl: string;
  showDownloadMenu: boolean;
  showPdfOptions: boolean;
  isPreparingPdf: boolean;
  pdfOptions: ProjectPdfOptions;
  hasSelectedCollaborator: boolean;
  showTrigger?: boolean;
  onToggleDownloadMenu: () => void;
  onCloseDownloadMenu: () => void;
  onShowPdfOptions: () => void;
  onClosePdfOptions: () => void;
  onPdfOptionsChange: (options: ProjectPdfOptions) => void;
  onPreparePdf: () => void;
};

export function ProjectDownloadMenu({
  excelExportUrl,
  showDownloadMenu,
  showPdfOptions,
  isPreparingPdf,
  pdfOptions,
  hasSelectedCollaborator,
  showTrigger = true,
  onToggleDownloadMenu,
  onCloseDownloadMenu,
  onShowPdfOptions,
  onClosePdfOptions,
  onPdfOptionsChange,
  onPreparePdf,
}: ProjectDownloadMenuProps) {
  return (
    <>
      {showTrigger && (
        <div className="download-menu-wrap">
          <button
            aria-expanded={showDownloadMenu}
            aria-label="Baixar relatório"
            className="report-download-icon-button"
            title="Baixar relatório"
            type="button"
            disabled={isPreparingPdf}
            onClick={onToggleDownloadMenu}
          >
            <Download size={20} />
          </button>
          {showDownloadMenu && (
            <div className="download-menu">
              <button
                type="button"
                onClick={() => {
                  onShowPdfOptions();
                  onCloseDownloadMenu();
                }}
              >
                <FileText size={16} />
                Baixar PDF executivo
              </button>
              <a href={excelExportUrl} onClick={onCloseDownloadMenu}>
                <FileSpreadsheet size={16} />
                Exportar Excel operacional
              </a>
            </div>
          )}
        </div>
      )}

      {showPdfOptions && (
        <section className="panel pdf-options-panel">
          <div>
            <h2>PDF executivo</h2>
            <p className="muted">Monte um arquivo compacto para compartilhar a leitura gerencial do projeto.</p>
          </div>
          <div className="pdf-options-grid">
            <label>
              <input
                type="checkbox"
                checked={pdfOptions.executiveSummary}
                onChange={(event) => onPdfOptionsChange({ ...pdfOptions, executiveSummary: event.target.checked })}
              />
              KPIs e resumo executivo
            </label>
            <label>
              <input
                type="checkbox"
                checked={pdfOptions.pendingItems}
                onChange={(event) => onPdfOptionsChange({ ...pdfOptions, pendingItems: event.target.checked })}
              />
              Pendências resumidas
            </label>
            <label className="pdf-chart-mode-field">
              <span>Gráficos executivos</span>
              <select
                aria-label="Gráficos executivos"
                value={pdfOptions.chartMode}
                onChange={(event) => onPdfOptionsChange({ ...pdfOptions, chartMode: event.target.value as PdfChartMode })}
              >
                <option value="none">Nenhum</option>
                <option value="current">Gráfico atual</option>
                <option value="all">Todos os gráficos</option>
              </select>
            </label>
            <label className={!hasSelectedCollaborator ? "disabled" : ""}>
              <input
                type="checkbox"
                checked={pdfOptions.collaboratorTasks}
                disabled={!hasSelectedCollaborator}
                onChange={(event) => onPdfOptionsChange({ ...pdfOptions, collaboratorTasks: event.target.checked })}
              />
              Detalhe operacional do colaborador
            </label>
          </div>
          <div className="export-format-note">
            <span>
              <FileText size={15} />
              PDF para apresentação executiva.
            </span>
            <span>
              <FileSpreadsheet size={15} />
              Excel operacional fica no menu de download para análise detalhada.
            </span>
          </div>
          <div className="pdf-options-actions">
            <button className="secondary-button compact" type="button" onClick={onClosePdfOptions}>
              Cancelar
            </button>
            <button className="primary-button compact" type="button" onClick={onPreparePdf}>
              Gerar PDF executivo
            </button>
          </div>
        </section>
      )}
    </>
  );
}
