export function IssueRow({ issue }: { issue: { line: number | null; field: string; message: string } }) {
  return (
    <div className="issue-row">
      <span>{issue.line ? `Linha ${issue.line}` : "Arquivo"}</span>
      <strong>{issue.field}</strong>
      <small>{issue.message}</small>
    </div>
  );
}
