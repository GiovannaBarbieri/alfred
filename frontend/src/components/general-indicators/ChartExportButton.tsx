import { Download } from "lucide-react";
import { useState, type MouseEvent } from "react";

import { exportChartAsPng } from "../../utils/chartImageExport";

export function ChartExportButton({ compact = false }: { compact?: boolean }) {
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
      aria-label="Baixar gráfico como PNG"
      className={`chart-export-button${compact ? " compact" : ""}`}
      data-export-exclude
      disabled={busy}
      onClick={(event) => void exportCurrentCard(event)}
      title="Baixar gráfico como PNG"
      type="button"
    >
      <Download size={compact ? 16 : 14} />
      {!compact && (busy ? "Exportando..." : "PNG")}
    </button>
  );
}
