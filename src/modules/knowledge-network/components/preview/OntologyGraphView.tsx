/** 本体图谱（建模预览新设计）—— 彩色实体类节点 + 关系连线，可选中并高亮邻居。 */

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
const INITIAL_VIEW = { x: 0, y: 0, w: PREVIEW_LAYOUT_WIDTH, h: PREVIEW_LAYOUT_HEIGHT };
const GROUP_HULL_PAD = 28;
// 分组边界配色（按分组 id 排序后稳定取色）。
const GROUP_COLORS = ["#2e68ff", "#7c4dff", "#00b8a3", "#f5a623", "#eb5757", "#11a0d8", "#9b51e0", "#2bb673"];

type OntologyLayoutMode = "force" | "circle" | "group";

type OntologyGraphViewProps = {
  graph: KnowledgeNetworkPreviewGraph;
  indexedIds: Set<string>;
  /** 节点 id → 概念分组 id，供「按逻辑分组」聚类。 */
  groupOf?: Map<string, string>;
  /** 分组 id → 名称，用于「按逻辑分组」时画边界标签。 */
  groupNames?: Map<string, string>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

function truncate(value: string, max = 6) {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

const CLAMP_PAD = 64;
const clamp = (value: number, max: number) => Math.max(CLAMP_PAD, Math.min(max - CLAMP_PAD, value));

/** 圆形布局：节点等角分布在画布中心的大圆上。 */
function circleLayout(ids: string[]): { id: string; x: number; y: number }[] {
  const cx = PREVIEW_LAYOUT_WIDTH / 2;
  const cy = PREVIEW_LAYOUT_HEIGHT / 2;
  const r = Math.min(PREVIEW_LAYOUT_WIDTH, PREVIEW_LAYOUT_HEIGHT) * 0.36;
  const n = Math.max(ids.length, 1);
  return ids.map((id, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { id, x: clamp(cx + r * Math.cos(a), PREVIEW_LAYOUT_WIDTH), y: clamp(cy + r * Math.sin(a), PREVIEW_LAYOUT_HEIGHT) };
  });
}

const NODE_GAP = 14; // 网格相邻节点中心最小距离之外的留白
const NODE_SPACING = NODE_RADIUS * 2 + NODE_GAP; // 理想中心距
const MIN_SPACING = NODE_RADIUS * 2; // 最小中心距：相切，绝不重叠
const CELL_INSET = GROUP_HULL_PAD + NODE_RADIUS; // cell 边到节点中心可用区的内缩（留出 hull 边距）

/** 组内节点排成接近正方的网格，居中于 cell；间距最多压到相切（MIN_SPACING），保证两两不重叠。 */
function placeCluster(
  gids: string[],
  gcx: number,
  gcy: number,
  cellW: number,
  cellH: number,
): { id: string; x: number; y: number }[] {
  const n = gids.length;
  if (n <= 1) {
    return gids.map((id) => ({
      id,
      x: clamp(gcx, PREVIEW_LAYOUT_WIDTH),
      y: clamp(gcy, PREVIEW_LAYOUT_HEIGHT),
    }));
  }
  const availW = Math.max(0, cellW - CELL_INSET * 2);
  const availH = Math.max(0, cellH - CELL_INSET * 2);
  // 按可用区宽高比挑接近正方的列数。
  const aspect = availW / Math.max(1, availH);
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * aspect)) || 1));
  const rows = Math.ceil(n / cols);
  // 间距：理想 NODE_SPACING；可用区不足则压缩，但不低于 MIN_SPACING（相切）。
  const spacingX = cols > 1 ? Math.max(MIN_SPACING, Math.min(NODE_SPACING, availW / (cols - 1))) : 0;
  const spacingY = rows > 1 ? Math.max(MIN_SPACING, Math.min(NODE_SPACING, availH / (rows - 1))) : 0;
  const startX = gcx - ((cols - 1) * spacingX) / 2;
  const startY = gcy - ((rows - 1) * spacingY) / 2;
  return gids.map((id, i) => ({
    id,
    x: startX + (i % cols) * spacingX,
    y: startY + Math.floor(i / cols) * spacingY,
  }));
}

/**
 * 按概念分组聚类：每组分得「等密度」cell（面积 ∝ 节点数），横向铺成若干 shelf，组内再排网格。
 * 大组拿到大 cell，不会再被挤到重叠；小组也不浪费空间。整体仍落在固定画布内。
 */
function groupLayout(ids: string[], groupOf: Map<string, string>): { id: string; x: number; y: number }[] {
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
    // 单组：用整张画布作为 cell。
    return placeCluster(
      groups[0] ?? [],
      PREVIEW_LAYOUT_WIDTH / 2,
      PREVIEW_LAYOUT_HEIGHT / 2,
      PREVIEW_LAYOUT_WIDTH,
      PREVIEW_LAYOUT_HEIGHT,
    );
  }
  const total = ids.length || 1;
  // shelf 行数按画布宽高比定，再把组按节点数均衡分到各 shelf（行高随之 ∝ 节点数）。
  const shelfCount = Math.max(
    1,
    Math.round(Math.sqrt(gn * (PREVIEW_LAYOUT_HEIGHT / PREVIEW_LAYOUT_WIDTH))) || 1,
  );
  const shelves = Array.from({ length: shelfCount }, () => ({ groups: [] as string[][], nodes: 0 }));
  // 大组优先放进当前节点数最少的 shelf，均衡每行总高度。
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
      const shelfH = PREVIEW_LAYOUT_HEIGHT * (shelf.nodes / total);
      let x = 0;
      shelf.groups.forEach((gids) => {
        const cellW = PREVIEW_LAYOUT_WIDTH * (gids.length / shelf.nodes);
        out.push(...placeCluster(gids, x + cellW / 2, y + shelfH / 2, cellW, shelfH));
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

  // 布局随 graph / 排列方式变化计算；选中节点时不重排。
  const { positions, radiusById, hubId } = useMemo(() => {
    const ids = graph.nodes.map((node) => node.id);
    const layout =
      mode === "circle"
        ? circleLayout(ids)
        : mode === "group"
          ? groupLayout(ids, groupOf ?? new Map())
          : computePreviewGraphLayout(graph);
    const positionMap = new Map(layout.map((node) => [node.id, { id: node.id, x: node.x, y: node.y }]));

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
    graph.nodes.forEach((node) => radius.set(node.id, node.id === topId ? HUB_RADIUS : NODE_RADIUS));

    return { positions: positionMap, radiusById: radius, hubId: topId };
  }, [graph, mode, groupOf]);

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

  // 拖拽：用户可移动节点重排。覆盖位置存在 dragged 里，优先于计算布局。
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragged, setDragged] = useState<Map<string, { x: number; y: number }>>(new Map());
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number; moved: boolean } | null>(null);

  // 画布缩放/平移：viewBox 驱动（getScreenCTM 自动反映，节点拖拽数学不变）。
  const [view, setView] = useState(INITIAL_VIEW);
  const panRef = useRef<
    { startX: number; startY: number; view: typeof INITIAL_VIEW; moved: boolean } | null
  >(null);

  // 切换图 / 排列方式时清掉手动位置；切换图时回到初始视图。
  useEffect(() => {
    setDragged(new Map());
  }, [graph, mode]);
  useEffect(() => {
    setView(INITIAL_VIEW);
  }, [graph]);

  const zoomBy = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    setView((prev) => {
      const ax = anchorX ?? prev.x + prev.w / 2;
      const ay = anchorY ?? prev.y + prev.h / 2;
      let nw = prev.w / factor;
      const zoom = PREVIEW_LAYOUT_WIDTH / nw;
      if (zoom > ZOOM_MAX) nw = PREVIEW_LAYOUT_WIDTH / ZOOM_MAX;
      if (zoom < ZOOM_MIN) nw = PREVIEW_LAYOUT_WIDTH / ZOOM_MIN;
      const nh = nw * (PREVIEW_LAYOUT_HEIGHT / PREVIEW_LAYOUT_WIDTH);
      const k = nw / prev.w;
      return { x: ax - (ax - prev.x) * k, y: ay - (ay - prev.y) * k, w: nw, h: nh };
    });
  }, []);
  const resetView = useCallback(() => setView(INITIAL_VIEW), []);

  const posOf = useCallback(
    (id: string) => dragged.get(id) ?? positions.get(id) ?? null,
    [dragged, positions],
  );

  // 「按逻辑分组」时，按当前位置（含拖拽）算每组包围盒，画虚线边界 + 名称。
  const groupHulls = useMemo(() => {
    if (mode !== "group" || !groupOf || groupOf.size === 0) return [];
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
      .filter((hull): hull is NonNullable<typeof hull> => hull !== null);
  }, [mode, groupOf, groupNames, graph, posOf, radiusById]);

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

  // 滚轮缩放（绕光标）：仅在按住 Ctrl/⌘ 时拦截，否则放行让页面正常滚动，
  // 避免整页滚动经过画布时被劫持成缩放。触控板捏合会带 ctrlKey，自然支持。
  // 用非 passive 监听以便 preventDefault 阻止页面滚动。
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
    (event.currentTarget as SVGGElement).setPointerCapture?.(event.pointerId);
  };

  // 空白处按下 = 开始平移画布（节点 onPointerDown 已 stopPropagation）。
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
          selectedKeys: [mode],
          items: [
            { key: "force", label: t("knowledgeNetwork.previewLayoutForce") },
            { key: "circle", label: t("knowledgeNetwork.previewLayoutCircle") },
            { key: "group", label: t("knowledgeNetwork.previewLayoutGroup") },
          ],
          onClick: ({ key }) => {
            setMode(key as OntologyLayoutMode);
            setDragged(new Map());
          },
        }}
      >
        <button type="button" className={styles.arrange} title={t("knowledgeNetwork.previewRearrange")}>
          <RetweetOutlined />
          {mode === "circle"
            ? t("knowledgeNetwork.previewLayoutCircle")
            : mode === "group"
              ? t("knowledgeNetwork.previewLayoutGroup")
              : t("knowledgeNetwork.previewLayoutForce")}
          <DownOutlined className={styles.arrangeCaret} />
        </button>
      </Dropdown>
      <button
        type="button"
        className={`${styles.edgeToggle} ${showEdgeLabels ? styles.edgeToggleOn : ""}`}
        title={t(showEdgeLabels ? "knowledgeNetwork.previewHideEdgeLabels" : "knowledgeNetwork.previewShowEdgeLabels")}
        aria-pressed={showEdgeLabels}
        onClick={() => setShowEdgeLabels((value) => !value)}
      >
        {showEdgeLabels ? <EyeOutlined /> : <EyeInvisibleOutlined />}
      </button>
      </div>
      <svg
        ref={svgRef}
        className={styles.graph}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("knowledgeNetwork.previewCanvas")}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
      <defs>
        <pattern id="kn-onto-grid" width="26" height="26" patternUnits="userSpaceOnUse">
          <circle cx="1.4" cy="1.4" r="1.3" fill="#eef1f6" />
        </pattern>
        <marker id="kn-onto-arrow" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#b3bdcf" />
        </marker>
        <marker id="kn-onto-arrow-hi" markerWidth="11" markerHeight="11" refX="8" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2e68ff" />
        </marker>
      </defs>

      <rect width={PREVIEW_LAYOUT_WIDTH} height={PREVIEW_LAYOUT_HEIGHT} fill="url(#kn-onto-grid)" />

      {groupHulls.length > 0 ? (
        <g className={styles.groups}>
          {groupHulls.map((hull) => (
            <g key={hull.gid} style={{ "--gc": hull.color } as CSSProperties}>
              <rect className={styles.groupHull} x={hull.x} y={hull.y} width={hull.w} height={hull.h} rx={22} />
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
        {graph.edges.map((edge) => {
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
          const active = Boolean(selectedId) && (edge.sourceId === selectedId || edge.targetId === selectedId);
          const dim = Boolean(selectedId) && !active;
          const label = edge.name || t("knowledgeNetwork.defaultEdgeName");
          const labelWidth = label.length * 14 + 18;
          return (
            <g
              key={edge.id}
              className={`${styles.edge} ${active ? styles.edgeActive : ""} ${dim ? styles.edgeDim : ""}`}
            >
              <line x1={sx} y1={sy} x2={ex} y2={ey} markerEnd={`url(#kn-onto-arrow${active ? "-hi" : ""})`} />
              {showEdgeLabels || active ? (
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
        {graph.nodes.map((node) => {
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
                <circle className={styles.nodeRing} cx={position.x} cy={position.y} r={radius + 7} />
              ) : null}
              <circle className={styles.nodeDisc} cx={position.x} cy={position.y} r={radius} />
              <text className={styles.nodeName} x={position.x} y={position.y + 5} textAnchor="middle">
                {truncate(node.name, radius === HUB_RADIUS ? 7 : 6)}
              </text>
              {indexedIds.has(node.id) ? (
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
        <button type="button" onClick={() => zoomBy(1.25)} title={t("knowledgeNetwork.previewZoomIn")}>
          <ZoomInOutlined />
        </button>
        <button type="button" onClick={() => zoomBy(0.8)} title={t("knowledgeNetwork.previewZoomOut")}>
          <ZoomOutOutlined />
        </button>
        <button type="button" onClick={resetView} title={t("knowledgeNetwork.previewFitView")}>
          <CompressOutlined />
        </button>
      </div>
    </div>
  );
}
