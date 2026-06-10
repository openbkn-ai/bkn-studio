import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";

export const PREVIEW_LAYOUT_WIDTH = 1000;
export const PREVIEW_LAYOUT_HEIGHT = 720;
export const PREVIEW_NODE_RADIUS = 36;
const MIN_NODE_DISTANCE = 210;
const LABEL_CLEARANCE = 28;

export type PreviewGraphLayoutNode = {
  id: string;
  x: number;
  y: number;
};

function buildDegreeMap(graph: KnowledgeNetworkPreviewGraph) {
  const degree = new Map<string, number>();

  for (const node of graph.nodes) {
    degree.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
    degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
  }

  return degree;
}

function resolveCollisions(
  positions: Map<string, { x: number; y: number }>,
  nodeIds: string[],
) {
  for (let iteration = 0; iteration < 80; iteration += 1) {
    let moved = false;

    for (let left = 0; left < nodeIds.length; left += 1) {
      for (let right = left + 1; right < nodeIds.length; right += 1) {
        const source = positions.get(nodeIds[left]!)!;
        const target = positions.get(nodeIds[right]!)!;
        let dx = target.x - source.x;
        let dy = target.y - source.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance >= MIN_NODE_DISTANCE) {
          continue;
        }

        const push = (MIN_NODE_DISTANCE - distance) / 2;
        dx /= distance;
        dy /= distance;
        source.x -= dx * push;
        source.y -= dy * push;
        target.x += dx * push;
        target.y += dy * push;
        moved = true;
      }
    }

    if (!moved) {
      break;
    }
  }
}

function clampPositions(
  positions: Map<string, { x: number; y: number }>,
  nodeIds: string[],
) {
  const paddingX = PREVIEW_NODE_RADIUS + 24;
  const paddingY = PREVIEW_NODE_RADIUS + LABEL_CLEARANCE + 24;

  for (const nodeId of nodeIds) {
    const position = positions.get(nodeId)!;
    position.x = Math.max(paddingX, Math.min(PREVIEW_LAYOUT_WIDTH - paddingX, position.x));
    position.y = Math.max(paddingY, Math.min(PREVIEW_LAYOUT_HEIGHT - paddingY, position.y));
  }
}

export function computePreviewGraphLayout(
  graph: KnowledgeNetworkPreviewGraph,
): PreviewGraphLayoutNode[] {
  if (graph.nodes.length === 0) {
    return [];
  }

  if (graph.nodes.length === 1) {
    return [
      {
        id: graph.nodes[0]!.id,
        x: PREVIEW_LAYOUT_WIDTH / 2,
        y: PREVIEW_LAYOUT_HEIGHT / 2,
      },
    ];
  }

  const degreeMap = buildDegreeMap(graph);
  const isolatedNodes = graph.nodes.filter((node) => (degreeMap.get(node.id) ?? 0) === 0);
  const connectedNodes = graph.nodes.filter((node) => (degreeMap.get(node.id) ?? 0) > 0);
  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();

  isolatedNodes.forEach((node, index) => {
    positions.set(node.id, {
      x: 180,
      y: 130 + index * 220,
      vx: 0,
      vy: 0,
    });
  });

  const connectedCenterX = isolatedNodes.length > 0 ? 680 : PREVIEW_LAYOUT_WIDTH / 2;
  const connectedCenterY = PREVIEW_LAYOUT_HEIGHT / 2;

  connectedNodes.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(connectedNodes.length, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: connectedCenterX + Math.cos(angle) * 180,
      y: connectedCenterY + Math.sin(angle) * 160,
      vx: 0,
      vy: 0,
    });
  });

  const movableNodeIds = connectedNodes.map((node) => node.id);
  const idealEdgeLength = 300;
  const iterations = 180;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let left = 0; left < movableNodeIds.length; left += 1) {
      for (let right = left + 1; right < movableNodeIds.length; right += 1) {
        const source = positions.get(movableNodeIds[left]!)!;
        const target = positions.get(movableNodeIds[right]!)!;
        let dx = source.x - target.x;
        let dy = source.y - target.y;
        const distance = Math.hypot(dx, dy) || 1;
        const force = 28_000 / (distance * distance);
        dx = (dx / distance) * force;
        dy = (dy / distance) * force;
        source.vx += dx;
        source.vy += dy;
        target.vx -= dx;
        target.vy -= dy;
      }
    }

    for (const edge of graph.edges) {
      const source = positions.get(edge.sourceId);
      const target = positions.get(edge.targetId);
      if (!source || !target) {
        continue;
      }

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.hypot(dx, dy) || 1;
      const displacement = distance - idealEdgeLength;
      const force = displacement * 0.05;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      if (movableNodeIds.includes(edge.sourceId)) {
        source.vx += fx;
        source.vy += fy;
      }
      if (movableNodeIds.includes(edge.targetId)) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    for (const nodeId of movableNodeIds) {
      const position = positions.get(nodeId)!;
      position.vx += (connectedCenterX - position.x) * 0.004;
      position.vy += (connectedCenterY - position.y) * 0.004;
      position.x += position.vx;
      position.y += position.vy;
      position.vx *= 0.78;
      position.vy *= 0.78;
    }
  }

  const allNodeIds = graph.nodes.map((node) => node.id);
  const plainPositions = new Map(
    [...positions.entries()].map(([id, position]) => [id, { x: position.x, y: position.y }]),
  );

  resolveCollisions(plainPositions, allNodeIds);
  clampPositions(plainPositions, allNodeIds);

  return allNodeIds.map((nodeId) => {
    const position = plainPositions.get(nodeId)!;
    return { id: nodeId, x: position.x, y: position.y };
  });
}
