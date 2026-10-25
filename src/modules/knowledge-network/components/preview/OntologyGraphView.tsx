/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Ontology graph for the modeling-preview redesign: colored entity-type nodes and relation edges, with selection and neighbor highlighting. */

import {
  CompressOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  RetweetOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { Dropdown } from "antd";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { KnowledgeNetworkPreviewGraph } from "@/modules/knowledge-network/types/knowledge-network";
import {
  PREVIEW_LAYOUT_HEIGHT,
  PREVIEW_LAYOUT_WIDTH,
  computePreviewGraphLayout,
} from "@/modules/knowledge-network/utils/compute-preview-graph-layout";

import styles from "./OntologyGraphView.module.css";

const HUB_RADIUS = 46;
const NODE_RADIUS = 38;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const GROUP_HULL_PAD = 28;
const FORCE_LAYOUT_NODE_LIMIT = 80;
const EDGE_LABEL_LIMIT = 120;
const MAX_VISIBLE_NODES = 1_200;
// Group-boundary colors, assigned stably after sorting by group ID.
const GROUP_COLORS = [
  "#2e68ff",
  "#7c4dff",
  "#00b8a3",
  "#f5a623",
  "#eb5757",
  "#11a0d8",
  "#9b51e0",
  "#2bb673",
];

type OntologyLayoutMode = "force" | "circle" | "group";
type OntologyRenderMode = OntologyLayoutMode | "grid";
type GraphViewBox = { x: number; y: number; w: number; h: number };
const EMPTY_GROUP_MAP = new Map<string, string>();

type OntologyGraphViewProps = {
  graph: KnowledgeNetworkPreviewGraph;
  indexedIds: Set<string>;
  /** Node ID to concept-group ID for logical-group clustering. */
  groupOf?: Map<string, string>;
  /** Group ID to name for boundary labels in logical-group mode. */
  groupNames?: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function truncate(value: string, max = 6) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

const CLAMP_PAD = 64;
const clamp = (value: number, max: number) => Math.max(CLAMP_PAD, Math.min(max - CLAMP_PAD, value));

function scalableCanvas(nodeCount: number) {
  if (nodeCount <= FORCE_LAYOUT_NODE_LIMIT) {
    return { width: PREVIEW_LAYOUT_WIDTH, height: PREVIEW_LAYOUT_HEIGHT };
  }
  const columns = Math.ceil(Math.sqrt(nodeCount * (PREVIEW_LAYOUT_WIDTH / PREVIEW_LAYOUT_HEIGHT)));
  const rows = Math.ceil(nodeCount / columns);
  return {
    width: Math.max(PREVIEW_LAYOUT_WIDTH, columns * NODE_SPACING + CLAMP_PAD * 2),
    height: Math.max(PREVIEW_LAYOUT_HEIGHT, rows * NODE_SPACING + CLAMP_PAD * 2),
  };
}

/** Circular layout: nodes are evenly distributed around a large circle centered on the canvas. */
function circleLayout(
  ids: string[],
  canvasWidth: number,
  canvasHeight: number,
): { id: string; x: number; y: number }[] {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const r = Math.min(canvasWidth, canvasHeight) * 0.4;
  const n = Math.max(ids.length, 1);
  return ids.map((id, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      id,
      x: clamp(cx + r * Math.cos(a), canvasWidth),
      y: clamp(cy + r * Math.sin(a), canvasHeight),
    };
  });
}

const NODE_GAP = 14; // 网格相邻节点中心最小距离之外的留白
const NODE_SPACING = NODE_RADIUS * 2 + NODE_GAP; // 理想中心距
const MIN_SPACING = NODE_RADIUS * 2; // 最小中心距：相切，绝不重叠
const CELL_INSET = GROUP_HULL_PAD + NODE_RADIUS; // cell 边到节点中心可用区的内缩（留出 hull 边距）

/** Arrange nodes in each group as an almost-square grid centered in its cell. Compress spacing only to MIN_SPACING, preserving non-overlap. */
function placeCluster(
  gids: string[],
  gcx: number,
  gcy: number,
  cellW: number,
  cellH: number,
  canvasWidth: number,
  canvasHeight: number,
): { id: string; x: number; y: number }[] {
  const n = gids.length;
  if (n <= 1) {
    return gids.map((id) => ({
      id,
      x: clamp(gcx, canvasWidth),
      y: clamp(gcy, canvasHeight),
    }));
  }
  const availW = Math.max(0, cellW - CELL_INSET * 2);
  const availH = Math.max(0, cellH - CELL_INSET * 2);
  // Choose a near-square column count from the available area's aspect ratio.
  const aspect = availW / Math.max(1, availH);
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect)) || 1));
  const rows = Math.ceil(n / cols);
  // Prefer NODE_SPACING; compress when space is limited but never below MIN_SPACING, where nodes touch.
  const spacingX =
    cols > 1 ? Math.max(MIN_SPACING, Math.min(NODE_SPACING, availW / (cols - 1))) : 0;
  const spacingY =
    rows > 1 ? Math.max(MIN_SPACING, Math.min(NODE_SPACING, availH / (rows - 1))) : 0;
  const startX = gcx - ((cols - 1) * spacingX) / 2;
  const startY = gcy - ((rows - 1) * spacingY) / 2;
  return gids.map((id, i) => ({
    id,
    x: startX + (i % cols) * spacingX,
    y: startY + Math.floor(i / cols) * spacingY,
  }));
}

/**
 * Clusters by concept group: each receives an equal-density cell with area proportional to node
 * count, distributed across horizontal shelves and then gridded internally. Large groups get larger
 * cells without overlap, smaller groups avoid wasted space, and all remain within the fixed canvas.
 */
function groupLayout(
  ids: string[],
  groupOf: Map<string, string>,
  canvasWidth: number,
  canvasHeight: number,
): { id: string; x: number; y: number }[] {
  const buckets = new Map<string, string[]>();
  ids.forEach((id) => {
    const g = groupOf.get(id) ?? "__ungrouped";
    const arr = buckets.get(g) ?? [];
    arr.push(id);
    buckets.set(g, arr);
  });
  const groups = [...buckets.values()];
  const gn = groups.length;
  if (gn <= 1) {
    // A single group uses the whole canvas as its cell.
    return placeCluster(
      groups[0] ?? [],
      canvasWidth / 2,
      canvasHeight / 2,
      canvasWidth,
      canvasHeight,
      canvasWidth,
      canvasHeight,
    );
  }
  const total = ids.length || 1;
  // Derive shelf count from canvas aspect ratio, then balance groups by node count; row height is proportional to node count.
  const shelfCount = Math.max(1, Math.round(Math.sqrt(gn * (canvasHeight / canvasWidth))) || 1);
  const shelves = Array.from({ length: shelfCount }, () => ({
    groups: [] as string[][],
    nodes: 0,
  }));
  // Place larger groups into the shelf with the fewest nodes to balance total row height.
  [...groups]
    .sort((a, b) => b.length - a.length)
    .forEach((gids) => {
      const target = shelves.reduce((min, s) => (s.nodes < min.nodes ? s : min));
      target.groups.push(gids);
      target.nodes += gids.length;
    });
  const out: { id: string; x: number; y: number }[] = [];
  let y = 0;
  shelves
    .filter((shelf) => shelf.groups.length > 0)
    .forEach((shelf) => {
      const shelfH = canvasHeight * (shelf.nodes / total);
      let x = 0;
      shelf.groups.forEach((gids) => {
        const cellW = canvasWidth * (gids.length / shelf.nodes);
        out.push(
          ...placeCluster(
            gids,
            x + cellW / 2,
            y + shelfH / 2,
            cellW,
            shelfH,
            canvasWidth,
            canvasHeight,
          ),
        );
        x += cellW;
      });
      y += shelfH;
    });
  return out;
}

export function OntologyGraphView({
  graph,
  indexedIds,
  groupOf,
  groupNames,
  selectedId,
  onSelect,
}: OntologyGraphViewProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<OntologyLayoutMode>("force");
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const logicalGroupingAvailable = Boolean(groupOf?.size);
  const selectedMode: OntologyLayoutMode =
    mode === "group" && !logicalGroupingAvailable ? "force" : mode;
  const renderMode: OntologyRenderMode =
    graph.nodes.length > FORCE_LAYOUT_NODE_LIMIT && selectedMode === "force"
      ? "grid"
      : selectedMode;
  const edgeLabelsVisible = showEdgeLabels && graph.edges.length <= EDGE_LABEL_LIMIT;

  // Recompute layout when graph or arrangement changes, not when selecting a node.
  const { positions, radiusById, hubId, canvasWidth, canvasHeight } = useMemo(() => {
    const ids = graph.nodes.map((node) => node.id);
    const canvas =
      renderMode === "force"
        ? { width: PREVIEW_LAYOUT_WIDTH, height: PREVIEW_LAYOUT_HEIGHT }
        : scalableCanvas(ids.length);
    const layout =
      renderMode === "circle"
        ? circleLayout(ids, canvas.width, canvas.height)
        : renderMode === "group" || renderMode === "grid"
          ? groupLayout(
              ids,
              renderMode === "group" ? (groupOf ?? EMPTY_GROUP_MAP) : EMPTY_GROUP_MAP,
              canvas.width,
              canvas.height,
            )
          : computePreviewGraphLayout(graph);
    const positionMap = new Map(
      layout.map((node) => [node.id, { id: node.id, x: node.x, y: node.y }]),
    );

    const degree = new Map<string, number>();
    graph.nodes.forEach((node) => degree.set(node.id, 0));
    graph.edges.forEach((edge) => {
      degree.set(edge.sourceId, (degree.get(edge.sourceId) ?? 0) + 1);
      degree.set(edge.targetId, (degree.get(edge.targetId) ?? 0) + 1);
    });
    let topId: string | null = null;
    let topDegree = 0;
    degree.forEach((value, id) => {
      if (value > topDegree) {
        topDegree = value;
        topId = id;
      }
    });

    const radius = new Map<string, number>();
    graph.nodes.forEach((node) =>
      radius.set(node.id, node.id === topId ? HUB_RADIUS : NODE_RADIUS),
    );

    return {
      positions: positionMap,
      radiusById: radius,
      hubId: topId,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
    };
  }, [graph, groupOf, renderMode]);

  const neighbors = useMemo(() => {
    const neighborSet = new Set<string>();
    if (selectedId) {
      graph.edges.forEach((edge) => {
        if (edge.sourceId === selectedId) neighborSet.add(edge.targetId);
        if (edge.targetId === selectedId) neighborSet.add(edge.sourceId);
      });
    }
    return neighborSet;
  }, [graph, selectedId]);

  // Dragging lets users reposition nodes. Overrides in dragged take precedence over computed layout.
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragged, setDragged] = useState<Map<string, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; moved: boolean } | null>(
    null,
  );

  // Canvas zoom/pan is driven by viewBox; getScreenCTM reflects it automatically and drag math stays unchanged.
  const initialView = useMemo<GraphViewBox>(
    () => ({ x: 0, y: 0, w: canvasWidth, h: canvasHeight }),
    [canvasHeight, canvasWidth],
  );
  const [view, setView] = useState<GraphViewBox>(initialView);
  const panRef = useRef<{
    startX: number;
    startY: number;
    view: GraphViewBox;
    moved: boolean;
  } | null>(null);

  // Clear manual positions when changing graph or arrangement; reset to the initial view when changing graph.
  useEffect(() => {
    setDragged(new Map());
  }, [graph, mode]);
  useEffect(() => {
    setView(initialView);
  }, [graph, initialView]);

  const zoomBy = useCallback(
    (factor: number, anchorX?: number, anchorY?: number) => {
      setView((prev) => {
        const ax = anchorX ?? prev.x + prev.w / 2;
        const ay = anchorY ?? prev.y + prev.h / 2;
        let nw = prev.w / factor;
        const zoom = canvasWidth / nw;
        if (zoom > ZOOM_MAX) nw = canvasWidth / ZOOM_MAX;
        if (zoom < ZOOM_MIN) nw = canvasWidth / ZOOM_MIN;
        const nh = nw * (canvasHeight / canvasWidth);
        const k = nw / prev.w;
        return { x: ax - (ax - prev.x) * k, y: ay - (ay - prev.y) * k, w: nw, h: nh };
      });
    },
    [canvasHeight, canvasWidth],
  );
  const resetView = useCallback(() => setView(initialView), [initialView]);

  const posOf = useCallback(
    (id: string) => dragged.get(id) ?? positions.get(id) ?? null,
    [dragged, positions],
  );

  const viewport = useMemo(() => {
    const padX = view.w * 0.12;
    const padY = view.h * 0.12;
    return {
      left: view.x - padX,
      right: view.x + view.w + padX,
      top: view.y - padY,
      bottom: view.y + view.h + padY,
    };
  }, [view]);
  const visibleNodes = useMemo(() => {
    const candidates = graph.nodes.filter((node) => {
      const position = posOf(node.id);
      return (
        position &&
        position.x >= viewport.left &&
        position.x <= viewport.right &&
        position.y >= viewport.top &&
        position.y <= viewport.bottom
      );
    });
    if (candidates.length <= MAX_VISIBLE_NODES) return candidates;
    const stride = Math.ceil(candidates.length / MAX_VISIBLE_NODES);
    return candidates.filter(
      (node, index) => index % stride === 0 || node.id === selectedId || neighbors.has(node.id),
    );
  }, [graph.nodes, neighbors, posOf, selectedId, viewport]);
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((edge) => {
        if (!visibleNodeIds.has(edge.sourceId) || !visibleNodeIds.has(edge.targetId)) return false;
        if (selectedId && edge.sourceId !== selectedId && edge.targetId !== selectedId)
          return false;
        const source = posOf(edge.sourceId);
        const target = posOf(edge.targetId);
        if (!source || !target) return false;
        return !(
          Math.max(source.x, target.x) < viewport.left ||
          Math.min(source.x, target.x) > viewport.right ||
          Math.max(source.y, target.y) < viewport.top ||
          Math.min(source.y, target.y) > viewport.bottom
        );
      }),
    [graph.edges, posOf, selectedId, viewport, visibleNodeIds],
  );
  const zoomLevel = canvasWidth / view.w;
  const nodeLabelsVisible = visibleNodes.length <= 250 || zoomLevel >= 1.4;
  const batchedEdgePath = useMemo(() => {
    if (edgeLabelsVisible || selectedId) return "";
    return visibleEdges
      .map((edge) => {
        const source = posOf(edge.sourceId);
        const target = posOf(edge.targetId);
        return source && target ? `M${source.x},${source.y}L${target.x},${target.y}` : "";
      })
      .join("");
  }, [edgeLabelsVisible, posOf, selectedId, visibleEdges]);

  // In logical-group mode, calculate each group's bounding box from current positions, including drags, and draw dashed boundaries with names.
  const groupHulls = useMemo(() => {
    if (renderMode !== "group" || !groupOf || groupOf.size === 0) return [];
    const buckets = new Map<string, string[]>();
    graph.nodes.forEach((node) => {
      const gid = groupOf.get(node.id);
      if (!gid) return; // 未分组节点不画边界
      const arr = buckets.get(gid) ?? [];
      arr.push(node.id);
      buckets.set(gid, arr);
    });
    const gids = [...buckets.keys()].sort();
    return gids
      .map((gid, gi) => {
        const ids = buckets.get(gid) ?? [];
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        ids.forEach((id) => {
          const p = posOf(id);
          if (!p) return;
          const r = radiusById.get(id) ?? NODE_RADIUS;
          minX = Math.min(minX, p.x - r);
          minY = Math.min(minY, p.y - r);
          maxX = Math.max(maxX, p.x + r);
          maxY = Math.max(maxY, p.y + r);
        });
        if (!Number.isFinite(minX)) return null;
        return {
          gid,
          name: groupNames?.get(gid) ?? "",
          color: GROUP_COLORS[gi % GROUP_COLORS.length],
          x: minX - GROUP_HULL_PAD,
          y: minY - GROUP_HULL_PAD,
          w: maxX - minX + GROUP_HULL_PAD * 2,
          h: maxY - minY + GROUP_HULL_PAD * 2,
        };
      })
      .filter((hull): hull is NonNullable<typeof hull> => hull !== null)
      .filter(
        (hull) =>
          hull.x + hull.w >= viewport.left &&
          hull.x <= viewport.right &&
          hull.y + hull.h >= viewport.top &&
          hull.y <= viewport.bottom,
      );
  }, [groupOf, groupNames, graph, posOf, radiusById, renderMode, viewport]);

  const toSvgPoint = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }, []);

  // Wheel zoom around the cursor only intercepts with Ctrl/Cmd held; otherwise allow normal page
  // scrolling so passing over the canvas does not hijack it. Trackpad pinch naturally sets ctrlKey.
  // Use a non-passive listener so preventDefault can stop page scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return; // 普通滚轮 = 翻页
      event.preventDefault();
      const p = toSvgPoint(event.clientX, event.clientY);
      zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12, p?.x, p?.y);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toSvgPoint, zoomBy]);

  const onNodePointerDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    const p = toSvgPoint(event.clientX, event.clientY);
    const base = posOf(id);
    if (!p || !base) return;
    dragRef.current = { id, offsetX: p.x - base.x, offsetY: p.y - base.y, moved: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  // Pressing blank space begins panning; node onPointerDown already stops propagation.
  const onCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    panRef.current = { startX: event.clientX, startY: event.clientY, view, moved: false };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const p = toSvgPoint(event.clientX, event.clientY);
      if (!p) return;
      const nx = p.x - drag.offsetX;
      const ny = p.y - drag.offsetY;
      const base = positions.get(drag.id);
      if (base && Math.hypot(nx - base.x, ny - base.y) > 3) drag.moved = true;
      setDragged((prev) => {
        const next = new Map(prev);
        next.set(drag.id, { x: nx, y: ny });
        return next;
      });
      return;
    }
    const pan = panRef.current;
    if (pan) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ((event.clientX - pan.startX) * pan.view.w) / rect.width;
      const dy = ((event.clientY - pan.startY) * pan.view.h) / rect.height;
      if (Math.hypot(event.clientX - pan.startX, event.clientY - pan.startY) > 3) pan.moved = true;
      setView({ x: pan.view.x - dx, y: pan.view.y - dy, w: pan.view.w, h: pan.view.h });
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    if (drag) {
      dragRef.current = null;
      if (!drag.moved) onSelect(drag.id === selectedId ? null : drag.id);
      return;
    }
    const pan = panRef.current;
    panRef.current = null;
    if (pan && !pan.moved) onSelect(null); // 空白点击 = 取消选中
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Dropdown
          trigger={["click"]}
          menu={{
            selectedKeys: [selectedMode],
            items: [
              {
                key: "force",
                label: t("knowledgeNetwork.previewLayoutForce"),
              },
              { key: "circle", label: t("knowledgeNetwork.previewLayoutCircle") },
              ...(logicalGroupingAvailable
                ? [{ key: "group", label: t("knowledgeNetwork.previewLayoutGroup") }]
                : []),
            ],
            onClick: ({ key }) => {
              setMode(key as OntologyLayoutMode);
              setDragged(new Map());
            },
          }}
        >
          <button
            type="button"
            className={styles.arrange}
            title={t("knowledgeNetwork.previewRearrange")}
          >
            <RetweetOutlined />
            {selectedMode === "circle"
              ? t("knowledgeNetwork.previewLayoutCircle")
              : selectedMode === "group"
                ? t("knowledgeNetwork.previewLayoutGroup")
                : t("knowledgeNetwork.previewLayoutForce")}
            <DownOutlined className={styles.arrangeCaret} />
          </button>
        </Dropdown>
        <button
          type="button"
          className={`${styles.edgeToggle} ${edgeLabelsVisible ? styles.edgeToggleOn : ""}`}
          title={t(
            edgeLabelsVisible
              ? "knowledgeNetwork.previewHideEdgeLabels"
              : "knowledgeNetwork.previewShowEdgeLabels",
          )}
          aria-pressed={edgeLabelsVisible}
          disabled={graph.edges.length > EDGE_LABEL_LIMIT}
          onClick={() => setShowEdgeLabels((value) => !value)}
        >
          {edgeLabelsVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
        </button>
      </div>
      <svg
        ref={svgRef}
        className={styles.graph}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        data-rendered-nodes={visibleNodes.length}
        data-total-nodes={graph.nodes.length}
        role="img"
        aria-label={t("knowledgeNetwork.previewCanvas")}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <defs>
          <pattern id="kn-onto-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle className={styles.gridDot} cx="1.2" cy="1.2" r="1.1" />
          </pattern>
          <marker
            id="kn-onto-arrow"
            markerWidth="11"
            markerHeight="11"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path className={styles.edgeArrow} d="M0,0 L8,4 L0,8 z" />
          </marker>
          <marker
            id="kn-onto-arrow-hi"
            markerWidth="11"
            markerHeight="11"
            refX="8"
            refY="4"
            orient="auto"
          >
            <path className={styles.edgeArrowActive} d="M0,0 L8,4 L0,8 z" />
          </marker>
        </defs>

        <rect width={canvasWidth} height={canvasHeight} fill="url(#kn-onto-grid)" />

        {groupHulls.length > 0 ? (
          <g className={styles.groups}>
            {groupHulls.map((hull) => (
              <g key={hull.gid} style={{ "--gc": hull.color } as CSSProperties}>
                <rect
                  className={styles.groupHull}
                  x={hull.x}
                  y={hull.y}
                  width={hull.w}
                  height={hull.h}
                  rx={22}
                />
                {hull.name ? (
                  <text className={styles.groupLabel} x={hull.x + 16} y={hull.y + 24}>
                    {hull.name}
                  </text>
                ) : null}
              </g>
            ))}
          </g>
        ) : null}

        <g className={styles.edges}>
          {batchedEdgePath ? <path className={styles.edgeBatch} d={batchedEdgePath} /> : null}
          {batchedEdgePath
            ? null
            : visibleEdges.map((edge) => {
                const a = posOf(edge.sourceId);
                const b = posOf(edge.targetId);
                if (!a || !b) {
                  return null;
                }
                const ra = radiusById.get(edge.sourceId) ?? NODE_RADIUS;
                const rb = radiusById.get(edge.targetId) ?? NODE_RADIUS;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;
                const sx = a.x + ux * ra;
                const sy = a.y + uy * ra;
                const ex = b.x - ux * (rb + 12);
                const ey = b.y - uy * (rb + 12);
                const mx = (sx + ex) / 2;
                const my = (sy + ey) / 2;
                const active =
                  Boolean(selectedId) &&
                  (edge.sourceId === selectedId || edge.targetId === selectedId);
                const dim = Boolean(selectedId) && !active;
                const label = edge.name || t("knowledgeNetwork.defaultEdgeName");
                const labelWidth = label.length * 14 + 18;
                return (
                  <g
                    key={edge.id}
                    className={`${styles.edge} ${active ? styles.edgeActive : ""} ${dim ? styles.edgeDim : ""}`}
                  >
                    <line
                      x1={sx}
                      y1={sy}
                      x2={ex}
                      y2={ey}
                      markerEnd={`url(#kn-onto-arrow${active ? "-hi" : ""})`}
                    />
                    {edgeLabelsVisible || active ? (
                      <>
                        <rect
                          className={styles.edgeLabelBg}
                          x={mx - labelWidth / 2}
                          y={my - 13}
                          width={labelWidth}
                          height={24}
                          rx={12}
                        />
                        <text className={styles.edgeLabel} x={mx} y={my + 4} textAnchor="middle">
                          {label}
                        </text>
                      </>
                    ) : null}
                  </g>
                );
              })}
        </g>

        <g className={styles.nodes}>
          {visibleNodes.map((node) => {
            const position = posOf(node.id);
            if (!position) {
              return null;
            }
            const radius = radiusById.get(node.id) ?? NODE_RADIUS;
            const isSelected = node.id === selectedId;
            const isNeighbor = neighbors.has(node.id);
            const dim = Boolean(selectedId) && !isSelected && !isNeighbor;
            const nodeStyle = { "--nc": node.color || "#2e68ff" } as CSSProperties;
            return (
              <g
                key={node.id}
                className={[
                  styles.node,
                  isSelected ? styles.nodeSelected : "",
                  dim ? styles.nodeDim : "",
                  node.id === hubId ? styles.nodeHub : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={nodeStyle}
                onPointerDown={(event) => onNodePointerDown(event, node.id)}
              >
                {isSelected ? (
                  <circle
                    className={styles.nodeRing}
                    cx={position.x}
                    cy={position.y}
                    r={radius + 7}
                  />
                ) : null}
                <circle className={styles.nodeDisc} cx={position.x} cy={position.y} r={radius} />
                {nodeLabelsVisible || isSelected ? (
                  <text
                    className={styles.nodeName}
                    x={position.x}
                    y={position.y + 5}
                    textAnchor="middle"
                  >
                    {truncate(node.name, radius === HUB_RADIUS ? 7 : 6)}
                  </text>
                ) : null}
                {indexedIds.has(node.id) && (nodeLabelsVisible || isSelected) ? (
                  <circle
                    className={styles.nodeIndexDot}
                    cx={position.x + radius - 10}
                    cy={position.y - radius + 10}
                    r={5}
                  >
                    <title>{t("knowledgeNetwork.previewIndexed")}</title>
                  </circle>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <span className={styles.zoomHint}>{t("knowledgeNetwork.previewZoomHint")}</span>
      <div className={styles.zoomCtl}>
        <button
          type="button"
          onClick={() => zoomBy(1.25)}
          title={t("knowledgeNetwork.previewZoomIn")}
        >
          <ZoomInOutlined />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(0.8)}
          title={t("knowledgeNetwork.previewZoomOut")}
        >
          <ZoomOutOutlined />
        </button>
        <button type="button" onClick={resetView} title={t("knowledgeNetwork.previewFitView")}>
          <CompressOutlined />
        </button>
      </div>
    </div>
  );
}
