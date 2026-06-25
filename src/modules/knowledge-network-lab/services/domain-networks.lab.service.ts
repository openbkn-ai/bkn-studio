/**
 * 领域业务知识网络（实验版）数据层 —— 适配真实后端。
 *
 * 复用 `@/modules/knowledge-network` 已有的真实服务（内置 mock/real 切换，
 * 命中 `/bkn-backend/v1/knowledge-networks/...`），把 ontology-manager 的
 * knowledge-network / object-type / relation-type 组装成图谱视图模型。
 * 实验版不另起后端，仅在现有数据之上换一套「领域网络 + 本体图谱」呈现。
 *
 * 列表仅发一次 listKnowledgeNetworks；本体（实体类 / 关系类 / 布局）只在
 * 详情页按需拉取，避免逐网络拉本体造成大量请求。
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
  ObjectTypeDetail,
} from "@/modules/knowledge-network/types/knowledge-network";
import { buildModelingPreviewGraph } from "@/modules/knowledge-network/utils/build-modeling-preview-graph";
import { computePreviewGraphLayout } from "@/modules/knowledge-network/utils/compute-preview-graph-layout";
import type {
  DomainNetwork,
  DomainNetworkListQuery,
  DomainNetworkStats,
  DomainNetworkSummary,
  EntityClass,
  GraphNode,
  RelationClass,
} from "@/modules/knowledge-network-lab/types/domain-network";

const DEFAULT_COLOR = "#1677ff";

function parseTime(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function statsOf(record: KnowledgeNetworkRecord): DomainNetworkStats {
  return {
    objectTypes: record.statistics.objectTypesTotal,
    relationTypes: record.statistics.relationTypesTotal,
    conceptGroups: record.statistics.conceptGroupsTotal,
    metrics: record.statistics.metricsTotal,
  };
}

function toSummary(record: KnowledgeNetworkRecord): DomainNetworkSummary {
  return {
    id: record.id,
    slug: record.identifier,
    name: record.name,
    domain: record.tags[0] ?? "",
    desc: record.description,
    owner: record.creatorName || record.updaterName || "",
    updatedAt: parseTime(record.updateTime),
    color: record.color || DEFAULT_COLOR,
    stats: statsOf(record),
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

/** 列出领域知识网络（真实后端，单次请求，不拉本体）。 */
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

  return { records: result.items.map(toSummary), total: result.total };
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

  // 用真实 object-type / relation-type 计算图谱布局。
  const graph = buildModelingPreviewGraph(objectTypes, relationTypes);
  const layout = computePreviewGraphLayout(graph);
  const positionById = new Map<string, GraphNode>(
    layout.map((node) => [node.id, { key: node.id, name: "", color: DEFAULT_COLOR, x: node.x, y: node.y }]),
  );

  const degreeById = new Map<string, number>();
  objectTypes.forEach((objectType) => degreeById.set(objectType.id, 0));
  graph.edges.forEach((edge) => {
    degreeById.set(edge.sourceId, (degreeById.get(edge.sourceId) ?? 0) + 1);
    degreeById.set(edge.targetId, (degreeById.get(edge.targetId) ?? 0) + 1);
  });
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

  return {
    ...toSummary(record),
    entityClasses,
    relationClasses,
  };
}
