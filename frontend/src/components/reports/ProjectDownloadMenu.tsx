import { FileSpreadsheet } from "lucide-react";

type ProjectDownloadMenuProps = {
  excelExportUrl: string;
  showTrigger?: boolean;
};

export function ProjectDownloadMenu({ excelExportUrl, showTrigger = true }: ProjectDownloadMenuProps) {
  if (!showTrigger) return null;

  return (
    <a
      aria-label="Exportar Excel operacional"
      className="report-download-icon-button"
      href={excelExportUrl}
      title="Exportar Excel operacional"
    >
      <FileSpreadsheet size={18} />
      <span>Excel</span>
    </a>
  );
}
