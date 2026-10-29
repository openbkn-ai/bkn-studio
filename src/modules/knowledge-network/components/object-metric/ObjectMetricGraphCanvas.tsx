/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  AimOutlined,
  ArrowLeftOutlined,
  QuestionCircleOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from "@ant-design/icons";
import { Button, Empty, Pagination, Spin, Tooltip } from "antd";
import type { KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { ObjectMetricGraphDetailDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricGraphDetailDrawer";
import { objectMetricVersionKey } from "@/modules/knowledge-network/lib/object-metric-lineage";
import { rootRelationTypeIds } from "@/modules/knowledge-network/lib/object-metric-relation-usage";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { listObjectMetricsV1 } from "@/modules/knowledge-network/services/object-metric.service";
import { listKnowledgeNetworkRelationTypePage } from "@/modules/knowledge-network/services/relation-type.service";
import type {
  ObjectMetricRecordV1,
  ObjectMetricTypeV1,
} from "@/modules/knowledge-network/types/object-metric";
import type { KnowledgeNetworkRelationTypeRecord } from "@/modules/knowledge-network/types/relation-type";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

import styles from "./ObjectMetricGraphCanvas.module.css";
import metricTheme from "./ObjectMetricTheme.module.css";

type Props = {
  canDelete?: boolean;
  canModify?: boolean;
  initialFocusedMetric?: { id: string; objectTypeId: string; version: number };
  metricType?: ObjectMetricTypeV1;
  networkId: string;
  objectTypeSearchEmpty?: boolean;
  objectTypesLoading?: boolean;
  ownerMetricCache?: Map<string, { entries: ObjectMetricRecordV1[]; total: number }>;
  onAuthorizeMetric?: (metric: ObjectMetricRecordV1) => void;
  onDeleteVersion?: (metric: ObjectMetricRecordV1) => void;
  onDeprecate?: (metric: ObjectMetricRecordV1) => void;
  onEditMetric?: (metric: ObjectMetricRecordV1) => void;
  onOpenMetric: (metric: ObjectMetricRecordV1) => void;
  onRestrictedObjectClick?: () => void;
  onSelectObject: (objectTypeId: string, objectTypeName: string) => void;
  onSwitchList?: () => void;
  onTrialMetric?: (metric: ObjectMetricRecordV1) => void;
  ownerObjectType?: ObjectTypeDetail | null;
  refreshVersion: number;
  restrictedObjectTypes?: boolean;
  selectedObjectTypeId: string;
  selectedObjectTypeName: string;
};

type ViewBox = { x: number; y: number; width: number; height: number };
type DetailGroup = { kind: "owner" } | { kind: "relation"; relationId: string };
type Point = { x: number; y: number };
type GraphNeighbor = {
  id: string;
  name: string;
  relations: KnowledgeNetworkRelationTypeRecord[];
};
type NeighborMetricCounts = {
  requestKey: string;
  values: Record<string, number | null>;
};
const RELATION_PAGE_SIZE = 6;
const RESTRICTED_METRIC_PAGE_SIZE = 6;
const NEIGHBOR_COUNT_CONCURRENCY = 3;
const METRIC_SCAN_PAGE_SIZE = 50;
const MAX_GRAPH_METRICS = 200;
const MAX_CLUSTERED_METRICS_PER_COLUMN = 36;
const EXPANDED_METRIC_BATCH_SIZE = 6;
const INITIAL_RING_VISIBLE_COUNTS: Record<ObjectMetricTypeV1, number> = {
  atomic: EXPANDED_METRIC_BATCH_SIZE,
  derived: EXPANDED_METRIC_BATCH_SIZE,
  composite: EXPANDED_METRIC_BATCH_SIZE,
};
const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 560;
const CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
const FOCUS_OWNER_POSITION = { x: 110, y: GRAPH_HEIGHT / 2 };
const FOCUS_OWNER_NODE_KEY = "metric-focus:owner";
const INITIAL_VIEW: ViewBox = { x: 0, y: 0, width: GRAPH_WIDTH, height: GRAPH_HEIGHT };
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.5;
const metricTypeOrder: Record<ObjectMetricTypeV1, number> = {
  atomic: 0,
  derived: 1,
  composite: 2,
};

const metricTypeNames = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
};
function pageSummary(page: number, total: number, pageSize = RELATION_PAGE_SIZE) {
  return objectMetricText("graphPageSummary", {
    p0: total ? (page - 1) * pageSize + 1 : 0,
    p1: Math.min(page * pageSize, total),
    p2: total,
  });
}

function countText(count: number, ready: boolean, complete: boolean, error: boolean) {
  if (error) return "—";
  if (!ready) return "…";
  return complete ? String(count) : `${count}+`;
}

function truncate(value: string, max: number) {
  const chars = Array.from(value);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : value;
}

function relatedPosition(index: number, count: number): Point {
  const angle =
    count === 1 ? 0 : count === 2 ? Math.PI * index : -Math.PI / 2 + (2 * Math.PI * index) / count;
  return { x: CENTER.x + Math.cos(angle) * 330, y: CENTER.y + Math.sin(angle) * 190 };
}

function edgeGeometry(center: Point, position: Point, outgoing: boolean, parallelOffset: number) {
  const dx = position.x - center.x;
  const dy = position.y - center.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  const nearCenter = { x: center.x + ux * 30, y: center.y + uy * 30 };
  const nearRelated = { x: position.x - ux * 28, y: position.y - uy * 28 };
  const from = outgoing ? nearCenter : nearRelated;
  const to = outgoing ? nearRelated : nearCenter;
  const control = {
    x: (from.x + to.x) / 2 - uy * parallelOffset,
    y: (from.y + to.y) / 2 + ux * parallelOffset,
  };
  return {
    from,
    to,
    control,
    label: { x: (from.x + to.x + control.x * 2) / 4, y: (from.y + to.y + control.y * 2) / 4 },
  };
}

function pointerToGraph(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  view: ViewBox,
): Point | null {
  const bounds = svg.getBoundingClientRect();
  const scale = Math.min(bounds.width / view.width, bounds.height / view.height);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const left = bounds.left + (bounds.width - view.width * scale) / 2;
  const top = bounds.top + (bounds.height - view.height * scale) / 2;
  return { x: view.x + (clientX - left) / scale, y: view.y + (clientY - top) / scale };
}

function clampNodePosition(position: Point): Point {
  return {
    x: Math.max(40, Math.min(GRAPH_WIDTH - 40, position.x)),
    y: Math.max(40, Math.min(GRAPH_HEIGHT - 60, position.y)),
  };
}

function metricNodeKey(metric: ObjectMetricRecordV1): string {
  return `metric:${metric.definition.id}@${metric.definition.version}`;
}

function moreMetricNodeKey(type: ObjectMetricTypeV1): string {
  return `metric-more:${type}`;
}

function isMetricFocusNodeKey(key: string): boolean {
  return (
    key === FOCUS_OWNER_NODE_KEY || key.startsWith("metric:") || key.startsWith("metric-more:")
  );
}

function directMetricRefs(metric: ObjectMetricRecordV1) {
  const specification = metric.definition.specification;
  if (specification.kind === "derived") return [specification.base_metric];
  if (specification.kind === "composite") {
    return [
      ...new Map(
        specification.dependencies.map((dependency) => [
          `${dependency.metric_ref.metric_id}@${dependency.metric_ref.version}`,
          dependency.metric_ref,
        ]),
      ).values(),
    ];
  }
  return [];
}

function compareMetricNames(left: ObjectMetricRecordV1, right: ObjectMetricRecordV1): number {
  return (
    left.definition.name.localeCompare(right.definition.name) ||
    left.definition.id.localeCompare(right.definition.id)
  );
}

function orderAtomicMetricsBySharedDownstream(
  atomicMetrics: ObjectMetricRecordV1[],
  visibleMetrics: ObjectMetricRecordV1[],
  resolveMetric: (reference: {
    metric_id: string;
    version: number;
  }) => ObjectMetricRecordV1 | undefined,
): ObjectMetricRecordV1[] {
  const sorted = [...atomicMetrics].sort(compareMetricNames);
  if (sorted.length < 3 || sorted.length > MAX_CLUSTERED_METRICS_PER_COLUMN) return sorted;

  const atomicKeys = new Set(sorted.map(metricNodeKey));
  const affinity = new Map<string, Map<string, number>>();
  const addAffinity = (left: string, right: string, weight: number) => {
    const leftScores = affinity.get(left) ?? new Map<string, number>();
    const rightScores = affinity.get(right) ?? new Map<string, number>();
    leftScores.set(right, (leftScores.get(right) ?? 0) + weight);
    rightScores.set(left, (rightScores.get(left) ?? 0) + weight);
    affinity.set(left, leftScores);
    affinity.set(right, rightScores);
  };
  const atomicAncestors = (metric: ObjectMetricRecordV1, visited: Set<string>): Set<string> => {
    const key = metricNodeKey(metric);
    if (visited.has(key)) return new Set();
    visited.add(key);
    if (atomicKeys.has(key)) return new Set([key]);
    const ancestors = new Set<string>();
    directMetricRefs(metric).forEach((reference) => {
      const dependency = resolveMetric(reference);
      if (dependency) {
        atomicAncestors(dependency, visited).forEach((ancestor) => ancestors.add(ancestor));
      }
    });
    return ancestors;
  };

  visibleMetrics.forEach((metric) => {
    if (metric.definition.metric_type === "atomic") return;
    const ancestors = [...atomicAncestors(metric, new Set())];
    const weight = 1 / Math.max(1, ancestors.length - 1);
    ancestors.forEach((left, index) => {
      ancestors.slice(index + 1).forEach((right) => addAffinity(left, right, weight));
    });
  });
  if (!affinity.size) return sorted;

  const remaining = [...sorted];
  const totalAffinity = (metric: ObjectMetricRecordV1) =>
    [...(affinity.get(metricNodeKey(metric))?.values() ?? [])].reduce(
      (total, weight) => total + weight,
      0,
    );
  remaining.sort(
    (left, right) => totalAffinity(right) - totalAffinity(left) || compareMetricNames(left, right),
  );
  const ordered = [remaining.shift()!];
  while (remaining.length) {
    const previousKey = metricNodeKey(ordered[ordered.length - 1]);
    remaining.sort((left, right) => {
      const leftAffinity = affinity.get(previousKey)?.get(metricNodeKey(left)) ?? 0;
      const rightAffinity = affinity.get(previousKey)?.get(metricNodeKey(right)) ?? 0;
      return (
        rightAffinity - leftAffinity ||
        totalAffinity(right) - totalAffinity(left) ||
        compareMetricNames(left, right)
      );
    });
    ordered.push(remaining.shift()!);
  }
  return ordered;
}

type FocusLayoutItem =
  { kind: "metric"; metric: ObjectMetricRecordV1 } | { kind: "more"; type: ObjectMetricTypeV1 };

function layoutMetricFocus(
  groups: Record<ObjectMetricTypeV1, ObjectMetricRecordV1[]>,
  hiddenCounts: Record<ObjectMetricTypeV1, number>,
  resolveMetric: (reference: {
    metric_id: string;
    version: number;
  }) => ObjectMetricRecordV1 | undefined,
) {
  const allMetrics = Object.values(groups).flat();
  const visibleMetrics = [
    ...orderAtomicMetricsBySharedDownstream(groups.atomic, allMetrics, resolveMetric),
    ...[...groups.derived].sort(compareMetricNames),
    ...[...groups.composite].sort(compareMetricNames),
  ];
  const metricOrder = new Map(
    visibleMetrics.map((metric, index) => [metricNodeKey(metric), index]),
  );
  const visibleKeys = new Set(visibleMetrics.map(metricNodeKey));
  const depths = new Map<string, number>();
  const depthFor = (metric: ObjectMetricRecordV1, visiting = new Set<string>()): number => {
    const key = metricNodeKey(metric);
    if (depths.has(key)) return depths.get(key)!;
    if (visiting.has(key)) return 1;
    visiting.add(key);
    const parentDepths = directMetricRefs(metric)
      .map(resolveMetric)
      .filter((parent): parent is ObjectMetricRecordV1 =>
        Boolean(parent && visibleKeys.has(metricNodeKey(parent)) && metricNodeKey(parent) !== key),
      )
      .map((parent) => depthFor(parent, visiting));
    visiting.delete(key);
    // A metric's own declared dependencies determine its column, not its metric type.
    const depth = parentDepths.length ? Math.max(...parentDepths) + 1 : 1;
    depths.set(key, depth);
    return depth;
  };
  visibleMetrics.forEach((metric) => depthFor(metric));

  const columns = new Map<number, FocusLayoutItem[]>();
  visibleMetrics.forEach((metric) => {
    const depth = depths.get(metricNodeKey(metric))!;
    columns.set(depth, [...(columns.get(depth) ?? []), { kind: "metric", metric }]);
  });
  (["atomic", "derived", "composite"] as const).forEach((type) => {
    if (!hiddenCounts[type]) return;
    const groupDepths = groups[type].map((metric) => depths.get(metricNodeKey(metric)) ?? 1);
    const depth = groupDepths.length ? Math.max(...groupDepths) : metricTypeOrder[type] + 1;
    columns.set(depth, [...(columns.get(depth) ?? []), { kind: "more", type }]);
  });

  const automaticMetricPositions = new Map<string, Point>();
  const moreMetricPositions: Partial<Record<ObjectMetricTypeV1, Point>> = {};
  const sortedDepths = [...columns.keys()].sort((left, right) => left - right);
  const columnGap = Math.min(
    220,
    (GRAPH_WIDTH - FOCUS_OWNER_POSITION.x - 100) / sortedDepths.length,
  );
  sortedDepths.forEach((depth, columnIndex) => {
    const items = columns.get(depth)!;
    const parentY = (item: FocusLayoutItem) => {
      if (item.kind !== "metric") return undefined;
      const positions = directMetricRefs(item.metric)
        .map(resolveMetric)
        .map((parent) => parent && automaticMetricPositions.get(metricNodeKey(parent)))
        .filter((position): position is Point => Boolean(position));
      return positions.length
        ? positions.reduce((sum, position) => sum + position.y, 0) / positions.length
        : undefined;
    };
    items.sort((left, right) => {
      const leftY = parentY(left);
      const rightY = parentY(right);
      if (leftY !== undefined && rightY !== undefined && leftY !== rightY) return leftY - rightY;
      if (leftY !== undefined && rightY === undefined) return -1;
      if (rightY !== undefined && leftY === undefined) return 1;
      if (left.kind === "more" || right.kind === "more") return left.kind === "more" ? 1 : -1;
      return (
        (metricOrder.get(metricNodeKey(left.metric)) ?? 0) -
        (metricOrder.get(metricNodeKey(right.metric)) ?? 0)
      );
    });
    const rowGap = Math.min(84, (GRAPH_HEIGHT - 120) / Math.max(1, items.length - 1));
    items.forEach((item, rowIndex) => {
      const position = {
        x: FOCUS_OWNER_POSITION.x + columnGap * (columnIndex + 1),
        y: GRAPH_HEIGHT / 2 + (rowIndex - (items.length - 1) / 2) * rowGap,
      };
      if (item.kind === "metric")
        automaticMetricPositions.set(metricNodeKey(item.metric), position);
      else moreMetricPositions[item.type] = position;
    });
  });
  return { automaticMetricPositions, moreMetricPositions, visibleMetrics };
}

function onButtonKeyDown(event: KeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

export function ObjectMetricGraphCanvas({
  canDelete = false,
  canModify = false,
  initialFocusedMetric,
  metricType,
  networkId,
  objectTypeSearchEmpty = false,
  objectTypesLoading = false,
  ownerMetricCache,
  onAuthorizeMetric,
  onDeleteVersion,
  onDeprecate,
  onEditMetric,
  onOpenMetric,
  onRestrictedObjectClick,
  onSelectObject,
  onSwitchList,
  onTrialMetric,
  ownerObjectType,
  refreshVersion,
  restrictedObjectTypes = false,
  selectedObjectTypeId,
  selectedObjectTypeName,
}: Props) {
  const [relationPage, setRelationPage] = useState(1);
  const [relations, setRelations] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [relationTotal, setRelationTotal] = useState(0);
  const [relationLoading, setRelationLoading] = useState(false);
  const [relationError, setRelationError] = useState(false);
  const [relationResultKey, setRelationResultKey] = useState("");
  const [metrics, setMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [metricTotal, setMetricTotal] = useState(0);
  const [metricComplete, setMetricComplete] = useState(false);
  const [metricLoading, setMetricLoading] = useState(false);
  const [metricError, setMetricError] = useState(false);
  const [metricResultKey, setMetricResultKey] = useState("");
  const [restrictedMetricPage, setRestrictedMetricPage] = useState(1);
  const [neighborMetricCounts, setNeighborMetricCounts] = useState<NeighborMetricCounts>({
    requestKey: "",
    values: {},
  });
  const neighborCountCacheRef = useRef(new Map<string, number | null>());
  const neighborCountRequestsRef = useRef(new Map<string, Promise<number | null>>());
  const localOwnerMetricCacheRef = useRef(
    new Map<string, { entries: ObjectMetricRecordV1[]; total: number }>(),
  );
  const metricCache = ownerMetricCache ?? localOwnerMetricCacheRef.current;
  const restrictedView = restrictedObjectTypes && !selectedObjectTypeId;
  const [drawerMetric, setDrawerMetric] = useState<ObjectMetricRecordV1>();
  const initialFocusRestoredRef = useRef(false);
  const [expandedGroup, setExpandedGroup] = useState<DetailGroup>();
  const [ringVisibleCounts, setRingVisibleCounts] = useState(INITIAL_RING_VISIBLE_COUNTS);
  const [view, setView] = useState<ViewBox>(INITIAL_VIEW);
  const [nodePositions, setNodePositions] = useState<Record<string, Point>>({});
  const relationViewRef = useRef<ViewBox>(INITIAL_VIEW);
  const panRef = useRef<{ x: number; y: number; view: ViewBox } | undefined>(undefined);
  const nodeDragRef = useRef<
    | {
        id: string;
        pointerId: number;
        startClient: Point;
        startPointer: Point;
        startPosition: Point;
        view: ViewBox;
        moved: boolean;
      }
    | undefined
  >(undefined);
  const suppressClickRef = useRef<string | null>(null);
  const arrowId = useId().replaceAll(":", "");

  const relationRequestKey = JSON.stringify([
    networkId,
    selectedObjectTypeId,
    relationPage,
    refreshVersion,
  ]);
  const metricRequestKey = JSON.stringify([
    networkId,
    restrictedView ? "restricted" : selectedObjectTypeId,
    metricType,
    restrictedView ? restrictedMetricPage : undefined,
    refreshVersion,
  ]);
  const relationCurrent = relationResultKey === relationRequestKey;
  const metricCurrent = metricResultKey === metricRequestKey;
  const metricReady = metricCurrent && !metricLoading;

  useEffect(() => {
    if (initialFocusRestoredRef.current || !metricReady || !initialFocusedMetric) return;
    initialFocusRestoredRef.current = true;
    if (initialFocusedMetric.objectTypeId !== selectedObjectTypeId) return;
    const focused = metrics.find(
      (entry) =>
        entry.definition.id === initialFocusedMetric.id &&
        entry.definition.version === initialFocusedMetric.version,
    );
    if (!focused) return;
    const sameType = metrics
      .filter((entry) => entry.definition.metric_type === focused.definition.metric_type)
      .sort(
        (left, right) =>
          left.definition.name.localeCompare(right.definition.name) ||
          left.definition.id.localeCompare(right.definition.id),
      );
    setRingVisibleCounts((current) => ({
      ...current,
      [focused.definition.metric_type]: Math.max(
        current[focused.definition.metric_type],
        sameType.findIndex(
          (entry) =>
            entry.definition.id === focused.definition.id &&
            entry.definition.version === focused.definition.version,
        ) + 1,
      ),
    }));
    setExpandedGroup({ kind: "owner" });
    setDrawerMetric(focused);
  }, [initialFocusedMetric, metricReady, metrics, selectedObjectTypeId]);

  useEffect(() => {
    setRelationPage(1);
    setRestrictedMetricPage(1);
    setDrawerMetric(undefined);
    setExpandedGroup(undefined);
    setRingVisibleCounts(INITIAL_RING_VISIBLE_COUNTS);
    setView(INITIAL_VIEW);
    relationViewRef.current = INITIAL_VIEW;
    setNodePositions({});
  }, [networkId, restrictedView, selectedObjectTypeId]);

  useEffect(() => {
    setDrawerMetric(undefined);
    setExpandedGroup(undefined);
    setRingVisibleCounts(INITIAL_RING_VISIBLE_COUNTS);
    setView(INITIAL_VIEW);
    relationViewRef.current = INITIAL_VIEW;
    setNodePositions({});
  }, [relationPage]);

  useEffect(() => {
    setDrawerMetric(undefined);
    setExpandedGroup(undefined);
    setRingVisibleCounts(INITIAL_RING_VISIBLE_COUNTS);
    setNodePositions((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !isMetricFocusNodeKey(key))),
    );
    setView(relationViewRef.current);
  }, [metricType]);

  useEffect(() => {
    if (objectTypesLoading || !selectedObjectTypeId) return;
    let active = true;
    setRelationLoading(true);
    setRelationError(false);
    void listKnowledgeNetworkRelationTypePage(networkId, {
      boundObjectTypeId: selectedObjectTypeId,
      direction: "asc",
      limit: RELATION_PAGE_SIZE,
      offset: (relationPage - 1) * RELATION_PAGE_SIZE,
      sort: "name",
    })
      .then((result) => {
        if (!active) return;
        const maxPage = Math.max(1, Math.ceil(result.totalCount / RELATION_PAGE_SIZE));
        setRelationTotal(result.totalCount);
        if (relationPage > maxPage) {
          setRelationPage(maxPage);
          return;
        }
        setRelations(result.entries);
        setRelationResultKey(relationRequestKey);
      })
      .catch(() => {
        if (!active) return;
        setRelations([]);
        setRelationTotal(0);
        setRelationError(true);
        setRelationResultKey(relationRequestKey);
      })
      .finally(() => {
        if (active) setRelationLoading(false);
      });
    return () => {
      active = false;
    };
  }, [networkId, objectTypesLoading, relationPage, relationRequestKey, selectedObjectTypeId]);

  useEffect(() => {
    if (objectTypesLoading || (!selectedObjectTypeId && !restrictedView)) return;
    let active = true;
    setMetricError(false);
    const cached = metricCache.get(metricRequestKey);
    if (cached) {
      setMetrics(cached.entries);
      setDrawerMetric((current) =>
        current
          ? cached.entries.find(
              (entry) =>
                entry.definition.id === current.definition.id &&
                entry.definition.version === current.definition.version,
            )
          : undefined,
      );
      setMetricTotal(cached.total);
      setMetricComplete(restrictedView || cached.entries.length >= cached.total);
      setMetricResultKey(metricRequestKey);
      setMetricLoading(false);
      return;
    }
    setMetricLoading(true);

    async function loadOwnerMetrics() {
      const loaded: ObjectMetricRecordV1[] = [];
      let total = 0;
      try {
        if (restrictedView) {
          const result = await listObjectMetricsV1(
            networkId,
            {
              limit: RESTRICTED_METRIC_PAGE_SIZE,
              metricType,
              offset: (restrictedMetricPage - 1) * RESTRICTED_METRIC_PAGE_SIZE,
            },
            { skipErrorToast: true },
          );
          if (!active) return;
          const maxPage = Math.max(1, Math.ceil(result.total_count / RESTRICTED_METRIC_PAGE_SIZE));
          if (restrictedMetricPage > maxPage) {
            setRestrictedMetricPage(maxPage);
            return;
          }
          setMetrics(result.entries);
          setDrawerMetric((current) =>
            current
              ? result.entries.find(
                  (entry) =>
                    entry.definition.id === current.definition.id &&
                    entry.definition.version === current.definition.version,
                )
              : undefined,
          );
          setMetricTotal(result.total_count);
          setMetricComplete(true);
          setMetricResultKey(metricRequestKey);
          metricCache.set(metricRequestKey, {
            entries: result.entries,
            total: result.total_count,
          });
          if (metricCache.size > 6) {
            const oldest = metricCache.keys().next().value;
            if (oldest) metricCache.delete(oldest);
          }
          return;
        }
        do {
          const result = await listObjectMetricsV1(
            networkId,
            {
              limit: Math.min(METRIC_SCAN_PAGE_SIZE, MAX_GRAPH_METRICS - loaded.length),
              metricType,
              offset: loaded.length,
              ownerObjectTypeId: selectedObjectTypeId,
            },
            { skipErrorToast: true },
          );
          if (!active) return;
          total = result.total_count;
          loaded.push(...result.entries);
          if (result.entries.length === 0) break;
        } while (loaded.length < total && loaded.length < MAX_GRAPH_METRICS);
        setMetrics(loaded);
        setDrawerMetric((current) =>
          current
            ? loaded.find(
                (entry) =>
                  entry.definition.id === current.definition.id &&
                  entry.definition.version === current.definition.version,
              )
            : undefined,
        );
        setMetricTotal(total);
        setMetricComplete(loaded.length >= total);
        setMetricResultKey(metricRequestKey);
        metricCache.set(metricRequestKey, { entries: loaded, total });
        if (metricCache.size > 6) {
          const oldest = metricCache.keys().next().value;
          if (oldest) metricCache.delete(oldest);
        }
      } catch {
        if (active) {
          setMetrics([]);
          setDrawerMetric(undefined);
          setMetricTotal(0);
          setMetricError(true);
          setMetricResultKey(metricRequestKey);
        }
      } finally {
        if (active) setMetricLoading(false);
      }
    }
    void loadOwnerMetrics();
    return () => {
      active = false;
    };
  }, [
    metricCache,
    metricRequestKey,
    metricType,
    networkId,
    objectTypesLoading,
    refreshVersion,
    restrictedMetricPage,
    restrictedView,
    selectedObjectTypeId,
  ]);

  const metricsByRelation = useMemo(() => {
    const groups = new Map<string, ObjectMetricRecordV1[]>();
    for (const metric of metrics) {
      for (const relationId of rootRelationTypeIds(metric)) {
        const group = groups.get(relationId) ?? [];
        group.push(metric);
        groups.set(relationId, group);
      }
    }
    return groups;
  }, [metrics]);
  const relationNames = useMemo(
    () => new Map(relations.map((relation) => [relation.id, relation.name])),
    [relations],
  );
  const neighbors = useMemo(() => {
    const groups = new Map<string, GraphNeighbor>();
    for (const relation of relations) {
      const outgoing = relation.sourceObjectTypeId === selectedObjectTypeId;
      const id = outgoing ? relation.targetObjectTypeId : relation.sourceObjectTypeId;
      const name = outgoing ? relation.targetObjectTypeName : relation.sourceObjectTypeName;
      const group = groups.get(id) ?? { id, name, relations: [] };
      group.relations.push(relation);
      groups.set(id, group);
    }
    return [...groups.values()];
  }, [relations, selectedObjectTypeId]);
  const neighborCountRequestKey = JSON.stringify([
    networkId,
    selectedObjectTypeId,
    metricType,
    refreshVersion,
    relationPage,
    relationCurrent ? neighbors.map((neighbor) => neighbor.id) : [],
  ]);
  const currentNeighborCounts: Record<string, number | null> =
    neighborMetricCounts.requestKey === neighborCountRequestKey ? neighborMetricCounts.values : {};

  useEffect(() => {
    if (!relationCurrent || !selectedObjectTypeId || expandedGroup) return;
    let active = true;
    const cache = neighborCountCacheRef.current;
    const requests = neighborCountRequestsRef.current;
    const countKey = (objectTypeId: string) =>
      JSON.stringify([networkId, metricType, refreshVersion, objectTypeId]);
    const visibleNeighbors = neighbors.filter((neighbor) => neighbor.id !== selectedObjectTypeId);

    setNeighborMetricCounts({
      requestKey: neighborCountRequestKey,
      values: Object.fromEntries(
        visibleNeighbors.flatMap((neighbor) => {
          const key = countKey(neighbor.id);
          return cache.has(key) ? [[neighbor.id, cache.get(key) ?? null] as const] : [];
        }),
      ),
    });

    const missingNeighbors = visibleNeighbors.filter(
      (neighbor) => !cache.has(countKey(neighbor.id)),
    );
    let nextIndex = 0;
    const loadNext = async () => {
      while (active && nextIndex < missingNeighbors.length) {
        const neighbor = missingNeighbors[nextIndex++];
        const key = countKey(neighbor.id);
        let request = requests.get(key);
        if (!request) {
          request = listObjectMetricsV1(
            networkId,
            { limit: 1, metricType, offset: 0, ownerObjectTypeId: neighbor.id },
            { skipErrorToast: true },
          )
            .then((result) => result.total_count)
            .catch(() => null)
            .then((count) => {
              cache.set(key, count);
              requests.delete(key);
              return count;
            });
          requests.set(key, request);
        }
        const count = await request;
        if (active) {
          setNeighborMetricCounts((current) =>
            current.requestKey === neighborCountRequestKey
              ? { ...current, values: { ...current.values, [neighbor.id]: count } }
              : current,
          );
        }
      }
    };
    void Promise.all(
      Array.from({ length: Math.min(NEIGHBOR_COUNT_CONCURRENCY, missingNeighbors.length) }, () =>
        loadNext(),
      ),
    );
    return () => {
      active = false;
    };
  }, [
    expandedGroup,
    metricType,
    neighborCountRequestKey,
    neighbors,
    networkId,
    refreshVersion,
    relationCurrent,
    selectedObjectTypeId,
  ]);
  const relationshipOwnerPosition = nodePositions[selectedObjectTypeId] ?? CENTER;
  const ownerNodeKey = expandedGroup ? FOCUS_OWNER_NODE_KEY : selectedObjectTypeId;
  const ownerPosition = expandedGroup
    ? (nodePositions[FOCUS_OWNER_NODE_KEY] ?? FOCUS_OWNER_POSITION)
    : relationshipOwnerPosition;
  const relationGeometries = useMemo(() => {
    const geometries = new Map<string, ReturnType<typeof edgeGeometry>>();
    neighbors.forEach((neighbor, neighborIndex) => {
      const position =
        nodePositions[neighbor.id] ?? relatedPosition(neighborIndex, neighbors.length);
      neighbor.relations.forEach((relation, relationIndex) => {
        geometries.set(
          relation.id,
          edgeGeometry(
            relationshipOwnerPosition,
            position,
            relation.sourceObjectTypeId === selectedObjectTypeId,
            70 * (relationIndex - (neighbor.relations.length - 1) / 2),
          ),
        );
      });
    });
    return geometries;
  }, [neighbors, nodePositions, relationshipOwnerPosition, selectedObjectTypeId]);
  const expandedRelation =
    expandedGroup?.kind === "relation"
      ? relations.find((relation) => relation.id === expandedGroup.relationId)
      : undefined;
  const expandedMetrics = useMemo(() => {
    if (!expandedGroup || !metricReady) return [];
    const group =
      expandedGroup.kind === "owner"
        ? metrics
        : (metricsByRelation.get(expandedGroup.relationId) ?? []);
    return [...group].sort(
      (left, right) =>
        metricTypeOrder[left.definition.metric_type] -
          metricTypeOrder[right.definition.metric_type] ||
        left.definition.name.localeCompare(right.definition.name) ||
        left.definition.id.localeCompare(right.definition.id),
    );
  }, [expandedGroup, metricReady, metrics, metricsByRelation]);
  const metricsByType = useMemo(() => {
    const groups: Record<ObjectMetricTypeV1, ObjectMetricRecordV1[]> = {
      atomic: [],
      derived: [],
      composite: [],
    };
    expandedMetrics.forEach((metric) => groups[metric.definition.metric_type].push(metric));
    return groups;
  }, [expandedMetrics]);
  const {
    hiddenMetricCounts,
    moreMetricPositions,
    visibleDependencyEdges,
    visibleMetricPositions,
    visibleMetrics,
  } = useMemo(() => {
    const loadedMetricsByRef = new Map(
      metrics.map((metric) => [
        objectMetricVersionKey(metric.definition.id, metric.definition.version),
        metric,
      ]),
    );
    const loadedMetricsById = new Map(metrics.map((metric) => [metric.definition.id, metric]));
    const resolveLoadedMetric = (reference: { metric_id: string; version: number }) =>
      loadedMetricsByRef.get(objectMetricVersionKey(reference.metric_id, reference.version)) ??
      loadedMetricsById.get(reference.metric_id);
    const visibleMetricKeys = new Set<string>();
    const revealMetricWithDependencies = (metric: ObjectMetricRecordV1): void => {
      const key = metricNodeKey(metric);
      if (visibleMetricKeys.has(key)) return;
      visibleMetricKeys.add(key);
      directMetricRefs(metric).forEach((reference) => {
        const dependency = resolveLoadedMetric(reference);
        if (dependency) revealMetricWithDependencies(dependency);
      });
    };
    (["atomic", "derived", "composite"] as const).forEach((type) => {
      metricsByType[type].slice(0, ringVisibleCounts[type]).forEach(revealMetricWithDependencies);
    });
    const visibleMetricsByType: Record<ObjectMetricTypeV1, ObjectMetricRecordV1[]> = {
      atomic: [],
      derived: [],
      composite: [],
    };
    metrics.forEach((metric) => {
      if (visibleMetricKeys.has(metricNodeKey(metric))) {
        visibleMetricsByType[metric.definition.metric_type].push(metric);
      }
    });
    const hiddenMetricCounts: Record<ObjectMetricTypeV1, number> = {
      atomic: 0,
      derived: 0,
      composite: 0,
    };
    (["atomic", "derived", "composite"] as const).forEach((type) => {
      hiddenMetricCounts[type] = metricsByType[type].filter(
        (metric) => !visibleMetricKeys.has(metricNodeKey(metric)),
      ).length;
    });
    const { automaticMetricPositions, moreMetricPositions, visibleMetrics } = layoutMetricFocus(
      visibleMetricsByType,
      hiddenMetricCounts,
      resolveLoadedMetric,
    );
    (["atomic", "derived", "composite"] as const).forEach((type) => {
      if (moreMetricPositions[type]) {
        moreMetricPositions[type] =
          nodePositions[moreMetricNodeKey(type)] ?? moreMetricPositions[type];
      }
    });
    const visibleMetricPositions = new Map(
      visibleMetrics.map((metric) => [
        metricNodeKey(metric),
        nodePositions[metricNodeKey(metric)] ??
          automaticMetricPositions.get(metricNodeKey(metric))!,
      ]),
    );
    const visibleMetricRefs = new Map(
      visibleMetrics.map((metric) => [
        objectMetricVersionKey(metric.definition.id, metric.definition.version),
        metric,
      ]),
    );
    const visibleMetricsById = new Map(
      visibleMetrics.map((metric) => [metric.definition.id, metric]),
    );
    const visibleDependencyEdges = visibleMetrics.flatMap((targetMetric) =>
      directMetricRefs(targetMetric).flatMap((reference) => {
        const sourceMetric =
          visibleMetricRefs.get(objectMetricVersionKey(reference.metric_id, reference.version)) ??
          visibleMetricsById.get(reference.metric_id);
        return sourceMetric && sourceMetric.definition.id !== targetMetric.definition.id
          ? [{ sourceMetric, targetMetric }]
          : [];
      }),
    );
    return {
      hiddenMetricCounts,
      moreMetricPositions,
      visibleDependencyEdges,
      visibleMetricPositions,
      visibleMetrics,
    };
  }, [metrics, metricsByType, nodePositions, ringVisibleCounts]);
  const selectedMetricKey = drawerMetric ? metricNodeKey(drawerMetric) : undefined;
  const selectedConnectedKeys = new Set<string>();
  if (selectedMetricKey) {
    selectedConnectedKeys.add(selectedMetricKey);
    visibleDependencyEdges.forEach(({ sourceMetric, targetMetric }) => {
      const sourceKey = metricNodeKey(sourceMetric);
      const targetKey = metricNodeKey(targetMetric);
      if (sourceKey === selectedMetricKey || targetKey === selectedMetricKey) {
        selectedConnectedKeys.add(sourceKey);
        selectedConnectedKeys.add(targetKey);
      }
    });
  }
  const ownerDisplayCount = expandedGroup ? expandedMetrics.length : metricTotal;
  const focusContextName =
    expandedGroup?.kind === "relation"
      ? expandedRelation?.name || "—"
      : objectMetricText("graphAllMetrics");

  const exitMetricFocus = useCallback(() => {
    setDrawerMetric(undefined);
    setExpandedGroup(undefined);
    setRingVisibleCounts(INITIAL_RING_VISIBLE_COUNTS);
    setNodePositions((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !isMetricFocusNodeKey(key))),
    );
    setView(relationViewRef.current);
  }, []);

  const toggleExpanded = (group: DetailGroup, count: number) => {
    if (!metricReady || count === 0) return;
    const isCurrentGroup =
      expandedGroup?.kind === group.kind &&
      (expandedGroup.kind === "owner" ||
        (group.kind === "relation" && expandedGroup.relationId === group.relationId));
    if (isCurrentGroup) {
      exitMetricFocus();
      return;
    }
    if (!expandedGroup) relationViewRef.current = view;
    setDrawerMetric(undefined);
    setRingVisibleCounts(INITIAL_RING_VISIBLE_COUNTS);
    setNodePositions((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !isMetricFocusNodeKey(key))),
    );
    setExpandedGroup(group);
    setView(INITIAL_VIEW);
  };

  useEffect(() => {
    if (!expandedGroup) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !drawerMetric) exitMetricFocus();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [drawerMetric, exitMetricFocus, expandedGroup]);

  const zoomBy = (factor: number) => {
    setView((current) => {
      const nextWidth = Math.max(
        GRAPH_WIDTH / MAX_ZOOM,
        Math.min(GRAPH_WIDTH / MIN_ZOOM, current.width / factor),
      );
      const nextHeight = (nextWidth / GRAPH_WIDTH) * GRAPH_HEIGHT;
      return {
        x: current.x + (current.width - nextWidth) / 2,
        y: current.y + (current.height - nextHeight) / 2,
        width: nextWidth,
        height: nextHeight,
      };
    });
  };

  const resetLayout = () => {
    setView(INITIAL_VIEW);
    if (expandedGroup) {
      setNodePositions((current) =>
        Object.fromEntries(Object.entries(current).filter(([key]) => !isMetricFocusNodeKey(key))),
      );
      return;
    }
    setRelationPage(1);
    setNodePositions({});
    relationViewRef.current = INITIAL_VIEW;
  };

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || (event.target as Element).closest('[data-graph-action="true"]'))
      return;
    panRef.current = { x: event.clientX, y: event.clientY, view };
    const captureTarget = event.target instanceof Element ? event.target : event.currentTarget;
    captureTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = nodeDragRef.current;
    if (drag) {
      if (event.pointerId !== drag.pointerId) return;
      const pointer = pointerToGraph(event.clientX, event.clientY, event.currentTarget, drag.view);
      if (!pointer) return;
      if (Math.hypot(event.clientX - drag.startClient.x, event.clientY - drag.startClient.y) > 4) {
        drag.moved = true;
      }
      if (drag.moved) {
        const nextPosition = {
          x: drag.startPosition.x + pointer.x - drag.startPointer.x,
          y: drag.startPosition.y + pointer.y - drag.startPointer.y,
        };
        setNodePositions((current) => ({
          ...current,
          [drag.id]: clampNodePosition(nextPosition),
        }));
      }
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const scale = Math.min(bounds.width / pan.view.width, bounds.height / pan.view.height);
    if (!Number.isFinite(scale) || scale <= 0) return;
    setView({
      ...pan.view,
      x: pan.view.x - (event.clientX - pan.x) / scale,
      y: pan.view.y - (event.clientY - pan.y) / scale,
    });
  };

  const onNodePointerDown = (event: PointerEvent<SVGGElement>, id: string, position: Point) => {
    if (event.button !== 0) return;
    const svg = event.currentTarget.ownerSVGElement;
    const pointer = svg ? pointerToGraph(event.clientX, event.clientY, svg, view) : null;
    if (!svg || !pointer) return;
    event.stopPropagation();
    nodeDragRef.current = {
      id,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      startPointer: pointer,
      startPosition: position,
      view,
      moved: false,
    };
    // Preserve the actual clicked SVG child as the capture target. Capturing
    // on the parent node retargets a count/text click to that parent, so its
    // nested expand action never receives the browser's click event.
    const captureTarget = event.target instanceof Element ? event.target : event.currentTarget;
    captureTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const drag = nodeDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      if (drag.moved) {
        suppressClickRef.current = drag.id;
        window.setTimeout(() => {
          if (suppressClickRef.current === drag.id) suppressClickRef.current = null;
        }, 0);
      }
      nodeDragRef.current = undefined;
    }
    panRef.current = undefined;
  };

  const activateNode = (id: string, action: () => void) => {
    if (suppressClickRef.current === id) {
      suppressClickRef.current = null;
      return;
    }
    action();
  };

  if (objectTypesLoading || (restrictedView && !metricReady)) {
    return (
      <div className={styles.loading} role="status">
        <Spin />
      </div>
    );
  }

  if (restrictedView && metricError) {
    return <Empty description={objectMetricText("graphLoadError")} />;
  }

  if (restrictedView && metricTotal === 0) {
    return <Empty description={objectMetricText("graphNoVisibleObjectTypesOrMetrics")} />;
  }

  if (restrictedView) {
    const restrictedRows = metrics.map((metric, index) => ({
      metric,
      y: 64 + index * 88,
    }));
    const restrictedOwners = [
      ...restrictedRows
        .reduce(
          (groups, row) => {
            const ownerId = row.metric.definition.owner_object_type_id;
            const current = groups.get(ownerId);
            if (current) {
              current.rows.push(row);
            } else {
              groups.set(ownerId, {
                name: row.metric.owner_object_type_name || objectMetricText("restrictedOwnerName"),
                ownerId,
                rows: [row],
              });
            }
            return groups;
          },
          new Map<
            string,
            {
              name: string;
              ownerId: string;
              rows: Array<{ metric: ObjectMetricRecordV1; y: number }>;
            }
          >(),
        )
        .values(),
    ];
    return (
      <div className={`${styles.shell} ${metricTheme.scope}`}>
        <div className={styles.explorerToolbar}>
          <div className={styles.graphPanelTitle}>
            <strong>{objectMetricText("restrictedGraphTitle")}</strong>
          </div>
          <div className={styles.toolbarMeta}>
            <span>
              {metricCurrent
                ? objectMetricText("restrictedGraphSummary", { p0: metricTotal })
                : objectMetricText("resourceLoading")}
            </span>
          </div>
        </div>
        <div className={styles.canvasContent}>
          {metrics.length === 0 ? (
            <Empty description={objectMetricText("noMetricsInList")} />
          ) : (
            <svg
              aria-label={objectMetricText("restrictedGraphAriaLabel")}
              className={styles.graph}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
            >
              <defs>
                <pattern
                  id={`${arrowId}-restricted-grid`}
                  height="28"
                  patternUnits="userSpaceOnUse"
                  width="28"
                >
                  <circle className={styles.gridDot} cx="1" cy="1" r="1" />
                </pattern>
              </defs>
              <rect
                fill={`url(#${arrowId}-restricted-grid)`}
                height={GRAPH_HEIGHT}
                width={GRAPH_WIDTH}
                x={0}
                y={0}
              />
              {restrictedRows.map(({ metric, y }) => {
                const key = metricNodeKey(metric);
                return (
                  <g key={key}>
                    <Tooltip
                      mouseEnterDelay={0.12}
                      placement="top"
                      title={metric.definition.name}
                      trigger={["hover", "focus"]}
                    >
                      <g
                        aria-label={objectMetricText("graphMetricNodeLabel", {
                          p0: metricTypeNames[metric.definition.metric_type],
                          p1: metric.definition.name,
                        })}
                        className={`${styles.metricNode} ${
                          metric.definition.metric_type === "atomic"
                            ? styles.metricNodeAtomic
                            : metric.definition.metric_type === "derived"
                              ? styles.metricNodeDerived
                              : styles.metricNodeComposite
                        }`}
                        data-graph-action="true"
                        onClick={() => setDrawerMetric(metric)}
                        onKeyDown={(event) => onButtonKeyDown(event, () => setDrawerMetric(metric))}
                        role="button"
                        tabIndex={0}
                        transform={`translate(650 ${y})`}
                      >
                        <circle className={styles.metricNodeBody} r="17" />
                        <text textAnchor="middle" y="36">
                          {truncate(metric.definition.name, 18)}
                        </text>
                      </g>
                    </Tooltip>
                  </g>
                );
              })}
              {restrictedOwners.map(({ name, ownerId, rows }) => {
                const y = rows.reduce((total, row) => total + row.y, 0) / rows.length;
                const ownerLabel = objectMetricText("restrictedOwnerNodeLabel", { p0: name });
                return (
                  <g key={ownerId}>
                    {rows.map((row) => (
                      <path
                        className={styles.restrictedOwnerEdge}
                        d={`M 304 ${y} C 420 ${y}, 510 ${row.y}, 626 ${row.y}`}
                        key={metricNodeKey(row.metric)}
                      />
                    ))}
                    <g
                      aria-label={ownerLabel}
                      className={styles.restrictedOwnerNode}
                      data-graph-action="true"
                      onClick={onRestrictedObjectClick}
                      onKeyDown={(event) =>
                        onButtonKeyDown(event, () => onRestrictedObjectClick?.())
                      }
                      role="button"
                      tabIndex={0}
                      transform={`translate(280 ${y})`}
                    >
                      <circle r="23" />
                      <path d="M-7 -2 V-7 A7 7 0 0 1 7 -7 V-2" />
                      <rect height="13" rx="2" width="18" x="-9" y="-2" />
                      <circle className={styles.restrictedOwnerKeyhole} cx="0" cy="4" r="1.7" />
                      <text textAnchor="middle" y="43">
                        {truncate(name, 18)}
                      </text>
                      <title>{ownerLabel}</title>
                    </g>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
        <div className={styles.notice}>{objectMetricText("restrictedGraphNotice")}</div>
        <div className={styles.canvasFooter}>
          <span>
            {pageSummary(
              restrictedMetricPage,
              metricCurrent ? metricTotal : 0,
              RESTRICTED_METRIC_PAGE_SIZE,
            )}
          </span>
          <Pagination
            current={restrictedMetricPage}
            onChange={setRestrictedMetricPage}
            pageSize={RESTRICTED_METRIC_PAGE_SIZE}
            showSizeChanger={false}
            simple
            size="small"
            total={metricCurrent ? metricTotal : 0}
          />
        </div>
        <ObjectMetricGraphDetailDrawer
          canDelete={canDelete}
          canModify={canModify}
          metric={drawerMetric}
          metrics={metrics}
          networkId={networkId}
          onAuthorizeMetric={onAuthorizeMetric}
          onClose={() => setDrawerMetric(undefined)}
          onDeleteVersion={onDeleteVersion}
          onDeprecate={onDeprecate}
          onEditMetric={onEditMetric}
          onOpenMetric={onOpenMetric}
          onTrialMetric={onTrialMetric}
          open={Boolean(drawerMetric)}
          ownerObjectType={null}
          ownerObjectTypeName={
            drawerMetric?.owner_object_type_name || objectMetricText("restrictedOwnerName")
          }
          relationNames={new Map()}
          refreshVersion={refreshVersion}
        />
      </div>
    );
  }

  if (!selectedObjectTypeId) {
    return (
      <Empty
        description={objectMetricText(
          objectTypeSearchEmpty ? "graphNoMatchingObjectTypes" : "m4093b8d5ac81",
        )}
      />
    );
  }

  return (
    <div className={`${styles.shell} ${metricTheme.scope}`}>
      <div
        className={`${styles.explorerToolbar} ${expandedGroup ? styles.metricFocusToolbar : ""}`}
      >
        <div className={styles.graphPanelTitle} title={selectedObjectTypeName}>
          <strong>{selectedObjectTypeName}</strong>
        </div>
        {expandedGroup ? (
          <div className={styles.metricFocusMeta}>
            <Button icon={<ArrowLeftOutlined />} onClick={exitMetricFocus} type="link">
              {objectMetricText("graphBackToRelations")}
            </Button>
            <span>{focusContextName}</span>
            <strong>{objectMetricText("graphMetricCount", { p0: expandedMetrics.length })}</strong>
            <Tooltip title={objectMetricText("mb74829d20f7d")}>
              <Button
                aria-label={objectMetricText("mb74829d20f7d")}
                icon={<AimOutlined />}
                onClick={resetLayout}
                size="small"
              />
            </Tooltip>
          </div>
        ) : (
          <div className={styles.toolbarMeta}>
            <span>
              {objectMetricText("graphObjectOverview", {
                p0: metricError ? "—" : metricCurrent ? metricTotal : "…",
                p1: relationCurrent ? relationTotal : "…",
              })}
            </span>
            <Tooltip title={objectMetricText("graphRelationCountMeaning")}>
              <Button
                aria-label={objectMetricText("graphRelationHelp")}
                icon={<QuestionCircleOutlined />}
                size="small"
                type="text"
              />
            </Tooltip>
            <Tooltip title={objectMetricText("mb74829d20f7d")}>
              <Button
                aria-label={objectMetricText("mb74829d20f7d")}
                icon={<AimOutlined />}
                onClick={resetLayout}
                size="small"
              />
            </Tooltip>
          </div>
        )}
      </div>
      <div className={styles.canvasContent}>
        {relationLoading || !relationCurrent ? (
          <div className={styles.loading} role="status">
            <Spin />
          </div>
        ) : relationError ? (
          <Empty description={objectMetricText("graphLoadError")} />
        ) : (
          <>
            <svg
              aria-label={objectMetricText("m8864ee148733")}
              className={styles.graph}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => {
                nodeDragRef.current = undefined;
                panRef.current = undefined;
              }}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
            >
              <defs>
                <pattern
                  id={`${arrowId}-grid`}
                  width="28"
                  height="28"
                  patternUnits="userSpaceOnUse"
                >
                  <circle className={styles.gridDot} cx="1" cy="1" r="1" />
                </pattern>
                <marker
                  id={`${arrowId}-arrow`}
                  markerWidth="10"
                  markerHeight="10"
                  orient="auto"
                  refX="7"
                  refY="4"
                >
                  <path className={styles.arrow} d="M0,0 L7,4 L0,8 z" />
                </marker>
                <marker
                  id={`${arrowId}-used-arrow`}
                  markerWidth="10"
                  markerHeight="10"
                  orient="auto"
                  refX="7"
                  refY="4"
                >
                  <path className={styles.usedArrow} d="M0,0 L7,4 L0,8 z" />
                </marker>
                <marker
                  id={`${arrowId}-metric-arrow`}
                  markerWidth="10"
                  markerHeight="10"
                  orient="auto"
                  refX="7"
                  refY="4"
                >
                  <path className={styles.metricArrow} d="M0,0 L7,4 L0,8 z" />
                </marker>
              </defs>
              <rect
                fill={`url(#${arrowId}-grid)`}
                height={GRAPH_HEIGHT}
                width={GRAPH_WIDTH}
                x={0}
                y={0}
              />
              {!expandedGroup
                ? neighbors.flatMap((neighbor) =>
                    neighbor.relations.map((relation) => {
                      const geometry = relationGeometries.get(relation.id);
                      if (!geometry) return null;
                      const relatedMetrics = metricsByRelation.get(relation.id) ?? [];
                      const count = countText(
                        relatedMetrics.length,
                        metricReady,
                        metricComplete,
                        metricError,
                      );
                      const hasRelatedMetrics = relatedMetrics.length > 0;
                      const shortName = truncate(relation.name, 11);
                      const badgeText = objectMetricText("graphRelationMetricBadge", { p0: count });
                      const countWidth = Math.max(
                        54,
                        Array.from(badgeText).reduce(
                          (width, char) => width + (char.charCodeAt(0) > 127 ? 12 : 7),
                          16,
                        ),
                      );
                      const nameWidth = Array.from(shortName).reduce(
                        (width, char) => width + (char.charCodeAt(0) > 127 ? 12 : 7),
                        24,
                      );
                      const labelWidth = Math.min(
                        250,
                        Math.max(90, nameWidth + (hasRelatedMetrics ? countWidth + 10 : 0)),
                      );
                      const openRelation = () =>
                        toggleExpanded(
                          { kind: "relation", relationId: relation.id },
                          relatedMetrics.length,
                        );
                      return (
                        <g key={relation.id}>
                          <path
                            className={hasRelatedMetrics ? styles.usedEdge : styles.edge}
                            d={`M ${geometry.from.x} ${geometry.from.y} Q ${geometry.control.x} ${geometry.control.y} ${geometry.to.x} ${geometry.to.y}`}
                            fill="none"
                            markerEnd={`url(#${arrowId}-${hasRelatedMetrics ? "used-arrow" : "arrow"})`}
                            data-graph-action={hasRelatedMetrics ? "true" : undefined}
                            onClick={hasRelatedMetrics ? openRelation : undefined}
                          />
                          <g
                            aria-label={
                              hasRelatedMetrics
                                ? objectMetricText("graphRelationNodeLabel", {
                                    p0: relation.name,
                                    p1: count,
                                  })
                                : objectMetricText("graphRelationNodeEmptyLabel", {
                                    p0: relation.name,
                                  })
                            }
                            className={`${styles.edgeLabel} ${hasRelatedMetrics ? styles.usedEdgeLabel : ""}`}
                            data-graph-action={hasRelatedMetrics ? "true" : undefined}
                            onClick={hasRelatedMetrics ? openRelation : undefined}
                            onKeyDown={
                              hasRelatedMetrics
                                ? (event) => onButtonKeyDown(event, openRelation)
                                : undefined
                            }
                            role={hasRelatedMetrics ? "button" : undefined}
                            tabIndex={hasRelatedMetrics ? 0 : undefined}
                            transform={`translate(${geometry.label.x} ${geometry.label.y})`}
                          >
                            <rect
                              height="26"
                              rx="13"
                              width={labelWidth}
                              x={-labelWidth / 2}
                              y="-13"
                            />
                            <text dy="4" textAnchor="start" x={-labelWidth / 2 + 12}>
                              {shortName}
                            </text>
                            {hasRelatedMetrics ? (
                              <g
                                aria-label={objectMetricText("graphExpandRelationMetrics", {
                                  p0: relation.name,
                                  p1: count,
                                })}
                                className={styles.relationCountAction}
                                data-graph-action="true"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleExpanded(
                                    { kind: "relation", relationId: relation.id },
                                    relatedMetrics.length,
                                  );
                                }}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  onButtonKeyDown(event, () =>
                                    toggleExpanded(
                                      { kind: "relation", relationId: relation.id },
                                      relatedMetrics.length,
                                    ),
                                  );
                                }}
                                role="button"
                                tabIndex={0}
                                transform={`translate(${labelWidth / 2 - countWidth - 5} -10)`}
                              >
                                <rect height="20" rx="10" width={countWidth} />
                                <text dy="14" textAnchor="middle" x={countWidth / 2}>
                                  {badgeText}
                                </text>
                              </g>
                            ) : null}
                            <title>
                              {hasRelatedMetrics
                                ? objectMetricText("graphRelationMetricUsage", {
                                    p0: count,
                                  })
                                : relation.name}
                            </title>
                          </g>
                        </g>
                      );
                    }),
                  )
                : null}
              {expandedGroup
                ? visibleMetrics
                    .filter((metric) => metric.definition.metric_type === "atomic")
                    .map((metric) => {
                      const position = visibleMetricPositions.get(metricNodeKey(metric));
                      if (!position) return null;
                      return (
                        <line
                          className={`${styles.metricSpoke} ${styles.atomicMetricSpoke}`}
                          key={`spoke-${metricNodeKey(metric)}`}
                          x1={ownerPosition.x}
                          x2={position.x}
                          y1={ownerPosition.y}
                          y2={position.y}
                        />
                      );
                    })
                : null}
              {expandedGroup && moreMetricPositions.atomic ? (
                <line
                  className={`${styles.metricSpoke} ${styles.moreMetricSpoke}`}
                  key="more-spoke-atomic"
                  x1={ownerPosition.x}
                  x2={moreMetricPositions.atomic.x}
                  y1={ownerPosition.y}
                  y2={moreMetricPositions.atomic.y}
                />
              ) : null}
              {visibleDependencyEdges.map(({ sourceMetric, targetMetric }) => {
                const sourceKey = metricNodeKey(sourceMetric);
                const targetKey = metricNodeKey(targetMetric);
                const source = visibleMetricPositions.get(sourceKey);
                const target = visibleMetricPositions.get(targetKey);
                if (!source || !target) return null;
                const distance = Math.hypot(target.x - source.x, target.y - source.y) || 1;
                const ux = (target.x - source.x) / distance;
                const uy = (target.y - source.y) / distance;
                const selected = Boolean(
                  selectedMetricKey &&
                  (sourceKey === selectedMetricKey || targetKey === selectedMetricKey),
                );
                return (
                  <path
                    className={`${styles.metricDependencyEdge} ${selected ? styles.metricDependencyEdgeSelected : ""} ${selectedMetricKey && !selected ? styles.metricDependencyEdgeDimmed : ""}`}
                    d={`M ${source.x + ux * 21} ${source.y + uy * 21} L ${target.x - ux * 24} ${target.y - uy * 24}`}
                    fill="none"
                    key={`dependency-${sourceKey}-${targetKey}`}
                    markerEnd={`url(#${arrowId}-metric-arrow)`}
                  >
                    <title>{`${sourceMetric.definition.name} → ${targetMetric.definition.name}`}</title>
                  </path>
                );
              })}
              {!expandedGroup
                ? neighbors.map((neighbor, index) => {
                    const position =
                      nodePositions[neighbor.id] ?? relatedPosition(index, neighbors.length);
                    const metricCount =
                      neighbor.id === selectedObjectTypeId
                        ? metricCurrent
                          ? metricError
                            ? null
                            : metricTotal
                          : undefined
                        : currentNeighborCounts[neighbor.id];
                    const countDisplay =
                      metricCount === undefined
                        ? "…"
                        : metricCount === null
                          ? "—"
                          : metricCount > 999
                            ? "999+"
                            : String(metricCount);
                    const countDescription =
                      metricCount === undefined
                        ? objectMetricText("graphRelatedObjectMetricLoading")
                        : metricCount === null
                          ? objectMetricText("graphRelatedObjectMetricError")
                          : objectMetricText("graphRelatedObjectMetricCount", { p0: metricCount });
                    return (
                      <g
                        aria-label={neighbor.name}
                        aria-description={countDescription}
                        className={styles.relatedNode}
                        data-graph-action="true"
                        key={neighbor.id}
                        onClick={() =>
                          activateNode(neighbor.id, () =>
                            onSelectObject(neighbor.id, neighbor.name),
                          )
                        }
                        onKeyDown={(event) =>
                          onButtonKeyDown(event, () => onSelectObject(neighbor.id, neighbor.name))
                        }
                        onPointerDown={(event) => onNodePointerDown(event, neighbor.id, position)}
                        role="button"
                        tabIndex={0}
                        transform={`translate(${position.x} ${position.y})`}
                      >
                        <circle r="18" />
                        <text className={styles.relatedCount} dy="4" textAnchor="middle">
                          {countDisplay}
                        </text>
                        <text textAnchor="middle" y="38">
                          {truncate(neighbor.name, 12)}
                        </text>
                        <title>{`${neighbor.name} · ${countDescription}`}</title>
                      </g>
                    );
                  })
                : null}
              <g
                aria-label={objectMetricText("graphOwnerNodeLabel", {
                  p0: selectedObjectTypeName,
                  p1: metricError ? "—" : metricCurrent ? ownerDisplayCount : "…",
                })}
                className={`${styles.ownerNode} ${expandedGroup ? styles.focusOwnerNode : ""}`}
                data-graph-action="true"
                onClick={() =>
                  activateNode(ownerNodeKey, () =>
                    toggleExpanded({ kind: "owner" }, metrics.length),
                  )
                }
                onKeyDown={(event) =>
                  onButtonKeyDown(event, () => toggleExpanded({ kind: "owner" }, metrics.length))
                }
                onPointerDown={(event) => onNodePointerDown(event, ownerNodeKey, ownerPosition)}
                role="button"
                tabIndex={0}
                transform={`translate(${ownerPosition.x} ${ownerPosition.y})`}
              >
                <circle r="23" />
                <text
                  aria-disabled={!metricReady || metrics.length === 0}
                  aria-label={objectMetricText("graphExpandOwnerMetrics", {
                    p0: selectedObjectTypeName,
                    p1: metricError ? "—" : metricCurrent ? ownerDisplayCount : "…",
                  })}
                  className={`${styles.ownerCount} ${expandedGroup?.kind === "owner" ? styles.expandedOwnerCount : ""}`}
                  dy="5"
                  onClick={(event) => {
                    event.stopPropagation();
                    activateNode(ownerNodeKey, () =>
                      toggleExpanded({ kind: "owner" }, metrics.length),
                    );
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    onButtonKeyDown(event, () => toggleExpanded({ kind: "owner" }, metrics.length));
                  }}
                  role="button"
                  tabIndex={0}
                  textAnchor="middle"
                >
                  {metricError ? "—" : metricCurrent ? ownerDisplayCount : "…"}
                </text>
                <text className={styles.ownerName} textAnchor="middle" y="42">
                  {truncate(selectedObjectTypeName, 12)}
                </text>
                <title>{selectedObjectTypeName}</title>
              </g>
              {visibleMetrics.map((metric) => {
                const key = metricNodeKey(metric);
                const position = visibleMetricPositions.get(key);
                if (!position) return null;
                const dimmed = Boolean(selectedMetricKey && !selectedConnectedKeys.has(key));
                return (
                  <Tooltip
                    key={key}
                    mouseEnterDelay={0.12}
                    placement="top"
                    title={metric.definition.name}
                    trigger={["hover", "focus"]}
                  >
                    <g
                      aria-label={objectMetricText("graphMetricNodeLabel", {
                        p0: metricTypeNames[metric.definition.metric_type],
                        p1: metric.definition.name,
                      })}
                      className={`${styles.metricNode} ${
                        metric.definition.metric_type === "atomic"
                          ? styles.metricNodeAtomic
                          : metric.definition.metric_type === "derived"
                            ? styles.metricNodeDerived
                            : styles.metricNodeComposite
                      } ${key === selectedMetricKey ? styles.metricNodeSelected : ""} ${dimmed ? styles.metricNodeDimmed : ""}`}
                      data-graph-action="true"
                      onClick={() =>
                        activateNode(key, () => {
                          setDrawerMetric(metric);
                        })
                      }
                      onKeyDown={(event) =>
                        onButtonKeyDown(event, () => {
                          setDrawerMetric(metric);
                        })
                      }
                      onPointerDown={(event) => onNodePointerDown(event, key, position)}
                      role="button"
                      tabIndex={0}
                      transform={`translate(${position.x} ${position.y})`}
                    >
                      <circle className={styles.metricNodeBody} r="17" />
                      <text textAnchor="middle" y="36">
                        {truncate(metric.definition.name, 11)}
                      </text>
                    </g>
                  </Tooltip>
                );
              })}
              {(["atomic", "derived", "composite"] as const).map((type) => {
                const position = moreMetricPositions[type];
                const hidden = hiddenMetricCounts[type];
                if (!position || hidden === 0) return null;
                const key = moreMetricNodeKey(type);
                const label = objectMetricText("graphExpandMoreMetricsOfType", {
                  p0: metricTypeNames[type],
                  p1: hidden,
                });
                const expandRing = () =>
                  setRingVisibleCounts((current) => ({
                    ...current,
                    [type]: Math.min(
                      metricsByType[type].length,
                      current[type] + EXPANDED_METRIC_BATCH_SIZE,
                    ),
                  }));
                return (
                  <g
                    aria-label={label}
                    className={`${styles.moreMetricsNode} ${
                      type === "atomic"
                        ? styles.moreAtomicMetrics
                        : type === "derived"
                          ? styles.moreDerivedMetrics
                          : styles.moreCompositeMetrics
                    }`}
                    data-graph-action="true"
                    key={key}
                    onClick={() => activateNode(key, expandRing)}
                    onKeyDown={(event) => onButtonKeyDown(event, expandRing)}
                    onPointerDown={(event) => onNodePointerDown(event, key, position)}
                    role="button"
                    tabIndex={0}
                    transform={`translate(${position.x} ${position.y})`}
                  >
                    <circle r="18" />
                    <text dy="5" textAnchor="middle">
                      +{hidden}
                    </text>
                    <title>{label}</title>
                  </g>
                );
              })}
            </svg>
            {expandedGroup ? (
              <div
                className={styles.metricLegend}
                aria-label={objectMetricText("graphMetricLegend")}
              >
                <span className={styles.atomicLegend}>{metricTypeNames.atomic}</span>
                <span className={styles.derivedLegend}>{metricTypeNames.derived}</span>
                <span className={styles.compositeLegend}>{metricTypeNames.composite}</span>
                <span className={styles.dependencyLegend}>
                  {objectMetricText("graphMetricDependencyLegend")}
                </span>
              </div>
            ) : null}
            {!expandedGroup && relations.length === 0 ? (
              <div className={styles.emptyRelations}>{objectMetricText("graphNoRelations")}</div>
            ) : null}
            <div className={styles.zoomControls}>
              <Button
                aria-label={objectMetricText("graphZoomIn")}
                icon={<ZoomInOutlined />}
                onClick={() => zoomBy(1.25)}
                size="small"
              />
              <Button
                aria-label={objectMetricText("graphZoomOut")}
                icon={<ZoomOutOutlined />}
                onClick={() => zoomBy(0.8)}
                size="small"
              />
              <Button
                aria-label={objectMetricText("graphFitView")}
                icon={<AimOutlined />}
                onClick={() => setView(INITIAL_VIEW)}
                size="small"
              />
            </div>
          </>
        )}
      </div>
      {!metricLoading && metricCurrent && !metricComplete && !metricError ? (
        <div className={styles.notice}>
          {objectMetricText("graphPartialMetricNotice", { p0: MAX_GRAPH_METRICS, p1: metricTotal })}
          {onSwitchList ? (
            <Button onClick={onSwitchList} size="small" type="link">
              {objectMetricText("graphOpenList")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {metricError ? (
        <div className={styles.notice}>{objectMetricText("graphMetricLoadError")}</div>
      ) : null}
      {!expandedGroup ? (
        <div className={styles.canvasFooter}>
          <span>{pageSummary(relationPage, relationCurrent ? relationTotal : 0)}</span>
          <Pagination
            current={relationPage}
            onChange={setRelationPage}
            pageSize={RELATION_PAGE_SIZE}
            showSizeChanger={false}
            simple
            size="small"
            total={relationCurrent ? relationTotal : 0}
          />
        </div>
      ) : null}
      <ObjectMetricGraphDetailDrawer
        canDelete={canDelete}
        canModify={canModify}
        metric={drawerMetric}
        metrics={metrics}
        networkId={networkId}
        onAuthorizeMetric={onAuthorizeMetric}
        onClose={() => setDrawerMetric(undefined)}
        onDeleteVersion={onDeleteVersion}
        onDeprecate={onDeprecate}
        onEditMetric={onEditMetric}
        onOpenMetric={onOpenMetric}
        onTrialMetric={onTrialMetric}
        open={Boolean(drawerMetric)}
        ownerObjectType={ownerObjectType}
        ownerObjectTypeName={selectedObjectTypeName}
        relationNames={relationNames}
        refreshVersion={refreshVersion}
      />
    </div>
  );
}
