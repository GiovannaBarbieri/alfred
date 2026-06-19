const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeWithHourFormat = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function parseDateParts(value: string) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?/);
  if (isoMatch) {
    return {
      year: isoMatch[1],
      month: isoMatch[2],
      day: isoMatch[3],
      hour: isoMatch[4],
      minute: isoMatch[5],
    };
  }

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (brMatch) {
    return {
      day: brMatch[1],
      month: brMatch[2],
      year: brMatch[3],
      hour: brMatch[4],
      minute: brMatch[5],
    };
  }

  return null;
}

export function formatDateBR(value: string) {
  const parts = parseDateParts(value);
  if (parts) return `${parts.day}/${parts.month}/${parts.year}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeFormat.format(date);
}

export function formatDateTimeBR(value: string) {
  const parts = parseDateParts(value);
  if (parts?.hour && parts.minute) return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
  if (parts) return `${parts.day}/${parts.month}/${parts.year}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return dateTimeWithHourFormat.format(date);
}

export function formatPeriodBR(value: string) {
  return formatDateBR(value);
}

export function formatWeekRangeBR(value: string) {
  const parts = parseDateParts(value);
  if (!parts) return value;

  const start = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  if (Number.isNaN(start.getTime())) return value;

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const endYear = String(end.getFullYear());
  const endMonth = String(end.getMonth() + 1).padStart(2, "0");
  const endDay = String(end.getDate()).padStart(2, "0");

  return `${formatDateBR(value)} a ${endDay}/${endMonth}/${endYear}`;
}
