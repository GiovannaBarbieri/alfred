export type LineChartRow = Record<string, string | number | null | undefined>;

export function trimInactiveEdges(rows: LineChartRow[], seriesKeys: string[]): LineChartRow[] {
  const trimmedRows = rows.map((row) => ({ ...row }));

  seriesKeys.forEach((seriesKey) => {
    const firstActiveIndex = trimmedRows.findIndex((row) => isPositiveNumber(row[seriesKey]));
    if (firstActiveIndex === -1) {
      trimmedRows.forEach((row) => {
        row[seriesKey] = null;
      });
      return;
    }

    let lastActiveIndex = firstActiveIndex;
    for (let index = trimmedRows.length - 1; index >= firstActiveIndex; index -= 1) {
      if (isPositiveNumber(trimmedRows[index][seriesKey])) {
        lastActiveIndex = index;
        break;
      }
    }

    trimmedRows.forEach((row, index) => {
      if (index < firstActiveIndex || index > lastActiveIndex) {
        row[seriesKey] = null;
      }
    });
  });

  return trimmedRows;
}

function isPositiveNumber(value: string | number | null | undefined) {
  return Number(value ?? 0) > 0;
}
