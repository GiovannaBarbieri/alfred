import { AlertTriangle, CheckCircle2, FileSpreadsheet, XCircle } from "lucide-react";
import { Metric } from "../Metric";

type ValidationSummaryProps = {
  totalRows: number;
  validRows: number;
  alertCount: number;
  blockingCount: number;
  classifierVersion?: string;
};

export function ValidationSummary({ totalRows, validRows, alertCount, blockingCount, classifierVersion }: ValidationSummaryProps) {
  return (
    <>
      {classifierVersion && (
        <div className="classifier-version-note">
          Classificador previsto para esta importacao: <strong>v{classifierVersion}</strong>
        </div>
      )}
      <section className="metrics-grid validation-summary" aria-label="Resumo da validacao">
        <Metric label="Registros lidos" value={String(totalRows)} icon={<FileSpreadsheet size={18} />} />
        <Metric label="Validos" value={String(validRows)} icon={<CheckCircle2 size={18} />} />
        <Metric label="Alertas" value={String(alertCount)} icon={<AlertTriangle size={18} />} />
        <Metric label="Bloqueios" value={String(blockingCount)} icon={<XCircle size={18} />} />
      </section>
    </>
  );
}
