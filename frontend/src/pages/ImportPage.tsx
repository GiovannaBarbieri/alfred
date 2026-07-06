import { Database, FileSpreadsheet, PlugZap, Upload } from "lucide-react";

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
  importSource,
  sqlServerProjectName,
  sqlServerIds,
  sqlServerIdType,
  isTestingSqlServer,
  sqlServerStatusMessage,
  onImportSourceChange,
  onFileChange,
  onValidate,
  onSqlServerProjectNameChange,
  onSqlServerIdsChange,
  onSqlServerIdTypeChange,
  onValidateSqlServer,
  onTestSqlServerConnection,
}: {
  file: File | null;
  isLoading: boolean;
  error: string | null;
  processingMessage: string | null;
  processingStepIndex: number;
  successMessage: string | null;
  result: ImportValidationResponse | null;
  importSource: "file" | "sqlserver";
  sqlServerProjectName: string;
  sqlServerIds: string;
  sqlServerIdType: "auto" | "epic" | "feature";
  isTestingSqlServer: boolean;
  sqlServerStatusMessage: string | null;
  onImportSourceChange: (source: "file" | "sqlserver") => void;
  onFileChange: (file: File | null) => void;
  onValidate: () => void;
  onSqlServerProjectNameChange: (value: string) => void;
  onSqlServerIdsChange: (value: string) => void;
  onSqlServerIdTypeChange: (value: "auto" | "epic" | "feature") => void;
  onValidateSqlServer: () => void;
  onTestSqlServerConnection: () => void;
}) {
  return (
    <section className="workspace-grid">
      <div className="panel import-panel">
        <div className="panel-heading">
          {importSource === "file" ? <FileSpreadsheet size={20} /> : <Database size={20} />}
          <h2>{importSource === "file" ? "Validar planilha" : "Consultar SQL Server"}</h2>
        </div>

        <div className="import-source-tabs" role="tablist" aria-label="Fonte da importacao">
          <button
            className={importSource === "file" ? "active" : ""}
            type="button"
            onClick={() => onImportSourceChange("file")}
          >
            <FileSpreadsheet size={16} />
            <span>Planilha</span>
          </button>
          <button
            className={importSource === "sqlserver" ? "active" : ""}
            type="button"
            onClick={() => onImportSourceChange("sqlserver")}
          >
            <Database size={16} />
            <span>SQL Server</span>
          </button>
        </div>

        {importSource === "file" ? (
          <>
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
          </>
        ) : (
          <div className="sqlserver-import-form">
            <label className="sqlserver-project-field">
              <span>Nome do projeto</span>
              <input
                value={sqlServerProjectName}
                onChange={(event) => onSqlServerProjectNameChange(event.target.value)}
                placeholder="Ex: 187358 - Cadastro Agil V2"
                maxLength={120}
              />
            </label>

            <div className="sqlserver-import-grid">
              <label className="sqlserver-id-field">
                <span>IDs</span>
                <input
                  value={sqlServerIds}
                  onChange={(event) => onSqlServerIdsChange(event.target.value)}
                  placeholder="Ex: 123, 456, 789"
                />
              </label>
              <label>
                <span>Tipo do ID</span>
                <select
                  value={sqlServerIdType}
                  onChange={(event) => onSqlServerIdTypeChange(event.target.value as "auto" | "epic" | "feature")}
                >
                  <option value="auto">Automatico</option>
                  <option value="epic">Epic</option>
                  <option value="feature">Feature</option>
                </select>
              </label>
            </div>

            <button
              className="secondary-button"
              disabled={isTestingSqlServer || isLoading}
              onClick={onTestSqlServerConnection}
              type="button"
            >
              <PlugZap size={16} />
              {isTestingSqlServer ? "Testando..." : "Testar conexao"}
            </button>

            <button className="primary-button" disabled={isLoading} onClick={onValidateSqlServer} type="button">
              {isLoading ? "Consultando..." : "Importar do banco"}
            </button>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
        {sqlServerStatusMessage && <p className="success-text">{sqlServerStatusMessage}</p>}
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
