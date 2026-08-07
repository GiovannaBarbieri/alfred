import { Download } from "lucide-react";
import { useState, type MouseEvent } from "react";

import { exportChartAsPng } from "../../utils/chartImageExport";

export function ChartExportButton() {
  const [busy, setBusy] = useState(false);

  async function exportCurrentCard(event: MouseEvent<HTMLButtonElement>) {
    const card = event.currentTarget.closest<HTMLElement>("[data-chart-export-card]");
    if (!card || busy) return;
    setBusy(true);
    try {
      await exportChartAsPng({
        element: card,
        period: card.dataset.chartExportPeriod ?? "",
        title: card.dataset.chartExportTitle ?? "Grafico",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      aria-label="Exportar gráfico atual em PNG"
      className="chart-export-button"
      data-export-exclude
      disabled={busy}
      onClick={(event) => void exportCurrentCard(event)}
      title="Exportar gráfico atual em PNG"
      type="button"
    >
      <Download size={14} />
      {busy ? "Exportando..." : "PNG"}
    </button>
  );
}
