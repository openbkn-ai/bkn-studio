/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/**
 * Ontology section on overview pages. Show the ontology-preview graph by default and load the
 * ontology-structure table only after expansion to avoid fetching every object-type detail at once.
 */

import { DownOutlined, RightOutlined } from "@ant-design/icons";
import { Button, Spin, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { TablePaginationBar } from "@/framework/ui/common/TablePaginationBar";
import { OntologyGraphCard } from "@/modules/knowledge-network/components/preview/OntologyGraphCard";
import { formatKnowledgeNetworkObjectTypeIndexStateLabel } from "@/modules/knowledge-network/utils/resource-index-state";
import {
  getKnowledgeNetworkObjectTypeDetail,
  getKnowledgeNetworkOverviewGraph,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkOverviewGraph,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRelationTypeRecord,
  ObjectTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";

import styles from "./OverviewOntologyBlock.module.css";

type OverviewOntologyBlockProps = {
  detailsExpanded?: boolean;
  networkId: string;
  onToggleDetails?: () => void;
};

const DEFAULT_COLOR = "#2e68ff";
const OVERVIEW_NODE_LIMIT = 60;
const OVERVIEW_EDGE_LIMIT = 120;
const MAX_MERGED_NODES = 200;
const MAX_MERGED_EDGES = 500;
const DETAIL_CONCURRENCY = 6;

const EMPTY_GRAPH: KnowledgeNetworkPreviewGraph = { edges: [], nodes: [] };

function mergeOverviewGraph(
  current: KnowledgeNetworkPreviewGraph,
  incoming: KnowledgeNetworkPreviewGraph,
): KnowledgeNetworkPreviewGraph {
  const nodes = new Map(current.nodes.map((node) => [node.id, node]));
  incoming.nodes.forEach((node) => {
    if (nodes.has(node.id) || nodes.size < MAX_MERGED_NODES) {
      nodes.set(node.id, node);
    }
  });
  const nodeIds = new Set(nodes.keys());
  const edges = new Map(current.edges.map((edge) => [edge.id, edge]));
  incoming.edges.forEach((edge) => {
    if (
      (edges.has(edge.id) || edges.size < MAX_MERGED_EDGES) &&
      nodeIds.has(edge.sourceId) &&
      nodeIds.has(edge.targetId)
    ) {
      edges.set(edge.id, edge);
    }
  });
  return { edges: [...edges.values()], nodes: [...nodes.values()] };
}

async function loadDetailsWithConcurrency(
  items: KnowledgeNetworkObjectTypeRecord[],
  load: (item: KnowledgeNetworkObjectTypeRecord) => Promise<ObjectTypeDetail | null>,
) {
  const results = new Map<string, ObjectTypeDetail | null>();
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(DETAIL_CONCURRENCY, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      results.set(item.id, await load(item));
    }
  });
  await Promise.all(workers);
  return results;
}

export function OverviewOntologyBlock({
  detailsExpanded = false,
  networkId,
  onToggleDetails,
}: OverviewOntologyBlockProps) {
  const { t } = useTranslation();

  const [graph, setGraph] = useState<KnowledgeNetworkPreviewGraph>(EMPTY_GRAPH);
  const [objectTypeTotal, setObjectTypeTotal] = useState(0);
  const [relationTypeTotal, setRelationTypeTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [expanding, setExpanding] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [detailById, setDetailById] = useState<Record<string, ObjectTypeDetail | null>>({});
  const [previewLoading, setPreviewLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [entityPage, setEntityPage] = useState(1);
  const [entityPageSize, setEntityPageSize] = useState(10);
  const [relationPage, setRelationPage] = useState(1);
  const [relationPageSize, setRelationPageSize] = useState(10);
  const [bindingPage, setBindingPage] = useState(1);
  const [bindingPageSize, setBindingPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);
    setGraph(EMPTY_GRAPH);
    setObjectTypeTotal(0);
    setRelationTypeTotal(0);
    setTruncated(false);
    setNextCursor(undefined);
    setExpandedNodeIds(new Set());
    setDetailById({});
    setEntityPage(1);
    setRelationPage(1);
    setBindingPage(1);

    void (async () => {
      try {
        const result = await getKnowledgeNetworkOverviewGraph(networkId, {
          edgeLimit: OVERVIEW_EDGE_LIMIT,
          nodeLimit: OVERVIEW_NODE_LIMIT,
        });
        if (cancelled) {
          return;
        }
        setGraph(result.graph);
        setObjectTypeTotal(result.objectTypeTotal);
        setRelationTypeTotal(result.relationTypeTotal);
        setTruncated(result.truncated);
        setNextCursor(result.nextCursor);
      } catch {
        if (!cancelled) {
          setGraph(EMPTY_GRAPH);
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const objectTypes = useMemo<KnowledgeNetworkObjectTypeRecord[]>(
    () =>
      graph.nodes.map((node) => ({
        color: node.color || DEFAULT_COLOR,
        conceptGroupIds: [],
        conceptGroupNames: [],
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
    [graph.nodes],
  );
  const relationTypes = useMemo<KnowledgeNetworkRelationTypeRecord[]>(() => {
    const names = new Map(graph.nodes.map((node) => [node.id, node.name]));
    return graph.edges.map((edge) => ({
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
  }, [graph.edges, graph.nodes]);

  const expandNode = useCallback(
    async (objectTypeId: string) => {
      if (expandedNodeIds.has(objectTypeId) || expanding) {
        return;
      }
      setExpanding(true);
      try {
        const result = await getKnowledgeNetworkOverviewGraph(networkId, {
          edgeLimit: OVERVIEW_EDGE_LIMIT,
          expandDepth: 1,
          focusObjectTypeId: objectTypeId,
          nodeLimit: OVERVIEW_NODE_LIMIT,
        });
        setGraph((current) => mergeOverviewGraph(current, result.graph));
        setExpandedNodeIds((current) => new Set(current).add(objectTypeId));
      } catch {
        // The shared HTTP layer reports the request error; keep the current graph usable.
      } finally {
        setExpanding(false);
      }
    },
    [expandedNodeIds, expanding, networkId],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || expanding) {
      return;
    }
    setExpanding(true);
    try {
      const result: KnowledgeNetworkOverviewGraph = await getKnowledgeNetworkOverviewGraph(
        networkId,
        {
          cursor: nextCursor,
          edgeLimit: OVERVIEW_EDGE_LIMIT,
          nodeLimit: OVERVIEW_NODE_LIMIT,
        },
      );
      setGraph((current) => mergeOverviewGraph(current, result.graph));
      setNextCursor(result.nextCursor);
      setTruncated(result.truncated);
    } catch {
      // The shared HTTP layer reports the request error; keep the current graph usable.
    } finally {
      setExpanding(false);
    }
  }, [expanding, networkId, nextCursor]);

  useEffect(() => {
    if (!detailsExpanded || objectTypes.length === 0) {
      return;
    }

    const visibleItems = new Map<string, KnowledgeNetworkObjectTypeRecord>();
    objectTypes
      .slice((entityPage - 1) * entityPageSize, entityPage * entityPageSize)
      .forEach((item) => visibleItems.set(item.id, item));
    objectTypes
      .slice((bindingPage - 1) * bindingPageSize, bindingPage * bindingPageSize)
      .forEach((item) => visibleItems.set(item.id, item));
    const missingItems = [...visibleItems.values()].filter((item) => !(item.id in detailById));
    if (missingItems.length === 0) {
      return;
    }

    let cancelled = false;
    setDetailLoading(true);

    void (async () => {
      try {
        const details = await loadDetailsWithConcurrency(missingItems, (item) =>
          getKnowledgeNetworkObjectTypeDetail(networkId, item.id).catch(() => null),
        );
        if (cancelled) {
          return;
        }

        setDetailById((current) => {
          const next = { ...current };
          missingItems.forEach((item) => {
            next[item.id] = details.get(item.id) ?? null;
          });
          return next;
        });
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bindingPage,
    bindingPageSize,
    detailById,
    detailsExpanded,
    entityPage,
    entityPageSize,
    networkId,
    objectTypes,
  ]);

  const hubIds = useMemo(() => {
    const degree = new Map<string, number>();
    objectTypes.forEach((item) => degree.set(item.id, 0));
    relationTypes.forEach((relation) => {
      degree.set(relation.sourceObjectTypeId, (degree.get(relation.sourceObjectTypeId) ?? 0) + 1);
      degree.set(relation.targetObjectTypeId, (degree.get(relation.targetObjectTypeId) ?? 0) + 1);
    });
    const max = Math.max(0, ...degree.values());
    const set = new Set<string>();
    if (max > 0) {
      degree.forEach((value, id) => {
        if (value === max) {
          set.add(id);
        }
      });
    }
    return set;
  }, [objectTypes, relationTypes]);

  const colorById = useMemo(
    () => new Map(objectTypes.map((item) => [item.id, item.color || DEFAULT_COLOR])),
    [objectTypes],
  );

  const renderResourceIndexState = useCallback(
    (entity: KnowledgeNetworkObjectTypeRecord) => {
      const label = formatKnowledgeNetworkObjectTypeIndexStateLabel(
        entity.indexStatus ?? entity.hasIndex,
        t,
      );

      return <span>{label}</span>;
    },
    [t],
  );

  const entityColumns: ColumnsType<KnowledgeNetworkObjectTypeRecord> = useMemo(
    () => [
      {
        title: t("knowledgeNetwork.previewEntityClasses"),
        key: "name",
        render: (_, entity) => (
          <span className={styles.tblName}>
            <span className={styles.dot} style={{ background: entity.color || DEFAULT_COLOR }} />
            <span>{entity.name}</span>
            {hubIds.has(entity.id) ? (
              <span className={styles.hubTag}>{t("knowledgeNetwork.previewHub")}</span>
            ) : null}
          </span>
        ),
      },
      {
        title: t("knowledgeNetwork.previewColProps"),
        key: "props",
        width: 80,
        render: (_, entity) => {
          const detail = detailById[entity.id];
          return detail ? detail.dataProperties.length : <span className={styles.muted}>—</span>;
        },
      },
      {
        title: t("knowledgeNetwork.previewColIndex"),
        key: "index",
        width: 140,
        render: (_, entity) => renderResourceIndexState(entity),
      },
      {
        title: t("knowledgeNetwork.previewColConceptGroups"),
        key: "groups",
        render: (_, entity) => {
          const groups = detailById[entity.id]?.conceptGroupNames ?? entity.conceptGroupNames;
          return groups.length > 0 ? (
            groups.map((group) => (
              <Tag key={group} bordered={false}>
                {group}
              </Tag>
            ))
          ) : (
            <span className={styles.muted}>—</span>
          );
        },
      },
    ],
    [detailById, hubIds, renderResourceIndexState, t],
  );

  const relationColumns: ColumnsType<KnowledgeNetworkRelationTypeRecord> = [
    {
      title: t("knowledgeNetwork.previewColRelation"),
      key: "name",
      render: (_, relation) => relation.name,
    },
    {
      title: t("knowledgeNetwork.previewColPath"),
      key: "path",
      render: (_, relation) => (
        <span className={styles.relPath}>
          <span
            className={styles.chip}
            style={
              { "--nc": colorById.get(relation.sourceObjectTypeId) ?? "#999" } as CSSProperties
            }
          >
            {relation.sourceObjectTypeName}
          </span>
          <span className={styles.relArrow}>→</span>
          <span
            className={styles.chip}
            style={
              { "--nc": colorById.get(relation.targetObjectTypeId) ?? "#999" } as CSSProperties
            }
          >
            {relation.targetObjectTypeName}
          </span>
        </span>
      ),
    },
    {
      title: t("knowledgeNetwork.previewColMapping"),
      key: "mapping",
      width: 110,
      render: (_, relation) => (
        <Tag bordered={false}>
          {relation.mappingMode === "resource"
            ? t("knowledgeNetwork.previewMappingResource")
            : t("knowledgeNetwork.previewMappingDirect")}
        </Tag>
      ),
    },
  ];

  const bindingColumns: ColumnsType<KnowledgeNetworkObjectTypeRecord> = useMemo(
    () => [
      {
        title: t("knowledgeNetwork.previewEntityClasses"),
        key: "name",
        render: (_, entity) => (
          <span className={styles.tblName}>
            <span className={styles.dot} style={{ background: entity.color || DEFAULT_COLOR }} />
            <span>{entity.name}</span>
          </span>
        ),
      },
      {
        title: t("knowledgeNetwork.previewColBoundResource"),
        key: "resource",
        render: (_, entity) => {
          const resource = entity.dataSource ?? detailById[entity.id]?.dataSource;
          return resource ? (
            <span className={styles.resourceName}>{resource.name}</span>
          ) : (
            <span className={styles.muted}>{t("knowledgeNetwork.previewUnbound")}</span>
          );
        },
      },
      {
        title: t("knowledgeNetwork.previewColIndexState"),
        key: "indexState",
        width: 180,
        render: (_, entity) => renderResourceIndexState(entity),
      },
    ],
    [detailById, renderResourceIndexState, t],
  );

  const pagedObjectTypes = useMemo(() => {
    const start = (entityPage - 1) * entityPageSize;
    return objectTypes.slice(start, start + entityPageSize);
  }, [entityPage, entityPageSize, objectTypes]);

  const pagedRelationTypes = useMemo(() => {
    const start = (relationPage - 1) * relationPageSize;
    return relationTypes.slice(start, start + relationPageSize);
  }, [relationPage, relationPageSize, relationTypes]);

  const pagedBindingObjectTypes = useMemo(() => {
    const start = (bindingPage - 1) * bindingPageSize;
    return objectTypes.slice(start, start + bindingPageSize);
  }, [bindingPage, bindingPageSize, objectTypes]);

  return (
    <div className={styles.block}>
      <Spin spinning={previewLoading}>
        <OntologyGraphCard
          loadConceptGroups={false}
          networkId={networkId}
          objectTypes={objectTypes}
          onExpandNode={(id) => {
            void expandNode(id);
          }}
          relationTypes={relationTypes}
        />
      </Spin>

      {!previewLoading && objectTypeTotal > 0 ? (
        <div className={styles.graphSummary}>
          <span>
            {t("knowledgeNetwork.previewGraphSummary", {
              loadedEdges: graph.edges.length,
              loadedNodes: graph.nodes.length,
              totalEdges: relationTypeTotal,
              totalNodes: objectTypeTotal,
            })}
          </span>
          {truncated ? (
            <Tag bordered={false} color="blue">
              {t("knowledgeNetwork.previewGraphTruncated")}
            </Tag>
          ) : null}
          {nextCursor ? (
            <Button
              loading={expanding}
              onClick={() => {
                void loadMore();
              }}
              size="small"
            >
              {t("knowledgeNetwork.previewGraphLoadMore")}
            </Button>
          ) : expanding ? (
            <Spin size="small" />
          ) : null}
        </div>
      ) : null}

      {objectTypes.length > 0 || previewLoading ? (
        <div className={styles.structureCard}>
          <button
            className={`${styles.structureToggle} ${detailsExpanded ? styles.structureToggleExpanded : ""}`}
            onClick={onToggleDetails}
            type="button"
          >
            <span>{t("knowledgeNetwork.previewTabOntology")}</span>
            <span className={styles.structureToggleIcon}>
              {detailsExpanded ? <DownOutlined /> : <RightOutlined />}
            </span>
          </button>
          {detailsExpanded ? (
            previewLoading ? (
              <div className={styles.loadingPlaceholder}>
                <Spin />
              </div>
            ) : (
              <Spin spinning={detailLoading}>
                <Tabs
                  className={styles.tabs}
                  defaultActiveKey="ontology"
                  items={[
                    {
                      key: "ontology",
                      label: t("knowledgeNetwork.previewTabOntology"),
                      children: (
                        <div className={styles.sectionGrid}>
                          <div className={styles.sectionCard}>
                            <div className={styles.sectionCardTitle}>
                              {t("knowledgeNetwork.previewEntityClasses")}
                              <span className={styles.badge}>{objectTypes.length}</span>
                            </div>
                            <Table
                              rowKey="id"
                              size="small"
                              columns={entityColumns}
                              dataSource={pagedObjectTypes}
                              pagination={false}
                            />
                            {objectTypes.length > 0 ? (
                              <div className={styles.paginationBar}>
                                <TablePaginationBar
                                  current={entityPage}
                                  onChange={(page, pageSize) => {
                                    setEntityPage(page);
                                    setEntityPageSize(pageSize);
                                  }}
                                  pageSize={entityPageSize}
                                  showSizeChanger
                                  showTotal={(total) => t("common.total", { total })}
                                  total={objectTypes.length}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className={`${styles.sectionCard} ${styles.sectionCardSecondary}`}>
                            <div className={styles.sectionCardTitle}>
                              {t("knowledgeNetwork.previewRelationClasses")}
                              <span className={styles.badge}>{relationTypes.length}</span>
                            </div>
                            <Table
                              rowKey="id"
                              size="small"
                              columns={relationColumns}
                              dataSource={pagedRelationTypes}
                              pagination={false}
                            />
                            {relationTypes.length > 0 ? (
                              <div className={styles.paginationBar}>
                                <TablePaginationBar
                                  current={relationPage}
                                  onChange={(page, pageSize) => {
                                    setRelationPage(page);
                                    setRelationPageSize(pageSize);
                                  }}
                                  pageSize={relationPageSize}
                                  showSizeChanger
                                  showTotal={(total) => t("common.total", { total })}
                                  total={relationTypes.length}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "binding",
                      label: t("knowledgeNetwork.previewTabBinding"),
                      children: (
                        <div className={styles.sectionCard}>
                          <div className={styles.sectionCardTitle}>
                            {t("knowledgeNetwork.previewColBoundResource")}
                          </div>
                          <Table
                            rowKey="id"
                            size="small"
                            columns={bindingColumns}
                            dataSource={pagedBindingObjectTypes}
                            pagination={false}
                          />
                          {objectTypes.length > 0 ? (
                            <div className={styles.paginationBar}>
                              <TablePaginationBar
                                current={bindingPage}
                                onChange={(page, pageSize) => {
                                  setBindingPage(page);
                                  setBindingPageSize(pageSize);
                                }}
                                pageSize={bindingPageSize}
                                showSizeChanger
                                showTotal={(total) => t("common.total", { total })}
                                total={objectTypes.length}
                              />
                            </div>
                          ) : null}
                        </div>
                      ),
                    },
                  ]}
                />
              </Spin>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
