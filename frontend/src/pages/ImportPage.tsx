import { AlertCircle, CheckCircle2, Database, FileSpreadsheet, Loader2, PlugZap, Upload } from "lucide-react";

import type { ImportValidationResponse } from "../types";
import { importProcessingSteps, sqlServerProcessingSteps } from "../hooks/useImportFlow";

const idTypeLabels: Record<"auto" | "epic" | "feature", string> = {
  auto: "Automatico",
  epic: "Epic",
  feature: "Feature",
};

function countSqlServerIds(value: string) {
  return value
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

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
  sqlServerConnectionValidated,
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
  sqlServerConnectionValidated: boolean;
  onImportSourceChange: (source: "file" | "sqlserver") => void;
  onFileChange: (file: File | null) => void;
  onValidate: () => void;
  onSqlServerProjectNameChange: (value: string) => void;
  onSqlServerIdsChange: (value: string) => void;
  onSqlServerIdTypeChange: (value: "auto" | "epic" | "feature") => void;
  onValidateSqlServer: () => void;
  onTestSqlServerConnection: () => void;
}) {
  const sqlServerIdCount = countSqlServerIds(sqlServerIds);
  const sqlServerRequiredFieldsReady =
    Boolean(sqlServerProjectName.trim()) && Boolean(sqlServerIds.trim()) && Boolean(sqlServerIdType);
  const sqlServerSummaryStatus = result
    ? "Importacao concluida"
    : sqlServerConnectionValidated
      ? "Conectado"
      : "Aguardando conexao";
  const currentProcessingSteps = importSource === "sqlserver" ? sqlServerProcessingSteps : importProcessingSteps;

  return (
    <section className="workspace-grid import-workspace-grid">
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
            <FileSpreadsheet size={18} />
            <span>Planilha</span>
          </button>
          <button
            className={importSource === "sqlserver" ? "active" : ""}
            type="button"
            onClick={() => onImportSourceChange("sqlserver")}
          >
            <Database size={18} />
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
          <div className="sqlserver-import-layout">
            <div className="sqlserver-import-form">
              <label className="sqlserver-project-field">
                <span>
                  Nome do projeto <b className="required-mark">*</b>
                </span>
                <input
                  value={sqlServerProjectName}
                  onChange={(event) => onSqlServerProjectNameChange(event.target.value)}
                  placeholder="Ex.: Cadastro Agil V2"
                  maxLength={120}
                  required
                />
                <small className="field-helper">Este nome sera utilizado para identificar esta importacao no sistema.</small>
              </label>

              <div className="sqlserver-import-grid">
                <label className="sqlserver-id-field">
                  <span>
                    IDs <b className="required-mark">*</b>
                  </span>
                  <input
                    value={sqlServerIds}
                    onChange={(event) => onSqlServerIdsChange(event.target.value)}
                    placeholder="Ex.: 187358 ou 123,456,789"
                    required
                  />
                  <small className="field-helper">Informe um ou mais IDs separados por virgula.</small>
                </label>
                <label>
                  <span>
                    Tipo do ID <b className="required-mark">*</b>
                  </span>
                  <select
                    value={sqlServerIdType}
                    onChange={(event) => onSqlServerIdTypeChange(event.target.value as "auto" | "epic" | "feature")}
                    required
                  >
                    <option value="auto">Automatico</option>
                    <option value="epic">Epic</option>
                    <option value="feature">Feature</option>
                  </select>
                  <small className="field-helper">
                    Selecione o tipo dos IDs informados ou utilize Automatico para deteccao automatica.
                  </small>
                </label>
              </div>

              <button
                className={`secondary-button sqlserver-test-button ${sqlServerConnectionValidated ? "validated" : ""}`}
                disabled={!sqlServerRequiredFieldsReady || isTestingSqlServer || isLoading}
                onClick={onTestSqlServerConnection}
                type="button"
              >
                {isTestingSqlServer ? (
                  <Loader2 className="button-spinner" size={18} />
                ) : sqlServerConnectionValidated ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <PlugZap size={18} />
                )}
                {isTestingSqlServer
                  ? "Testando conexao..."
                  : sqlServerConnectionValidated
                    ? "Conexao validada"
                    : "Testar conexao"}
              </button>

              <button
                className="primary-button sqlserver-import-button"
                disabled={!sqlServerRequiredFieldsReady || !sqlServerConnectionValidated || isLoading}
                onClick={onValidateSqlServer}
                type="button"
              >
                {isLoading && <Loader2 className="button-spinner" size={18} />}
                {isLoading ? "Importando..." : "Importar do banco"}
              </button>
            </div>

            <aside className="sqlserver-import-summary" aria-label="Resumo da importacao">
              <h3>Resumo da importacao</h3>
              <dl>
                <div>
                  <dt>Origem</dt>
                  <dd>SQL Server</dd>
                </div>
                <div>
                  <dt>Projeto</dt>
                  <dd>{sqlServerProjectName.trim() || "Nao informado"}</dd>
                </div>
                <div>
                  <dt>Quantidade de IDs</dt>
                  <dd>{sqlServerIdCount}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{idTypeLabels[sqlServerIdType]}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd className={sqlServerConnectionValidated ? "connected" : ""}>{sqlServerSummaryStatus}</dd>
                </div>
              </dl>
            </aside>
          </div>
        )}

        {importSource === "sqlserver" && error && (
          <div className="form-alert error" role="alert">
            <AlertCircle size={18} />
            <div>
              <strong>Nao foi possivel continuar.</strong>
              <span>{error}</span>
            </div>
          </div>
        )}
        {importSource === "sqlserver" && sqlServerConnectionValidated && sqlServerStatusMessage && (
          <div className="form-alert success" role="status">
            <CheckCircle2 size={18} />
            <div>
              <strong>Conexao realizada com sucesso.</strong>
              <span>O banco esta acessivel e pronto para importacao.</span>
            </div>
          </div>
        )}
        {importSource === "file" && error && <p className="error-text">{error}</p>}
        {importSource === "file" && sqlServerStatusMessage && <p className="success-text">{sqlServerStatusMessage}</p>}
        {processingMessage && (
          <div className={`import-processing-card ${isLoading ? "active" : ""}`} role="status" aria-live="polite">
            <div className="import-processing-header">
              {isLoading && <span className="processing-spinner" aria-hidden="true" />}
              <strong>{processingMessage}</strong>
            </div>
            {isLoading && (
              <ol className="import-processing-steps">
                {currentProcessingSteps.map((step, index) => (
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
          <div
            className={`import-file-history-summary ${
              result.fileHistory.exactDuplicate ? "warning" : result.fileHistory.status === "nova_versao" ? "info" : "success"
            }`}
          >
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
