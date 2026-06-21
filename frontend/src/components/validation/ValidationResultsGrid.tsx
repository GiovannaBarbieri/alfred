import { ConfidenceBadge } from "../ConfidenceBadge";
import { IssueRow } from "../IssueRow";
import { ResultPanel } from "../ResultPanel";
import type { ImportIssue, ImportValidationResponse } from "../../types";

type ValidationResultsGridProps = {
  result: ImportValidationResponse;
  blockingIssues: ImportIssue[];
  alertIssues: ImportIssue[];
};

export function ValidationResultsGrid({ result, blockingIssues }: ValidationResultsGridProps) {
  return (
    <section className="results-grid">
      {blockingIssues.length > 0 && (
        <ResultPanel title="Bloqueios" emptyText="Nenhum bloqueio encontrado." count={blockingIssues.length} defaultOpen>
          {blockingIssues.slice(0, 8).map((issue, index) => (
            <IssueRow issue={issue} key={`${issue.code}-${issue.line}-${index}`} />
          ))}
        </ResultPanel>
      )}

      {/*
      Modulo de alertas ocultado por decisao de produto.
      Para reativar, incluir alertIssues novamente na assinatura do componente.
      <ResultPanel title="Alertas" emptyText="Nenhum alerta encontrado." count={alertIssues.length}>
        {alertIssues.slice(0, 8).map((issue, index) => (
          <IssueRow issue={issue} key={`${issue.code}-${issue.line}-${index}`} />
        ))}
      </ResultPanel>
      */}

      {/*
      Modulo resumido de classificacoes ocultado por decisao de produto.
      A revisao operacional continua no componente ClassificationReviewPanel.
      <ResultPanel title="Classificações" emptyText="Nenhuma classificação sugerida." count={result.classifications.length}>
        {result.classifications.slice(0, 8).map((item) => (
          <div className="classification-row" key={`${item.line}-${item.tituloTask}`}>
            <span>Linha {item.line}</span>
            <strong>{item.category}</strong>
            <small>
              {item.loginUsuario} - {item.subcategory} - {Math.round(item.confidence * 100)}%
            </small>
            <ConfidenceBadge level={item.confidenceLevel} />
          </div>
        ))}
      </ResultPanel>
      */}
    </section>
  );
}
