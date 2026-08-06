export function buildLineChartHighlights(
  data: Array<Record<string, any>>,
  series: ReadonlyArray<{ key: string }>,
) {
  return Object.fromEntries(
    series.map((item) => {
      const values = data
        .map((point, index) => ({ index, value: Number(point[item.key] || 0) }))
        .filter((point) => Number.isFinite(point.value));
      const highlighted = new Set<number>();
      if (values.length > 0) {
        const max = values.reduce((current, point) => point.value > current.value ? point : current, values[0]);
        const min = values.reduce((current, point) => point.value < current.value ? point : current, values[0]);
        highlighted.add(max.index);
        highlighted.add(min.index);
        highlighted.add(values[values.length - 1].index);
      }
      return [item.key, highlighted];
    }),
  ) as Record<string, Set<number>>;
}

export function LinePointValueLabel({
  x = 0,
  y = 0,
  index,
  value,
  highlightedIndexes,
  formatter,
}: any & {
  highlightedIndexes: Set<number>;
  formatter: (value: number) => string;
}) {
  const numericValue = Number(value || 0);
  if (!highlightedIndexes.has(Number(index)) || !Number.isFinite(numericValue)) return null;

  return (
    <text
      className="monthly-line-point-label"
      dominantBaseline="auto"
      textAnchor="middle"
      x={Number(x)}
      y={Number(y) - 10}
    >
      {formatter(numericValue)}
    </text>
  );
}
