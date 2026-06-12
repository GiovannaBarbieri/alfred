import { useEffect, useState } from "react";

import type { ProjectPdfOptions } from "../components/reports/ProjectDownloadMenu";

const defaultPdfOptions: ProjectPdfOptions = {
  executiveSummary: true,
  pendingItems: true,
  chartMode: "current",
  collaboratorTasks: false,
};

export function useProjectExports() {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<ProjectPdfOptions>(defaultPdfOptions);

  useEffect(() => {
    if (!isPreparingPdf) return;

    const handleAfterPrint = () => setIsPreparingPdf(false);
    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    const timeoutId = window.setTimeout(() => window.print(), 450);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [isPreparingPdf]);

  return {
    showDownloadMenu,
    showPdfOptions,
    isPreparingPdf,
    pdfOptions,
    toggleDownloadMenu: () => setShowDownloadMenu((current) => !current),
    closeDownloadMenu: () => setShowDownloadMenu(false),
    showPdfOptionsPanel: () => setShowPdfOptions(true),
    closePdfOptions: () => setShowPdfOptions(false),
    setPdfOptions,
    preparePdf: () => setIsPreparingPdf(true),
  };
}
