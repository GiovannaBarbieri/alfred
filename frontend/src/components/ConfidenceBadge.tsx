export function ConfidenceBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  return <span className={`confidence-badge ${normalized}`}>{level}</span>;
}
