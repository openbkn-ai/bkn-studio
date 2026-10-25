/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { ArrowLeftOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Spin } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { useCapability } from "@/framework/entitlement/use-entitlement";
import { extractRequestErrorMessage } from "@/framework/request/error-message";
import { ObjectMetricTrialDrawer } from "@/modules/knowledge-network/components/object-metric/ObjectMetricTrialDrawer";
import {
  ObjectTypeResourceGraph,
  type ObjectTypeGraphSelectedResource,
} from "@/modules/knowledge-network/components/object-type/ObjectTypeResourceGraph";
import {
  knowledgeNetworkReturnState,
  writeKnowledgeNetworkGraphSelection,
  type KnowledgeNetworkGraphSelection,
} from "@/modules/knowledge-network/lib/knowledge-network-navigation";
import { OntologyGraphCard } from "@/modules/knowledge-network/components/preview/OntologyGraphCard";
import {
  queryObjectMetricDataV1,
  queryObjectMetricDrillThroughV1,
  trialObjectMetricDataV1,
  trialObjectMetricDrillThroughV1,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import { getKnowledgeNetworkObjectTypeDetail } from "@/modules/knowledge-network/services/object-type.service";
import { getKnowledgeNetworkOverviewGraph } from "@/modules/knowledge-network/services/overview-graph.service";
import type {
  ConceptGroupRecord,
  KnowledgeNetworkOverviewGraph,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewEdge,
  KnowledgeNetworkPreviewNode,
  KnowledgeNetworkRelationTypeRecord,
} from "@/modules/knowledge-network/types/knowledge-network";
import type { ObjectMetricRecordV1 } from "@/modules/knowledge-network/types/object-metric";
import type { ObjectTypeDetail } from "@/modules/knowledge-network/types/object-type";

import styles from "./ConceptGroupGraphPanel.module.css";

const GROUP_GRAPH_NODE_LIMIT = 500;
const GROUP_GRAPH_EDGE_LIMIT = 1_000;
const DEFAULT_COLOR = "#2e68ff";

function mergeGroupGraphPages(
  current: KnowledgeNetworkOverviewGraph | null,
  page: KnowledgeNetworkOverviewGraph,
): KnowledgeNetworkOverviewGraph {
  const nodes = new Map<string, KnowledgeNetworkPreviewNode>();
  const edges = new Map<string, KnowledgeNetworkPreviewEdge>();
  current?.graph.nodes.forEach((node) => nodes.set(node.id, node));
  current?.graph.edges.forEach((edge) => edges.set(edge.id, edge));
  page.graph.nodes.forEach((node) => nodes.set(node.id, node));
  page.graph.edges.forEach((edge) => edges.set(edge.id, edge));
  return {
    ...page,
    graph: { nodes: [...nodes.values()], edges: [...edges.values()] },
    truncated: nodes.size < page.objectTypeTotal || edges.size < page.relationTypeTotal,
  };
}

type ConceptGroupGraphPanelProps = {
  focusedObjectTypeId?: string | null;
  group: ConceptGroupRecord;
  initialSelectedResource?: KnowledgeNetworkGraphSelection;
  networkId: string;
  networkName?: string;
  onFocusedObjectTypeIdChange?: (id: string | null) => void;
  onSelectedResourceChange?: (resource?: ObjectTypeGraphSelectedResource) => void;
  onSelectedObjectTypeIdChange: (id: string | null) => void;
  refreshVersion: number;
  selectedObjectTypeId: string | null;
};

export function ConceptGroupGraphPanel({
  focusedObjectTypeId,
  group,
  initialSelectedResource,
  networkId,
  networkName = "",
  onFocusedObjectTypeIdChange,
  onSelectedResourceChange,
  onSelectedObjectTypeIdChange,
  refreshVersion,
  selectedObjectTypeId,
}: ConceptGroupGraphPanelProps) {
  const { t } = useTranslation();
  const [result, setResult] = useState<KnowledgeNetworkOverviewGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [partialError, setPartialError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    setPartialError(undefined);
    setResult(null);
    void (async () => {
      let cursor: string | undefined;
      let accumulated: KnowledgeNetworkOverviewGraph | null = null;
      const seenCursors = new Set<string>();
      try {
        do {
          const page = await getKnowledgeNetworkOverviewGraph(networkId, {
            conceptGroupId: group.id,
            ...(cursor ? { cursor } : {}),
            edgeLimit: GROUP_GRAPH_EDGE_LIMIT,
            nodeLimit: GROUP_GRAPH_NODE_LIMIT,
          });
          if (cancelled) return;
          accumulated = mergeGroupGraphPages(accumulated, page);
          setResult(accumulated);
          setLoading(false);
          cursor = page.nextCursor;
          if (cursor) {
            if (seenCursors.has(cursor)) break;
            seenCursors.add(cursor);
          }
        } while (cursor);
      } catch (nextError) {
        if (!cancelled) {
          const message = extractRequestErrorMessage(nextError);
          if (accumulated) {
            setPartialError(message);
          } else {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [group.id, networkId, refreshVersion]);

  useEffect(() => {
    if (
      result &&
      !result.truncated &&
      selectedObjectTypeId &&
      !result.graph.nodes.some((node) => node.id === selectedObjectTypeId)
    ) {
      onSelectedObjectTypeIdChange(null);
    }
  }, [onSelectedObjectTypeIdChange, result, selectedObjectTypeId]);

  const objectTypes = useMemo<KnowledgeNetworkObjectTypeRecord[]>(
    () =>
      (result?.graph.nodes ?? []).map((node) => ({
        color: node.color || DEFAULT_COLOR,
        conceptGroupIds: [group.id],
        conceptGroupNames: [group.name],
        description: "",
        hasIndex: node.indexStatus?.state === "available",
        icon: node.icon,
        id: node.id,
        indexStatus: node.indexStatus,
        name: node.name,
        tags: [],
        updateTime: "",
        updaterName: "",
      })),
    [group.id, group.name, result?.graph.nodes],
  );
  const relationTypes = useMemo<KnowledgeNetworkRelationTypeRecord[]>(() => {
    const names = new Map(objectTypes.map((item) => [item.id, item.name]));
    return (result?.graph.edges ?? []).map((edge) => ({
      color: DEFAULT_COLOR,
      description: "",
      id: edge.id,
      mappingMode: edge.mappingMode ?? "direct",
      name: edge.name,
      sourceObjectTypeId: edge.sourceId,
      sourceObjectTypeName: names.get(edge.sourceId) ?? edge.sourceId,
      tags: [],
      targetObjectTypeId: edge.targetId,
      targetObjectTypeName: names.get(edge.targetId) ?? edge.targetId,
      updateTime: "",
      updaterName: "",
    }));
  }, [objectTypes, result?.graph.edges]);

  if (loading) {
    return (
      <div className={styles.state}>
        <Spin />
      </div>
    );
  }

  if (error) {
    return <Alert message={error} showIcon type="error" />;
  }

  if (!result) {
    return <Empty description={t("knowledgeNetwork.conceptGroupGraphEmpty")} />;
  }

  return (
    <div className={styles.root}>
      {partialError && !focusedObjectTypeId ? (
        <Alert
          description={partialError}
          message={t("knowledgeNetwork.conceptGroupGraphPartialError")}
          showIcon
          type="warning"
        />
      ) : null}
      {focusedObjectTypeId ? (
        <FocusedObjectTypeGraph
          initialSelectedResource={initialSelectedResource}
          networkId={networkId}
          networkName={networkName}
          objectTypeColors={Object.fromEntries(objectTypes.map((item) => [item.id, item.color]))}
          objectTypeId={focusedObjectTypeId}
          onBack={() => onFocusedObjectTypeIdChange?.(null)}
          onSelectObject={(id) => onFocusedObjectTypeIdChange?.(id)}
          onSelectedResourceChange={onSelectedResourceChange}
          refreshVersion={refreshVersion}
        />
      ) : (
        <OntologyGraphCard
          emptyDescription={t("knowledgeNetwork.conceptGroupGraphEmpty")}
          fillAvailableHeight
          logicalGrouping={false}
          loadConceptGroups={false}
          networkId={networkId}
          objectTypes={objectTypes}
          onExpandNode={(id) => onFocusedObjectTypeIdChange?.(id)}
          onSelectedIdChange={onSelectedObjectTypeIdChange}
          relationTypes={relationTypes}
          selectedId={selectedObjectTypeId}
          showInspector={false}
          title={group.name}
        />
      )}
    </div>
  );
}

type FocusedObjectTypeGraphProps = {
  initialSelectedResource?: KnowledgeNetworkGraphSelection;
  networkId: string;
  networkName: string;
  objectTypeColors: Record<string, string | undefined>;
  objectTypeId: string;
  onBack: () => void;
  onSelectObject: (id: string) => void;
  onSelectedResourceChange?: (resource?: ObjectTypeGraphSelectedResource) => void;
  refreshVersion: number;
};

function FocusedObjectTypeGraph({
  initialSelectedResource,
  networkId,
  networkName,
  objectTypeColors,
  objectTypeId,
  onBack,
  onSelectObject,
  onSelectedResourceChange,
  refreshVersion,
}: FocusedObjectTypeGraphProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const metricsAvailable = useCapability(CAPABILITIES.OBJECT_METRICS) === "available";
  const [objectType, setObjectType] = useState<ObjectTypeDetail | null>();
  const [error, setError] = useState<string>();
  const [trialMetric, setTrialMetric] = useState<ObjectMetricRecordV1>();
  const [trialObjectType, setTrialObjectType] = useState<ObjectTypeDetail | null | undefined>();
  const trialRequestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setObjectType(undefined);
    setError(undefined);
    void getKnowledgeNetworkObjectTypeDetail(networkId, objectTypeId)
      .then((result) => {
        if (!cancelled) setObjectType(result ?? null);
      })
      .catch((nextError) => {
        if (!cancelled) {
          setObjectType(null);
          setError(extractRequestErrorMessage(nextError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [networkId, objectTypeId, refreshVersion]);

  const graphReturnTo = (selection: KnowledgeNetworkGraphSelection) => {
    const params = new URLSearchParams(location.search);
    params.set("focusObjectTypeId", objectTypeId);
    writeKnowledgeNetworkGraphSelection(params, selection);
    return `${location.pathname}?${params.toString()}`;
  };
  const openWithReturn = (path: string, selection: KnowledgeNetworkGraphSelection) => {
    void navigate(path, { state: knowledgeNetworkReturnState(graphReturnTo(selection)) });
  };
  const openMetricTrial = async (record: ObjectMetricRecordV1) => {
    const request = ++trialRequestRef.current;
    setTrialObjectType(undefined);
    try {
      const detail = await getKnowledgeNetworkObjectTypeDetail(
        networkId,
        record.definition.owner_object_type_id,
      );
      if (request !== trialRequestRef.current) return;
      setTrialObjectType(detail ?? null);
    } catch {
      if (request !== trialRequestRef.current) return;
      setTrialObjectType(null);
    } finally {
      if (request === trialRequestRef.current) setTrialMetric(record);
    }
  };

  if (objectType === undefined) {
    return (
      <div className={styles.state}>
        <Spin />
      </div>
    );
  }

  if (!objectType) {
    return (
      <div className={styles.focusState}>
        <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
          {t("knowledgeNetwork.conceptGroupGraphBack")}
        </Button>
        {error ? <Alert message={error} showIcon type="error" /> : null}
        <Empty description={t("knowledgeNetwork.emptyObjectTypes")} />
      </div>
    );
  }

  return (
    <div className={styles.focusRoot}>
      <ObjectTypeResourceGraph
        allowAuthorizeObject={false}
        allowDeleteObject={false}
        allowDeleteRelation={false}
        allowEditObject={false}
        allowExecuteAction={false}
        allowTrialMetric={false}
        backLabel={t("knowledgeNetwork.conceptGroupGraphBack")}
        canAuthorizeObject={false}
        canModify={false}
        canRequestObjectPermission={false}
        initialSelectedResource={initialSelectedResource}
        key={objectType.id}
        metricsAvailable={metricsAvailable}
        networkId={networkId}
        networkName={networkName}
        objectType={objectType}
        objectTypeColors={objectTypeColors}
        onBack={onBack}
        onAuthorizeObject={(record) => {
          openWithReturn(
            `/knowledge-network/workspace/${networkId}/object-types/${record.id}/authorization`,
            { id: record.id, kind: "object" },
          );
        }}
        onDeleteObject={() => undefined}
        onEditObject={(id) => {
          openWithReturn(`/knowledge-network/workspace/${networkId}/object-types/${id}/edit`, {
            id,
            kind: "object",
          });
        }}
        onExecuteAction={(action) => {
          openWithReturn(
            `/knowledge-network/workspace/${networkId}/action-types/${action.id}/execution`,
            { id: action.id, kind: "action" },
          );
        }}
        onOpenAction={(action) => {
          openWithReturn(
            `/knowledge-network/workspace/${networkId}/action-types/${action.id}/detail`,
            { id: action.id, kind: "action" },
          );
        }}
        onOpenMetric={(metric) => {
          openWithReturn(
            `/knowledge-network/workspace/${networkId}/metrics/${metric.definition.id}/detail?version=${metric.definition.version}`,
            {
              id: metric.definition.id,
              kind: "metric",
              version: metric.definition.version,
            },
          );
        }}
        onOpenObject={(id) => {
          openWithReturn(`/knowledge-network/workspace/${networkId}/object-types/${id}/detail`, {
            id,
            kind: "object",
          });
        }}
        onOpenRelation={(relation) => {
          openWithReturn(
            `/knowledge-network/workspace/${networkId}/relation-types/${relation.id}/detail`,
            { id: relation.id, kind: "relation" },
          );
        }}
        onSelectedResourceChange={onSelectedResourceChange}
        onSelectObject={onSelectObject}
        onTrialMetric={(metric) => void openMetricTrial(metric)}
        permissionRequestsEnabled={false}
        refreshVersion={refreshVersion}
      />
      {trialMetric ? (
        <ObjectMetricTrialDrawer
          definition={trialMetric.definition}
          key={`${trialMetric.definition.id}@${trialMetric.definition.version}`}
          mode={
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? "published"
              : "draft"
          }
          networkId={networkId}
          objectType={trialObjectType}
          onClose={() => {
            trialRequestRef.current += 1;
            setTrialMetric(undefined);
            setTrialObjectType(undefined);
          }}
          onDrillThrough={(query, bucketKey, cursor) =>
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? queryObjectMetricDrillThroughV1(
                  networkId,
                  trialMetric.definition.id,
                  trialMetric.definition.version,
                  query,
                  bucketKey,
                  cursor,
                )
              : trialObjectMetricDrillThroughV1(
                  networkId,
                  trialMetric.definition,
                  query,
                  bucketKey,
                  cursor,
                )
          }
          onRun={(query) =>
            ["published", "deprecated"].includes(trialMetric.definition.lifecycle.status)
              ? queryObjectMetricDataV1(
                  networkId,
                  trialMetric.definition.id,
                  trialMetric.definition.version,
                  query,
                )
              : trialObjectMetricDataV1(networkId, trialMetric.definition, query)
          }
          open
        />
      ) : null}
    </div>
  );
}
