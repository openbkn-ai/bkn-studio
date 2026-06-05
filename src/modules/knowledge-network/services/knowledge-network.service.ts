import { http } from "@/framework/request/http";
import type {
  KnowledgeNetworkActionTypeKind,
  KnowledgeNetworkActionTypeMutationPayload,
  KnowledgeNetworkActionTypeRecord,
  ConceptGroupDetail,
  ConceptGroupMutationPayload,
  ConceptGroupRecord,
  ConceptGroupRelatedItem,
  KnowledgeNetworkListQuery,
  KnowledgeNetworkListResult,
  KnowledgeNetworkMutationPayload,
  KnowledgeNetworkObjectTypeMutationPayload,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkPreviewGraph,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRelationTypeMutationPayload,
  KnowledgeNetworkRelationTypeRecord,
  KnowledgeNetworkStatistics,
} from "@/modules/knowledge-network/types/knowledge-network";

type BackendAccountInfo = {
  id?: string | null;
  name?: string | null;
};

type BackendKnowledgeNetwork = {
  code?: string;
  color?: string;
  comment?: string;
  create_time?: number;
  creator?: BackendAccountInfo;
  description?: string;
  display_id?: string;
  icon?: string;
  id: string;
  name: string;
  statistics?: {
    action_types_total?: number;
    concept_groups_total?: number;
    metrics_total?: number;
    object_types_total?: number;
    relation_types_total?: number;
  };
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
};

type BackendObjectType = {
  color?: string;
  comment?: string;
  concept_groups?: Array<{
    id: string;
    name?: string;
  }>;
  has_index?: boolean;
  icon?: string;
  id: string;
  name: string;
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
};

type BackendConceptGroup = {
  action_types?: BackendObjectType[];
  color?: string;
  comment?: string;
  id: string;
  name: string;
  object_types?: BackendObjectType[];
  relation_types?: BackendObjectType[];
  statistics?: {
    action_types_total?: number;
    object_types_total?: number;
    relation_types_total?: number;
  };
  tags?: string[];
  update_time?: number;
};

type BackendRelationType = {
  color?: string;
  comment?: string;
  id: string;
  mapping_mode?: "direct" | "data_view";
  name: string;
  source_object_type?: {
    id?: string;
    name?: string;
  };
  source_object_type_id?: string;
  tags?: string[];
  target_object_type?: {
    id?: string;
    name?: string;
  };
  target_object_type_id?: string;
  update_time?: number;
  updater?: BackendAccountInfo;
};

type BackendActionType = {
  action_type?: "ADD" | "UPDATE" | "DELETE" | "NOTIFY";
  color?: string;
  comment?: string;
  id: string;
  name: string;
  object_type?: {
    id?: string;
    name?: string;
  };
  object_type_id?: string;
  tags?: string[];
  update_time?: number;
  updater?: BackendAccountInfo;
};

type BackendListResponse<T> = {
  entries: T[];
  total_count: number;
};

type BackendSubgraphResponse = {
  edges?: Array<{
    id?: string;
    name?: string;
    source?: string;
    source_id?: string;
    source_object_type_id?: string;
    target?: string;
    target_id?: string;
    target_object_type_id?: string;
  }>;
  nodes?: Array<{
    color?: string;
    id?: string;
    name?: string;
  }>;
  objects?: Array<{
    color?: string;
    id?: string;
    name?: string;
  }>;
  relations?: Array<{
    id?: string;
    name?: string;
    source?: string;
    source_id?: string;
    source_object_type_id?: string;
    target?: string;
    target_id?: string;
    target_object_type_id?: string;
  }>;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

let mockKnowledgeNetworks: KnowledgeNetworkRecord[] = [
  {
    id: "kn-domain-risk",
    identifier: "domain_risk_network",
    name: "领域风控知识网络",
    description:
      "围绕风控对象、风险关系与行动策略组织的领域业务知识网络。",
    color: "#1677ff",
    icon: "deployment-unit",
    tags: ["风控", "核心"],
    createTime: "2026-06-01 09:30:00",
    updateTime: "2026-06-04 18:20:00",
    creatorName: "Platform Admin",
    updaterName: "Knowledge Team",
    statistics: {
      objectTypesTotal: 18,
      relationTypesTotal: 12,
      actionTypesTotal: 7,
      conceptGroupsTotal: 6,
      metricsTotal: 9,
    },
  },
  {
    id: "kn-domain-supply",
    identifier: "domain_supply_network",
    name: "领域供应链知识网络",
    description:
      "用于供应商、仓配、履约行动和经营指标建模的领域知识网络。",
    color: "#13c2c2",
    icon: "share-alt",
    tags: ["供应链"],
    createTime: "2026-05-28 14:12:00",
    updateTime: "2026-06-03 11:45:00",
    creatorName: "Ops Team",
    updaterName: "Ops Team",
    statistics: {
      objectTypesTotal: 11,
      relationTypesTotal: 9,
      actionTypesTotal: 5,
      conceptGroupsTotal: 4,
      metricsTotal: 6,
    },
  },
  {
    id: "kn-domain-customer",
    identifier: "domain_customer_network",
    name: "领域客户知识网络",
    description:
      "聚焦客户主体、标签体系和营销动作的业务知识网络。",
    color: "#52c41a",
    icon: "team",
    tags: ["客户", "营销"],
    createTime: "2026-05-20 10:05:00",
    updateTime: "2026-06-02 16:00:00",
    creatorName: "Marketing Team",
    updaterName: "Marketing Team",
    statistics: {
      objectTypesTotal: 14,
      relationTypesTotal: 8,
      actionTypesTotal: 6,
      conceptGroupsTotal: 5,
      metricsTotal: 8,
    },
  },
];

const mockRecentObjects: Record<string, KnowledgeNetworkRecentObject[]> = {
  "kn-domain-risk": [
    {
      id: "ot-risk-order",
      name: "风险订单",
      comment: "描述命中风控策略后的订单实体。",
      color: "#1677ff",
      icon: "database",
      tags: ["订单", "风控"],
      updateTime: "2026-06-04 17:35:00",
      updaterName: "Knowledge Team",
    },
    {
      id: "ot-risk-device",
      name: "风险设备",
      comment: "用于识别设备级别异常关联。",
      color: "#722ed1",
      icon: "hdd",
      tags: ["设备"],
      updateTime: "2026-06-04 16:12:00",
      updaterName: "Knowledge Team",
    },
  ],
  "kn-domain-supply": [
    {
      id: "ot-supplier",
      name: "供应商",
      comment: "供应链基础主体对象。",
      color: "#13c2c2",
      icon: "shop",
      tags: ["主数据"],
      updateTime: "2026-06-03 10:20:00",
      updaterName: "Ops Team",
    },
  ],
  "kn-domain-customer": [
    {
      id: "ot-customer-profile",
      name: "客户画像",
      comment: "客户标签、偏好和行为概况集合。",
      color: "#52c41a",
      icon: "user",
      tags: ["画像"],
      updateTime: "2026-06-02 15:00:00",
      updaterName: "Marketing Team",
    },
  ],
};

const mockConceptGroups: Record<string, ConceptGroupDetail[]> = {
  "kn-domain-risk": [
    {
      id: "cg-risk-core",
      name: "核心风险主体",
      description: "风控主链路的关键对象与关系集合。",
      color: "#1677ff",
      tags: ["风控", "核心"],
      objectTypesTotal: 5,
      relationTypesTotal: 4,
      actionTypesTotal: 2,
      updateTime: "2026-06-04 17:10:00",
      objectTypes: [
        {
          id: "ot-risk-order",
          name: "风险订单",
          description: "命中风控策略后的订单实体。",
          color: "#1677ff",
          tags: ["订单"],
        },
        {
          id: "ot-risk-account",
          name: "风险账号",
          description: "风控建模中的账号基础对象。",
          color: "#0ea5e9",
          tags: ["账号"],
        },
      ],
      relationTypes: [
        {
          id: "rt-risk-bind",
          name: "绑定关联",
          description: "账号与设备的绑定关系。",
          color: "#7c3aed",
          tags: ["关联"],
        },
      ],
      actionTypes: [
        {
          id: "at-risk-block",
          name: "阻断处置",
          description: "命中策略后的阻断动作。",
          color: "#16a34a",
          tags: ["处置"],
        },
      ],
    },
    {
      id: "cg-risk-monitor",
      name: "监控告警",
      description: "围绕监控指标与告警动作组织的概念分组。",
      color: "#fa8c16",
      tags: ["告警"],
      objectTypesTotal: 3,
      relationTypesTotal: 2,
      actionTypesTotal: 2,
      updateTime: "2026-06-03 19:20:00",
      objectTypes: [],
      relationTypes: [],
      actionTypes: [],
    },
  ],
  "kn-domain-supply": [
    {
      id: "cg-supply-fulfillment",
      name: "履约协同",
      description: "履约、仓配与供应关系分组。",
      color: "#13c2c2",
      tags: ["履约"],
      objectTypesTotal: 4,
      relationTypesTotal: 3,
      actionTypesTotal: 1,
      updateTime: "2026-06-03 11:00:00",
      objectTypes: [],
      relationTypes: [],
      actionTypes: [],
    },
  ],
  "kn-domain-customer": [
    {
      id: "cg-customer-growth",
      name: "增长转化",
      description: "围绕客户增长和转化动作的概念分组。",
      color: "#52c41a",
      tags: ["增长"],
      objectTypesTotal: 4,
      relationTypesTotal: 2,
      actionTypesTotal: 2,
      updateTime: "2026-06-02 14:35:00",
      objectTypes: [],
      relationTypes: [],
      actionTypes: [],
    },
  ],
};

const mockPreviewGraphs: Record<string, KnowledgeNetworkPreviewGraph> = {
  "kn-domain-risk": {
    nodes: [
      { id: "risk-order", name: "风险订单", color: "#1677ff" },
      { id: "risk-device", name: "风险设备", color: "#722ed1" },
      { id: "risk-strategy", name: "风控策略", color: "#fa8c16" },
      { id: "risk-action", name: "处置行动", color: "#52c41a" },
    ],
    edges: [
      { id: "edge-1", name: "命中", sourceId: "risk-order", targetId: "risk-strategy" },
      { id: "edge-2", name: "关联", sourceId: "risk-device", targetId: "risk-order" },
      { id: "edge-3", name: "触发", sourceId: "risk-strategy", targetId: "risk-action" },
    ],
  },
  "kn-domain-supply": {
    nodes: [
      { id: "supplier", name: "供应商", color: "#13c2c2" },
      { id: "warehouse", name: "仓库", color: "#36cfc9" },
      { id: "fulfillment", name: "履约任务", color: "#08979c" },
    ],
    edges: [
      { id: "edge-supply-1", name: "服务", sourceId: "supplier", targetId: "warehouse" },
      { id: "edge-supply-2", name: "承接", sourceId: "warehouse", targetId: "fulfillment" },
    ],
  },
  "kn-domain-customer": {
    nodes: [
      { id: "customer", name: "客户", color: "#52c41a" },
      { id: "segment", name: "人群分层", color: "#95de64" },
      { id: "campaign", name: "营销行动", color: "#389e0d" },
    ],
    edges: [
      { id: "edge-customer-1", name: "归属", sourceId: "customer", targetId: "segment" },
      { id: "edge-customer-2", name: "触达", sourceId: "segment", targetId: "campaign" },
    ],
  },
};

const mockObjectTypes: Record<string, KnowledgeNetworkObjectTypeRecord[]> = {
  "kn-domain-risk": [
    {
      id: "ot-risk-order",
      name: "Risk Order",
      description: "Order entity that has triggered a risk policy workflow.",
      color: "#1677ff",
      icon: "database",
      tags: ["order", "risk"],
      conceptGroupIds: ["cg-risk-core"],
      conceptGroupNames: ["Core Risk Subjects"],
      hasIndex: true,
      updateTime: "2026-06-04 17:35:00",
      updaterName: "Knowledge Team",
    },
    {
      id: "ot-risk-device",
      name: "Risk Device",
      description: "Device entity used to identify abnormal association patterns.",
      color: "#722ed1",
      icon: "hdd",
      tags: ["device"],
      conceptGroupIds: ["cg-risk-core"],
      conceptGroupNames: ["Core Risk Subjects"],
      hasIndex: false,
      updateTime: "2026-06-04 16:12:00",
      updaterName: "Knowledge Team",
    },
  ],
  "kn-domain-supply": [
    {
      id: "ot-supplier",
      name: "Supplier",
      description: "Core supplier master object in the supply network.",
      color: "#13c2c2",
      icon: "shop",
      tags: ["master-data"],
      conceptGroupIds: ["cg-supply-fulfillment"],
      conceptGroupNames: ["Fulfillment Coordination"],
      hasIndex: true,
      updateTime: "2026-06-03 10:20:00",
      updaterName: "Ops Team",
    },
  ],
  "kn-domain-customer": [
    {
      id: "ot-customer-profile",
      name: "Customer Profile",
      description: "Unified customer profile object with tags and lifecycle signals.",
      color: "#52c41a",
      icon: "user",
      tags: ["profile"],
      conceptGroupIds: ["cg-customer-growth"],
      conceptGroupNames: ["Growth Conversion"],
      hasIndex: true,
      updateTime: "2026-06-02 15:00:00",
      updaterName: "Marketing Team",
    },
  ],
};

const mockRelationTypes: Record<string, KnowledgeNetworkRelationTypeRecord[]> = {
  "kn-domain-risk": [
    {
      id: "rt-risk-bind",
      name: "Bind Relation",
      description: "Association between a risk account and a device.",
      color: "#7c3aed",
      mappingMode: "direct",
      sourceObjectTypeId: "ot-risk-order",
      sourceObjectTypeName: "Risk Order",
      targetObjectTypeId: "ot-risk-device",
      targetObjectTypeName: "Risk Device",
      tags: ["association"],
      updateTime: "2026-06-04 15:20:00",
      updaterName: "Knowledge Team",
    },
  ],
  "kn-domain-supply": [
    {
      id: "rt-supply-service",
      name: "Service Relation",
      description: "Supplier serves a fulfillment node.",
      color: "#08979c",
      mappingMode: "data-view",
      sourceObjectTypeId: "ot-supplier",
      sourceObjectTypeName: "Supplier",
      targetObjectTypeId: "ot-supplier",
      targetObjectTypeName: "Supplier",
      tags: ["fulfillment"],
      updateTime: "2026-06-03 09:10:00",
      updaterName: "Ops Team",
    },
  ],
  "kn-domain-customer": [],
};

const mockActionTypes: Record<string, KnowledgeNetworkActionTypeRecord[]> = {
  "kn-domain-risk": [
    {
      id: "at-risk-block",
      name: "Block Order",
      description: "Trigger a blocking workflow for a risky order.",
      color: "#16a34a",
      actionKind: "notify",
      objectTypeId: "ot-risk-order",
      objectTypeName: "Risk Order",
      tags: ["disposal"],
      updateTime: "2026-06-04 18:05:00",
      updaterName: "Knowledge Team",
    },
  ],
  "kn-domain-supply": [
    {
      id: "at-supply-alert",
      name: "Fulfillment Alert",
      description: "Notify the fulfillment team when a supplier exception occurs.",
      color: "#fa8c16",
      actionKind: "notify",
      objectTypeId: "ot-supplier",
      objectTypeName: "Supplier",
      tags: ["alert"],
      updateTime: "2026-06-03 09:40:00",
      updaterName: "Ops Team",
    },
  ],
  "kn-domain-customer": [],
};

const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(value)
    .replace(/\//g, "-");
}

function emptyStatistics(): KnowledgeNetworkStatistics {
  return {
    objectTypesTotal: 0,
    relationTypesTotal: 0,
    actionTypesTotal: 0,
    conceptGroupsTotal: 0,
    metricsTotal: 0,
  };
}

function mapKnowledgeNetwork(item: BackendKnowledgeNetwork): KnowledgeNetworkRecord {
  return {
    id: item.id,
    identifier: item.display_id ?? item.code ?? item.id,
    name: item.name,
    description: item.comment ?? item.description ?? "",
    color: item.color ?? "#1677ff",
    icon: item.icon,
    tags: item.tags ?? [],
    createTime: formatTimestamp(item.create_time),
    updateTime: formatTimestamp(item.update_time),
    creatorName: item.creator?.name ?? item.creator?.id ?? "-",
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
    statistics: {
      objectTypesTotal: item.statistics?.object_types_total ?? 0,
      relationTypesTotal: item.statistics?.relation_types_total ?? 0,
      actionTypesTotal: item.statistics?.action_types_total ?? 0,
      conceptGroupsTotal: item.statistics?.concept_groups_total ?? 0,
      metricsTotal: item.statistics?.metrics_total ?? 0,
    },
  };
}

function mapRecentObject(item: BackendObjectType): KnowledgeNetworkRecentObject {
  return {
    id: item.id,
    name: item.name,
    comment: item.comment ?? "",
    color: item.color ?? "#1677ff",
    icon: item.icon,
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

function mapObjectType(item: BackendObjectType): KnowledgeNetworkObjectTypeRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color ?? "#1677ff",
    icon: item.icon,
    tags: item.tags ?? [],
    conceptGroupIds: (item.concept_groups ?? []).map((group) => group.id),
    conceptGroupNames: (item.concept_groups ?? []).map(
      (group) => group.name ?? group.id,
    ),
    hasIndex: item.has_index ?? false,
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

function mapConceptGroup(item: BackendConceptGroup): ConceptGroupRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color,
    tags: item.tags ?? [],
    objectTypesTotal: item.statistics?.object_types_total ?? 0,
    relationTypesTotal: item.statistics?.relation_types_total ?? 0,
    actionTypesTotal: item.statistics?.action_types_total ?? 0,
    updateTime: formatTimestamp(item.update_time),
  };
}

function mapConceptGroupRelatedItem(item: BackendObjectType): ConceptGroupRelatedItem {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color,
    icon: item.icon,
    tags: item.tags ?? [],
  };
}

function mapConceptGroupDetail(item: BackendConceptGroup): ConceptGroupDetail {
  return {
    ...mapConceptGroup(item),
    objectTypes: (item.object_types ?? []).map(mapConceptGroupRelatedItem),
    relationTypes: (item.relation_types ?? []).map(mapConceptGroupRelatedItem),
    actionTypes: (item.action_types ?? []).map(mapConceptGroupRelatedItem),
  };
}

function mapRelationType(item: BackendRelationType): KnowledgeNetworkRelationTypeRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color ?? "#7c3aed",
    mappingMode: item.mapping_mode === "data_view" ? "data-view" : "direct",
    sourceObjectTypeId:
      item.source_object_type_id ?? item.source_object_type?.id ?? "",
    sourceObjectTypeName:
      item.source_object_type?.name ??
      item.source_object_type_id ??
      "-",
    targetObjectTypeId:
      item.target_object_type_id ?? item.target_object_type?.id ?? "",
    targetObjectTypeName:
      item.target_object_type?.name ??
      item.target_object_type_id ??
      "-",
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

function mapActionKind(
  value?: BackendActionType["action_type"],
): KnowledgeNetworkActionTypeKind {
  switch (value) {
    case "UPDATE":
      return "update";
    case "DELETE":
      return "delete";
    case "NOTIFY":
      return "notify";
    case "ADD":
    default:
      return "create";
  }
}

function mapActionType(item: BackendActionType): KnowledgeNetworkActionTypeRecord {
  return {
    id: item.id,
    name: item.name,
    description: item.comment ?? "",
    color: item.color ?? "#16a34a",
    actionKind: mapActionKind(item.action_type),
    objectTypeId: item.object_type_id ?? item.object_type?.id ?? "",
    objectTypeName: item.object_type?.name ?? item.object_type_id ?? "-",
    tags: item.tags ?? [],
    updateTime: formatTimestamp(item.update_time),
    updaterName: item.updater?.name ?? item.updater?.id ?? "-",
  };
}

function filterKnowledgeNetworks(items: KnowledgeNetworkRecord[], query: KnowledgeNetworkListQuery) {
  const keyword = query.keyword.trim().toLowerCase();
  const tag = query.tag?.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.identifier.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword);
    const matchesTag =
      !tag || item.tags.some((itemTag) => itemTag.toLowerCase() === tag);

    return matchesKeyword && matchesTag;
  });

  const sortBy = query.sortBy ?? "updateTime";
  const direction = query.direction ?? "desc";

  filtered.sort((left, right) => {
    const leftValue = sortBy === "name" ? left.name : left.updateTime;
    const rightValue = sortBy === "name" ? right.name : right.updateTime;
    const compareResult =
      sortBy === "name"
        ? leftValue.localeCompare(rightValue, "zh-CN")
        : leftValue.localeCompare(rightValue);

    return direction === "asc" ? compareResult : -compareResult;
  });

  return filtered;
}

function syncKnowledgeNetworkStatistics(networkId: string) {
  const objectTypeCount = (mockObjectTypes[networkId] ?? []).length;
  const conceptGroupCount = (mockConceptGroups[networkId] ?? []).length;
  const relationTypeCount = (mockRelationTypes[networkId] ?? []).length;
  const actionTypeCount = (mockActionTypes[networkId] ?? []).length;

  mockKnowledgeNetworks = mockKnowledgeNetworks.map((item) =>
    item.id === networkId
      ? {
          ...item,
          updateTime: formatTimestamp(Date.now()),
          updaterName: "Local Admin",
          statistics: {
            ...item.statistics,
            conceptGroupsTotal: conceptGroupCount,
            objectTypesTotal: objectTypeCount,
            relationTypesTotal: relationTypeCount,
            actionTypesTotal: actionTypeCount,
          },
        }
      : item,
  );
}

function syncMockConceptGroups(networkId: string) {
  const objectTypes = mockObjectTypes[networkId] ?? [];

  mockConceptGroups[networkId] = (mockConceptGroups[networkId] ?? []).map((group) => {
    const relatedObjectTypes = objectTypes.filter((item) =>
      item.conceptGroupIds.includes(group.id),
    );

    return {
      ...group,
      objectTypes: relatedObjectTypes.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        color: item.color,
        icon: item.icon,
        tags: item.tags,
      })),
      objectTypesTotal: relatedObjectTypes.length,
    };
  });
}

export async function listKnowledgeNetworks(query: KnowledgeNetworkListQuery): Promise<KnowledgeNetworkListResult> {
  if (useMock) {
    const filtered = filterKnowledgeNetworks(mockKnowledgeNetworks, query);
    const startIndex = (query.page - 1) * query.pageSize;

    return wait({
      items: filtered.slice(startIndex, startIndex + query.pageSize),
      total: filtered.length,
    });
  }

  const response = await http.get<BackendListResponse<BackendKnowledgeNetwork>>(
    "/bkn-backend/v1/knowledge-networks",
    {
      params: {
        direction: query.direction === "asc" ? "asc" : "desc",
        limit: query.pageSize,
        name_pattern: query.keyword.trim() || undefined,
        offset: (query.page - 1) * query.pageSize,
        sort: query.sortBy === "name" ? "name" : "update_time",
        tag: query.tag || undefined,
      },
    },
  );

  return {
    items: response.data.entries.map(mapKnowledgeNetwork),
    total: response.data.total_count,
  };
}

export async function listKnowledgeNetworkTags() {
  if (useMock) {
    return wait([...new Set(mockKnowledgeNetworks.flatMap((item) => item.tags))].sort());
  }

  return [];
}

export async function getKnowledgeNetwork(networkId: string) {
  if (useMock) {
    return wait(mockKnowledgeNetworks.find((item) => item.id === networkId) ?? null);
  }

  const response = await http.get<BackendKnowledgeNetwork>(
    `/bkn-backend/v1/knowledge-networks/${networkId}`,
    { params: { include_statistics: true } },
  );

  return mapKnowledgeNetwork(response.data);
}

export async function createKnowledgeNetwork(input: KnowledgeNetworkMutationPayload) {
  if (useMock) {
    const nextRecord: KnowledgeNetworkRecord = {
      id: crypto.randomUUID(),
      identifier: input.identifier,
      name: input.name,
      description: input.description,
      color: input.color,
      icon: "deployment-unit",
      tags: input.tags,
      createTime: formatTimestamp(Date.now()),
      updateTime: formatTimestamp(Date.now()),
      creatorName: "Local Admin",
      updaterName: "Local Admin",
      statistics: emptyStatistics(),
    };

    mockKnowledgeNetworks.unshift(nextRecord);
    mockRecentObjects[nextRecord.id] = [];
    mockConceptGroups[nextRecord.id] = [];
    mockPreviewGraphs[nextRecord.id] = { nodes: [], edges: [] };
    mockObjectTypes[nextRecord.id] = [];
    mockRelationTypes[nextRecord.id] = [];
    mockActionTypes[nextRecord.id] = [];

    await wait(undefined);
    return nextRecord;
  }

  const response = await http.post<BackendKnowledgeNetwork>(
    "/bkn-backend/v1/knowledge-networks",
    {
      code: input.identifier,
      color: input.color,
      comment: input.description,
      name: input.name,
      tags: input.tags,
    },
  );

  return mapKnowledgeNetwork(response.data);
}

export async function updateKnowledgeNetwork(networkId: string, input: KnowledgeNetworkMutationPayload) {
  if (useMock) {
    mockKnowledgeNetworks = mockKnowledgeNetworks.map((item) =>
      item.id === networkId
        ? {
            ...item,
            identifier: input.identifier,
            name: input.name,
            description: input.description,
            color: input.color,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );

    await wait(undefined);
    return mockKnowledgeNetworks.find((item) => item.id === networkId) ?? null;
  }

  const response = await http.put<BackendKnowledgeNetwork>(
    `/bkn-backend/v1/knowledge-networks/${networkId}`,
    {
      code: input.identifier,
      color: input.color,
      comment: input.description,
      name: input.name,
      tags: input.tags,
    },
  );

  return mapKnowledgeNetwork(response.data);
}

export async function deleteKnowledgeNetwork(networkId: string) {
  if (useMock) {
    mockKnowledgeNetworks = mockKnowledgeNetworks.filter((item) => item.id !== networkId);
    delete mockRecentObjects[networkId];
    delete mockConceptGroups[networkId];
    delete mockPreviewGraphs[networkId];
    delete mockObjectTypes[networkId];
    delete mockRelationTypes[networkId];
    delete mockActionTypes[networkId];
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}`);
}

export async function listKnowledgeNetworkRecentObjects(networkId: string) {
  if (useMock) {
    return wait(mockRecentObjects[networkId] ?? []);
  }

  const response = await http.get<BackendListResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      params: {
        direction: "desc",
        limit: 5,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapRecentObject);
}

export async function listKnowledgeNetworkConceptGroups(networkId: string) {
  if (useMock) {
    return wait((mockConceptGroups[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendConceptGroup>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups`,
    {
      params: {
        direction: "desc",
        limit: 50,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapConceptGroup);
}

export async function listKnowledgeNetworkObjectTypes(networkId: string) {
  if (useMock) {
    return wait((mockObjectTypes[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      params: {
        direction: "desc",
        limit: 100,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapObjectType);
}

export async function getKnowledgeNetworkObjectType(
  networkId: string,
  objectTypeId: string,
) {
  if (useMock) {
    return wait(
      (mockObjectTypes[networkId] ?? []).find((item) => item.id === objectTypeId) ??
        null,
    );
  }

  const response = await http.get<BackendObjectType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`,
  );

  return mapObjectType(response.data);
}

export async function listKnowledgeNetworkRelationTypes(networkId: string) {
  if (useMock) {
    return wait((mockRelationTypes[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendRelationType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
    {
      params: {
        direction: "desc",
        limit: 100,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapRelationType);
}

export async function getKnowledgeNetworkRelationType(
  networkId: string,
  relationTypeId: string,
) {
  if (useMock) {
    return wait(
      (mockRelationTypes[networkId] ?? []).find((item) => item.id === relationTypeId) ??
        null,
    );
  }

  const response = await http.get<BackendRelationType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
  );

  return mapRelationType(response.data);
}

export async function listKnowledgeNetworkActionTypes(networkId: string) {
  if (useMock) {
    return wait((mockActionTypes[networkId] ?? []).map((item) => ({ ...item })));
  }

  const response = await http.get<BackendListResponse<BackendActionType>>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
    {
      params: {
        direction: "desc",
        limit: 100,
        offset: 0,
        sort: "update_time",
      },
    },
  );

  return response.data.entries.map(mapActionType);
}

export async function getKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
) {
  if (useMock) {
    return wait(
      (mockActionTypes[networkId] ?? []).find((item) => item.id === actionTypeId) ??
        null,
    );
  }

  const response = await http.get<BackendActionType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
  );

  return mapActionType(response.data);
}

export async function createKnowledgeNetworkObjectType(
  networkId: string,
  input: KnowledgeNetworkObjectTypeMutationPayload,
) {
  if (useMock) {
    const relatedGroups = (mockConceptGroups[networkId] ?? []).filter((group) =>
      input.conceptGroupIds.includes(group.id),
    );
    const nextItem: KnowledgeNetworkObjectTypeRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      icon: input.icon,
      tags: input.tags,
      conceptGroupIds: input.conceptGroupIds,
      conceptGroupNames: relatedGroups.map((group) => group.name),
      hasIndex: false,
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockObjectTypes[networkId] = [nextItem, ...(mockObjectTypes[networkId] ?? [])];
    mockRecentObjects[networkId] = [
      {
        id: nextItem.id,
        name: nextItem.name,
        comment: nextItem.description,
        color: nextItem.color,
        icon: nextItem.icon,
        tags: nextItem.tags,
        updateTime: nextItem.updateTime,
        updaterName: nextItem.updaterName,
      },
      ...(mockRecentObjects[networkId] ?? []),
    ].slice(0, 5);
    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return nextItem;
  }

  const response = await http.post<BackendObjectType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types`,
    {
      entries: [
        {
          color: input.color,
          comment: input.description,
          concept_group_ids: input.conceptGroupIds,
          icon: input.icon,
          name: input.name,
          tags: input.tags,
        },
      ],
    },
  );

  return Array.isArray((response.data as unknown as { entries?: BackendObjectType[] }).entries)
    ? mapObjectType(
        ((response.data as unknown as { entries?: BackendObjectType[] }).entries ?? [])[0],
      )
    : mapObjectType(response.data);
}

export async function updateKnowledgeNetworkObjectType(
  networkId: string,
  objectTypeId: string,
  input: KnowledgeNetworkObjectTypeMutationPayload,
) {
  if (useMock) {
    const relatedGroups = (mockConceptGroups[networkId] ?? []).filter((group) =>
      input.conceptGroupIds.includes(group.id),
    );
    mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).map((item) =>
      item.id === objectTypeId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            icon: input.icon,
            tags: input.tags,
            conceptGroupIds: input.conceptGroupIds,
            conceptGroupNames: relatedGroups.map((group) => group.name),
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    mockRecentObjects[networkId] = (mockRecentObjects[networkId] ?? []).map((item) =>
      item.id === objectTypeId
        ? {
            ...item,
            name: input.name,
            comment: input.description,
            color: input.color,
            icon: input.icon,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return (
      (mockObjectTypes[networkId] ?? []).find((item) => item.id === objectTypeId) ??
      null
    );
  }

  const response = await http.put<BackendObjectType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`,
    {
      color: input.color,
      comment: input.description,
      concept_group_ids: input.conceptGroupIds,
      icon: input.icon,
      name: input.name,
      tags: input.tags,
    },
  );

  return mapObjectType(response.data);
}

export async function deleteKnowledgeNetworkObjectType(
  networkId: string,
  objectTypeId: string,
) {
  if (useMock) {
    mockObjectTypes[networkId] = (mockObjectTypes[networkId] ?? []).filter(
      (item) => item.id !== objectTypeId,
    );
    mockRecentObjects[networkId] = (mockRecentObjects[networkId] ?? []).filter(
      (item) => item.id !== objectTypeId,
    );
    syncMockConceptGroups(networkId);
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(
    `/bkn-backend/v1/knowledge-networks/${networkId}/object-types/${objectTypeId}`,
  );
}

export async function createKnowledgeNetworkRelationType(
  networkId: string,
  input: KnowledgeNetworkRelationTypeMutationPayload,
) {
  if (useMock) {
    const sourceObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.sourceObjectTypeId,
    );
    const targetObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.targetObjectTypeId,
    );
    const nextItem: KnowledgeNetworkRelationTypeRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      mappingMode: input.mappingMode,
      sourceObjectTypeId: input.sourceObjectTypeId,
      sourceObjectTypeName: sourceObject?.name ?? input.sourceObjectTypeId,
      targetObjectTypeId: input.targetObjectTypeId,
      targetObjectTypeName: targetObject?.name ?? input.targetObjectTypeId,
      tags: input.tags,
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockRelationTypes[networkId] = [nextItem, ...(mockRelationTypes[networkId] ?? [])];
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return nextItem;
  }

  const response = await http.post<BackendRelationType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types`,
    {
      entries: [
        {
          color: input.color,
          comment: input.description,
          mapping_mode: input.mappingMode === "data-view" ? "data_view" : "direct",
          name: input.name,
          source_object_type_id: input.sourceObjectTypeId,
          target_object_type_id: input.targetObjectTypeId,
          tags: input.tags,
        },
      ],
    },
  );

  return Array.isArray((response.data as unknown as { entries?: BackendRelationType[] }).entries)
    ? mapRelationType(
        ((response.data as unknown as { entries?: BackendRelationType[] }).entries ?? [])[0],
      )
    : mapRelationType(response.data);
}

export async function updateKnowledgeNetworkRelationType(
  networkId: string,
  relationTypeId: string,
  input: KnowledgeNetworkRelationTypeMutationPayload,
) {
  if (useMock) {
    const sourceObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.sourceObjectTypeId,
    );
    const targetObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.targetObjectTypeId,
    );
    mockRelationTypes[networkId] = (mockRelationTypes[networkId] ?? []).map((item) =>
      item.id === relationTypeId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            mappingMode: input.mappingMode,
            sourceObjectTypeId: input.sourceObjectTypeId,
            sourceObjectTypeName: sourceObject?.name ?? input.sourceObjectTypeId,
            targetObjectTypeId: input.targetObjectTypeId,
            targetObjectTypeName: targetObject?.name ?? input.targetObjectTypeId,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return (
      (mockRelationTypes[networkId] ?? []).find((item) => item.id === relationTypeId) ??
      null
    );
  }

  const response = await http.put<BackendRelationType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
    {
      color: input.color,
      comment: input.description,
      mapping_mode: input.mappingMode === "data-view" ? "data_view" : "direct",
      name: input.name,
      source_object_type_id: input.sourceObjectTypeId,
      target_object_type_id: input.targetObjectTypeId,
      tags: input.tags,
    },
  );

  return mapRelationType(response.data);
}

export async function deleteKnowledgeNetworkRelationType(
  networkId: string,
  relationTypeId: string,
) {
  if (useMock) {
    mockRelationTypes[networkId] = (mockRelationTypes[networkId] ?? []).filter(
      (item) => item.id !== relationTypeId,
    );
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(
    `/bkn-backend/v1/knowledge-networks/${networkId}/relation-types/${relationTypeId}`,
  );
}

export async function createKnowledgeNetworkActionType(
  networkId: string,
  input: KnowledgeNetworkActionTypeMutationPayload,
) {
  if (useMock) {
    const relatedObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.objectTypeId,
    );
    const nextItem: KnowledgeNetworkActionTypeRecord = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      actionKind: input.actionKind,
      objectTypeId: input.objectTypeId,
      objectTypeName: relatedObject?.name ?? input.objectTypeId,
      tags: input.tags,
      updateTime: formatTimestamp(Date.now()),
      updaterName: "Local Admin",
    };

    mockActionTypes[networkId] = [nextItem, ...(mockActionTypes[networkId] ?? [])];
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return nextItem;
  }

  const actionType =
    input.actionKind === "update"
      ? "UPDATE"
      : input.actionKind === "delete"
        ? "DELETE"
        : input.actionKind === "notify"
          ? "NOTIFY"
          : "ADD";

  const response = await http.post<BackendActionType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types`,
    {
      entries: [
        {
          action_type: actionType,
          color: input.color,
          comment: input.description,
          name: input.name,
          object_type_id: input.objectTypeId,
          tags: input.tags,
        },
      ],
    },
  );

  return Array.isArray((response.data as unknown as { entries?: BackendActionType[] }).entries)
    ? mapActionType(
        ((response.data as unknown as { entries?: BackendActionType[] }).entries ?? [])[0],
      )
    : mapActionType(response.data);
}

export async function updateKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
  input: KnowledgeNetworkActionTypeMutationPayload,
) {
  if (useMock) {
    const relatedObject = (mockObjectTypes[networkId] ?? []).find(
      (item) => item.id === input.objectTypeId,
    );
    mockActionTypes[networkId] = (mockActionTypes[networkId] ?? []).map((item) =>
      item.id === actionTypeId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            actionKind: input.actionKind,
            objectTypeId: input.objectTypeId,
            objectTypeName: relatedObject?.name ?? input.objectTypeId,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
            updaterName: "Local Admin",
          }
        : item,
    );
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return (
      (mockActionTypes[networkId] ?? []).find((item) => item.id === actionTypeId) ??
      null
    );
  }

  const actionType =
    input.actionKind === "update"
      ? "UPDATE"
      : input.actionKind === "delete"
        ? "DELETE"
        : input.actionKind === "notify"
          ? "NOTIFY"
          : "ADD";

  const response = await http.put<BackendActionType>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
    {
      action_type: actionType,
      color: input.color,
      comment: input.description,
      name: input.name,
      object_type_id: input.objectTypeId,
      tags: input.tags,
    },
  );

  return mapActionType(response.data);
}

export async function deleteKnowledgeNetworkActionType(
  networkId: string,
  actionTypeId: string,
) {
  if (useMock) {
    mockActionTypes[networkId] = (mockActionTypes[networkId] ?? []).filter(
      (item) => item.id !== actionTypeId,
    );
    syncKnowledgeNetworkStatistics(networkId);
    await wait(undefined);
    return;
  }

  await http.delete(
    `/bkn-backend/v1/knowledge-networks/${networkId}/action-types/${actionTypeId}`,
  );
}

export async function getKnowledgeNetworkConceptGroup(networkId: string, groupId: string) {
  if (useMock) {
    return wait(mockConceptGroups[networkId]?.find((item) => item.id === groupId) ?? null);
  }

  const response = await http.get<BackendConceptGroup>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}`,
  );

  return mapConceptGroupDetail(response.data);
}

export async function createKnowledgeNetworkConceptGroup(networkId: string, input: ConceptGroupMutationPayload) {
  if (useMock) {
    const nextItem: ConceptGroupDetail = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      color: input.color,
      tags: input.tags,
      objectTypesTotal: 0,
      relationTypesTotal: 0,
      actionTypesTotal: 0,
      updateTime: formatTimestamp(Date.now()),
      objectTypes: [],
      relationTypes: [],
      actionTypes: [],
    };

    mockConceptGroups[networkId] = [nextItem, ...(mockConceptGroups[networkId] ?? [])];
    await wait(undefined);
    return nextItem;
  }

  const response = await http.post<BackendConceptGroup>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups`,
    {
      color: input.color,
      comment: input.description,
      name: input.name,
      tags: input.tags,
    },
  );

  return mapConceptGroupDetail(response.data);
}

export async function updateKnowledgeNetworkConceptGroup(
  networkId: string,
  groupId: string,
  input: ConceptGroupMutationPayload,
) {
  if (useMock) {
    mockConceptGroups[networkId] = (mockConceptGroups[networkId] ?? []).map((item) =>
      item.id === groupId
        ? {
            ...item,
            name: input.name,
            description: input.description,
            color: input.color,
            tags: input.tags,
            updateTime: formatTimestamp(Date.now()),
          }
        : item,
    );

    await wait(undefined);
    return mockConceptGroups[networkId]?.find((item) => item.id === groupId) ?? null;
  }

  const response = await http.put<BackendConceptGroup>(
    `/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}`,
    {
      color: input.color,
      comment: input.description,
      name: input.name,
      tags: input.tags,
    },
  );

  return mapConceptGroupDetail(response.data);
}

export async function deleteKnowledgeNetworkConceptGroup(networkId: string, groupId: string) {
  if (useMock) {
    mockConceptGroups[networkId] = (mockConceptGroups[networkId] ?? []).filter(
      (item) => item.id !== groupId,
    );
    await wait(undefined);
    return;
  }

  await http.delete(`/bkn-backend/v1/knowledge-networks/${networkId}/concept-groups/${groupId}`);
}

export async function getKnowledgeNetworkPreviewGraph(networkId: string) {
  if (useMock) {
    return wait(mockPreviewGraphs[networkId] ?? { nodes: [], edges: [] });
  }

  const response = await http.post<BackendSubgraphResponse>(
    `/ontology-query/v1/knowledge-networks/${networkId}/subgraph`,
    {},
  );

  const subgraph = response.data;
  const rawNodes = (subgraph.nodes ?? subgraph.objects ?? []) as Array<{
    color?: string;
    id?: string;
    name?: string;
  }>;
  const rawEdges = (subgraph.edges ?? subgraph.relations ?? []) as Array<{
    id?: string;
    name?: string;
    source?: string;
    source_id?: string;
    source_object_type_id?: string;
    target?: string;
    target_id?: string;
    target_object_type_id?: string;
  }>;

  return {
    nodes: rawNodes
      .filter((item) => item.id)
      .map((item) => ({
        id: item.id as string,
        name: item.name ?? item.id ?? "-",
        color: item.color ?? "#1677ff",
      })),
    edges: rawEdges
      .filter(
        (item) =>
          item.id &&
          (item.source ?? item.source_id ?? item.source_object_type_id) &&
          (item.target ?? item.target_id ?? item.target_object_type_id),
      )
      .map((item) => ({
        id: item.id as string,
        name: item.name ?? "",
        sourceId:
          item.source ??
          item.source_id ??
          (item.source_object_type_id as string),
        targetId:
          item.target ??
          item.target_id ??
          (item.target_object_type_id as string),
      })),
  };
}
