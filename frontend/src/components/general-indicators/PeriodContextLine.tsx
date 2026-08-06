import {
  formatAnalyzedPeriodLabel,
  formatComparedPeriodsLabel,
  type PeriodRange,
} from "../../utils/periodPresentation";

export function PeriodContextLine({
  period,
}: {
  period?: PeriodRange | null;
}) {
  if (!period?.startDate || !period?.endDate) return null;

  return (
    <p className="period-context-line">
      <span>Período analisado:</span> {formatAnalyzedPeriodLabel(period)}
    </p>
  );
}

export function ComparedPeriodsContextLine({
  periodA,
  periodB,
}: {
  periodA?: PeriodRange | null;
  periodB?: PeriodRange | null;
}) {
  if (!periodA?.startDate || !periodA?.endDate || !periodB?.startDate || !periodB?.endDate) return null;

  return (
    <p className="period-context-line">
      <span>Períodos comparados:</span> {formatComparedPeriodsLabel(periodA, periodB)}
    </p>
  );
}
