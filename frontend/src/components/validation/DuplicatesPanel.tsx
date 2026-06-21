import type { SetStateAction } from "react";
import type { DuplicateGroup } from "../../types";
import { formatDateTimeBR } from "../../utils/date";

type DuplicatesPanelProps = {
  duplicates: DuplicateGroup[];
  duplicateSelections: Record<string, number>;
  onDuplicateSelectionsChange: (updater: SetStateAction<Record<string, number>>) => void;
};

export function DuplicatesPanel({ duplicates, duplicateSelections, onDuplicateSelectionsChange }: DuplicatesPanelProps) {
  if (duplicates.length === 0) return null;

  return (
    <section className="panel duplicates-panel">
      <div className="result-heading">
        <h2>Resolver duplicidades</h2>
        <span>{duplicates.length}</span>
      </div>
      <div className="duplicate-list">
        {duplicates.map((duplicate) => (
          <div className="duplicate-group" key={duplicate.idLancamento}>
            <div className="duplicate-title">
              <strong>IdLancamento {duplicate.idLancamento}</strong>
              <small>Escolha uma linha para manter na importação.</small>
            </div>
            <div className="duplicate-records">
              {duplicate.records.map((record) => (
                <label className="duplicate-record" key={`${duplicate.idLancamento}-${record.line}`}>
                  <input
                    checked={duplicateSelections[duplicate.idLancamento] === record.line}
                    name={`duplicate-${duplicate.idLancamento}`}
                    type="radio"
                    onChange={() =>
                      onDuplicateSelectionsChange((current) => ({
                        ...current,
                        [duplicate.idLancamento]: record.line,
                      }))
                    }
                  />
                  <span>Linha {record.line}</span>
                  <strong>{record.task}</strong>
                  <small>
                    {record.loginUsuario} - {record.duracao} - {formatDateTimeBR(record.dataHoraCadastro)}
                  </small>
                  <small>
                    {record.epic} / {record.pbi}
                  </small>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
