import { IssueRow } from "../IssueRow";
import { ResultPanel } from "../ResultPanel";
import type { ImportIssue } from "../../types";

type ValidationResultsGridProps = {
  blockingIssues: ImportIssue[];
  alertIssues: ImportIssue[];
};

export function ValidationResultsGrid({ blockingIssues }: ValidationResultsGridProps) {
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

    </section>
  );
}
