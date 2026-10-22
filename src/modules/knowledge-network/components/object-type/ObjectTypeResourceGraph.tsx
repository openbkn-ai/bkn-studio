/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AimOutlined, ZoomInOutlined, ZoomOutOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Segmented,
  Spin,
  Tooltip,
  Typography,
} from "antd";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { ObjectMetricGraphDetailDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricGraphDetailDrawer";
import { KnowledgeNetworkAuthorizationActionLabel } from "@/modules/knowledge-network/components/shared/KnowledgeNetworkAuthorizationActionLabel";
import { ResourcePermissionRequestAction } from "@/modules/knowledge-network/components/shared/ResourcePermissionRequestAction";
import { canRequestResourcePermission } from "@/modules/knowledge-network/components/shared/resource-permission-request";
import {
  directObjectMetricReferences,
  objectMetricVersionKey,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import type { KnowledgeNetworkGraphSelection } from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import {
  needsActionTypeActionSourceDisplayResolution,
  resolveActionTypeActionSourceDisplayWithTimeout,
} from "@/modules/knowledge-network/services/action-type-tool.service";
import {
  getKnowledgeNetworkActionTypeDetail,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkActionTypePage,
  listKnowledgeNetworkRelationTypePage,
  listObjectMetricsV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  ActionTypeActionSource,
  ActionTypeCondition,
  ActionTypeDetail,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";
import { getReadableActionSourceDisplayName } from "@/modules/knowledge-network/utils/action-type-execution";
import { hasKnowledgeNetworkRecordOperation } from "@/modules/knowledge-network/utils/record-operations";

import styles from "./ObjectTypeResourceGraph.module.css";

type GraphSection = "all" | "relations" | "metrics" | "actions";
type ResourceScope = "all" | "relations" | "actions";
type ExpandableGroup = "metrics" | "actions";
type Point = { x: number; y: number };
type ViewBox = { height: number; width: number; x: number; y: number };
type GraphError = {
  key: Exclude<GraphSection, "all"> | `action:${string}`;
  message: string;
};
type GraphNeighbor = {
  id: string;
  name: string;
  relations: KnowledgeNetworkRelationTypeRecord[];
};
type ActionSemanticPresentation = {
  action: KnowledgeNetworkActionTypeRecord;
  affectDescription?: string;
  affectedObjectLabel?: string;
  condition?: ActionTypeCondition;
  propertyLabels: Map<string, string>;
  sourceName?: string;
  sourceType: ActionTypeDetail["executionConfig"]["sourceType"];
};
type ActionSemanticLoadResult =
  | { presentation: ActionSemanticPresentation }
  | { action: KnowledgeNetworkActionTypeRecord; error: unknown };
export type ObjectTypeGraphSelectedResource =
  | { kind: "relation"; value: KnowledgeNetworkRelationTypeRecord }
  | { kind: "metric"; value: ObjectMetricRecordV1 }
  | { kind: "action"; value: KnowledgeNetworkActionTypeRecord }
  | {
      description: string;
      id: string;
      kind: "object";
      name: string;
      value?: KnowledgeNetworkObjectTypeRecord;
    };

type Props = {
  allowAuthorizeObject?: boolean;
  allowDeleteObject?: boolean;
  allowDeleteRelation?: boolean;
  allowEditObject?: boolean;
  canAuthorizeObject: boolean;
  canModify: boolean;
  canRequestObjectPermission: boolean;
  initialSelectedResource?: KnowledgeNetworkGraphSelection;
  metricsAvailable: boolean;
  networkId: string;
  networkName: string;
  objectType: KnowledgeNetworkObjectTypeRecord;
  objectTypeColors?: Record<string, string | undefined>;
  onEditObject: (objectTypeId: string) => void;
  onEditAction?: (action: KnowledgeNetworkActionTypeRecord) => void;
  onAuthorizeAction?: (action: KnowledgeNetworkActionTypeRecord) => void;
  onAuthorizeObject: (objectType: KnowledgeNetworkObjectTypeRecord) => void;
  onAuthorizeRelation?: (relation: KnowledgeNetworkRelationTypeRecord) => void;
  onDeleteAction?: (action: KnowledgeNetworkActionTypeRecord) => void;
  onDeleteObject: (objectType: KnowledgeNetworkObjectTypeRecord) => void;
  onDeleteRelation?: (relation: KnowledgeNetworkRelationTypeRecord) => void;
  onExecuteAction: (action: KnowledgeNetworkActionTypeRecord) => void;
  onOpenAction: (action: KnowledgeNetworkActionTypeRecord) => void;
  onOpenMetric: (metric: ObjectMetricRecordV1) => void;
  onOpenObject: (objectTypeId: string) => void;
  onOpenRelation: (relation: KnowledgeNetworkRelationTypeRecord) => void;
  onOpenRelationMapping?: (relation: KnowledgeNetworkRelationTypeRecord) => void;
  onSelectObject: (objectTypeId: string) => void;
  onSelectedResourceChange?: (resource?: ObjectTypeGraphSelectedResource) => void;
  onTrialMetric: (metric: ObjectMetricRecordV1) => void;
  permissionRequestsEnabled?: boolean;
  refreshVersion: number;
  resourceScope?: ResourceScope;
};

const GRAPH_WIDTH = 1120;
const GRAPH_HEIGHT = 620;
const INITIAL_VIEW: ViewBox = { height: GRAPH_HEIGHT, width: GRAPH_WIDTH, x: 0, y: 0 };
const CENTER: Point = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 };
const PAGE_SIZE = 12;
const OVERVIEW_LIMIT = 4;
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 2.5;
const ACTION_FOCUS_TRIGGER_WIDTH = 140;
const ACTION_FOCUS_SOURCE_WIDTH = 120;
const ACTION_FOCUS_IMPACT_WIDTH = 150;

function objectNodeColor(objectTypeId: string, configuredColor?: string) {
  if (configuredColor) return configuredColor;
  let hash = 0;
  for (const character of objectTypeId) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return `hsl(${Math.round((hash * 137.508) % 360)} 68% 48%)`;
}

function truncate(value: string, max = 14) {
  const chars = Array.from(value);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : value;
}

function spreadAngles(count: number, start: number, end: number) {
  if (count <= 1) return [(start + end) / 2];
  return Array.from({ length: count }, (_, index) => start + ((end - start) * index) / (count - 1));
}

function polar(angle: number, radiusX: number, radiusY: number, center = CENTER): Point {
  return {
    x: center.x + Math.cos(angle) * radiusX,
    y: center.y + Math.sin(angle) * radiusY,
  };
}

function overviewGroupPosition(group: ExpandableGroup, expandedGroup: ExpandableGroup | null) {
  if (!expandedGroup) return group === "metrics" ? { x: 760, y: 210 } : { x: 760, y: 410 };
  if (group === expandedGroup) return { x: 700, y: CENTER.y };
  return group === "metrics" ? { x: 700, y: 72 } : { x: 700, y: GRAPH_HEIGHT - 72 };
}

function layoutActionItems(actions: KnowledgeNetworkActionTypeRecord[], sourcePosition: Point) {
  const positions = new Map<string, Point>();
  const orderedActions = [...actions].sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
  const rowGap = Math.min(84, (GRAPH_HEIGHT - 120) / Math.max(1, orderedActions.length - 1));
  orderedActions.forEach((action, index) => {
    positions.set(`action:${action.id}`, {
      x: Math.min(sourcePosition.x + 220, GRAPH_WIDTH - 100),
      y: CENTER.y + (index - (orderedActions.length - 1) / 2) * rowGap,
    });
  });
  return positions;
}

function trimmedLine(from: Point, to: Point, fromInset: number, toInset: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const unitX = dx / length;
  const unitY = dy / length;
  return {
    from: { x: from.x + unitX * fromInset, y: from.y + unitY * fromInset },
    to: { x: to.x - unitX * toInset, y: to.y - unitY * toInset },
  };
}

function relationGeometry(
  center: Point,
  neighbor: Point,
  outgoing: boolean,
  parallelOffset: number,
) {
  const dx = neighbor.x - center.x;
  const dy = neighbor.y - center.y;
  const distance = Math.hypot(dx, dy) || 1;
  const unitX = dx / distance;
  const unitY = dy / distance;
  const nearCenter = { x: center.x + unitX * 32, y: center.y + unitY * 32 };
  const nearNeighbor = { x: neighbor.x - unitX * 24, y: neighbor.y - unitY * 24 };
  const from = outgoing ? nearCenter : nearNeighbor;
  const to = outgoing ? nearNeighbor : nearCenter;
  const control = {
    x: (from.x + to.x) / 2 - unitY * parallelOffset,
    y: (from.y + to.y) / 2 + unitX * parallelOffset,
  };
  return {
    control,
    from,
    label: {
      x: (from.x + to.x + control.x * 2) / 4,
      y: (from.y + to.y + control.y * 2) / 4,
    },
    to,
  };
}

function metricNodeKey(metric: ObjectMetricRecordV1) {
  return `metric:${metric.definition.id}:${metric.definition.version}`;
}

function directLoadedMetricReferences(metric: ObjectMetricRecordV1) {
  return metric.definition.specification ? directObjectMetricReferences(metric) : [];
}

const metricTypeOrder: Record<ObjectMetricRecordV1["definition"]["metric_type"], number> = {
  atomic: 0,
  derived: 1,
  composite: 2,
};

function layoutMetrics(metrics: ObjectMetricRecordV1[], sourcePosition: Point) {
  const positions = new Map<string, Point>();
  const metricsByVersion = new Map(
    metrics.map((metric) => [
      objectMetricVersionKey(metric.definition.id, metric.definition.version),
      metric,
    ]),
  );
  const metricsById = new Map(metrics.map((metric) => [metric.definition.id, metric]));
  const depths = new Map<string, number>();
  const depthFor = (metric: ObjectMetricRecordV1, visiting = new Set<string>()): number => {
    const key = metricNodeKey(metric);
    const known = depths.get(key);
    if (known) return known;
    if (visiting.has(key)) return 1;
    visiting.add(key);
    const parentDepths = directLoadedMetricReferences(metric)
      .map(
        (reference) =>
          metricsByVersion.get(objectMetricVersionKey(reference.metric_id, reference.version)) ??
          metricsById.get(reference.metric_id),
      )
      .filter((parent): parent is ObjectMetricRecordV1 => Boolean(parent))
      .map((parent) => depthFor(parent, visiting));
    visiting.delete(key);
    const depth = parentDepths.length ? Math.max(...parentDepths) + 1 : 1;
    depths.set(key, depth);
    return depth;
  };

  const columns = new Map<number, ObjectMetricRecordV1[]>();
  const orderedMetrics = [...metrics].sort(
    (left, right) =>
      metricTypeOrder[left.definition.metric_type] -
        metricTypeOrder[right.definition.metric_type] ||
      left.definition.name.localeCompare(right.definition.name) ||
      left.definition.id.localeCompare(right.definition.id),
  );
  const metricOrder = new Map(
    orderedMetrics.map((metric, index) => [metricNodeKey(metric), index]),
  );
  orderedMetrics.forEach((metric) => {
    const depth = depthFor(metric);
    columns.set(depth, [...(columns.get(depth) ?? []), metric]);
  });
  const sortedDepths = [...columns.keys()].sort((left, right) => left - right);
  const columnGap = Math.min(
    220,
    (GRAPH_WIDTH - sourcePosition.x - 100) / Math.max(1, sortedDepths.length),
  );
  sortedDepths.forEach((depth, columnIndex) => {
    const parentY = (metric: ObjectMetricRecordV1) => {
      const parentPositions = directLoadedMetricReferences(metric)
        .map(
          (reference) =>
            metricsByVersion.get(objectMetricVersionKey(reference.metric_id, reference.version)) ??
            metricsById.get(reference.metric_id),
        )
        .map((parent) => parent && positions.get(metricNodeKey(parent)))
        .filter((position): position is Point => Boolean(position));
      return parentPositions.length
        ? parentPositions.reduce((total, position) => total + position.y, 0) /
            parentPositions.length
        : undefined;
    };
    const items = [...(columns.get(depth) ?? [])].sort((left, right) => {
      const leftParentY = parentY(left);
      const rightParentY = parentY(right);
      if (leftParentY !== undefined && rightParentY !== undefined && leftParentY !== rightParentY)
        return leftParentY - rightParentY;
      if (leftParentY !== undefined && rightParentY === undefined) return -1;
      if (rightParentY !== undefined && leftParentY === undefined) return 1;
      return (
        (metricOrder.get(metricNodeKey(left)) ?? 0) - (metricOrder.get(metricNodeKey(right)) ?? 0)
      );
    });
    const rowGap = Math.min(84, (GRAPH_HEIGHT - 120) / Math.max(1, items.length - 1));
    items.forEach((metric, rowIndex) => {
      positions.set(metricNodeKey(metric), {
        x: sourcePosition.x + columnGap * (columnIndex + 1),
        y: GRAPH_HEIGHT / 2 + (rowIndex - (items.length - 1) / 2) * rowGap,
      });
    });
  });
  return positions;
}

function metricTypeLabel(
  type: ObjectMetricRecordV1["definition"]["metric_type"],
  t: (key: string) => string,
) {
  if (type === "atomic") return t("knowledgeNetwork.objectTypeGraphMetricAtomic");
  if (type === "derived") return t("knowledgeNetwork.objectTypeGraphMetricDerived");
  return t("knowledgeNetwork.objectTypeGraphMetricComposite");
}

function actionTypeLabel(
  type: KnowledgeNetworkActionTypeRecord["actionKind"],
  t: (key: string) => string,
) {
  if (type === "create") return t("knowledgeNetwork.actionTypeKindCreate");
  if (type === "update") return t("knowledgeNetwork.actionTypeKindUpdate");
  if (type === "delete") return t("knowledgeNetwork.actionTypeKindDelete");
  return t("knowledgeNetwork.actionTypeKindNotify");
}

function actionConditionLabel(
  condition: ActionTypeCondition | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
  propertyLabels: Map<string, string>,
): string {
  if (!condition) return t("knowledgeNetwork.actionTypeEmptyValue");
  if (condition.subConditions?.length) {
    const separator = ` ${t(
      condition.operation === "or"
        ? "knowledgeNetwork.actionTypeConditionGroupOr"
        : "knowledgeNetwork.actionTypeConditionGroupAnd",
    )} `;
    return condition.subConditions
      .map((item) => actionConditionLabel(item, t, propertyLabels))
      .filter(Boolean)
      .join(separator);
  }
  if (!condition.field || !condition.operation) {
    return t("knowledgeNetwork.actionTypeEmptyValue");
  }
  const operation = t(`knowledgeNetwork.actionTypeConditionOperation_${condition.operation}`);
  const field = propertyLabels.get(condition.field);
  if (!field) return t("knowledgeNetwork.actionTypeEmptyValue");
  if (condition.operation === "exist" || condition.operation === "not_exist") {
    return `${field} ${operation}`;
  }
  const value = Array.isArray(condition.value)
    ? condition.value.join(", ")
    : condition.value === undefined
      ? ""
      : String(condition.value);
  return value ? `${field} ${operation} ${value}` : `${field} ${operation}`;
}

function actionSourceTypeLabel(
  sourceType: ActionTypeDetail["executionConfig"]["sourceType"],
  t: (key: string) => string,
) {
  if (sourceType === "tool") return t("knowledgeNetwork.actionTypeExecutionSourceTool");
  if (sourceType === "mcp") return "MCP";
  return t("knowledgeNetwork.actionTypeExecutionSourceManual");
}

function DrawerEllipsis({ value }: { value: string }) {
  return (
    <span className={styles.drawerEllipsis} title={value}>
      {value}
    </span>
  );
}

export function ObjectTypeResourceGraph({
  allowAuthorizeObject = true,
  allowDeleteObject = true,
  allowDeleteRelation = false,
  allowEditObject = true,
  canAuthorizeObject,
  canModify,
  canRequestObjectPermission,
  initialSelectedResource,
  metricsAvailable,
  networkId,
  networkName,
  objectType,
  objectTypeColors = {},
  onEditAction,
  onEditObject,
  onAuthorizeAction,
  onAuthorizeObject,
  onAuthorizeRelation,
  onDeleteAction,
  onDeleteObject,
  onDeleteRelation,
  onExecuteAction,
  onOpenAction,
  onOpenMetric,
  onOpenObject,
  onOpenRelation,
  onOpenRelationMapping,
  onSelectObject,
  onSelectedResourceChange,
  onTrialMetric,
  permissionRequestsEnabled = false,
  refreshVersion,
  resourceScope = "all",
}: Props) {
  const { t } = useTranslation();
  const graphId = useId().replaceAll(":", "");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { key: string; lastX: number; lastY: number; moved: boolean; type: "node" }
    | { lastX: number; lastY: number; moved: boolean; type: "canvas" }
    | null
  >(null);
  const suppressClickRef = useRef(false);
  const restoredSelectionKeyRef = useRef("");
  const [section, setSection] = useState<GraphSection>(
    resourceScope === "all" ? "all" : resourceScope,
  );
  const [expandedGroup, setExpandedGroup] = useState<ExpandableGroup | null>(null);
  const [relations, setRelations] = useState<KnowledgeNetworkRelationTypeRecord[]>([]);
  const [metrics, setMetrics] = useState<ObjectMetricRecordV1[]>([]);
  const [actions, setActions] = useState<KnowledgeNetworkActionTypeRecord[]>([]);
  const [totals, setTotals] = useState({ actions: 0, metrics: 0, relations: 0 });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<GraphError[]>([]);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selected, setSelected] = useState<ObjectTypeGraphSelectedResource>();
  const [focusedAction, setFocusedAction] = useState<KnowledgeNetworkActionTypeRecord>();
  const [expandedActions, setExpandedActions] = useState<KnowledgeNetworkActionTypeRecord[]>([]);
  const [actionPresentations, setActionPresentations] = useState<
    Record<string, ActionSemanticPresentation>
  >({});
  const [selectedActionDetail, setSelectedActionDetail] = useState<ActionTypeDetail | null>();
  const [selectedActionObjectType, setSelectedActionObjectType] = useState<
    ObjectTypeDetail | null | undefined
  >();
  const [selectedActionAffectedObjectName, setSelectedActionAffectedObjectName] = useState<
    string | null | undefined
  >();
  const [resolvedActionSource, setResolvedActionSource] = useState<
    ActionTypeActionSource | undefined
  >();
  const [selectedActionLoading, setSelectedActionLoading] = useState(false);
  const [metricOwnerObjectType, setMetricOwnerObjectType] = useState<
    ObjectTypeDetail | null | undefined
  >();
  const [view, setView] = useState<ViewBox>(INITIAL_VIEW);
  const [nodePositions, setNodePositions] = useState<Record<string, Point>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrors([]);
    setRelations([]);
    setMetrics([]);
    setActions([]);
    setTotals({ actions: 0, metrics: 0, relations: 0 });
    setSelected(undefined);
    setFocusedAction(undefined);
    setExpandedActions([]);
    setActionPresentations({});
    setNodePositions({});
    setView(INITIAL_VIEW);
    setExpandedGroup(null);

    const reportError = (key: GraphError["key"], error: unknown) => {
      if (!active) return;
      setErrors((current) => [
        ...current.filter((entry) => entry.key !== key),
        { key, message: extractRequestErrorMessage(error) },
      ]);
    };

    const relationRequest =
      resourceScope === "actions"
        ? Promise.resolve()
        : listKnowledgeNetworkRelationTypePage(networkId, {
            boundObjectTypeId: objectType.id,
            direction: "asc",
            limit: PAGE_SIZE,
            offset: 0,
            sort: "name",
          })
            .then((result) => {
              if (!active) return;
              setRelations(result.entries);
              setTotals((current) => ({ ...current, relations: result.totalCount }));
            })
            .catch((error: unknown) => {
              if (!active) return;
              setRelations([]);
              setTotals((current) => ({ ...current, relations: 0 }));
              reportError("relations", error);
            });

    const actionRequest =
      resourceScope === "relations"
        ? Promise.resolve()
        : listKnowledgeNetworkActionTypePage(networkId, {
            direction: "asc",
            limit: PAGE_SIZE,
            objectTypeId: objectType.id,
            offset: 0,
            sort: "name",
          })
            .then((result) => {
              if (!active) return;
              setActions(result.entries);
              setTotals((current) => ({ ...current, actions: result.totalCount }));
            })
            .catch((error: unknown) => {
              if (!active) return;
              setActions([]);
              setTotals((current) => ({ ...current, actions: 0 }));
              reportError("actions", error);
            });

    const metricRequest =
      metricsAvailable && resourceScope === "all"
        ? listObjectMetricsV1(
            networkId,
            { limit: PAGE_SIZE, offset: 0, ownerObjectTypeId: objectType.id },
            { skipErrorToast: true },
          )
            .then((result) => {
              if (!active) return;
              setMetrics(result.entries);
              setTotals((current) => ({ ...current, metrics: result.total_count }));
            })
            .catch((error: unknown) => {
              if (!active) return;
              setMetrics([]);
              setTotals((current) => ({ ...current, metrics: 0 }));
              reportError("metrics", error);
            })
        : Promise.resolve().then(() => {
            if (!active) return;
            setMetrics([]);
            setTotals((current) => ({ ...current, metrics: 0 }));
          });

    void Promise.allSettled([relationRequest, metricRequest, actionRequest]).then(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [metricsAvailable, networkId, objectType.id, refreshVersion, reloadVersion, resourceScope]);

  useEffect(() => {
    if (resourceScope !== "all" && section !== resourceScope) {
      setSection(resourceScope);
      setNodePositions({});
      setView(INITIAL_VIEW);
    }
  }, [resourceScope, section]);

  useEffect(() => {
    if (loading) return;
    if (initialSelectedResource) {
      const restoreKey = `${objectType.id}:${initialSelectedResource.kind}:${initialSelectedResource.id}:${initialSelectedResource.version ?? ""}`;
      if (restoredSelectionKeyRef.current !== restoreKey) return;
    }
    onSelectedResourceChange?.(selected);
  }, [initialSelectedResource, loading, objectType.id, onSelectedResourceChange, selected]);

  const selectedMetric = selected?.kind === "metric" ? selected.value : undefined;
  useEffect(() => {
    if (!selectedMetric) {
      setMetricOwnerObjectType(undefined);
      return;
    }
    let active = true;
    setMetricOwnerObjectType(undefined);
    void getKnowledgeNetworkObjectTypeDetail(
      networkId,
      selectedMetric.definition.owner_object_type_id,
    )
      .then((detail) => {
        if (active) setMetricOwnerObjectType(detail ?? null);
      })
      .catch(() => {
        if (active) setMetricOwnerObjectType(null);
      });
    return () => {
      active = false;
    };
  }, [networkId, refreshVersion, selectedMetric]);

  const selectedAction = selected?.kind === "action" ? selected.value : undefined;
  useEffect(() => {
    if (!selectedAction) {
      setSelectedActionDetail(undefined);
      setSelectedActionObjectType(undefined);
      setSelectedActionAffectedObjectName(undefined);
      setSelectedActionLoading(false);
      return;
    }
    let active = true;
    setSelectedActionDetail(undefined);
    setSelectedActionObjectType(undefined);
    setSelectedActionAffectedObjectName(undefined);
    setSelectedActionLoading(true);
    void (async () => {
      try {
        const detail = await getKnowledgeNetworkActionTypeDetail(networkId, selectedAction.id);
        if (!active) return;
        setSelectedActionDetail(detail);
        const conditionObjectTypeId =
          detail?.condition?.objectTypeId || detail?.objectTypeId || selectedAction.objectTypeId;
        const affectedObjectTypeId = detail?.affect?.objectTypeId;
        const [conditionObjectType, affectedObjectType] = await Promise.all([
          getKnowledgeNetworkObjectTypeDetail(networkId, conditionObjectTypeId).catch(() => null),
          !affectedObjectTypeId || affectedObjectTypeId === objectType.id
            ? Promise.resolve(null)
            : getKnowledgeNetworkObjectTypeDetail(networkId, affectedObjectTypeId).catch(
                () => null,
              ),
        ]);
        if (!active) return;
        setSelectedActionObjectType(conditionObjectType ?? null);
        setSelectedActionAffectedObjectName(
          !affectedObjectTypeId
            ? null
            : affectedObjectTypeId === objectType.id
              ? objectType.name
              : (affectedObjectType?.name ?? null),
        );
      } catch {
        if (active) {
          setSelectedActionDetail(null);
          setSelectedActionObjectType(null);
          setSelectedActionAffectedObjectName(null);
        }
      } finally {
        if (active) setSelectedActionLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [networkId, objectType.id, objectType.name, refreshVersion, selectedAction]);

  useEffect(() => {
    const actionSource = selectedActionDetail?.executionConfig.actionSource;
    setResolvedActionSource(actionSource);
    if (!needsActionTypeActionSourceDisplayResolution(actionSource)) return;
    let active = true;
    void resolveActionTypeActionSourceDisplayWithTimeout(actionSource!)
      .then((resolved) => {
        if (active) setResolvedActionSource(resolved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selectedActionDetail]);

  useEffect(() => {
    if (!metricsAvailable && section === "metrics") setSection("all");
  }, [metricsAvailable, section]);

  const relationItems = useMemo(
    () => (section === "all" ? relations.slice(0, OVERVIEW_LIMIT) : relations),
    [relations, section],
  );
  const metricItems = useMemo(
    () => (section === "all" ? (expandedGroup === "metrics" ? metrics : []) : metrics),
    [expandedGroup, metrics, section],
  );
  const actionItems = useMemo(
    () => (section === "all" ? (expandedGroup === "actions" ? actions : []) : actions),
    [actions, expandedGroup, section],
  );
  const relationGroups = useMemo(() => {
    const groups = new Map<string, GraphNeighbor>();
    relationItems.forEach((relation) => {
      const outgoing = relation.sourceObjectTypeId === objectType.id;
      const id = outgoing ? relation.targetObjectTypeId : relation.sourceObjectTypeId;
      const name = outgoing ? relation.targetObjectTypeName : relation.sourceObjectTypeName;
      const group = groups.get(id) ?? { id, name, relations: [] };
      group.relations.push(relation);
      groups.set(id, group);
    });
    return [...groups.values()];
  }, [objectType.id, relationItems]);
  const relationNames = useMemo(
    () => new Map(relations.map((relation) => [relation.id, relation.name])),
    [relations],
  );

  useEffect(() => {
    if (loading || !initialSelectedResource) return;
    const restoreKey = `${objectType.id}:${initialSelectedResource.kind}:${initialSelectedResource.id}:${initialSelectedResource.version ?? ""}`;
    if (restoredSelectionKeyRef.current === restoreKey) return;
    restoredSelectionKeyRef.current = restoreKey;

    if (initialSelectedResource.kind === "object") {
      if (initialSelectedResource.id === objectType.id) {
        setSelected({
          description: objectType.description,
          id: objectType.id,
          kind: "object",
          name: objectType.name,
          value: objectType,
        });
      }
      return;
    }
    if (initialSelectedResource.kind === "relation") {
      const relation = relations.find((item) => item.id === initialSelectedResource.id);
      if (relation) setSelected({ kind: "relation", value: relation });
      return;
    }
    if (initialSelectedResource.kind === "action") {
      const action = actions.find((item) => item.id === initialSelectedResource.id);
      if (action) {
        if (section === "all") setExpandedGroup("actions");
        if (section === "actions") {
          setExpandedActions([action]);
          setFocusedAction(action);
        }
        setSelected({ kind: "action", value: action });
      }
      return;
    }
    const metric = metrics.find(
      (item) =>
        item.definition.id === initialSelectedResource.id &&
        (!initialSelectedResource.version ||
          item.definition.version === initialSelectedResource.version),
    );
    if (metric) {
      if (section === "all") setExpandedGroup("metrics");
      setSelected({ kind: "metric", value: metric });
    }
  }, [actions, initialSelectedResource, loading, metrics, objectType, relations, section]);
  const showRelations = section === "all" || section === "relations";
  const showMetrics = metricsAvailable && (section === "all" || section === "metrics");
  const showActions = section === "all" || section === "actions";
  const showMetricGroup = section === "all" && metricsAvailable && totals.metrics > 0;
  const showActionGroup = section === "all" && totals.actions > 0;
  const showMetricItems = showMetrics && (section !== "all" || expandedGroup === "metrics");
  const showActionItems = showActions && (section !== "all" || expandedGroup === "actions");
  const visibleMetricTypes = new Set(metricItems.map((metric) => metric.definition.metric_type));
  const visibleResourceCount =
    (showRelations ? relationItems.length : 0) +
    (showMetricGroup ? 1 : 0) +
    (showMetricItems ? metricItems.length : 0) +
    (showActionGroup ? 1 : 0) +
    (showActionItems ? actionItems.length : 0);

  const metricGroupPosition = useMemo(
    () => overviewGroupPosition("metrics", expandedGroup),
    [expandedGroup],
  );
  const actionGroupPosition = useMemo(
    () => overviewGroupPosition("actions", expandedGroup),
    [expandedGroup],
  );
  const metricGroupDisplayPosition = nodePositions["group:metrics"] ?? metricGroupPosition;
  const actionGroupDisplayPosition = nodePositions["group:actions"] ?? actionGroupPosition;

  const basePositions = useMemo(() => {
    const result = new Map<string, Point>();
    const focusedSection = section === "metrics" || section === "actions";
    result.set("owner", focusedSection ? { x: 110, y: CENTER.y } : CENTER);
    result.set("group:metrics", metricGroupDisplayPosition);
    result.set("group:actions", actionGroupDisplayPosition);

    const relationAngles =
      section === "relations"
        ? spreadAngles(relationGroups.length, -Math.PI * 0.82, Math.PI * 0.82)
        : spreadAngles(relationGroups.length, Math.PI * 0.7, Math.PI * 1.3);
    relationGroups.forEach((neighbor, index) => {
      const neighborPosition = polar(
        relationAngles[index] ?? Math.PI,
        section === "relations" ? 470 : 430,
        section === "relations" ? 250 : 235,
      );
      result.set(`neighbor:${neighbor.id}`, neighborPosition);
    });

    if (section === "metrics") {
      layoutMetrics(metricItems, { x: 110, y: CENTER.y }).forEach((point, key) =>
        result.set(key, point),
      );
    } else if (expandedGroup === "metrics") {
      layoutMetrics(metricItems, metricGroupDisplayPosition).forEach((point, key) =>
        result.set(key, point),
      );
    }

    if (section === "actions") {
      layoutActionItems(actionItems, { x: 110, y: CENTER.y }).forEach((point, key) =>
        result.set(key, point),
      );
    } else if (expandedGroup === "actions") {
      layoutActionItems(actionItems, actionGroupDisplayPosition).forEach((point, key) =>
        result.set(key, point),
      );
    }
    return result;
  }, [
    actionGroupDisplayPosition,
    actionItems,
    expandedGroup,
    metricGroupDisplayPosition,
    metricItems,
    relationGroups,
    section,
  ]);

  const position = (key: string) => nodePositions[key] ?? basePositions.get(key) ?? CENTER;
  const ownerPosition = position("owner");
  const metricGroupEdge = trimmedLine(ownerPosition, metricGroupDisplayPosition, 32, 58);
  const actionGroupEdge = trimmedLine(ownerPosition, actionGroupDisplayPosition, 32, 58);
  const metricsByVersion = new Map(
    metricItems.map((metric) => [
      objectMetricVersionKey(metric.definition.id, metric.definition.version),
      metric,
    ]),
  );
  const metricsById = new Map(metricItems.map((metric) => [metric.definition.id, metric]));
  const metricDependencies = showMetricItems
    ? metricItems.flatMap((metric) =>
        directLoadedMetricReferences(metric).flatMap((reference) => {
          const dependency =
            metricsByVersion.get(objectMetricVersionKey(reference.metric_id, reference.version)) ??
            metricsById.get(reference.metric_id);
          return dependency ? [{ dependency, metric }] : [];
        }),
      )
    : [];
  const metricsWithLoadedDependencies = new Set(
    metricDependencies.map(({ metric }) => metricNodeKey(metric)),
  );

  const zoomBy = useCallback((factor: number) => {
    setView((current) => {
      const width = Math.min(
        GRAPH_WIDTH / MIN_ZOOM,
        Math.max(GRAPH_WIDTH / MAX_ZOOM, current.width / factor),
      );
      const height = (width / GRAPH_WIDTH) * GRAPH_HEIGHT;
      return {
        height,
        width,
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
      };
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1.12 : 0.89);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  const graphDelta = (clientX: number, clientY: number, lastX: number, lastY: number) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return { x: 0, y: 0 };
    return {
      x: ((clientX - lastX) / bounds.width) * view.width,
      y: ((clientY - lastY) / bounds.height) * view.height,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = graphDelta(event.clientX, event.clientY, drag.lastX, drag.lastY);
    if (Math.abs(delta.x) + Math.abs(delta.y) > 1) drag.moved = true;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (drag.type === "canvas") {
      setView((current) => ({ ...current, x: current.x - delta.x, y: current.y - delta.y }));
    } else {
      setNodePositions((current) => {
        const currentPosition = current[drag.key] ?? basePositions.get(drag.key) ?? CENTER;
        return {
          ...current,
          [drag.key]: { x: currentPosition.x + delta.x, y: currentPosition.y + delta.y },
        };
      });
    }
  };

  const finishDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag?.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId))
      event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startCanvasDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("[data-graph-node='true']")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { lastX: event.clientX, lastY: event.clientY, moved: false, type: "canvas" };
  };

  const startNodeDrag = (
    event: ReactPointerEvent<SVGElement>,
    key: string,
    initialPosition?: Point,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    if (initialPosition) {
      setNodePositions((current) =>
        current[key] ? current : { ...current, [key]: initialPosition },
      );
    }
    const captureTarget = event.target instanceof Element ? event.target : event.currentTarget;
    captureTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      key,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      type: "node",
    };
  };

  const activate = (callback: () => void) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    callback();
  };

  const toggleGroup = (group: ExpandableGroup) => {
    setExpandedGroup((current) => (current === group ? null : group));
    setNodePositions((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => key === "owner" || key.startsWith("neighbor:") || key.startsWith("group:"),
        ),
      ),
    );
  };

  const selectCurrentObject = () => {
    setFocusedAction(undefined);
    setExpandedActions([]);
    setActionPresentations({});
    setSelected({
      description: objectType.description,
      id: objectType.id,
      kind: "object",
      name: objectType.name,
      value: objectType,
    });
  };

  const activateAction = (action: KnowledgeNetworkActionTypeRecord) => {
    if (section === "actions") {
      setExpandedActions((current) =>
        current.some((item) => item.id === action.id) ? current : [...current, action],
      );
      setFocusedAction(action);
      return;
    }
    setSelected({ kind: "action", value: action });
  };

  const collapseFocusedAction = () => {
    if (!focusedAction) return;
    const remainingActions = expandedActions.filter((action) => action.id !== focusedAction.id);
    setExpandedActions(remainingActions);
    setActionPresentations((current) => {
      const next = { ...current };
      delete next[focusedAction.id];
      return next;
    });
    setFocusedAction(remainingActions.at(-1));
  };

  const collapseAllActions = () => {
    setExpandedActions([]);
    setActionPresentations({});
    setFocusedAction(undefined);
  };

  const openSelected = () => {
    if (!selected) return;
    if (selected.kind === "object") onOpenObject(selected.id);
    if (selected.kind === "relation") onOpenRelation(selected.value);
    if (selected.kind === "metric") onOpenMetric(selected.value);
    if (selected.kind === "action") onOpenAction(selected.value);
  };

  const editSelected = () => {
    if (!selected) return;
    if (selected.kind === "object") onEditObject(selected.id);
  };

  const canEditSelected =
    selected?.kind === "object" &&
    allowEditObject &&
    canModify &&
    selected.value !== undefined &&
    hasKnowledgeNetworkRecordOperation(selected.value, "modify");
  const canExecuteSelected =
    selected?.kind === "action" && hasKnowledgeNetworkRecordOperation(selected.value, "execute");
  const canEditSelectedAction =
    selectedAction !== undefined &&
    onEditAction !== undefined &&
    hasKnowledgeNetworkRecordOperation(selectedAction, "modify");
  const canAuthorizeSelectedAction =
    selectedAction !== undefined &&
    onAuthorizeAction !== undefined &&
    canAuthorizeObject &&
    hasKnowledgeNetworkRecordOperation(selectedAction, "view_detail");
  const canDeleteSelectedAction =
    selectedAction !== undefined &&
    onDeleteAction !== undefined &&
    hasKnowledgeNetworkRecordOperation(selectedAction, "delete");
  const canRequestSelectedActionPermission =
    resourceScope === "actions" &&
    selectedAction !== undefined &&
    canRequestResourcePermission(
      "action_type",
      selectedAction.operations,
      permissionRequestsEnabled,
    );
  const selectedObjectRecord =
    selected?.kind === "object" && selected.value ? selected.value : undefined;
  const canAuthorizeSelectedObject =
    allowAuthorizeObject &&
    selectedObjectRecord !== undefined &&
    canAuthorizeObject &&
    hasKnowledgeNetworkRecordOperation(selectedObjectRecord, "view_detail");
  const canDeleteSelectedObject =
    allowDeleteObject &&
    selectedObjectRecord !== undefined &&
    hasKnowledgeNetworkRecordOperation(selectedObjectRecord, "delete");
  const selectedRelation = selected?.kind === "relation" ? selected.value : undefined;
  const canMapSelectedRelation =
    selectedRelation !== undefined &&
    onOpenRelationMapping !== undefined &&
    hasKnowledgeNetworkRecordOperation(selectedRelation, "modify");
  const canAuthorizeSelectedRelation =
    selectedRelation !== undefined &&
    onAuthorizeRelation !== undefined &&
    canAuthorizeObject &&
    hasKnowledgeNetworkRecordOperation(selectedRelation, "view_detail");
  const canDeleteSelectedRelation =
    allowDeleteRelation &&
    selectedRelation !== undefined &&
    onDeleteRelation !== undefined &&
    hasKnowledgeNetworkRecordOperation(selectedRelation, "delete");
  const canRequestSelectedRelationPermission =
    selectedRelation !== undefined &&
    canRequestResourcePermission(
      "relation_type",
      selectedRelation.operations,
      permissionRequestsEnabled,
    );

  const selectedTitle = selected
    ? selected.kind === "object"
      ? selected.name
      : selected.kind === "metric"
        ? selected.value.definition.name
        : selected.value.name
    : "";
  const selectedDescription = selected
    ? selected.kind === "object"
      ? selected.description
      : selected.kind === "metric"
        ? selected.value.definition.description
        : selected.kind === "action"
          ? selectedActionDetail?.description || selected.value.description
          : selected.value.description
    : "";
  const selectedIdentifier = selected
    ? selected.kind === "object"
      ? selected.id
      : selected.kind === "metric"
        ? selected.value.definition.code || selected.value.definition.id
        : selected.value.id
    : "";
  const selectedTypeLabel = selected
    ? selected.kind === "object"
      ? t("knowledgeNetwork.objectTypeGraphObjectNode")
      : selected.kind === "relation"
        ? t("knowledgeNetwork.objectTypeGraphRelationNode")
        : selected.kind === "metric"
          ? t("knowledgeNetwork.objectTypeGraphMetricNode")
          : t("knowledgeNetwork.objectTypeGraphActionNode")
    : "";
  const selectedDrawerTitle = selected
    ? selected.kind === "object"
      ? t("knowledgeNetwork.objectTypeGraphObjectDetail")
      : selected.kind === "relation"
        ? t("knowledgeNetwork.objectTypeGraphRelationDetail")
        : selected.kind === "metric"
          ? t("knowledgeNetwork.objectTypeGraphMetricDetail")
          : t("knowledgeNetwork.objectTypeGraphActionDetail")
    : t("knowledgeNetwork.objectTypeGraphResourceDetail");
  const selectedActionExecution = selectedActionDetail?.executionConfig;
  const selectedActionRecord = selectedActionDetail ?? selectedAction;
  const selectedActionPropertyLabels = new Map(
    [
      ...(selectedActionObjectType?.dataProperties ?? []),
      ...(selectedActionObjectType?.logicProperties ?? []),
    ].map((property) => [property.name, property.displayName || property.name]),
  );
  const selectedActionSourceName =
    getReadableActionSourceDisplayName(
      resolvedActionSource ?? selectedActionExecution?.actionSource,
    ) || t("knowledgeNetwork.actionTypeExecutionSourceUnavailable");
  const selectedActionParameterCount = selectedActionExecution?.parameters.length ?? 0;
  const selectedActionDynamicParameterCount =
    selectedActionExecution?.parameters.filter((parameter) => parameter.valueFrom === "input")
      .length ?? 0;
  const selectedActionAffectedObjectLabel =
    selectedActionAffectedObjectName || t("knowledgeNetwork.actionTypeEmptyValue");
  const selectedActionConditionLabel = actionConditionLabel(
    selectedActionDetail?.condition,
    t,
    selectedActionPropertyLabels,
  );
  const selectedActionSourceTypeLabel = selectedActionExecution
    ? actionSourceTypeLabel(selectedActionExecution.sourceType, t)
    : t("knowledgeNetwork.actionTypeEmptyValue");
  const selectedActionParameterLabel = `${t("knowledgeNetwork.actionTypeExecutionParameterCount", {
    count: selectedActionParameterCount,
  })}${
    selectedActionDynamicParameterCount > 0
      ? ` · ${t("knowledgeNetwork.actionTypeExecutionDynamicParamCount", {
          count: selectedActionDynamicParameterCount,
        })}`
      : ""
  }`;
  const selectedActionAffectDescription =
    selectedActionDetail?.affect?.comment || t("knowledgeNetwork.actionTypeEmptyValue");
  const selectedActionTags = selectedActionRecord?.tags.length
    ? selectedActionRecord.tags.join("、")
    : t("knowledgeNetwork.noTags");
  useEffect(() => {
    const missingActions = expandedActions.filter((action) => !actionPresentations[action.id]);
    if (missingActions.length === 0) return undefined;

    let active = true;
    const loadPresentation = async (
      action: KnowledgeNetworkActionTypeRecord,
    ): Promise<ActionSemanticLoadResult> => {
      try {
        const detail = await getKnowledgeNetworkActionTypeDetail(networkId, action.id);
        if (!detail) {
          throw new Error(t("knowledgeNetwork.objectTypeGraphActionDetailUnavailable"));
        }
        const conditionObjectTypeId =
          detail.condition?.objectTypeId || detail.objectTypeId || action.objectTypeId;
        const affectedObjectTypeId = detail.affect?.objectTypeId;
        const [conditionObjectType, affectedObjectType] = await Promise.all([
          getKnowledgeNetworkObjectTypeDetail(networkId, conditionObjectTypeId).catch(() => null),
          !affectedObjectTypeId || affectedObjectTypeId === objectType.id
            ? Promise.resolve(null)
            : getKnowledgeNetworkObjectTypeDetail(networkId, affectedObjectTypeId).catch(
                () => null,
              ),
        ]);
        const propertyLabels = new Map(
          [
            ...(conditionObjectType?.dataProperties ?? []),
            ...(conditionObjectType?.logicProperties ?? []),
          ].map((property) => [property.name, property.displayName || property.name]),
        );
        let actionSource = detail.executionConfig.actionSource;
        if (needsActionTypeActionSourceDisplayResolution(actionSource)) {
          actionSource = await resolveActionTypeActionSourceDisplayWithTimeout(actionSource!).catch(
            () => actionSource,
          );
        }
        return {
          presentation: {
            action,
            affectDescription: detail.affect?.comment,
            affectedObjectLabel: !affectedObjectTypeId
              ? undefined
              : affectedObjectTypeId === objectType.id
                ? objectType.name
                : (affectedObjectType?.name ?? affectedObjectTypeId),
            condition: detail.condition,
            propertyLabels,
            sourceName: getReadableActionSourceDisplayName(actionSource) || undefined,
            sourceType: detail.executionConfig.sourceType,
          },
        };
      } catch (error: unknown) {
        return {
          action,
          error,
        };
      }
    };

    void Promise.all(missingActions.map(loadPresentation)).then((results) => {
      if (!active) return;
      const presentations = results.flatMap((result) =>
        "presentation" in result ? [result.presentation] : [],
      );
      const failures = results.flatMap((result) => ("error" in result ? [result] : []));
      if (presentations.length > 0) {
        setActionPresentations((current) => ({
          ...current,
          ...Object.fromEntries(
            presentations.map((presentation) => [presentation.action.id, presentation]),
          ),
        }));
      }
      const attemptedKeys = new Set(missingActions.map((action) => `action:${action.id}`));
      setErrors((current) => [
        ...current.filter((entry) => !attemptedKeys.has(entry.key)),
        ...failures.map(({ action, error }) => ({
          key: `action:${action.id}` as const,
          message: t("knowledgeNetwork.objectTypeGraphActionDetailLoadError", {
            message: extractRequestErrorMessage(error),
            name: action.name,
          }),
        })),
      ]);
      if (failures.length > 0) {
        const failedIds = new Set(failures.map(({ action }) => action.id));
        const fallbackAction = [...expandedActions]
          .reverse()
          .find((action) => !failedIds.has(action.id));
        setExpandedActions((current) => current.filter((action) => !failedIds.has(action.id)));
        setFocusedAction((current) =>
          current && failedIds.has(current.id) ? fallbackAction : current,
        );
      }
    });
    return () => {
      active = false;
    };
  }, [
    actionPresentations,
    expandedActions,
    networkId,
    objectType.id,
    objectType.name,
    refreshVersion,
    t,
  ]);
  const expandedActionPresentations = expandedActions.flatMap((action) => {
    const presentation = actionPresentations[action.id];
    return presentation ? [presentation] : [];
  });
  const expandedActionIds = new Set(expandedActionPresentations.map(({ action }) => action.id));

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarIdentity}>
          <strong title={objectType.name}>{objectType.name}</strong>
        </div>
        <div className={styles.toolbarControls}>
          {resourceScope === "all" ? (
            <Segmented
              onChange={(value) => {
                setSection(value as GraphSection);
                setExpandedGroup(null);
                setFocusedAction(undefined);
                setExpandedActions([]);
                setActionPresentations({});
                setNodePositions({});
                setView(INITIAL_VIEW);
              }}
              options={[
                { label: t("knowledgeNetwork.objectTypeGraphAll"), value: "all" },
                {
                  label: `${t("knowledgeNetwork.objectTypeGraphRelations")} ${totals.relations}`,
                  value: "relations",
                },
                ...(metricsAvailable
                  ? [
                      {
                        label: `${t("knowledgeNetwork.objectTypeGraphMetrics")} ${totals.metrics}`,
                        value: "metrics",
                      },
                    ]
                  : []),
                {
                  label: `${t("knowledgeNetwork.objectTypeGraphActions")} ${totals.actions}`,
                  value: "actions",
                },
              ]}
              value={section}
            />
          ) : (
            <span className={styles.toolbarSummary}>
              {t(
                resourceScope === "relations"
                  ? "knowledgeNetwork.objectTypeGraphRelationCount"
                  : "knowledgeNetwork.objectTypeGraphActionCount",
                {
                  count: loading
                    ? "…"
                    : resourceScope === "relations"
                      ? totals.relations
                      : totals.actions,
                },
              )}
            </span>
          )}
          {section === "actions" && focusedAction ? (
            <div className={styles.actionFocusControls}>
              <strong title={focusedAction.name}>{focusedAction.name}</strong>
              <span className={styles.actionFocusCount}>
                {t("knowledgeNetwork.objectTypeGraphActionExpandedCount", {
                  count: expandedActions.length,
                })}
              </span>
              <Button
                onClick={() => setSelected({ kind: "action", value: focusedAction })}
                size="small"
              >
                {t("knowledgeNetwork.objectTypeGraphActionViewDetail")}
              </Button>
              <Button onClick={collapseFocusedAction} size="small" type="text">
                {t("knowledgeNetwork.objectTypeGraphActionCollapse")}
              </Button>
              {expandedActions.length > 1 ? (
                <Button onClick={collapseAllActions} size="small" type="text">
                  {t("knowledgeNetwork.objectTypeGraphActionCollapseAll")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {errors.length > 0 ? (
        <Alert
          action={
            <Button onClick={() => setReloadVersion((value) => value + 1)}>
              {t("common.retry")}
            </Button>
          }
          description={errors.map((entry) => entry.message).join("；")}
          message={t("knowledgeNetwork.objectTypeGraphPartialError")}
          showIcon
          type="warning"
        />
      ) : null}

      <div className={styles.canvas}>
        <Spin spinning={loading}>
          <svg
            aria-label={t("knowledgeNetwork.objectTypeGraphAriaLabel", { name: objectType.name })}
            className={styles.svg}
            onPointerCancel={finishDrag}
            onPointerDown={startCanvasDrag}
            onPointerMove={onPointerMove}
            onPointerUp={finishDrag}
            ref={svgRef}
            role="img"
            preserveAspectRatio="xMidYMid meet"
            viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          >
            <defs>
              <pattern height="28" id={`${graphId}-grid`} patternUnits="userSpaceOnUse" width="28">
                <circle className={styles.gridDot} cx="1" cy="1" r="1" />
              </pattern>
              <marker
                id={`${graphId}-arrow`}
                markerHeight="7"
                markerWidth="7"
                orient="auto"
                refX="6"
                refY="3.5"
              >
                <path d="M 0 0 L 7 3.5 L 0 7 z" />
              </marker>
              <marker
                id={`${graphId}-metric-arrow`}
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path className={styles.metricArrow} d="M 0 0 L 7 4 L 0 8 z" />
              </marker>
              <marker
                id={`${graphId}-action-arrow`}
                markerHeight="8"
                markerWidth="8"
                orient="auto"
                refX="7"
                refY="4"
              >
                <path className={styles.actionArrow} d="M 0 0 L 7 4 L 0 8 z" />
              </marker>
            </defs>
            <rect
              fill={`url(#${graphId}-grid)`}
              height={GRAPH_HEIGHT * 5}
              width={GRAPH_WIDTH * 5}
              x={-GRAPH_WIDTH * 2}
              y={-GRAPH_HEIGHT * 2}
            />

            {showRelations
              ? relationGroups.map((neighbor) => {
                  const neighborKey = `neighbor:${neighbor.id}`;
                  const neighborPosition = position(neighborKey);
                  return (
                    <g key={neighbor.id}>
                      {neighbor.relations.map((relation, relationIndex) => {
                        const outgoing = relation.sourceObjectTypeId === objectType.id;
                        const geometry = relationGeometry(
                          ownerPosition,
                          neighborPosition,
                          outgoing,
                          70 * (relationIndex - (neighbor.relations.length - 1) / 2),
                        );
                        const relationName = truncate(relation.name, 14);
                        const labelWidth = Math.min(
                          220,
                          Math.max(
                            92,
                            Array.from(relationName).reduce(
                              (width, character) =>
                                width + (character.codePointAt(0)! > 127 ? 12 : 7),
                              24,
                            ),
                          ),
                        );
                        return (
                          <g key={relation.id}>
                            <path
                              className={styles.relationEdge}
                              d={`M ${geometry.from.x} ${geometry.from.y} Q ${geometry.control.x} ${geometry.control.y} ${geometry.to.x} ${geometry.to.y}`}
                              data-graph-edge="relation"
                              data-source-object-type-id={relation.sourceObjectTypeId}
                              data-target-object-type-id={relation.targetObjectTypeId}
                              markerEnd={`url(#${graphId}-arrow)`}
                            />
                            <g
                              aria-label={`${t("knowledgeNetwork.objectTypeGraphRelationNode")} ${relation.name}`}
                              className={styles.relationNode}
                              data-graph-node="true"
                              onClick={() =>
                                activate(() => setSelected({ kind: "relation", value: relation }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ")
                                  setSelected({ kind: "relation", value: relation });
                              }}
                              role="button"
                              tabIndex={0}
                              transform={`translate(${geometry.label.x} ${geometry.label.y})`}
                            >
                              <rect
                                height="28"
                                rx="14"
                                width={labelWidth}
                                x={-labelWidth / 2}
                                y="-14"
                              />
                              <text dy="4" textAnchor="middle">
                                {relationName}
                              </text>
                              <title>{relation.name}</title>
                            </g>
                          </g>
                        );
                      })}
                      <g
                        aria-label={`${t("knowledgeNetwork.objectTypeGraphObjectNode")} ${neighbor.name}`}
                        className={styles.neighborNode}
                        data-graph-node="true"
                        onClick={() => activate(() => onSelectObject(neighbor.id))}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          onSelectObject(neighbor.id);
                        }}
                        onPointerDown={(event) => startNodeDrag(event, neighborKey)}
                        role="button"
                        tabIndex={0}
                        transform={`translate(${neighborPosition.x} ${neighborPosition.y})`}
                      >
                        <circle
                          r="20"
                          style={{
                            fill: objectNodeColor(neighbor.id, objectTypeColors[neighbor.id]),
                          }}
                        />
                        <text className={styles.nodeLabel} textAnchor="middle" y="40">
                          {truncate(neighbor.name)}
                        </text>
                        <title>{neighbor.name}</title>
                      </g>
                    </g>
                  );
                })
              : null}

            {showMetricGroup ? (
              <g>
                <path
                  className={styles.metricEdge}
                  d={`M ${metricGroupEdge.from.x} ${metricGroupEdge.from.y} L ${metricGroupEdge.to.x} ${metricGroupEdge.to.y}`}
                  data-graph-edge="metric-group"
                />
                <path
                  className={styles.groupEdgeHitArea}
                  d={`M ${metricGroupEdge.from.x} ${metricGroupEdge.from.y} L ${metricGroupEdge.to.x} ${metricGroupEdge.to.y}`}
                  data-graph-edge-drag-handle="metric-group"
                  onPointerDown={(event) => startNodeDrag(event, "group:metrics")}
                />
                <g
                  aria-label={`${expandedGroup === "metrics" ? t("common.collapse") : t("common.expand")} ${t("knowledgeNetwork.objectTypeGraphMetrics")} ${totals.metrics}`}
                  aria-pressed={expandedGroup === "metrics"}
                  className={`${styles.groupNode} ${styles.metricGroupNode} ${expandedGroup === "metrics" ? styles.groupNodeExpanded : ""}`}
                  data-graph-node="true"
                  onClick={() => activate(() => toggleGroup("metrics"))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") toggleGroup("metrics");
                  }}
                  onPointerDown={(event) => startNodeDrag(event, "group:metrics")}
                  role="button"
                  tabIndex={0}
                  transform={`translate(${metricGroupDisplayPosition.x} ${metricGroupDisplayPosition.y})`}
                >
                  <rect height="44" rx="22" width="116" x="-58" y="-22" />
                  <text dy="5" textAnchor="middle">
                    {`${t("knowledgeNetwork.objectTypeGraphMetrics")} · ${totals.metrics}`}
                  </text>
                  <title>{`${expandedGroup === "metrics" ? t("common.collapse") : t("common.expand")} ${t("knowledgeNetwork.objectTypeGraphMetrics")}`}</title>
                </g>
              </g>
            ) : null}

            {showActionGroup ? (
              <g>
                <path
                  className={styles.actionEdge}
                  d={`M ${actionGroupEdge.from.x} ${actionGroupEdge.from.y} L ${actionGroupEdge.to.x} ${actionGroupEdge.to.y}`}
                  data-graph-edge="action-group"
                />
                <path
                  className={styles.groupEdgeHitArea}
                  d={`M ${actionGroupEdge.from.x} ${actionGroupEdge.from.y} L ${actionGroupEdge.to.x} ${actionGroupEdge.to.y}`}
                  data-graph-edge-drag-handle="action-group"
                  onPointerDown={(event) => startNodeDrag(event, "group:actions")}
                />
                <g
                  aria-label={`${expandedGroup === "actions" ? t("common.collapse") : t("common.expand")} ${t("knowledgeNetwork.objectTypeGraphActions")} ${totals.actions}`}
                  aria-pressed={expandedGroup === "actions"}
                  className={`${styles.groupNode} ${styles.actionGroupNode} ${expandedGroup === "actions" ? styles.groupNodeExpanded : ""}`}
                  data-graph-node="true"
                  onClick={() => activate(() => toggleGroup("actions"))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") toggleGroup("actions");
                  }}
                  onPointerDown={(event) => startNodeDrag(event, "group:actions")}
                  role="button"
                  tabIndex={0}
                  transform={`translate(${actionGroupDisplayPosition.x} ${actionGroupDisplayPosition.y})`}
                >
                  <rect height="44" rx="22" width="116" x="-58" y="-22" />
                  <text dy="5" textAnchor="middle">
                    {`${t("knowledgeNetwork.objectTypeGraphActions")} · ${totals.actions}`}
                  </text>
                  <title>{`${expandedGroup === "actions" ? t("common.collapse") : t("common.expand")} ${t("knowledgeNetwork.objectTypeGraphActions")}`}</title>
                </g>
              </g>
            ) : null}

            {showMetricItems
              ? metricDependencies.map(({ dependency, metric }) => {
                  const dependencyPosition = position(metricNodeKey(dependency));
                  const metricPosition = position(metricNodeKey(metric));
                  const line = trimmedLine(dependencyPosition, metricPosition, 21, 23);
                  return (
                    <path
                      className={styles.metricDependencyEdge}
                      d={`M ${line.from.x} ${line.from.y} L ${line.to.x} ${line.to.y}`}
                      key={`dependency:${metricNodeKey(dependency)}:${metricNodeKey(metric)}`}
                      markerEnd={`url(#${graphId}-metric-arrow)`}
                    />
                  );
                })
              : null}

            {showMetricItems
              ? metricItems.map((metric) => {
                  const key = metricNodeKey(metric);
                  const metricPosition = position(key);
                  const showOwnerSpoke = !metricsWithLoadedDependencies.has(key);
                  const metricSource =
                    section === "all" ? metricGroupDisplayPosition : ownerPosition;
                  const ownerSpoke = trimmedLine(
                    metricSource,
                    metricPosition,
                    section === "all" ? 58 : 32,
                    21,
                  );
                  return (
                    <g key={key}>
                      {showOwnerSpoke ? (
                        <path
                          className={styles.metricEdge}
                          data-graph-edge="metric-spoke"
                          data-target-metric-id={metric.definition.id}
                          d={`M ${ownerSpoke.from.x} ${ownerSpoke.from.y} L ${ownerSpoke.to.x} ${ownerSpoke.to.y}`}
                        />
                      ) : null}
                      <g
                        aria-label={`${t("knowledgeNetwork.objectTypeGraphMetricNode")} ${metric.definition.name}`}
                        className={`${styles.resourceNode} ${styles[`metric${metric.definition.metric_type[0].toUpperCase()}${metric.definition.metric_type.slice(1)}`]}`}
                        data-graph-node="true"
                        onClick={() =>
                          activate(() => setSelected({ kind: "metric", value: metric }))
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ")
                            setSelected({ kind: "metric", value: metric });
                        }}
                        onPointerDown={(event) => startNodeDrag(event, key)}
                        role="button"
                        tabIndex={0}
                        transform={`translate(${metricPosition.x} ${metricPosition.y})`}
                      >
                        <circle className={styles.metricNodeBody} r="18" />
                        <text className={styles.nodeLabel} textAnchor="middle" y="38">
                          {truncate(metric.definition.name)}
                        </text>
                        <title>{`${metricTypeLabel(metric.definition.metric_type, t)} · ${metric.definition.name}`}</title>
                      </g>
                    </g>
                  );
                })
              : null}

            {showActionItems
              ? actionItems.map((action) => {
                  const key = `action:${action.id}`;
                  if (expandedActionIds.has(action.id)) return null;
                  const actionPosition = position(key);
                  const actionSource =
                    section === "all" ? actionGroupDisplayPosition : ownerPosition;
                  const actionSpoke = trimmedLine(
                    actionSource,
                    actionPosition,
                    section === "all" ? 58 : 32,
                    21,
                  );
                  return (
                    <g key={key}>
                      <path
                        className={styles.actionEdge}
                        d={`M ${actionSpoke.from.x} ${actionSpoke.from.y} L ${actionSpoke.to.x} ${actionSpoke.to.y}`}
                      />
                      <g
                        aria-label={`${t("knowledgeNetwork.objectTypeGraphActionNode")} ${action.name}`}
                        className={`${styles.actionNode} ${
                          expandedActionPresentations.length > 0 ? styles.actionNodeAvailable : ""
                        }`}
                        data-graph-node="true"
                        onClick={() => activate(() => activateAction(action))}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") activateAction(action);
                        }}
                        onPointerDown={(event) => startNodeDrag(event, key)}
                        role="button"
                        tabIndex={0}
                        transform={`translate(${actionPosition.x} ${actionPosition.y})`}
                      >
                        <circle r="20" />
                        <text className={styles.nodeLabel} textAnchor="middle" y="41">
                          {truncate(action.name)}
                        </text>
                        <title>{`${actionTypeLabel(action.actionKind, t)} · ${action.name}`}</title>
                      </g>
                    </g>
                  );
                })
              : null}

            {expandedActionPresentations.map((presentation) => {
              const { action } = presentation;
              const conditionLabel = presentation.condition
                ? actionConditionLabel(presentation.condition, t, presentation.propertyLabels)
                : t("knowledgeNetwork.objectTypeGraphActionNoCondition");
              const sourceName =
                presentation.sourceName ||
                t("knowledgeNetwork.actionTypeExecutionSourceUnavailable");
              const sourceTypeLabel = actionSourceTypeLabel(presentation.sourceType, t);
              const affectedObjectLabel =
                presentation.affectedObjectLabel ||
                t("knowledgeNetwork.objectTypeGraphActionNoAffectedObject");
              const affectDescription =
                presentation.affectDescription ||
                t("knowledgeNetwork.objectTypeGraphActionNoAffectDescription");
              const originalActionPosition = position(`action:${action.id}`);
              const laneY = originalActionPosition.y;
              const actionFocusKey = `action-focus:${action.id}`;
              const actionFocusTriggerKey = `${actionFocusKey}:trigger`;
              const actionFocusActionKey = `${actionFocusKey}:action`;
              const actionFocusSourceKey = `${actionFocusKey}:source`;
              const actionFocusImpactKey = `${actionFocusKey}:impact`;
              const actionFocusActionPosition =
                nodePositions[actionFocusActionKey] ?? originalActionPosition;
              const actionFocusTriggerPosition =
                nodePositions[actionFocusTriggerKey] ??
                ({ x: originalActionPosition.x + 150, y: laneY } satisfies Point);
              const actionFocusSourcePosition =
                nodePositions[actionFocusSourceKey] ??
                ({ x: originalActionPosition.x + 310, y: laneY } satisfies Point);
              const actionFocusImpactPosition =
                nodePositions[actionFocusImpactKey] ??
                ({ x: originalActionPosition.x + 470, y: laneY } satisfies Point);
              const actionFocusOwnerEdge = trimmedLine(
                ownerPosition,
                actionFocusActionPosition,
                32,
                21,
              );
              const actionFocusTriggerEdge = trimmedLine(
                actionFocusActionPosition,
                actionFocusTriggerPosition,
                21,
                ACTION_FOCUS_TRIGGER_WIDTH / 2,
              );
              const actionFocusExecutionEdge = trimmedLine(
                actionFocusTriggerPosition,
                actionFocusSourcePosition,
                ACTION_FOCUS_TRIGGER_WIDTH / 2,
                ACTION_FOCUS_SOURCE_WIDTH / 2,
              );
              const actionFocusImpactEdge = trimmedLine(
                actionFocusSourcePosition,
                actionFocusImpactPosition,
                ACTION_FOCUS_SOURCE_WIDTH / 2,
                ACTION_FOCUS_IMPACT_WIDTH / 2,
              );
              const isActive = focusedAction?.id === action.id;
              return (
                <g data-action-semantic-focus={action.id} key={action.id}>
                  <path
                    className={styles.actionSemanticEdge}
                    d={`M ${actionFocusTriggerEdge.from.x} ${actionFocusTriggerEdge.from.y} L ${actionFocusTriggerEdge.to.x} ${actionFocusTriggerEdge.to.y}`}
                    data-action-id={action.id}
                    data-graph-edge="action-trigger"
                    markerEnd={`url(#${graphId}-action-arrow)`}
                  />
                  <path
                    className={styles.actionSemanticEdge}
                    d={`M ${actionFocusOwnerEdge.from.x} ${actionFocusOwnerEdge.from.y} L ${actionFocusOwnerEdge.to.x} ${actionFocusOwnerEdge.to.y}`}
                    data-action-id={action.id}
                    data-graph-edge="action-owner"
                    markerEnd={`url(#${graphId}-action-arrow)`}
                  />
                  <path
                    className={styles.actionSemanticEdge}
                    d={`M ${actionFocusExecutionEdge.from.x} ${actionFocusExecutionEdge.from.y} L ${actionFocusExecutionEdge.to.x} ${actionFocusExecutionEdge.to.y}`}
                    data-action-id={action.id}
                    data-graph-edge="action-execution"
                    markerEnd={`url(#${graphId}-action-arrow)`}
                  />
                  <path
                    className={styles.actionImpactEdge}
                    d={`M ${actionFocusImpactEdge.from.x} ${actionFocusImpactEdge.from.y} L ${actionFocusImpactEdge.to.x} ${actionFocusImpactEdge.to.y}`}
                    data-action-id={action.id}
                    data-graph-edge="action-impact"
                    markerEnd={`url(#${graphId}-action-arrow)`}
                  />
                  <path
                    className={styles.actionSemanticEdgeHitArea}
                    d={`M ${actionFocusTriggerEdge.from.x} ${actionFocusTriggerEdge.from.y} L ${actionFocusTriggerEdge.to.x} ${actionFocusTriggerEdge.to.y}`}
                    data-action-id={action.id}
                    data-action-edge-drag-handle="trigger"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusTriggerKey, actionFocusTriggerPosition)
                    }
                  />
                  <path
                    className={styles.actionSemanticEdgeHitArea}
                    d={`M ${actionFocusOwnerEdge.from.x} ${actionFocusOwnerEdge.from.y} L ${actionFocusOwnerEdge.to.x} ${actionFocusOwnerEdge.to.y}`}
                    data-action-id={action.id}
                    data-action-edge-drag-handle="action"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusActionKey, actionFocusActionPosition)
                    }
                  />
                  <path
                    className={styles.actionSemanticEdgeHitArea}
                    d={`M ${actionFocusExecutionEdge.from.x} ${actionFocusExecutionEdge.from.y} L ${actionFocusExecutionEdge.to.x} ${actionFocusExecutionEdge.to.y}`}
                    data-action-id={action.id}
                    data-action-edge-drag-handle="execution"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusSourceKey, actionFocusSourcePosition)
                    }
                  />
                  <path
                    className={styles.actionSemanticEdgeHitArea}
                    d={`M ${actionFocusImpactEdge.from.x} ${actionFocusImpactEdge.from.y} L ${actionFocusImpactEdge.to.x} ${actionFocusImpactEdge.to.y}`}
                    data-action-id={action.id}
                    data-action-edge-drag-handle="impact"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusImpactKey, actionFocusImpactPosition)
                    }
                  />

                  <g
                    aria-label={`${t("knowledgeNetwork.objectTypeGraphActionNode")} ${action.name}`}
                    className={`${styles.actionNode} ${styles.actionNodeFocused} ${
                      isActive ? styles.actionNodeActive : ""
                    }`}
                    data-graph-node="true"
                    onClick={() => activate(() => setFocusedAction(action))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setFocusedAction(action);
                    }}
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusActionKey, actionFocusActionPosition)
                    }
                    role="button"
                    tabIndex={0}
                    transform={`translate(${actionFocusActionPosition.x} ${actionFocusActionPosition.y})`}
                  >
                    <circle r="22" />
                    <text className={styles.nodeLabel} textAnchor="middle" y="43">
                      {truncate(action.name)}
                    </text>
                    <title>{`${actionTypeLabel(action.actionKind, t)} · ${action.name}`}</title>
                  </g>

                  <g
                    aria-label={`${t("knowledgeNetwork.objectTypeGraphActionTrigger", {
                      kind: actionTypeLabel(action.actionKind, t),
                    })} ${conditionLabel}`}
                    className={`${styles.actionSemanticNode} ${styles.actionTriggerNode}`}
                    data-action-semantic="trigger"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusTriggerKey, actionFocusTriggerPosition)
                    }
                    transform={`translate(${actionFocusTriggerPosition.x} ${actionFocusTriggerPosition.y})`}
                  >
                    <rect
                      height="58"
                      rx="8"
                      width={ACTION_FOCUS_TRIGGER_WIDTH}
                      x={-ACTION_FOCUS_TRIGGER_WIDTH / 2}
                      y="-29"
                    />
                    <text className={styles.actionSemanticTitle} textAnchor="middle" y="-7">
                      {t("knowledgeNetwork.objectTypeGraphActionTrigger", {
                        kind: actionTypeLabel(action.actionKind, t),
                      })}
                    </text>
                    <text className={styles.actionSemanticDescription} textAnchor="middle" y="14">
                      {truncate(conditionLabel, 18)}
                    </text>
                    <title>{conditionLabel}</title>
                  </g>

                  <g
                    aria-label={`${t("knowledgeNetwork.objectTypeGraphActionExecution", {
                      type: sourceTypeLabel,
                    })} ${sourceName}`}
                    className={`${styles.actionSemanticNode} ${styles.actionExecutionNode}`}
                    data-action-semantic="execution"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusSourceKey, actionFocusSourcePosition)
                    }
                    transform={`translate(${actionFocusSourcePosition.x} ${actionFocusSourcePosition.y})`}
                  >
                    <rect
                      height="58"
                      rx="8"
                      width={ACTION_FOCUS_SOURCE_WIDTH}
                      x={-ACTION_FOCUS_SOURCE_WIDTH / 2}
                      y="-29"
                    />
                    <text className={styles.actionSemanticTitle} textAnchor="middle" y="-7">
                      {t("knowledgeNetwork.objectTypeGraphActionExecution", {
                        type: sourceTypeLabel,
                      })}
                    </text>
                    <text className={styles.actionSemanticDescription} textAnchor="middle" y="14">
                      {truncate(sourceName, 15)}
                    </text>
                    <title>{sourceName}</title>
                  </g>

                  <g
                    aria-label={`${t("knowledgeNetwork.objectTypeGraphActionImpact", {
                      object: affectedObjectLabel,
                    })} ${affectDescription}`}
                    className={`${styles.actionSemanticNode} ${styles.actionImpactNode}`}
                    data-action-semantic="impact"
                    data-graph-node="true"
                    onPointerDown={(event) =>
                      startNodeDrag(event, actionFocusImpactKey, actionFocusImpactPosition)
                    }
                    transform={`translate(${actionFocusImpactPosition.x} ${actionFocusImpactPosition.y})`}
                  >
                    <rect
                      height="58"
                      rx="8"
                      width={ACTION_FOCUS_IMPACT_WIDTH}
                      x={-ACTION_FOCUS_IMPACT_WIDTH / 2}
                      y="-29"
                    />
                    <text className={styles.actionSemanticTitle} textAnchor="middle" y="-7">
                      {truncate(
                        t("knowledgeNetwork.objectTypeGraphActionImpact", {
                          object: affectedObjectLabel,
                        }),
                        17,
                      )}
                    </text>
                    <text className={styles.actionSemanticDescription} textAnchor="middle" y="14">
                      {truncate(affectDescription, 18)}
                    </text>
                    <title>{`${affectedObjectLabel} · ${affectDescription}`}</title>
                  </g>
                </g>
              );
            })}

            <g
              aria-label={`${t("knowledgeNetwork.objectTypeGraphCurrentObject")} ${objectType.name}`}
              className={styles.ownerNode}
              data-graph-node="true"
              onClick={() => activate(selectCurrentObject)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                selectCurrentObject();
              }}
              onPointerDown={(event) => startNodeDrag(event, "owner")}
              role="button"
              tabIndex={0}
              transform={`translate(${ownerPosition.x} ${ownerPosition.y})`}
            >
              <circle r="28" style={{ fill: objectNodeColor(objectType.id, objectType.color) }} />
              <text className={styles.ownerLabel} textAnchor="middle" y="50">
                {truncate(objectType.name, 18)}
              </text>
              <title>{objectType.name}</title>
            </g>
          </svg>
        </Spin>

        <div aria-label={t("knowledgeNetwork.objectTypeGraphLegend")} className={styles.legend}>
          <strong>{t("knowledgeNetwork.objectTypeGraphLegend")}</strong>
          <span className={styles.currentObjectLegend}>
            {t("knowledgeNetwork.objectTypeGraphCurrentObject")}
          </span>
          {showRelations ? (
            <>
              <span className={styles.relatedObjectLegend}>
                {t("knowledgeNetwork.objectTypeGraphLegendRelatedObject")}
              </span>
              <span className={styles.relationLegend}>
                {t("knowledgeNetwork.objectTypeGraphLegendRelation")}
              </span>
            </>
          ) : null}
          {showMetricGroup ? (
            <span className={styles.metricGroupLegend}>
              {t("knowledgeNetwork.objectTypeGraphMetrics")}
            </span>
          ) : null}
          {showMetricItems ? (
            <>
              {visibleMetricTypes.has("atomic") ? (
                <span className={styles.atomicMetricLegend}>
                  {t("knowledgeNetwork.objectTypeGraphMetricAtomic")}
                </span>
              ) : null}
              {visibleMetricTypes.has("derived") ? (
                <span className={styles.derivedMetricLegend}>
                  {t("knowledgeNetwork.objectTypeGraphMetricDerived")}
                </span>
              ) : null}
              {visibleMetricTypes.has("composite") ? (
                <span className={styles.compositeMetricLegend}>
                  {t("knowledgeNetwork.objectTypeGraphMetricComposite")}
                </span>
              ) : null}
              {section === "metrics" ? (
                <span className={styles.metricDependencyLegend}>
                  {t("knowledgeNetwork.objectTypeGraphLegendDependency")}
                </span>
              ) : null}
            </>
          ) : null}
          {showActionGroup ? (
            <span className={styles.actionGroupLegend}>
              {t("knowledgeNetwork.objectTypeGraphActions")}
            </span>
          ) : null}
          {showActionItems ? (
            <span className={styles.actionLegend}>
              {t("knowledgeNetwork.objectTypeGraphLegendAction")}
            </span>
          ) : null}
        </div>

        {!loading && visibleResourceCount === 0 ? (
          <div className={styles.emptyState}>
            <Empty description={t("knowledgeNetwork.objectTypeGraphEmpty")} />
          </div>
        ) : null}

        <div className={styles.zoomControls}>
          <Tooltip title={t("knowledgeNetwork.objectTypeGraphZoomIn")}>
            <Button
              aria-label={t("knowledgeNetwork.objectTypeGraphZoomIn")}
              icon={<ZoomInOutlined />}
              onClick={() => zoomBy(1.25)}
            />
          </Tooltip>
          <Tooltip title={t("knowledgeNetwork.objectTypeGraphZoomOut")}>
            <Button
              aria-label={t("knowledgeNetwork.objectTypeGraphZoomOut")}
              icon={<ZoomOutOutlined />}
              onClick={() => zoomBy(0.8)}
            />
          </Tooltip>
          <Tooltip title={t("knowledgeNetwork.objectTypeGraphFit")}>
            <Button
              aria-label={t("knowledgeNetwork.objectTypeGraphFit")}
              icon={<AimOutlined />}
              onClick={() => {
                setNodePositions({});
                setView(INITIAL_VIEW);
              }}
            />
          </Tooltip>
        </div>
      </div>

      <ObjectMetricGraphDetailDrawer
        canModify={canModify}
        metric={selectedMetric}
        metrics={metrics}
        networkId={networkId}
        onClose={() => setSelected(undefined)}
        onOpenMetric={onOpenMetric}
        onTrialMetric={onTrialMetric}
        open={Boolean(selectedMetric)}
        ownerObjectType={metricOwnerObjectType}
        ownerObjectTypeName={objectType.name}
        relationNames={relationNames}
        refreshVersion={refreshVersion}
      />

      <Drawer
        className={styles.resourceDrawer}
        onClose={() => setSelected(undefined)}
        open={Boolean(selected && selected.kind !== "metric")}
        title={selectedDrawerTitle}
        width={400}
      >
        {selected && selected.kind !== "metric" ? (
          <Spin spinning={selected.kind === "action" && selectedActionLoading}>
            <div className={styles.drawerContent}>
              <strong className={styles.drawerResourceName}>{selectedTitle}</strong>
              <div className={styles.drawerActions}>
                <Button autoInsertSpace={false} onClick={openSelected} type="primary">
                  {t("common.detail")}
                </Button>
                {canRequestSelectedRelationPermission && selectedRelation ? (
                  <ResourcePermissionRequestAction
                    operations={selectedRelation.operations}
                    resourceID={`${networkId}/${selectedRelation.id}`}
                    resourceName={`${networkName} / ${selectedRelation.name}`}
                    resourceType="relation_type"
                    trigger="button"
                  />
                ) : null}
                {selected.kind === "object" && canRequestObjectPermission ? (
                  <ResourcePermissionRequestAction
                    operations={selected.value?.operations}
                    resourceID={`${networkId}/${selected.id}`}
                    resourceName={`${networkName} / ${selected.name}`}
                    resourceType="object_type"
                    trigger="button"
                  />
                ) : null}
                {canRequestSelectedActionPermission && selectedAction ? (
                  <ResourcePermissionRequestAction
                    operations={selectedAction.operations}
                    resourceID={`${networkId}/${selectedAction.id}`}
                    resourceName={`${networkName} / ${selectedAction.name}`}
                    resourceType="action_type"
                    trigger="button"
                  />
                ) : null}
                {canEditSelected ? (
                  <Button autoInsertSpace={false} onClick={editSelected}>
                    {t("common.edit")}
                  </Button>
                ) : null}
                {canEditSelectedAction && selectedAction ? (
                  <Button autoInsertSpace={false} onClick={() => onEditAction?.(selectedAction)}>
                    {t("common.edit")}
                  </Button>
                ) : null}
                {canAuthorizeSelectedObject && selectedObjectRecord ? (
                  <Button
                    autoInsertSpace={false}
                    onClick={() => onAuthorizeObject(selectedObjectRecord)}
                  >
                    <KnowledgeNetworkAuthorizationActionLabel>
                      {t("knowledgeNetwork.authorizeAction")}
                    </KnowledgeNetworkAuthorizationActionLabel>
                  </Button>
                ) : null}
                {canMapSelectedRelation && selectedRelation ? (
                  <Button
                    autoInsertSpace={false}
                    onClick={() => onOpenRelationMapping?.(selectedRelation)}
                  >
                    {t("knowledgeNetwork.relationTypeMappingEntry")}
                  </Button>
                ) : null}
                {canAuthorizeSelectedRelation && selectedRelation ? (
                  <Button
                    autoInsertSpace={false}
                    onClick={() => onAuthorizeRelation?.(selectedRelation)}
                  >
                    <KnowledgeNetworkAuthorizationActionLabel>
                      {t("knowledgeNetwork.authorizeAction")}
                    </KnowledgeNetworkAuthorizationActionLabel>
                  </Button>
                ) : null}
                {canExecuteSelected && selected.kind === "action" ? (
                  <Button autoInsertSpace={false} onClick={() => onExecuteAction(selected.value)}>
                    {t("knowledgeNetwork.actionTypeExecutionEntry")}
                  </Button>
                ) : null}
                {canAuthorizeSelectedAction && selectedAction ? (
                  <Button
                    autoInsertSpace={false}
                    onClick={() => onAuthorizeAction?.(selectedAction)}
                  >
                    <KnowledgeNetworkAuthorizationActionLabel>
                      {t("knowledgeNetwork.authorizeAction")}
                    </KnowledgeNetworkAuthorizationActionLabel>
                  </Button>
                ) : null}
                {canDeleteSelectedObject && selectedObjectRecord ? (
                  <Button
                    autoInsertSpace={false}
                    danger
                    onClick={() => onDeleteObject(selectedObjectRecord)}
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
                {canDeleteSelectedRelation && selectedRelation ? (
                  <Button
                    autoInsertSpace={false}
                    danger
                    onClick={() => onDeleteRelation?.(selectedRelation)}
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
                {canDeleteSelectedAction && selectedAction ? (
                  <Button
                    autoInsertSpace={false}
                    danger
                    onClick={() => onDeleteAction?.(selectedAction)}
                  >
                    {t("common.delete")}
                  </Button>
                ) : null}
              </div>
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t("knowledgeNetwork.objectTypeGraphResourceType")}>
                  {selectedTypeLabel}
                </Descriptions.Item>
                <Descriptions.Item label={t("common.id")}>
                  <Typography.Text copyable={{ text: selectedIdentifier }} type="secondary">
                    {selectedIdentifier}
                  </Typography.Text>
                </Descriptions.Item>
                {selected.kind === "relation" ? (
                  <>
                    <Descriptions.Item label={t("knowledgeNetwork.relationTypeListSourceObject")}>
                      {selected.value.sourceObjectTypeName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.relationTypeListTargetObject")}>
                      {selected.value.targetObjectTypeName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.relationTypeMappingMode")}>
                      {t(
                        selected.value.mappingMode === "direct"
                          ? "knowledgeNetwork.relationTypeDirectMapping"
                          : "knowledgeNetwork.relationTypeResourceMapping",
                      )}
                    </Descriptions.Item>
                  </>
                ) : null}
                {selected.kind === "action" ? (
                  <>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeKind")}>
                      <DrawerEllipsis
                        value={actionTypeLabel(
                          selectedActionRecord?.actionKind ?? selected.value.actionKind,
                          t,
                        )}
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeObject")}>
                      <DrawerEllipsis
                        value={
                          selectedActionRecord?.objectTypeName || selected.value.objectTypeName
                        }
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeTriggerCondition")}>
                      <DrawerEllipsis value={selectedActionConditionLabel} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionSourceType")}>
                      <DrawerEllipsis value={selectedActionSourceTypeLabel} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionSourceName")}>
                      <DrawerEllipsis value={selectedActionSourceName} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeExecutionParameters")}>
                      <DrawerEllipsis value={selectedActionParameterLabel} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeAffectedObject")}>
                      <DrawerEllipsis value={selectedActionAffectedObjectLabel} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeAffectDescription")}>
                      <DrawerEllipsis value={selectedActionAffectDescription} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("common.tag")}>
                      <DrawerEllipsis value={selectedActionTags} />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeUpdater")}>
                      <DrawerEllipsis
                        value={
                          selectedActionRecord?.updaterName ||
                          t("knowledgeNetwork.actionTypeEmptyValue")
                        }
                      />
                    </Descriptions.Item>
                    <Descriptions.Item label={t("knowledgeNetwork.actionTypeUpdateTime")}>
                      <DrawerEllipsis
                        value={
                          selectedActionRecord?.updateTime ||
                          t("knowledgeNetwork.actionTypeEmptyValue")
                        }
                      />
                    </Descriptions.Item>
                  </>
                ) : null}
              </Descriptions>
              <div className={styles.drawerDescription}>
                <span className={styles.drawerDescriptionLabel}>
                  {t("knowledgeNetwork.descriptionField")}
                </span>
                <div
                  className={`${styles.drawerDescriptionContent} ${selected.kind === "action" ? styles.drawerDescriptionEllipsis : ""}`}
                  title={selected.kind === "action" ? selectedDescription : undefined}
                >
                  {selectedDescription || t("knowledgeNetwork.noDescription")}
                </div>
              </div>
            </div>
          </Spin>
        ) : null}
      </Drawer>
    </div>
  );
}
