export function normalizeTimestamp(value?: number): number | undefined {
  if (value == null || value === 0) {
    return undefined;
  }

  // Backend uses nanosecond timestamps; JS Date expects milliseconds.
  if (value > 1e15) {
    return Math.floor(value / 1_000_000);
  }

  return value;
}

export function formatExecutionUnitTime(value?: number): string {
  const normalized = normalizeTimestamp(value);

  if (!normalized) {
    return "-";
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
