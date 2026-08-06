const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export type PeriodRange = {
  startDate: string;
  endDate: string;
};

export function formatAnalyzedPeriodLabel(period: PeriodRange): string {
  const start = parseIsoDate(period.startDate);
  const end = parseIsoDate(period.endDate);
  if (!start || !end) return `${formatIsoDate(period.startDate)} a ${formatIsoDate(period.endDate)}`;
  if (start.year !== end.year) return formatCustomPeriod(period);

  const year = start.year;
  if (period.startDate === `${year}-01-01` && period.endDate === `${year}-12-31`) {
    return `Ano de ${year}`;
  }
  if (period.startDate === `${year}-01-01` && period.endDate === `${year}-06-30`) {
    return `1º Semestre de ${year}`;
  }
  if (period.startDate === `${year}-07-01` && period.endDate === `${year}-12-31`) {
    return `2º Semestre de ${year}`;
  }

  const quarterRanges = [
    { label: "1º Trimestre", start: `${year}-01-01`, end: `${year}-03-31` },
    { label: "2º Trimestre", start: `${year}-04-01`, end: `${year}-06-30` },
    { label: "3º Trimestre", start: `${year}-07-01`, end: `${year}-09-30` },
    { label: "4º Trimestre", start: `${year}-10-01`, end: `${year}-12-31` },
  ];
  const quarter = quarterRanges.find((item) => item.start === period.startDate && item.end === period.endDate);
  if (quarter) return `${quarter.label} de ${year}`;

  const fullMonth = start.month === end.month && start.day === 1 && end.day === lastDayOfMonth(year, start.month);
  if (fullMonth) return `${monthNames[start.month - 1]} de ${year}`;

  return formatCustomPeriod(period);
}

export function formatComparedPeriodsLabel(periodA: PeriodRange, periodB: PeriodRange): string {
  return `${formatAnalyzedPeriodLabel(periodA)} × ${formatAnalyzedPeriodLabel(periodB)}`;
}

export function formatIsoDate(value: string): string {
  const parts = parseIsoDate(value);
  if (!parts) return value;
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

function formatCustomPeriod(period: PeriodRange): string {
  return `${formatIsoDate(period.startDate)} a ${formatIsoDate(period.endDate)}`;
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
