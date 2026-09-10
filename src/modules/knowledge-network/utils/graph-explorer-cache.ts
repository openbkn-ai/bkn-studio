/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { GEdge, GNode } from "@/modules/knowledge-network/services/graph-explorer.service";

export const CACHE_VERSION = 1;

export type ExplorerLayout = "force" | "chain" | "dagre" | "radial" | "circular" | "grid";
export type ExplorerShape = "circle" | "rect" | "diamond" | "ellipse" | "hexagon" | "star";
/** single: only the dragged node moves; linked: its neighbours follow with a decaying pull. */
export type DragMode = "single" | "linked";

export type ExplorerSettings = {
  layout: ExplorerLayout;
  shape: ExplorerShape;
  /** Object type id -> property used as the node label. */
  labelByOt: Record<string, string>;
  /** Object type id -> palette index, kept so colours survive a reload. */
  colorByOt: Record<string, number>;
  showNodeLabels: boolean;
  showEdgeLabels: boolean;
  sidebarCollapsed: boolean;
  groupByConceptGroup: boolean;
  dragMode: DragMode;
};

export type NodePosition = { x: number; y: number; fixed?: boolean };

export type ExplorerSnapshot = {
  version: typeof CACHE_VERSION;
  nodes: GNode[];
  edges: GEdge[];
  positions: Record<string, NodePosition>;
  settings: ExplorerSettings;
};

export const DEFAULT_SETTINGS: ExplorerSettings = {
  layout: "force",
  shape: "circle",
  labelByOt: {},
  colorByOt: {},
  showNodeLabels: true,
  showEdgeLabels: true,
  sidebarCollapsed: false,
  groupByConceptGroup: false,
  dragMode: "single",
};

export const LAYOUTS: ExplorerLayout[] = ["force", "chain", "dagre", "radial", "circular", "grid"];
export const SHAPES: ExplorerShape[] = ["circle", "rect", "diamond", "ellipse", "hexagon", "star"];

export function cacheKey(knId: string): string {
  return `bkn-studio.graph-explorer.${knId}`;
}

export type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): CacheStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeSettings(raw: unknown): ExplorerSettings {
  const out: ExplorerSettings = { ...DEFAULT_SETTINGS, labelByOt: {}, colorByOt: {} };
  if (!isRecord(raw)) return out;
  if (typeof raw.layout === "string" && (LAYOUTS as string[]).includes(raw.layout)) out.layout = raw.layout as ExplorerLayout;
  if (typeof raw.shape === "string" && (SHAPES as string[]).includes(raw.shape)) out.shape = raw.shape as ExplorerShape;
  if (isRecord(raw.labelByOt)) {
    for (const [key, value] of Object.entries(raw.labelByOt)) {
      if (typeof value === "string" && value) out.labelByOt[key] = value;
    }
  }
  if (isRecord(raw.colorByOt)) {
    for (const [key, value] of Object.entries(raw.colorByOt)) {
      if (typeof value === "number" && Number.isInteger(value) && value >= 0) out.colorByOt[key] = value;
    }
  }
  if (typeof raw.showNodeLabels === "boolean") out.showNodeLabels = raw.showNodeLabels;
  if (typeof raw.showEdgeLabels === "boolean") out.showEdgeLabels = raw.showEdgeLabels;
  if (typeof raw.sidebarCollapsed === "boolean") out.sidebarCollapsed = raw.sidebarCollapsed;
  if (typeof raw.groupByConceptGroup === "boolean") out.groupByConceptGroup = raw.groupByConceptGroup;
  if (raw.dragMode === "single" || raw.dragMode === "linked") out.dragMode = raw.dragMode;
  return out;
}

function isNode(value: unknown): value is GNode {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.otId === "string" &&
    typeof value.otName === "string" &&
    typeof value.display === "string" &&
    isRecord(value.identity) &&
    isRecord(value.props)
  );
}

function isEdge(value: unknown): value is GEdge {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string" &&
    typeof value.relTypeId === "string" &&
    typeof value.relTypeName === "string"
  );
}

function sanitizePositions(raw: unknown): Record<string, NodePosition> {
  const out: Record<string, NodePosition> = {};
  if (!isRecord(raw)) return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!isRecord(value) || typeof value.x !== "number" || typeof value.y !== "number") continue;
    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) continue;
    out[id] = value.fixed === true ? { x: value.x, y: value.y, fixed: true } : { x: value.x, y: value.y };
  }
  return out;
}

/**
 * Reads the snapshot for one knowledge network. A missing or unparsable entry yields
 * null. A version mismatch keeps only the settings it can still recognise, because a
 * canvas written by another schema is worth less than a clean start.
 */
export function readCache(knId: string, storage: CacheStorage | null = defaultStorage()): ExplorerSnapshot | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(cacheKey(knId));
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const settings = sanitizeSettings(parsed.settings);
  if (parsed.version !== CACHE_VERSION) {
    return { version: CACHE_VERSION, nodes: [], edges: [], positions: {}, settings };
  }
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes.filter(isNode) : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(parsed.edges)
    ? parsed.edges.filter(isEdge).filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    : [];
  const positions = sanitizePositions(parsed.positions);
  for (const id of Object.keys(positions)) {
    if (!nodeIds.has(id)) delete positions[id];
  }
  return { version: CACHE_VERSION, nodes, edges, positions, settings };
}

export type WriteOutcome = "saved" | "settings-only" | "unavailable";

/**
 * Persists the snapshot. When the browser refuses the full payload (quota), the
 * settings alone are written so at least layout and label choices survive.
 */
export function writeCache(
  knId: string,
  snapshot: Omit<ExplorerSnapshot, "version">,
  storage: CacheStorage | null = defaultStorage(),
): WriteOutcome {
  if (!storage) return "unavailable";
  const key = cacheKey(knId);
  const full: ExplorerSnapshot = { version: CACHE_VERSION, ...snapshot };
  try {
    storage.setItem(key, JSON.stringify(full));
    return "saved";
  } catch {
    // Quota exceeded or serialisation failure: keep the settings.
  }
  try {
    const settingsOnly: ExplorerSnapshot = { version: CACHE_VERSION, nodes: [], edges: [], positions: {}, settings: snapshot.settings };
    storage.setItem(key, JSON.stringify(settingsOnly));
    return "settings-only";
  } catch {
    return "unavailable";
  }
}

export function clearCache(knId: string, storage: CacheStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(cacheKey(knId));
  } catch {
    // Ignore unavailable storage.
  }
}
