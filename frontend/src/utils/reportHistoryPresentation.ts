const kpiStatusLabels: Record<string, string> = {
  within_target: "Dentro da meta",
  attention: "Atenção",
  alert: "Alerta",
  critical: "Crítico",
};

export function formatReportDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return day && month && year ? `${day}/${month}/${year}` : "—";
}

export function formatReportDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatReportNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function formatReportHours(value: number): string {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} h`;
}

export function formatReportPercentage(value: number | null): string {
  return value === null ? "Não informado" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function formatKpiStatus(value: string | null): string {
  return value ? (kpiStatusLabels[value] ?? "Situação não informada") : "Situação não informada";
}
