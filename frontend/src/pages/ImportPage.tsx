import { FileSpreadsheet, Upload } from "lucide-react";

import type { ImportValidationResponse } from "../types";
import { importProcessingSteps } from "../hooks/useImportFlow";

export function ImportPage({
  file,
  isLoading,
  error,
  processingMessage,
  processingStepIndex,
  successMessage,
  result,
  onFileChange,
  onValidate,
}: {
  file: File | null;
  isLoading: boolean;
  error: string | null;
  processingMessage: string | null;
  processingStepIndex: number;
  successMessage: string | null;
  result: ImportValidationResponse | null;
  onFileChange: (file: File | null) => void;
  onValidate: () => void;
}) {
  return (
    <section className="workspace-grid">
      <div className="panel import-panel">
        <div className="panel-heading">
          <FileSpreadsheet size={20} />
          <h2>Validar planilha</h2>
        </div>

        <label className="file-drop">
          <input
            accept=".xlsx,.csv"
            type="file"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <Upload size={24} />
          <span>{file ? file.name : "Selecione um arquivo .xlsx ou .csv"}</span>
        </label>

        <button className="primary-button" disabled={!file || isLoading} onClick={onValidate} type="button">
          {isLoading ? "Validando..." : "Validar arquivo"}
        </button>

        {error && <p className="error-text">{error}</p>}
        {processingMessage && (
          <div className={`import-processing-card ${isLoading ? "active" : ""}`} role="status" aria-live="polite">
            <div className="import-processing-header">
              {isLoading && <span className="processing-spinner" aria-hidden="true" />}
              <strong>{processingMessage}</strong>
            </div>
            {isLoading && (
              <ol className="import-processing-steps">
                {importProcessingSteps.map((step, index) => (
                  <li
                    className={`${index < processingStepIndex ? "done" : ""} ${index === processingStepIndex ? "active" : ""}`}
                    key={step}
                  >
                    <span>{index + 1}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        {successMessage && <p className="success-text">{successMessage}</p>}
        {result?.fileHistory && (
          <div className={`import-file-history-summary ${result.fileHistory.exactDuplicate ? "warning" : result.fileHistory.status === "nova_versao" ? "info" : "success"}`}>
            <strong>
              {result.fileHistory.exactDuplicate
                ? "Arquivo ja importado"
                : result.fileHistory.status === "nova_versao"
                  ? "Atualizacao detectada"
                  : "Arquivo novo"}
            </strong>
            <span>{result.fileHistory.message}</span>
          </div>
        )}
      </div>
    </section>
  );
}
