const twoDecimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const oneDecimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

export function formatHoursPtBr(value: number, spaceBeforeUnit = true) {
  return `${twoDecimalFormatter.format(Number(value || 0))}${spaceBeforeUnit ? " " : ""}h`;
}

export function formatPercentagePtBr(value: number) {
  return `${twoDecimalFormatter.format(Number(value || 0))}%`;
}

export function formatChartLabelHoursPtBr(value: number, spaceBeforeUnit = false) {
  return `${oneDecimalFormatter.format(Number(value || 0))}${spaceBeforeUnit ? " " : ""}h`;
}

export function formatChartLabelPercentagePtBr(value: number) {
  return `${oneDecimalFormatter.format(Number(value || 0))}%`;
}

export function formatCountPtBr(value: number) {
  return integerFormatter.format(Number(value || 0));
}

export function formatCompactHoursPtBr(value: number) {
  return `${integerFormatter.format(Number(value || 0))}h`;
}
