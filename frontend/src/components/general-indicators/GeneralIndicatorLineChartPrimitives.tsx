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
        highlighted.add(values[0].index);
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
  const numericIndex = Number(index);
  if (!highlightedIndexes.has(numericIndex) || !Number.isFinite(numericValue)) return null;
  const offsets = labelOffsetForIndex(numericIndex);

  return (
    <text
      className="monthly-line-point-label"
      dominantBaseline="middle"
      textAnchor={offsets.anchor}
      x={Number(x) + offsets.dx}
      y={Number(y) + offsets.dy}
    >
      {formatter(numericValue)}
    </text>
  );
}

function labelOffsetForIndex(index: number): { dx: number; dy: number; anchor: "start" | "middle" | "end" } {
  const pattern = index % 4;
  if (pattern === 0) return { dx: 8, dy: -12, anchor: "start" };
  if (pattern === 1) return { dx: 0, dy: 14, anchor: "middle" };
  if (pattern === 2) return { dx: -8, dy: -12, anchor: "end" };
  return { dx: 0, dy: -16, anchor: "middle" };
}
