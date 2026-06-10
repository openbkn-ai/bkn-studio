import {
  CompressOutlined,
  DatabaseOutlined,
  MinusOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { renderResourceIcon } from "@/modules/knowledge-network/components/shared/ResourceIconSelect";
import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import {
  computePreviewGraphLayout,
  PREVIEW_LAYOUT_HEIGHT,
  PREVIEW_LAYOUT_WIDTH,
  PREVIEW_NODE_RADIUS,
} from "@/modules/knowledge-network/utils/compute-preview-graph-layout";
import {
  buildPreviewGraphEdgePath,
  getPreviewDirectedEdgeKey,
} from "@/modules/knowledge-network/utils/preview-graph-edge-path";

import styles from "./KnowledgeNetworkPreviewCanvas.module.css";

type KnowledgeNetworkPreviewCanvasProps = {
  graph: KnowledgeNetworkPreviewGraph;
};

type NodePosition = {
  x: number;
  y: number;
};

type ViewportState = {
  scale: number;
  x: number;
  y: number;
};

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;

type RenderEdge = {
  edge: KnowledgeNetworkPreviewGraph["edges"][number];
  edgeIndex: number;
  edgeTotal: number;
};

function truncateLabel(value: string, maxLength = 12) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}…`;
}

export function KnowledgeNetworkPreviewCanvas({ graph }: KnowledgeNetworkPreviewCanvasProps) {
  const { t } = useTranslation();
  const shellRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  } | null>(null);
  const nodeDragRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
    pointerId: number;
  } | null>(null);
  const [size, setSize] = useState({ height: 560, width: 960 });
  const [viewport, setViewport] = useState<ViewportState>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  useEffect(() => {
    const element = shellRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? 960;
      const nextHeight = entry?.contentRect.height ?? 560;
      setSize({
        height: Math.max(520, nextHeight),
        width: Math.max(640, nextWidth),
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const layoutNodes = useMemo(() => computePreviewGraphLayout(graph), [graph]);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});

  useEffect(() => {
    setNodePositions(
      Object.fromEntries(layoutNodes.map((node) => [node.id, { x: node.x, y: node.y }])),
    );
  }, [layoutNodes]);

  const positionList = useMemo(
    () =>
      graph.nodes
        .map((node) => {
          const position = nodePositions[node.id];
          return position ? { id: node.id, ...position } : null;
        })
        .filter((node): node is { id: string; x: number; y: number } => Boolean(node)),
    [graph.nodes, nodePositions],
  );

  const layoutMap = useMemo(
    () => new Map(positionList.map((node) => [node.id, node])),
    [positionList],
  );

  const getGraphPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) {
        return null;
      }

      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      };
    },
    [viewport.scale, viewport.x, viewport.y],
  );

  const renderEdges = useMemo(() => {
    const grouped = new Map<string, KnowledgeNetworkPreviewGraph["edges"]>();

    for (const edge of graph.edges) {
      const key = getPreviewDirectedEdgeKey(edge.sourceId, edge.targetId);
      grouped.set(key, [...(grouped.get(key) ?? []), edge]);
    }

    return graph.edges
      .map((edge) => {
        const key = getPreviewDirectedEdgeKey(edge.sourceId, edge.targetId);
        const siblings = [...(grouped.get(key) ?? [edge])].sort((left, right) =>
          left.id.localeCompare(right.id),
        );
        const edgeIndex = siblings.findIndex((item) => item.id === edge.id);

        return {
          edge,
          edgeIndex: edgeIndex < 0 ? 0 : edgeIndex,
          edgeTotal: siblings.length,
        } satisfies RenderEdge;
      })
      .sort((left, right) => left.edge.id.localeCompare(right.edge.id));
  }, [graph.edges]);

  const fitViewToPositions = useCallback(
    (positions: Array<{ x: number; y: number }>) => {
      if (positions.length === 0) {
        setViewport({ scale: 1, x: 0, y: 0 });
        return;
      }

      const padding = 72;
      const xs = positions.map((node) => node.x);
      const ys = positions.map((node) => node.y);
      const minX = Math.min(...xs) - padding;
      const maxX = Math.max(...xs) + padding;
      const minY = Math.min(...ys) - padding;
      const maxY = Math.max(...ys) + padding;
      const graphWidth = Math.max(maxX - minX, 1);
      const graphHeight = Math.max(maxY - minY, 1);
      const scale = Math.min(
        MAX_SCALE,
        Math.max(
          MIN_SCALE,
          Math.min(size.width / graphWidth, size.height / graphHeight),
        ),
      );
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      setViewport({
        scale,
        x: size.width / 2 - centerX * scale,
        y: size.height / 2 - centerY * scale,
      });
    },
    [size.height, size.width],
  );

  const fitView = useCallback(() => {
    fitViewToPositions(positionList);
  }, [fitViewToPositions, positionList]);

  useEffect(() => {
    fitViewToPositions(layoutNodes);
  }, [fitViewToPositions, layoutNodes]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const zoomFactor = event.deltaY > 0 ? 0.92 : 1.08;

    setViewport((current) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * zoomFactor));
      const graphX = (pointerX - current.x) / current.scale;
      const graphY = (pointerY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointerX - graphX * nextScale,
        y: pointerY - graphY * nextScale,
      };
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest(`.${styles.nodeCard}`)) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: viewport.x,
      y: viewport.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleNodePointerDown = (
    nodeId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const point = getGraphPointer(event.clientX, event.clientY);
    const position = nodePositions[nodeId];
    if (!point || !position) {
      return;
    }

    event.stopPropagation();
    nodeDragRef.current = {
      nodeId,
      offsetX: point.x - position.x,
      offsetY: point.y - position.y,
      pointerId: event.pointerId,
    };
    setDraggingNodeId(nodeId);
    viewportRef.current?.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const nodeDrag = nodeDragRef.current;
    if (nodeDrag && nodeDrag.pointerId === event.pointerId) {
      const point = getGraphPointer(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      setNodePositions((current) => ({
        ...current,
        [nodeDrag.nodeId]: {
          x: point.x - nodeDrag.offsetX,
          y: point.y - nodeDrag.offsetY,
        },
      }));
      return;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    setViewport((current) => ({
      ...current,
      x: dragState.x + (event.clientX - dragState.startX),
      y: dragState.y + (event.clientY - dragState.startY),
    }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current?.pointerId === event.pointerId) {
      nodeDragRef.current = null;
      setDraggingNodeId(null);
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const zoomBy = (factor: number) => {
    setViewport((current) => ({
      ...current,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor)),
    }));
  };

  const stageTransform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;

  return (
    <div className={styles.canvasShell} ref={shellRef}>
      <div className={styles.canvasToolbar}>
        <button
          aria-label={t("knowledgeNetwork.previewZoomIn")}
          className={styles.toolbarButton}
          onClick={() => zoomBy(1.12)}
          type="button"
        >
          <PlusOutlined />
        </button>
        <button
          aria-label={t("knowledgeNetwork.previewZoomOut")}
          className={styles.toolbarButton}
          onClick={() => zoomBy(0.88)}
          type="button"
        >
          <MinusOutlined />
        </button>
        <button
          aria-label={t("knowledgeNetwork.previewFitView")}
          className={styles.toolbarButton}
          onClick={fitView}
          type="button"
        >
          <CompressOutlined />
        </button>
      </div>

      <div
        className={
          dragging || draggingNodeId
            ? `${styles.canvasViewport} ${styles.canvasViewportDragging}`
            : styles.canvasViewport
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        ref={viewportRef}
      >
        <div
          className={styles.canvasStage}
          style={{
            height: PREVIEW_LAYOUT_HEIGHT,
            transform: stageTransform,
            width: PREVIEW_LAYOUT_WIDTH,
          }}
        >
          <svg
            aria-hidden
            className={styles.canvasSvg}
            height={PREVIEW_LAYOUT_HEIGHT}
            width={PREVIEW_LAYOUT_WIDTH}
          >
            <defs>
              <pattern
                height="24"
                id="preview-grid"
                patternUnits="userSpaceOnUse"
                width="24"
              >
                <circle cx="1.5" cy="1.5" fill="#e8e8e8" r="1.2" />
              </pattern>
              <marker
                id="preview-arrow"
                markerHeight="8"
                markerUnits="strokeWidth"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="#d9d9d9" />
              </marker>
            </defs>
            <rect
              fill="url(#preview-grid)"
              height={PREVIEW_LAYOUT_HEIGHT}
              width={PREVIEW_LAYOUT_WIDTH}
              x={0}
              y={0}
            />
            <g>
              {renderEdges.map(({ edge, edgeIndex, edgeTotal }) => {
                const source = layoutMap.get(edge.sourceId);
                const target = layoutMap.get(edge.targetId);
                if (!source || !target) {
                  return null;
                }

                const label = truncateLabel(edge.name || t("knowledgeNetwork.defaultEdgeName"));
                const path = buildPreviewGraphEdgePath(
                  source.x,
                  source.y,
                  target.x,
                  target.y,
                  {
                    edgeIndex,
                    edgeTotal,
                    label,
                    nodeRadius: PREVIEW_NODE_RADIUS,
                  },
                );

                return (
                  <g key={edge.id}>
                    <path
                      className={styles.edgePath}
                      d={path.d}
                      markerEnd="url(#preview-arrow)"
                    />
                    <rect
                      className={styles.edgeLabelBg}
                      height={path.labelHeight}
                      rx={3}
                      width={path.labelWidth}
                      x={path.labelX - path.labelWidth / 2}
                      y={path.labelY - path.labelHeight / 2}
                    />
                    <text className={styles.edgeLabel} x={path.labelX} y={path.labelY + 4}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div
            className={styles.nodeLayer}
            style={{ height: PREVIEW_LAYOUT_HEIGHT, width: PREVIEW_LAYOUT_WIDTH }}
          >
            {graph.nodes.map((node) => {
              const position = layoutMap.get(node.id);
              if (!position) {
                return null;
              }

              return (
                <div
                  className={
                    draggingNodeId === node.id
                      ? `${styles.nodeCard} ${styles.nodeCardDragging}`
                      : styles.nodeCard
                  }
                  key={node.id}
                  onPointerDown={(event) => handleNodePointerDown(node.id, event)}
                  style={{ left: position.x, top: position.y }}
                >
                  <span
                    className={styles.nodeCircle}
                    style={{ backgroundColor: node.color || "#3b8cff" }}
                  >
                    {node.icon ? renderResourceIcon(node.icon, 24) : <DatabaseOutlined />}
                  </span>
                  <span className={styles.nodeLabel}>{truncateLabel(node.name, 16)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
