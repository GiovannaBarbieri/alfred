const twoDecimalFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

export function formatCountPtBr(value: number) {
  return integerFormatter.format(Number(value || 0));
}

export function formatCompactHoursPtBr(value: number) {
  return `${integerFormatter.format(Number(value || 0))}h`;
}
