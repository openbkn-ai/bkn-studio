/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { AimOutlined, ApartmentOutlined, FullscreenOutlined } from "@ant-design/icons";
import { Button, Descriptions, Drawer, Empty, Tag, Tooltip } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  directObjectMetricReferences,
  objectMetricVersionKey,
} from "@/modules/knowledge-network/lib/object-metric-lineage";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./ObjectMetricGraphCanvas.module.css";
import { objectMetricText } from "@/modules/knowledge-network/lib/object-metric-text";
import { useTranslation } from "react-i18next";

type Position = { x: number; y: number };
type GraphNode =
  | { id: string; kind: "object"; object: KnowledgeNetworkObjectTypeRecord; position: Position }
  | {
      id: string;
      kind: "relation";
      position: Position;
      relation: KnowledgeNetworkRelationTypeRecord;
    }
  | { id: string; kind: "metric"; metric: ObjectMetricRecordV1; position: Position };

type GraphEdge = {
  from: GraphNode;
  id: string;
  kind: "metric_dependency" | "metric_owner" | "relation";
  to: GraphNode;
};

type Props = {
  metrics: ObjectMetricRecordV1[];
  objectTypes: KnowledgeNetworkObjectTypeRecord[];
  onOpenMetric: (metricId: string) => void;
  onSelectObject: (objectTypeId: string) => void;
  relationTypes: KnowledgeNetworkRelationTypeRecord[];
  selectedObjectTypeId: string;
};

const VIEWBOX = { height: 620, width: 1100 };
const selectedObjectPosition = { x: 295, y: 215 };
const metricTypeNames = {
  get atomic() {
    return objectMetricText("me5675ba4c2fd");
  },
  get composite() {
    return objectMetricText("m3e70c815f275");
  },
  get derived() {
    return objectMetricText("me88b222ae28a");
  },
};
const metricTypeClass = {
  atomic: styles.atomic,
  composite: styles.composite,
  derived: styles.derived,
};

function defaultLayout(
  objectTypes: KnowledgeNetworkObjectTypeRecord[],
  relationTypes: KnowledgeNetworkRelationTypeRecord[],
  metrics: ObjectMetricRecordV1[],
  selectedObjectTypeId: string,
): GraphNode[] {
  const selectedObject = objectTypes.find((item) => item.id === selectedObjectTypeId);
  if (!selectedObject) return [];
  const connectedRelations = relationTypes
    .filter(
      (item) =>
        item.sourceObjectTypeId === selectedObjectTypeId ||
        item.targetObjectTypeId === selectedObjectTypeId,
    )
    .slice(0, 8);
  const connectedObjectIds = connectedRelations.map((item) =>
    item.sourceObjectTypeId === selectedObjectTypeId
      ? item.targetObjectTypeId
      : item.sourceObjectTypeId,
  );
  const uniqueConnectedIds = [...new Set(connectedObjectIds)].filter(
    (objectTypeId) => objectTypeId !== selectedObjectTypeId,
  );
  const nodes: GraphNode[] = [
    {
      id: `object:${selectedObject.id}`,
      kind: "object",
      object: selectedObject,
      position: selectedObjectPosition,
    },
  ];
  uniqueConnectedIds.forEach((objectTypeId, index) => {
    const object = objectTypes.find((item) => item.id === objectTypeId);
    if (!object) return;
    const angle = (Math.PI * 2 * index) / Math.max(uniqueConnectedIds.length, 1) - Math.PI / 2;
    nodes.push({
      id: `object:${object.id}`,
      kind: "object",
      object,
      position: { x: 760 + Math.cos(angle) * 235, y: 220 + Math.sin(angle) * 130 },
    });
  });
  connectedRelations.forEach((relation, index) => {
    const relatedId =
      relation.sourceObjectTypeId === selectedObjectTypeId
        ? relation.targetObjectTypeId
        : relation.sourceObjectTypeId;
    const related = nodes.find((item) => item.id === `object:${relatedId}`);
    if (!related) return;
    const dx = related.position.x - selectedObjectPosition.x;
    const dy = related.position.y - selectedObjectPosition.y;
    const distance = Math.hypot(dx, dy) || 1;
    const laneOffset = (index - (connectedRelations.length - 1) / 2) * 30;
    nodes.push({
      id: `relation:${relation.id}:${index}`,
      kind: "relation",
      relation,
      position: {
        x: (selectedObjectPosition.x + related.position.x) / 2 - (dy / distance) * laneOffset,
        y: (selectedObjectPosition.y + related.position.y) / 2 + (dx / distance) * laneOffset,
      },
    });
  });
  metrics
    .filter((metric) => metric.definition.owner_object_type_id === selectedObjectTypeId)
    .slice(0, 15)
    .forEach((metric, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      nodes.push({
        id: `metric:${metric.definition.id}:${metric.definition.version}`,
        kind: "metric",
        metric,
        position: { x: 125 + column * 215, y: 440 + row * 68 },
      });
    });
  return nodes;
}

function center(node: GraphNode) {
  return node.position;
}

function nodeDragBounds(node: GraphNode) {
  if (node.kind === "object") return { x: 72, y: 40 };
  if (node.kind === "relation") return { x: 58, y: 28 };
  return { x: 80, y: 30 };
}

export function ObjectMetricGraphCanvas({
  metrics,
  objectTypes,
  onOpenMetric,
  onSelectObject,
  relationTypes,
  selectedObjectTypeId,
}: Props) {
  useTranslation();
  const initialNodes = useMemo(
    () => defaultLayout(objectTypes, relationTypes, metrics, selectedObjectTypeId),
    [metrics, objectTypes, relationTypes, selectedObjectTypeId],
  );
  const [nodes, setNodes] = useState(initialNodes);
  const [selectedMetric, setSelectedMetric] = useState<ObjectMetricRecordV1>();
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
  }>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);

  useEffect(() => setNodes(initialNodes), [initialNodes]);

  const objectNode = (objectTypeId: string) =>
    nodes.find((item) => item.id === `object:${objectTypeId}`);
  const edges: GraphEdge[] = nodes
    .filter((item): item is Extract<GraphNode, { kind: "relation" }> => item.kind === "relation")
    .flatMap((relationNode) => {
      const source = objectNode(relationNode.relation.sourceObjectTypeId);
      const target = objectNode(relationNode.relation.targetObjectTypeId);
      return relationNode && source && target
        ? [
            { from: source, id: `${relationNode.id}:source`, kind: "relation", to: relationNode },
            { from: relationNode, id: `${relationNode.id}:target`, kind: "relation", to: target },
          ]
        : [];
    });
  nodes
    .filter((item): item is Extract<GraphNode, { kind: "metric" }> => item.kind === "metric")
    .forEach((metricNode) => {
      const owner = objectNode(metricNode.metric.definition.owner_object_type_id);
      if (owner) {
        edges.push({
          from: owner,
          id: `${metricNode.id}:owner`,
          kind: "metric_owner",
          to: metricNode,
        });
      }
    });
  const metricNodesByKey = new Map(
    nodes
      .filter((item): item is Extract<GraphNode, { kind: "metric" }> => item.kind === "metric")
      .map((item) => [
        objectMetricVersionKey(item.metric.definition.id, item.metric.definition.version),
        item,
      ]),
  );
  metricNodesByKey.forEach((dependent) => {
    directObjectMetricReferences(dependent.metric).forEach((reference) => {
      const dependency = metricNodesByKey.get(
        objectMetricVersionKey(reference.metric_id, reference.version),
      );
      if (dependency) {
        edges.push({
          from: dependency,
          id: `${dependency.id}:dependency:${dependent.id}`,
          kind: "metric_dependency",
          to: dependent,
        });
      }
    });
  });

  const toCanvasPosition = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: ((clientX - rect.left) / rect.width) * VIEWBOX.width,
      y: ((clientY - rect.top) / rect.height) * VIEWBOX.height,
    };
  };

  if (!nodes.length) {
    return <Empty description={objectMetricText("m4093b8d5ac81")} />;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.canvasHeader}>
        <div>
          <strong>{objectMetricText("m8864ee148733")}</strong>
          <span>{objectMetricText("m25d94a840760")}</span>
        </div>
        <Tooltip title={objectMetricText("m3208ffc11c17")}>
          <Button icon={<AimOutlined />} onClick={() => setNodes(initialNodes)} size="small">
            {objectMetricText("mb74829d20f7d")}
          </Button>
        </Tooltip>
      </div>
      <div
        className={styles.canvas}
        onPointerMove={(event) => {
          if (!dragging) return;
          const point = toCanvasPosition(event.clientX, event.clientY);
          draggedRef.current =
            draggedRef.current ||
            Math.abs(point.x - dragging.startX) > 3 ||
            Math.abs(point.y - dragging.startY) > 3;
          setNodes((current) =>
            current.map((item) => {
              if (item.id !== dragging.id) return item;
              const bounds = nodeDragBounds(item);
              return {
                ...item,
                position: {
                  x: Math.max(
                    bounds.x,
                    Math.min(VIEWBOX.width - bounds.x, point.x - dragging.offsetX),
                  ),
                  y: Math.max(
                    bounds.y,
                    Math.min(VIEWBOX.height - bounds.y, point.y - dragging.offsetY),
                  ),
                },
              };
            }),
          );
        }}
        onPointerUp={() => setDragging(undefined)}
        ref={canvasRef}
      >
        <svg
          aria-hidden
          className={styles.edges}
          preserveAspectRatio="none"
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        >
          <defs>
            <marker
              id="metric-lineage-arrow"
              markerHeight="8"
              markerWidth="8"
              orient="auto"
              refX="7"
              refY="3"
              viewBox="0 0 8 6"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill="var(--metric-graph-lineage-edge)" />
            </marker>
          </defs>
          {edges.map(({ from, id, kind, to }) => (
            <line
              className={
                kind === "metric_dependency"
                  ? styles.metricDependencyEdge
                  : kind === "metric_owner"
                    ? styles.metricEdge
                    : styles.relationEdge
              }
              key={id}
              markerEnd={kind === "metric_dependency" ? "url(#metric-lineage-arrow)" : undefined}
              x1={center(from).x}
              x2={center(to).x}
              y1={center(from).y}
              y2={center(to).y}
            />
          ))}
        </svg>
        {nodes.map((node) => {
          const positionStyle = {
            left: `${(node.position.x / VIEWBOX.width) * 100}%`,
            top: `${(node.position.y / VIEWBOX.height) * 100}%`,
          };
          const pointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
            const point = toCanvasPosition(event.clientX, event.clientY);
            draggedRef.current = false;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging({
              id: node.id,
              offsetX: point.x - node.position.x,
              offsetY: point.y - node.position.y,
              startX: point.x,
              startY: point.y,
            });
          };
          if (node.kind === "object") {
            return (
              <button
                aria-label={objectMetricText("m1a35a8fea7ba", { p0: node.object.name })}
                className={`${styles.node} ${styles.objectNode} ${node.object.id === selectedObjectTypeId ? styles.focusObject : ""}`}
                key={node.id}
                onClick={() => {
                  if (!draggedRef.current) onSelectObject(node.object.id);
                }}
                onPointerDown={pointerDown}
                style={positionStyle}
                title={`${node.object.name} · ${node.object.id}`}
                type="button"
              >
                <span className={styles.nodeEyebrow}>{objectMetricText("m04c269ce47c9")}</span>
                <strong>{node.object.name}</strong>
                <small>{node.object.id}</small>
              </button>
            );
          }
          if (node.kind === "relation") {
            return (
              <button
                aria-label={objectMetricText("mfa030e9d6456", { p0: node.relation.name })}
                className={`${styles.node} ${styles.relationNode}`}
                key={node.id}
                onPointerDown={pointerDown}
                style={positionStyle}
                title={`${node.relation.name} · ${node.relation.id}`}
                type="button"
              >
                <ApartmentOutlined />
                <span>{node.relation.name}</span>
                <small>{node.relation.id}</small>
              </button>
            );
          }
          return (
            <button
              aria-label={`${metricTypeNames[node.metric.definition.metric_type]} ${node.metric.definition.name}`}
              className={`${styles.node} ${styles.metricNode} ${metricTypeClass[node.metric.definition.metric_type]}`}
              key={node.id}
              onClick={() => {
                if (!draggedRef.current) setSelectedMetric(node.metric);
              }}
              onPointerDown={pointerDown}
              style={positionStyle}
              title={`${node.metric.definition.name} · ${node.metric.definition.code}@v${node.metric.definition.version}`}
              type="button"
            >
              <span>{metricTypeNames[node.metric.definition.metric_type]}</span>
              <strong>{node.metric.definition.name}</strong>
              <small>
                {node.metric.definition.code}@v{node.metric.definition.version}
              </small>
            </button>
          );
        })}
        <div className={styles.legend}>
          <span>
            <i className={styles.objectLegend} />
            {objectMetricText("m04c269ce47c9")}
          </span>
          <span>
            <i className={styles.relationLegend} />
            {objectMetricText("me68ff632cab8")}
          </span>
          <span>
            <i className={styles.atomicLegend} />
            {objectMetricText("me5675ba4c2fd")}
          </span>
          <span>
            <i className={styles.derivedLegend} />
            {objectMetricText("me88b222ae28a")}
          </span>
          <span>
            <i className={styles.compositeLegend} />
            {objectMetricText("m3e70c815f275")}
          </span>
          <span>
            <i className={styles.lineageLegend} />
            {objectMetricText("m3d28b1387d4e")}
          </span>
        </div>
      </div>
      <Drawer
        destroyOnHidden
        onClose={() => setSelectedMetric(undefined)}
        open={Boolean(selectedMetric)}
        rootClassName={styles.drawer}
        title={objectMetricText("m8646198458ce")}
        width="min(520px, calc(100vw - 24px))"
      >
        {selectedMetric ? (
          <div className={styles.drawerContent}>
            <div className={styles.drawerTitle}>
              <div>
                <Tag color="blue">{metricTypeNames[selectedMetric.definition.metric_type]}</Tag>
                <h2>{selectedMetric.definition.name}</h2>
                <code>
                  {selectedMetric.definition.code}@v{selectedMetric.definition.version}
                </code>
              </div>
              <Tag
                color={
                  selectedMetric.definition.lifecycle.status === "published" ? "success" : "default"
                }
              >
                {selectedMetric.definition.lifecycle.status === "published"
                  ? objectMetricText("md334724d6b2f")
                  : objectMetricText("m2a2fd29bd27a")}
              </Tag>
            </div>
            <p>{selectedMetric.definition.description}</p>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label={objectMetricText("m90f9643a2da5")}>
                {objectTypes.find(
                  (item) => item.id === selectedMetric.definition.owner_object_type_id,
                )?.name ?? selectedMetric.definition.owner_object_type_id}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("mec7844e49915")}>
                {selectedMetric.definition.calculation_scope === "object_instance"
                  ? objectMetricText("mabe9d02781fc")
                  : objectMetricText("m9c51e86f9307")}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("mc8475edb7e01")}>
                {selectedMetric.definition.result_semantics.value.semantic_type}
              </Descriptions.Item>
              <Descriptions.Item label={objectMetricText("m80b19d68b149")}>
                {selectedMetric.definition.result_semantics.value.unit?.code ??
                  objectMetricText("m3be9bf13138e")}
              </Descriptions.Item>
            </Descriptions>
            <Button
              block
              icon={<FullscreenOutlined />}
              onClick={() => onOpenMetric(selectedMetric.definition.id)}
              type="primary"
            >
              {objectMetricText("m316e53b767a4")}
            </Button>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
