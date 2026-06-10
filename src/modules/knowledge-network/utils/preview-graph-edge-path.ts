export type PreviewGraphEdgePath = {
  d: string;
  labelHeight: number;
  labelWidth: number;
  labelX: number;
  labelY: number;
};

type Point = {
  x: number;
  y: number;
};

const LABEL_CHAR_WIDTH = 7;
const LABEL_PADDING_X = 10;
const LABEL_HEIGHT = 16;

function cubicPoint(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  t: number,
): Point {
  const inverse = 1 - t;
  const a = inverse * inverse * inverse;
  const b = 3 * inverse * inverse * t;
  const c = 3 * inverse * t * t;
  const d = t * t * t;

  return {
    x: a * start.x + b * control1.x + c * control2.x + d * end.x,
    y: a * start.y + b * control1.y + c * control2.y + d * end.y,
  };
}

function estimateLabelWidth(label: string) {
  return Math.max(label.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2, 28);
}

function resolveParallelSpread(edgeIndex: number, edgeTotal: number) {
  if (edgeTotal <= 1) {
    return 0;
  }

  return edgeIndex - (edgeTotal - 1) / 2;
}

function resolveParallelGap(edgeTotal: number) {
  if (edgeTotal <= 1) {
    return 0;
  }

  return Math.max(30, 38 - edgeTotal * 2);
}

export function buildPreviewGraphEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  options: {
    edgeIndex: number;
    edgeTotal: number;
    label?: string;
    nodeRadius?: number;
  },
): PreviewGraphEdgePath {
  const nodeRadius = options.nodeRadius ?? 36;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.hypot(dx, dy) || 1;
  const unitX = dx / distance;
  const unitY = dy / distance;
  const normalX = -unitY;
  const normalY = unitX;

  const start = {
    x: sourceX + unitX * nodeRadius,
    y: sourceY + unitY * nodeRadius,
  };
  const end = {
    x: targetX - unitX * nodeRadius,
    y: targetY - unitY * nodeRadius,
  };

  const spread = resolveParallelSpread(options.edgeIndex, options.edgeTotal);
  const parallelGap = resolveParallelGap(options.edgeTotal);
  const lateralOffset = spread * parallelGap;
  const handleLength = Math.min(distance * 0.28, 140);
  const bow = -Math.min(42, Math.max(16, distance * 0.1));

  const control1 = {
    x: start.x + unitX * handleLength + normalX * (lateralOffset + bow),
    y: start.y + unitY * handleLength + normalY * (lateralOffset + bow),
  };
  const control2 = {
    x: end.x - unitX * handleLength + normalX * (lateralOffset + bow),
    y: end.y - unitY * handleLength + normalY * (lateralOffset + bow),
  };

  const labelT = 0.5;
  const labelPoint = cubicPoint(start, control1, control2, end, labelT);
  const label = options.label ?? "";

  return {
    d: `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`,
    labelHeight: LABEL_HEIGHT,
    labelWidth: estimateLabelWidth(label),
    labelX: labelPoint.x,
    labelY: labelPoint.y,
  };
}

export function getPreviewDirectedEdgeKey(sourceId: string, targetId: string) {
  return `${sourceId}|${targetId}`;
}

export function getPreviewEdgePairKey(sourceId: string, targetId: string) {
  return sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`;
}
