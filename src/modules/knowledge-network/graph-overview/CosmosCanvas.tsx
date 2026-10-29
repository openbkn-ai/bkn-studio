/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { Graph, type GraphConfig } from "@cosmos.gl/graph";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import styles from "./GraphOverviewPage.module.css";
import { boundsOf, isolatedBand } from "./isolated-band";
import type { OverviewCanvasHandle, OverviewCanvasProps } from "./OverviewCanvas";

/*
 * The overview canvas for large budgets (up to 200 000 points): cosmos.gl simulates the forces and
 * draws on the GPU. It draws no text, so names are painted on a 2D canvas laid over it.
 */

/** How long the layout runs on its own before it pauses; the toolbar can run it again. */
const LAYOUT_RUN_MS = 20_000;
/** Simulation space; cosmos.gl warns that larger sizes crash some devices. */
const SPACE_SIZE = 4096;
/** Highlighted points beyond which their lines are drawn thin and light. */
const MANY_LINES = 60;
/**
 * Lines of the selected point named at most. Each name makes room for the ones already drawn, so
 * a hub's lines are named as far as there is space instead of not at all.
 */
const NAMED_LINES = 400;
/** Highlighted points up to which every one of them is named; beyond, names make room. */
const NAMED_POINTS = 12;
/** Outside a selection only hubs are named: leaves often share one name (a tournament's). */
const LABEL_MIN_DEGREE = 20;
/** Names drawn at most at once outside a selection. */
const MAX_LABELS = 160;
/** Gap between neighbouring isolated points in their band, in space units. */
const BAND_SPACING = 12;
/** cosmos.gl space has y pointing up the screen. */
const SPACE_Y_DOWN = false;

/** How far the view opens zoomed in, relative to fitting everything. */
const START_MAGNIFY = 2.2;

type Rgba = [number, number, number, number];

const THEME = {
  light: {
    background: "#f6f8fb",
    edge: "#dde2ea",
    edgeStrong: "#4a5160",
    edgeMany: "#a3abb8",
    dim: "#e6e9ef",
    label: "#333333",
    halo: "rgba(246, 248, 251, 0.9)",
    hoverBg: "#ffffff",
    hoverBorder: "rgba(0, 0, 0, 0.12)",
    ring: "#1f2430",
  },
  dark: {
    background: "#111318",
    edge: "#272b34",
    edgeStrong: "#c9ced8",
    edgeMany: "#5c6372",
    dim: "#2a2e37",
    label: "rgba(255, 255, 255, 0.92)",
    halo: "rgba(17, 19, 24, 0.85)",
    hoverBg: "#23262d",
    hoverBorder: "rgba(255, 255, 255, 0.18)",
    ring: "#ffffff",
  },
};

function rgba(color: string, alpha = 1): Rgba {
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha];
}

function hash01(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

/** Three sizes by degree, in pixels: leaves, ordinary points and hubs. */
function sizeFor(degree: number): number {
  if (degree > 20) return 7;
  if (degree > 3) return 4;
  return 2.5;
}

export const CosmosCanvas = forwardRef<OverviewCanvasHandle, OverviewCanvasProps>(
  function CosmosCanvas(props, ref) {
    const { nodes, edges, colorOf, hiddenTypes, selectedId, picked, dark, settled } = props;
    const containerRef = useRef<HTMLDivElement | null>(null);
    const labelsRef = useRef<HTMLCanvasElement | null>(null);
    const graphRef = useRef<Graph | null>(null);
    const propsRef = useRef(props);
    propsRef.current = props;
    const stopTimerRef = useRef<number | undefined>(undefined);
    const layoutStartedRef = useRef(false);
    const boxEndedRef = useRef(false);
    const hoveredRef = useRef<{ index: number; position: [number, number] } | null>(null);
    /** The line under the pointer, named beside it. */
    const hoveredLinkRef = useRef<number | null>(null);
    /** The pointer over the canvas, in its own pixels. */
    const pointerRef = useRef<[number, number]>([0, 0]);
    const layoutRunningRef = useRef(false);
    const drawScheduledRef = useRef(false);
    const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

    /** Everything the GPU arrays are built from, indexed like the points. */
    const dataRef = useRef({
      ids: [] as string[],
      index: new Map<string, number>(),
      otIds: [] as string[],
      labels: [] as string[],
      degree: new Uint32Array(0),
      linkEnds: new Uint32Array(0),
      linkRel: [] as string[],
      /** Whether each line is drawn: a hidden or unlit line answers no hover. */
      linkVisible: new Uint8Array(0),
      neighbours: [] as number[][],
      incident: [] as number[][],
      /** Points named as highlighted, with their tracked positions read back each frame. */
      named: [] as number[],
      namedLines: [] as number[],
    });

    /* ------------------------------ labels ------------------------------ */

    const drawLabels = () => {
      drawScheduledRef.current = false;
      const graph = graphRef.current;
      const canvas = labelsRef.current;
      if (!graph || !canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      const theme = propsRef.current.dark ? THEME.dark : THEME.light;
      const data = dataRef.current;
      const hidden = propsRef.current.hiddenTypes;
      context.font = "12px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      context.textBaseline = "middle";
      const taken: [number, number, number, number][] = [];
      const fits = (x: number, y: number, w: number, h: number) =>
        !taken.some(([a, b, c, d]) => x < c && x + w > a && y < d && y + h > b);
      const label = (index: number, at: [number, number], force: boolean) => {
        const text = data.labels[index];
        if (!text || hidden.has(data.otIds[index])) return;
        const w = context.measureText(text).width;
        const x = at[0] + 7;
        const y = at[1];
        if (!force && !fits(x - 2, y - 8, w + 4, 16)) return;
        taken.push([x - 2, y - 8, x + w + 2, y + 8]);
        context.lineWidth = 3;
        context.strokeStyle = theme.halo;
        context.strokeText(text, x, y);
        context.fillStyle = theme.label;
        context.fillText(text, x, y);
      };

      const tracked = data.named.length > 0 ? graph.getTrackedPointPositionsMap() : null;
      const screen = (index: number): [number, number] | null => {
        const space = tracked?.get(index);
        return space ? graph.spaceToScreenPosition(space) : null;
      };
      if (tracked) {
        for (const index of data.named) {
          const at = screen(index);
          if (at) label(index, at, data.named.length <= NAMED_POINTS);
        }
        // Relation names along the selected point's lines, each clear of the names already drawn.
        if (data.namedLines.length > 0) {
          context.font = "11px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          for (const link of data.namedLines) {
            const a = screen(data.linkEnds[link * 2]);
            const b = screen(data.linkEnds[link * 2 + 1]);
            if (!a || !b) continue;
            const text = propsRef.current.relationName(data.linkRel[link]);
            let angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
            if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
            // The rotated name's upright bounds, around the point it is drawn at.
            const w = context.measureText(text).width + 4;
            const h = 14;
            const cx = (a[0] + b[0]) / 2 + Math.sin(angle) * 6;
            const cy = (a[1] + b[1]) / 2 - Math.cos(angle) * 6;
            const hx = (Math.abs(Math.cos(angle)) * w + Math.abs(Math.sin(angle)) * h) / 2;
            const hy = (Math.abs(Math.sin(angle)) * w + Math.abs(Math.cos(angle)) * h) / 2;
            if (!fits(cx - hx, cy - hy, hx * 2, hy * 2)) continue;
            taken.push([cx - hx, cy - hy, cx + hx, cy + hy]);
            context.save();
            context.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            context.rotate(angle);
            context.textAlign = "center";
            context.lineWidth = 3;
            context.strokeStyle = theme.halo;
            context.strokeText(text, 0, -6);
            context.fillStyle = theme.label;
            context.fillText(text, 0, -6);
            context.restore();
          }
          context.textAlign = "start";
          context.font = "12px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        }
      } else {
        // Outside a selection: a spread-out sample of what is on screen, hubs first.
        const sample = [...graph.getSampledPointPositionsMap()];
        sample.sort(([a], [b]) => data.degree[b] - data.degree[a]);
        let count = 0;
        for (const [index, space] of sample) {
          if (count >= MAX_LABELS || data.degree[index] <= LABEL_MIN_DEGREE) break;
          const before = taken.length;
          label(index, graph.spaceToScreenPosition(space), false);
          if (taken.length > before) count += 1;
        }
      }

      const hovered = hoveredRef.current;
      if (hovered && hovered.index < data.ids.length) {
        const [x, y] = graph.spaceToScreenPosition(hovered.position);
        const text = data.labels[hovered.index] ?? "";
        const w = context.measureText(text).width;
        context.fillStyle = theme.hoverBg;
        context.strokeStyle = theme.hoverBorder;
        context.beginPath();
        context.roundRect(x + 8, y - 11, w + 12, 22, 4);
        context.fill();
        context.stroke();
        context.fillStyle = theme.label;
        context.fillText(text, x + 14, y + 1);
      }

      // The line under the pointer: what it joins and by which relation, beside the pointer.
      const link = hoveredLinkRef.current;
      if (link !== null && link < data.linkRel.length && !hovered) {
        const source = data.labels[data.linkEnds[link * 2]] ?? "";
        const target = data.labels[data.linkEnds[link * 2 + 1]] ?? "";
        const text = `${source} —${propsRef.current.relationName(data.linkRel[link])}→ ${target}`;
        const [x, y] = pointerRef.current;
        const w = context.measureText(text).width;
        // Kept inside the canvas near its right edge.
        const left = Math.min(x + 12, width - w - 16);
        context.fillStyle = theme.hoverBg;
        context.strokeStyle = theme.hoverBorder;
        context.beginPath();
        context.roundRect(left, y + 10, w + 12, 22, 4);
        context.fill();
        context.stroke();
        context.fillStyle = theme.label;
        context.fillText(text, left + 6, y + 22);
      }
    };

    const scheduleLabels = () => {
      if (drawScheduledRef.current) return;
      drawScheduledRef.current = true;
      window.requestAnimationFrame(drawLabels);
    };

    /* ------------------------------ graph ------------------------------ */

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const theme = propsRef.current.dark ? THEME.dark : THEME.light;
      const config: GraphConfig = {
        backgroundColor: theme.background,
        spaceSize: SPACE_SIZE,
        enableDrag: true,
        fitViewOnInit: false,
        rescalePositions: false,
        pointDefaultSize: 3,
        scalePointsOnZoom: false,
        renderHoveredPointRing: true,
        hoveredPointRingColor: theme.ring,
        hoveredPointCursor: "pointer",
        hoveredLinkCursor: "pointer",
        // Wider under the pointer, in its own colour: an unlit line stays out of sight.
        hoveredLinkWidthIncrease: 2,
        linkDefaultWidth: 0.5,
        linkDefaultColor: theme.edge,
        pointSamplingDistance: 90,
        // Long lines: weak springs and wide link distance, firm repulsion.
        simulationRepulsion: 1.2,
        simulationLinkSpring: 0.4,
        simulationLinkDistance: 14,
        simulationGravity: 0.15,
        simulationFriction: 0.85,
        simulationDecay: 8000,
        onPointClick: (index) => {
          const id = dataRef.current.ids[index];
          if (id) propsRef.current.onNodeClick(id);
        },
        onBackgroundClick: () => {
          if (boxEndedRef.current) {
            boxEndedRef.current = false;
            return;
          }
          propsRef.current.onStageClick();
        },
        onPointMouseOver: (index, position) => {
          hoveredRef.current = { index, position };
          scheduleLabels();
        },
        onPointMouseOut: () => {
          hoveredRef.current = null;
          scheduleLabels();
        },
        onLinkMouseOver: (link) => {
          if (!dataRef.current.linkVisible[link]) return;
          hoveredLinkRef.current = link;
          scheduleLabels();
        },
        onLinkMouseOut: () => {
          hoveredLinkRef.current = null;
          scheduleLabels();
        },
        onDragEnd: (event) => {
          // Stays where it is dropped.
          // The drag event's types come from d3-drag, which this build does not carry.
          const subject = (event as unknown as { subject?: { index?: unknown } }).subject;
          const index = subject?.index;
          if (typeof index === "number") graphRef.current?.setPinnedPoint(index, true);
        },
        onDrag: scheduleLabels,
        onZoom: scheduleLabels,
        onSimulationTick: scheduleLabels,
        onSimulationEnd: () => propsRef.current.onLayoutRunning(false),
      };
      const graph = new Graph(container, config);
      graphRef.current = graph;
      const observer = new ResizeObserver(scheduleLabels);
      observer.observe(container);
      const onPointerMove = (event: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        pointerRef.current = [event.clientX - rect.left, event.clientY - rect.top];
        if (hoveredLinkRef.current !== null) scheduleLabels();
      };
      container.addEventListener("pointermove", onPointerMove);
      return () => {
        container.removeEventListener("pointermove", onPointerMove);
        observer.disconnect();
        window.clearTimeout(stopTimerRef.current);
        graph.destroy();
        graphRef.current = null;
      };
      // Built once; later changes go through the effects below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * Lays the points with no relation out as a band under the connected part and pins them, so
     * repulsion cannot push them against the edge of the space. Returns whether anything moved.
     */
    const placeIsolated = (positions: Float32Array): boolean => {
      const data = dataRef.current;
      const isolated: number[] = [];
      const connected: number[] = [];
      for (let i = 0; i < data.ids.length; i += 1)
        (data.degree[i] === 0 ? isolated : connected).push(i);
      if (isolated.length === 0 || connected.length === 0) return false;
      const bounds = boundsOf(positions, connected);
      if (!bounds) return false;
      const band = isolatedBand(isolated, (i) => data.otIds[i], bounds, BAND_SPACING, {
        yDown: SPACE_Y_DOWN,
      });
      band.order.forEach((index, k) => {
        positions[index * 2] = band.positions[k * 2];
        positions[index * 2 + 1] = band.positions[k * 2 + 1];
      });
      isolatedRef.current = isolated;
      return true;
    };
    const isolatedRef = useRef<number[]>([]);

    /* ------------------------------ data ------------------------------ */

    useEffect(() => {
      const graph = graphRef.current;
      if (!graph) return;
      const previous = dataRef.current;
      // Points that stay keep their place; new ones start in their object type's sector.
      const oldPositions = previous.ids.length > 0 ? graph.getPointPositions() : null;
      const ids = nodes.map((node) => node.id);
      const index = new Map(ids.map((id, i) => [id, i]));
      const typeOrder = [...new Set(nodes.map((node) => node.otId))];
      const typeIndex = new Map(typeOrder.map((otId, i) => [otId, i]));
      const positions = new Float32Array(ids.length * 2);
      const centre = SPACE_SIZE / 2;
      const ring = typeOrder.length > 1 ? SPACE_SIZE * 0.18 : 0;
      const spread = SPACE_SIZE * 0.08;
      nodes.forEach((node, i) => {
        const old = previous.index.get(node.id);
        if (oldPositions && old !== undefined && Number.isFinite(oldPositions[old * 2])) {
          positions[i * 2] = oldPositions[old * 2];
          positions[i * 2 + 1] = oldPositions[old * 2 + 1];
          return;
        }
        const angle =
          (2 * Math.PI * (typeIndex.get(node.otId) ?? 0)) / Math.max(1, typeOrder.length);
        const r = spread * Math.sqrt(hash01(node.id));
        const theta = 2 * Math.PI * hash01(`${node.id}#`);
        positions[i * 2] = centre + ring * Math.cos(angle) + r * Math.cos(theta);
        positions[i * 2 + 1] = centre + ring * Math.sin(angle) + r * Math.sin(theta);
      });
      const kept = edges.filter((edge) => index.has(edge.source) && index.has(edge.target));
      const linkEnds = new Uint32Array(kept.length * 2);
      const degree = new Uint32Array(ids.length);
      const neighbours: number[][] = ids.map(() => []);
      const incident: number[][] = ids.map(() => []);
      kept.forEach((edge, i) => {
        const a = index.get(edge.source) ?? 0;
        const b = index.get(edge.target) ?? 0;
        linkEnds[i * 2] = a;
        linkEnds[i * 2 + 1] = b;
        degree[a] += 1;
        degree[b] += 1;
        neighbours[a].push(b);
        neighbours[b].push(a);
        incident[a].push(i);
        incident[b].push(i);
      });
      dataRef.current = {
        ids,
        index,
        otIds: nodes.map((node) => node.otId),
        labels: nodes.map((node) => node.display),
        degree,
        linkEnds,
        linkRel: kept.map((edge) => edge.relTypeId),
        linkVisible: new Uint8Array(kept.length).fill(1),
        neighbours,
        incident,
        named: [],
        namedLines: [],
      };
      isolatedRef.current = [];
      hoveredLinkRef.current = null;
      placeIsolated(positions);
      graph.setPointPositions(positions);
      graph.setPinnedPoints(isolatedRef.current.length > 0 ? isolatedRef.current : null);
      graph.setLinks(Float32Array.from(linkEnds));
      const sizes = new Float32Array(ids.length);
      for (let i = 0; i < ids.length; i += 1) sizes[i] = sizeFor(degree[i]);
      graph.setPointSizes(sizes);
      graph.render();
      // Nothing moves while points arrive; the layout runs once the load is done.
      if (!propsRef.current.settled) graph.pause();
    }, [nodes, edges]);

    /* ------------------------------ colours and highlight ------------------------------ */

    useEffect(() => {
      const graph = graphRef.current;
      if (!graph) return;
      const theme = dark ? THEME.dark : THEME.light;
      const data = dataRef.current;
      const count = data.ids.length;
      const focus = new Set<number>();
      const selected = selectedId !== null ? data.index.get(selectedId) : undefined;
      if (selected !== undefined) {
        focus.add(selected);
        for (const n of data.neighbours[selected] ?? []) focus.add(n);
      } else {
        for (const id of picked) {
          const i = data.index.get(id);
          if (i !== undefined) focus.add(i);
        }
      }
      const focusing = focus.size > 0;
      const many = focus.size > MANY_LINES;
      const dim = rgba(theme.dim);
      const pointColors = new Float32Array(count * 4);
      const colourByType = new Map<string, Rgba>();
      for (let i = 0; i < count; i += 1) {
        const otId = data.otIds[i];
        let colour: Rgba;
        if (hiddenTypes.has(otId)) colour = [0, 0, 0, 0];
        else if (focusing && !focus.has(i)) colour = dim;
        else {
          colour = colourByType.get(otId) ?? rgba(colorOf(otId));
          colourByType.set(otId, colour);
        }
        pointColors.set(colour, i * 4);
      }
      const links = data.linkRel.length;
      const linkColors = new Float32Array(links * 4);
      const linkWidths = new Float32Array(links);
      const base = rgba(theme.edge);
      const strong = rgba(many ? theme.edgeMany : theme.edgeStrong);
      for (let l = 0; l < links; l += 1) {
        const a = data.linkEnds[l * 2];
        const b = data.linkEnds[l * 2 + 1];
        let colour = base;
        let width = 0.5;
        if (hiddenTypes.has(data.otIds[a]) || hiddenTypes.has(data.otIds[b])) colour = [0, 0, 0, 0];
        else if (focusing) {
          const lit =
            selected !== undefined
              ? a === selected || b === selected
              : focus.has(a) && focus.has(b);
          colour = lit ? strong : [0, 0, 0, 0];
          width = lit ? (many ? 0.6 : 1.4) : 0.5;
        }
        linkColors.set(colour, l * 4);
        linkWidths[l] = width;
        data.linkVisible[l] = colour[3] > 0 ? 1 : 0;
      }
      if (hoveredLinkRef.current !== null && !data.linkVisible[hoveredLinkRef.current])
        hoveredLinkRef.current = null;
      graph.setPointColors(pointColors);
      graph.setLinkColors(linkColors);
      graph.setLinkWidths(linkWidths);
      graph.setConfigPartial({
        backgroundColor: theme.background,
        hoveredPointRingColor: theme.ring,
        linkDefaultColor: theme.edge,
      });
      // Names for the highlighted points, tracked so they follow the layout and drags.
      const named = focusing ? [...focus] : [];
      dataRef.current.named = named;
      dataRef.current.namedLines =
        selected !== undefined ? (data.incident[selected] ?? []).slice(0, NAMED_LINES) : [];
      graph.trackPointPositionsByIndices(named);
      graph.render();
      if (!layoutRunningRef.current) graph.pause();
      scheduleLabels();
      // scheduleLabels reads through refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dark, hiddenTypes, selectedId, picked, colorOf, nodes, edges]);

    /* ------------------------------ layout ------------------------------ */

    const stopLayout = () => {
      window.clearTimeout(stopTimerRef.current);
      const graph = graphRef.current;
      graph?.pause();
      // The connected part has grown or moved since the band was laid: lay it again under it.
      if (graph && isolatedRef.current.length > 0) {
        const positions = Float32Array.from(graph.getPointPositions());
        if (placeIsolated(positions)) {
          const order = isolatedRef.current;
          const moved = new Float32Array(order.length * 2);
          order.forEach((index, k) => {
            moved[k * 2] = positions[index * 2];
            moved[k * 2 + 1] = positions[index * 2 + 1];
          });
          graph.setPointPositionsByIndices(order, moved);
          graph.render();
          graph.pause();
        }
      }
      layoutRunningRef.current = false;
      propsRef.current.onLayoutRunning(false);
    };

    const runLayout = () => {
      const graph = graphRef.current;
      if (!graph || dataRef.current.ids.length === 0) return;
      graph.start(1);
      layoutRunningRef.current = true;
      propsRef.current.onLayoutRunning(true);
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(stopLayout, LAYOUT_RUN_MS);
    };

    useEffect(() => {
      if (!settled) {
        layoutStartedRef.current = false;
        return;
      }
      if (layoutStartedRef.current) return;
      layoutStartedRef.current = true;
      const graph = graphRef.current;
      runLayout();
      // The canvas is larger than the screen: open on the middle, magnified.
      if (graph) {
        graph.fitView(0, 0.1, true);
        window.setTimeout(() => {
          const current = graphRef.current;
          if (current) current.setZoomLevel(current.getZoomLevel() * START_MAGNIFY, 600, true);
        }, 50);
      }
      // runLayout reads everything through refs.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settled]);

    useImperativeHandle(ref, () => ({
      fit() {
        graphRef.current?.fitView(300, 0.1, layoutRunningRef.current);
      },
      focus(id) {
        const data = dataRef.current;
        const index = data.index.get(id);
        if (!graphRef.current || index === undefined) return;
        // After the selection's redraw, which would otherwise cut the camera move short.
        window.setTimeout(() => {
          graphRef.current?.fitViewByPointIndices(
            [index, ...(data.neighbours[index] ?? [])],
            400,
            0.25,
            layoutRunningRef.current,
          );
        }, 80);
      },
      runLayout,
      stopLayout,
    }));

    /* ------------------------------ box selection ------------------------------ */

    const onMouseDownCapture = (event: React.MouseEvent<HTMLDivElement>) => {
      if (!event.shiftKey || event.button !== 0) return;
      // Ahead of cosmos.gl, which would otherwise start panning.
      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setBox({ x0: x, y0: y, x1: x, y1: y });
      const move = (moveEvent: MouseEvent) =>
        setBox((current) =>
          current
            ? { ...current, x1: moveEvent.clientX - rect.left, y1: moveEvent.clientY - rect.top }
            : current,
        );
      const up = (upEvent: MouseEvent) => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        setBox(null);
        const graph = graphRef.current;
        if (!graph) return;
        const x1 = upEvent.clientX - rect.left;
        const y1 = upEvent.clientY - rect.top;
        const [left, right] = [Math.min(x, x1), Math.max(x, x1)];
        const [top, bottom] = [Math.min(y, y1), Math.max(y, y1)];
        if (right - left < 4 && bottom - top < 4) return;
        boxEndedRef.current = true;
        window.setTimeout(() => {
          boxEndedRef.current = false;
        }, 300);
        const data = dataRef.current;
        const hidden = propsRef.current.hiddenTypes;
        const ids = graph
          .findPointsInRect([
            [left, top],
            [right, bottom],
          ])
          .filter((i) => !hidden.has(data.otIds[i]))
          .map((i) => data.ids[i]);
        propsRef.current.onBoxSelect(ids);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    };

    return (
      <div className={styles.canvasWrap} onMouseDownCapture={onMouseDownCapture}>
        <div ref={containerRef} className={styles.canvas} data-testid="graph-overview-canvas" />
        <canvas ref={labelsRef} className={styles.labels} />
        {box ? (
          <div
            className={styles.box}
            style={{
              left: Math.min(box.x0, box.x1),
              top: Math.min(box.y0, box.y1),
              width: Math.abs(box.x1 - box.x0),
              height: Math.abs(box.y1 - box.y0),
            }}
          />
        ) : null}
      </div>
    );
  },
);
