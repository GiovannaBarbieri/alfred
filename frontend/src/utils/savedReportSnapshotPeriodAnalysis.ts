export function validateSnapshotPeriod(
  startDate: string,
  endDate: string,
  officialStart: string,
  officialEnd: string,
): { startDate?: string; endDate?: string } {
  const errors: { startDate?: string; endDate?: string } = {};
  if (!startDate) errors.startDate = "Informe a data inicial.";
  if (!endDate) errors.endDate = "Informe a data final.";
  if (startDate && startDate < officialStart) errors.startDate = "A data inicial deve estar dentro do período do relatório.";
  if (endDate && endDate > officialEnd) errors.endDate = "A data final deve estar dentro do período do relatório.";
  if (startDate && endDate && endDate < startDate) errors.endDate = "A data final não pode ser anterior à data inicial.";
  return errors;
}
