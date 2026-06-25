/**
 * 领域业务知识网络（实验版）数据层 —— 适配真实后端。
 *
 * 复用 `@/modules/knowledge-network` 已有的真实服务（内置 mock/real 切换，
 * 命中 `/bkn-backend/v1/knowledge-networks/...`），把 ontology-manager 的
 * knowledge-network / object-type / relation-type 组装成图谱视图模型。
 * 实验版不另起后端，仅在现有数据之上换一套「领域网络 + 本体图谱」呈现。
 */

import {
  getKnowledgeNetwork,
  getKnowledgeNetworkObjectTypeDetail,
  listKnowledgeNetworkObjectTypes,
  listKnowledgeNetworkRelationTypes,
  listKnowledgeNetworks,
} from "@/modules/knowledge-network/services/knowledge-network.service";
import type {
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRelationTypeRecord,
  ObjectTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";
import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";
import { computePreviewGraphLayout } from "@/modules/knowledge-network/utils/compute-preview-graph-layout";
import type {
  DomainNetwork,
  DomainNetworkListQuery,
  DomainNetworkStats,
  DomainNetworkStatus,
  DomainNetworkSummary,
  EntityClass,
  GraphEdge,
  GraphNode,
  RelationClass,
} from "@/modules/knowledge-network-lab/types/domain-network";

const DEFAULT_COLOR = "#1677ff";

function parseTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function deriveStatus(stats: DomainNetworkStats): DomainNetworkStatus {
  if (stats.objectTypes === 0) {
    return "empty";
  }
  if (stats.relationTypes === 0) {
    return "draft";
  }
  return "published";
}

function statsOf(record: KnowledgeNetworkRecord): DomainNetworkStats {
  return {
    objectTypes: record.statistics.objectTypesTotal,
    relationTypes: record.statistics.relationTypesTotal,
    conceptGroups: record.statistics.conceptGroupsTotal,
    metrics: record.statistics.metricsTotal,
  };
}

/** 用真实 object-type / relation-type 计算图谱布局节点与连线。 */
function layoutGraph(
  objectTypes: KnowledgeNetworkObjectTypeRecord[],
  relationTypes: KnowledgeNetworkRelationTypeRecord[],
): { nodes: GraphNode[]; edges: GraphEdge[]; positionById: Map<string, GraphNode>; degreeById: Map<string, number> } {
  const graph = buildModelingPreviewGraph(objectTypes, relationTypes);
  const layout = computePreviewGraphLayout(graph);
  const layoutById = new Map(layout.map((node) => [node.id, node]));

  const nodes: GraphNode[] = graph.nodes.map((node) => {
    const position = layoutById.get(node.id);
    return {
      key: node.id,
      name: node.name,
      color: node.color || DEFAULT_COLOR,
      x: position?.x ?? 0,
      y: position?.y ?? 0,
    };
  });

  const edges: GraphEdge[] = graph.edges.map((edge) => ({
    key: edge.id,
    name: edge.name,
    from: edge.sourceId,
    to: edge.targetId,
  }));

  const degreeById = new Map<string, number>();
  nodes.forEach((node) => degreeById.set(node.key, 0));
  edges.forEach((edge) => {
    degreeById.set(edge.from, (degreeById.get(edge.from) ?? 0) + 1);
    degreeById.set(edge.to, (degreeById.get(edge.to) ?? 0) + 1);
  });

  const positionById = new Map(nodes.map((node) => [node.key, node]));
  return { nodes, edges, positionById, degreeById };
}

async function toSummary(record: KnowledgeNetworkRecord): Promise<DomainNetworkSummary> {
  const [objectTypes, relationTypes] = await Promise.all([
    listKnowledgeNetworkObjectTypes(record.id),
    listKnowledgeNetworkRelationTypes(record.id),
  ]);
  const { nodes, edges } = layoutGraph(objectTypes, relationTypes);
  const stats = statsOf(record);

  return {
    id: record.id,
    slug: record.identifier,
    name: record.name,
    domain: record.tags[0] ?? "",
    status: deriveStatus(stats),
    desc: record.description,
    owner: record.creatorName || record.updaterName || "",
    updatedAt: parseTime(record.updateTime),
    color: record.color || DEFAULT_COLOR,
    stats,
    miniNodes: nodes,
    miniEdges: edges,
  };
}

/** 属性是否参与索引（任一索引配置启用）。 */
function propIndexed(detail: ObjectTypeDetail | null, propName: string): boolean {
  const property = detail?.dataProperties.find((item) => item.name === propName);
  const config = property?.indexConfig;
  if (!config) {
    return false;
  }
  return (
    config.fulltextConfig.enabled || config.keywordConfig.enabled || config.vectorConfig.enabled
  );
}

function toEntityClass(
  objectType: KnowledgeNetworkObjectTypeRecord,
  detail: ObjectTypeDetail | null,
  position: GraphNode | undefined,
  degree: number,
  maxDegree: number,
): EntityClass {
  const props = (detail?.dataProperties ?? []).map((property) => ({
    name: property.name,
    type: property.type,
    pk: property.primaryKey,
    indexed: propIndexed(detail, property.name),
  }));

  const boundResource = detail?.dataSource
    ? {
        id: detail.dataSource.id,
        name: detail.dataSource.name,
        indexed: objectType.hasIndex,
      }
    : null;

  return {
    key: objectType.id,
    name: objectType.name,
    color: objectType.color || DEFAULT_COLOR,
    x: position?.x ?? 0,
    y: position?.y ?? 0,
    hub: maxDegree > 0 && degree === maxDegree,
    indexed: objectType.hasIndex,
    props,
    boundResource,
    conceptGroups: objectType.conceptGroupNames ?? [],
  };
}

function matchesStatus(summary: DomainNetworkSummary, status?: DomainNetworkListQuery["status"]): boolean {
  return !status || status === "all" || summary.status === status;
}

/** 列出领域知识网络（真实后端，每个网络附带本体缩略图）。 */
export async function listDomainNetworks(
  query: DomainNetworkListQuery = {},
): Promise<{ records: DomainNetworkSummary[]; total: number }> {
  const result = await listKnowledgeNetworks({
    keyword: query.keyword?.trim() ?? "",
    page: 1,
    pageSize: 50,
    sortBy: "updateTime",
    direction: "desc",
  });

  const summaries = await Promise.all(result.items.map(toSummary));
  const records = summaries.filter((summary) => matchesStatus(summary, query.status));
  return { records, total: records.length };
}

/** 读取单个领域知识网络的完整本体（实体类 + 关系类 + 数据绑定）。 */
export async function getDomainNetwork(id: string): Promise<DomainNetwork | null> {
  const [record, objectTypes, relationTypes] = await Promise.all([
    getKnowledgeNetwork(id),
    listKnowledgeNetworkObjectTypes(id),
    listKnowledgeNetworkRelationTypes(id),
  ]);

  if (!record) {
    return null;
  }

  const { nodes, edges, positionById, degreeById } = layoutGraph(objectTypes, relationTypes);
  const maxDegree = Math.max(0, ...degreeById.values());

  // 拉取每个实体类的明细（属性 + 绑定资源）。
  const details = await Promise.all(
    objectTypes.map((objectType) =>
      getKnowledgeNetworkObjectTypeDetail(id, objectType.id).catch(() => null),
    ),
  );

  const entityClasses = objectTypes.map((objectType, index) =>
    toEntityClass(
      objectType,
      details[index] ?? null,
      positionById.get(objectType.id),
      degreeById.get(objectType.id) ?? 0,
      maxDegree,
    ),
  );

  const relationClasses: RelationClass[] = relationTypes.map((relationType) => ({
    key: relationType.id,
    name: relationType.name,
    from: relationType.sourceObjectTypeId,
    to: relationType.targetObjectTypeId,
    fromName: relationType.sourceObjectTypeName,
    toName: relationType.targetObjectTypeName,
    mappingMode: relationType.mappingMode,
  }));

  const stats = statsOf(record);

  return {
    id: record.id,
    slug: record.identifier,
    name: record.name,
    domain: record.tags[0] ?? "",
    status: deriveStatus(stats),
    desc: record.description,
    owner: record.creatorName || record.updaterName || "",
    updatedAt: parseTime(record.updateTime),
    color: record.color || DEFAULT_COLOR,
    stats,
    miniNodes: nodes,
    miniEdges: edges,
    entityClasses,
    relationClasses,
  };
}
