import {
  cloneActionTypeExecutionConfig,
  createDefaultActionTypeExecutionConfig,
} from "@/modules/knowledge-network/utils/action-type-execution";
import type {
  ActionTypeAffect,
  ActionTypeCondition,
  ActionTypeExecutionConfig,
  ActionTypeExecutionLogDetail,
  ActionTypeExecutionLogQuery,
  ConceptGroupDetail,
  ConceptGroupRelatedResourceRef,
  KnowledgeNetworkActionTypeRecord,
  KnowledgeNetworkMetricRecord,
  KnowledgeNetworkObjectTypeRecord,
  KnowledgeNetworkRecentObject,
  KnowledgeNetworkRecord,
  KnowledgeNetworkRelationTypeRecord,
  KnowledgeNetworkTaskChildRecord,
  KnowledgeNetworkTaskRecord,
  ObjectTypeDataProperty,
  ObjectTypeDataSource,
  ObjectTypeDataViewField,
  ObjectTypeDataViewGroup,
  ObjectTypeDetail,
  ObjectTypeIndexConfig,
  ObjectTypeLogicMetricModelRecord,
  ObjectTypeLogicOperatorRecord,
  ObjectTypeLogicProperty,
  ObjectTypeSmallModel,
  RelationTypeDataViewRowMapping,
  RelationTypePropertyMapping,
} from "@/modules/knowledge-network/types/knowledge-network";
import { formatTimestamp } from "@/modules/knowledge-network/services/shared/runtime";

export let mockKnowledgeNetworks: KnowledgeNetworkRecord[] = [
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

export const mockRecentObjects: Record<string, KnowledgeNetworkRecentObject[]> = {
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

export const mockConceptGroups: Record<string, ConceptGroupDetail[]> = {
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
      updaterName: "Knowledge Team",
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
      updaterName: "Knowledge Team",
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

export const mockObjectTypes: Record<string, KnowledgeNetworkObjectTypeRecord[]> = {
  "kn-domain-risk": [
    {
      id: "ot-risk-order",
      name: "风险订单",
      description: "触发风控策略流程的订单实体。",
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
      name: "风险设备",
      description: "用于识别异常关联模式的设备实体。",
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


const defaultIndexConfig = (): ObjectTypeIndexConfig => ({
  fulltextConfig: {
    analyzer: "",
    enabled: false,
  },
  keywordConfig: {
    enabled: false,
    ignoreAboveLen: 1024,
  },
  vectorConfig: {
    enabled: false,
    modelId: "",
  },
});

export const mockObjectTypeDataProperties: Record<
  string,
  Record<string, ObjectTypeDataProperty[]>
> = {
  "kn-domain-risk": {
    "ot-risk-order": [
      {
        displayKey: false,
        displayName: "Order ID",
        incrementalKey: false,
        indexConfig: {
          ...defaultIndexConfig(),
          keywordConfig: { enabled: true, ignoreAboveLen: 256 },
        },
        name: "order_id",
        primaryKey: true,
        type: "string",
      },
      {
        displayKey: true,
        displayName: "Order Name",
        incrementalKey: false,
        indexConfig: defaultIndexConfig(),
        name: "order_name",
        primaryKey: false,
        type: "string",
      },
      {
        displayKey: false,
        displayName: "Risk Summary",
        incrementalKey: false,
        indexConfig: {
          ...defaultIndexConfig(),
          fulltextConfig: { enabled: true, analyzer: "standard" },
        },
        name: "risk_summary",
        primaryKey: false,
        type: "text",
      },
      {
        displayKey: false,
        displayName: "Risk Score",
        incrementalKey: false,
        name: "risk_score",
        primaryKey: false,
        type: "double",
      },
      {
        displayKey: false,
        displayName: "Embedding",
        incrementalKey: false,
        indexConfig: {
          ...defaultIndexConfig(),
          vectorConfig: { enabled: true, modelId: "sm-embedding-v1" },
        },
        name: "embedding",
        primaryKey: false,
        type: "vector",
      },
    ],
    "ot-risk-device": [
      {
        displayKey: false,
        displayName: "Device ID",
        incrementalKey: false,
        name: "device_id",
        primaryKey: true,
        type: "string",
      },
      {
        displayKey: true,
        displayName: "Device Name",
        incrementalKey: false,
        name: "device_name",
        primaryKey: false,
        type: "string",
      },
      {
        displayKey: false,
        displayName: "Fingerprint",
        incrementalKey: true,
        name: "fingerprint",
        primaryKey: false,
        type: "text",
      },
    ],
  },
  "kn-domain-supply": {
    "ot-supplier": [
      {
        displayKey: false,
        displayName: "Supplier ID",
        incrementalKey: false,
        indexConfig: {
          ...defaultIndexConfig(),
          keywordConfig: { enabled: true, ignoreAboveLen: 128 },
        },
        name: "supplier_id",
        primaryKey: true,
        type: "string",
      },
      {
        displayKey: true,
        displayName: "Supplier Name",
        incrementalKey: false,
        name: "supplier_name",
        primaryKey: false,
        type: "string",
      },
      {
        displayKey: false,
        displayName: "Description",
        incrementalKey: false,
        name: "description",
        primaryKey: false,
        type: "text",
      },
    ],
  },
  "kn-domain-customer": {
    "ot-customer-profile": [
      {
        displayKey: false,
        displayName: "Customer ID",
        incrementalKey: false,
        indexConfig: {
          ...defaultIndexConfig(),
          keywordConfig: { enabled: true, ignoreAboveLen: 128 },
        },
        name: "customer_id",
        primaryKey: true,
        type: "string",
      },
      {
        displayKey: true,
        displayName: "Customer Name",
        incrementalKey: false,
        name: "customer_name",
        primaryKey: false,
        type: "string",
      },
      {
        displayKey: false,
        displayName: "Profile Summary",
        incrementalKey: false,
        indexConfig: {
          ...defaultIndexConfig(),
          fulltextConfig: { enabled: true, analyzer: "ik_max_word" },
        },
        name: "profile_summary",
        primaryKey: false,
        type: "text",
      },
    ],
  },
};

export const mockObjectTypeLogicProperties: Record<
  string,
  Record<string, ObjectTypeLogicProperty[]>
> = {
  "kn-domain-risk": {
    "ot-risk-order": [
      {
        comment: "Computed risk level from policy engine.",
        dataSource: {
          id: "metric-risk-hit-rate",
          name: "风险命中率",
          type: "metric",
        },
        displayName: "Risk Level",
        name: "risk_level",
        parameters: [
          {
            id: "param-risk-region",
            name: "region",
            operation: "==",
            type: "string",
            value: "region_code",
            valueFrom: "property",
          },
        ],
        type: "metric",
      },
    ],
  },
};

export const mockObjectTypeLogicMetricModels: ObjectTypeLogicMetricModelRecord[] = [
  {
    analysisDimensions: [
      { displayName: "区域", name: "region", type: "string" },
      { displayName: "风险等级", name: "risk_level", type: "string" },
    ],
    groupName: "风控指标",
    id: "metric-risk-hit-rate",
    name: "风险命中率",
  },
  {
    analysisDimensions: [
      { displayName: "设备 ID", name: "device_id", type: "string" },
      { displayName: "评分", name: "risk_score", type: "integer" },
    ],
    groupName: "设备指标",
    id: "metric-device-score",
    name: "设备风险评分",
  },
];

export const mockObjectTypeLogicOperators: ObjectTypeLogicOperatorRecord[] = [
  {
    id: "operator-risk-eval",
    inputParameters: [
      {
        description: "设备标识",
        key: "device_id",
        name: "device_id",
        source: "Body",
        type: "string",
      },
      {
        description: "风险阈值",
        key: "threshold",
        name: "threshold",
        source: "Body",
        type: "integer",
      },
    ],
    name: "风险评分算子",
  },
];

export function cloneDataProperties(properties: ObjectTypeDataProperty[]) {
  return properties.map((item) => ({
    ...item,
    indexConfig: item.indexConfig
      ? {
          fulltextConfig: { ...item.indexConfig.fulltextConfig },
          keywordConfig: { ...item.indexConfig.keywordConfig },
          vectorConfig: { ...item.indexConfig.vectorConfig },
        }
      : undefined,
  }));
}

export function objectTypeHasIndexFromProperties(properties: ObjectTypeDataProperty[]) {
  return properties.some(
    (property) =>
      property.indexConfig &&
      (property.indexConfig.keywordConfig.enabled ||
        property.indexConfig.fulltextConfig.enabled ||
        property.indexConfig.vectorConfig.enabled),
  );
}

export const mockObjectTypeDataSources: Record<string, Record<string, ObjectTypeDataSource>> = {
  "kn-domain-risk": {
    "ot-risk-order": { id: "dv-risk-order", name: "风险订单视图" },
  },
};

export function persistMockObjectTypeProperties(
  networkId: string,
  objectTypeId: string,
  dataProperties: ObjectTypeDataProperty[],
  logicProperties: ObjectTypeLogicProperty[],
  dataSource?: ObjectTypeDataSource,
) {
  mockObjectTypeDataProperties[networkId] = {
    ...(mockObjectTypeDataProperties[networkId] ?? {}),
    [objectTypeId]: cloneDataProperties(dataProperties),
  };
  mockObjectTypeLogicProperties[networkId] = {
    ...(mockObjectTypeLogicProperties[networkId] ?? {}),
    [objectTypeId]: logicProperties.map((item) => ({ ...item })),
  };
  if (dataSource) {
    mockObjectTypeDataSources[networkId] = {
      ...(mockObjectTypeDataSources[networkId] ?? {}),
      [objectTypeId]: { ...dataSource },
    };
  } else if (mockObjectTypeDataSources[networkId]?.[objectTypeId]) {
    const nextSources = { ...mockObjectTypeDataSources[networkId] };
    delete nextSources[objectTypeId];
    mockObjectTypeDataSources[networkId] = nextSources;
  }
}

export function removeMockObjectTypeProperties(networkId: string, objectTypeId: string) {
  if (mockObjectTypeDataProperties[networkId]) {
    delete mockObjectTypeDataProperties[networkId][objectTypeId];
  }
  if (mockObjectTypeLogicProperties[networkId]) {
    delete mockObjectTypeLogicProperties[networkId][objectTypeId];
  }
  if (mockObjectTypeDataSources[networkId]) {
    delete mockObjectTypeDataSources[networkId][objectTypeId];
  }
}

export const mockObjectTypeSmallModels: ObjectTypeSmallModel[] = [
  {
    batchSize: 32,
    embeddingDim: 768,
    label: "Embedding V1",
    maxTokens: 512,
    value: "sm-embedding-v1",
  },
  {
    batchSize: 16,
    embeddingDim: 1024,
    label: "Embedding V2",
    maxTokens: 1024,
    value: "sm-embedding-v2",
  },
];

export const mockObjectTypeDataViewGroups: Record<string, ObjectTypeDataViewGroup[]> = {
  "kn-domain-risk": [
    { id: "source-type:mysql", name: "MySQL", selectable: false, type: "mysql" },
    { id: "ds-mysql", name: "order_platform", parentId: "source-type:mysql", type: "mysql" },
    { id: "source-type:index_base", name: "Index Base", selectable: false, type: "index_base" },
    { id: "ds-index", name: "索引库", parentId: "source-type:index_base", type: "index_base" },
  ],
  "kn-domain-supply": [
    { id: "source-type:mysql", name: "MySQL", selectable: false, type: "mysql" },
    { id: "ds-mysql", name: "supply_platform", parentId: "source-type:mysql", type: "mysql" },
  ],
  "kn-domain-customer": [
    { id: "source-type:index_base", name: "Index Base", selectable: false, type: "index_base" },
    { id: "ds-index", name: "索引库", parentId: "source-type:index_base", type: "index_base" },
  ],
};

export const mockObjectTypeDataViews: Record<string, ObjectTypeDataSource[]> = {
  "kn-domain-risk": [
    { dataSourceId: "ds-mysql", id: "dv-risk-order", name: "风险订单视图" },
    { dataSourceId: "ds-mysql", id: "dv-risk-device", name: "风险设备视图" },
    { dataSourceId: "ds-mysql", id: "dv-risk-payment", name: "付款表" },
    { dataSourceId: "ds-mysql", id: "dv-risk-product", name: "商品表" },
    { dataSourceId: "ds-index", id: "dv-risk-order-detail", name: "订单明细表" },
  ],
  "kn-domain-supply": [{ dataSourceId: "ds-mysql", id: "dv-supplier", name: "Supplier View" }],
  "kn-domain-customer": [{ dataSourceId: "ds-index", id: "dv-customer", name: "Customer View" }],
};

export const mockObjectTypeDataViewPreviewRows: Record<
  string,
  Record<string, Array<Record<string, string | number>>>
> = {
  "kn-domain-risk": {
    "dv-risk-order": [
      {
        order_id: "1",
        order_name: "ORD-202401",
        risk_level: 3,
        updated_at: "2024-01-15 10:30:00",
      },
      {
        order_id: "2",
        order_name: "ORD-202402",
        risk_level: 2,
        updated_at: "2024-01-16 11:20:00",
      },
      {
        order_id: "3",
        order_name: "ORD-202403",
        risk_level: 4,
        updated_at: "2024-01-17 09:15:00",
      },
    ],
    "dv-risk-device": [
      {
        device_id: "d-001",
        device_name: "Device A",
        risk_score: 0.82,
      },
      {
        device_id: "d-002",
        device_name: "Device B",
        risk_score: 0.61,
      },
    ],
  },
};

export const mockObjectTypeDataViewFields: Record<
  string,
  Record<string, ObjectTypeDataViewField[]>
> = {
  "kn-domain-risk": {
    "dv-risk-order": [
      { displayName: "订单 ID", name: "order_id", type: "string" },
      { displayName: "订单名称", name: "order_name", type: "string" },
      { displayName: "风险等级", name: "risk_level", type: "integer" },
      { displayName: "更新时间", name: "updated_at", type: "string" },
    ],
    "dv-risk-device": [
      { displayName: "设备 ID", name: "device_id", type: "string" },
      { displayName: "设备名称", name: "device_name", type: "string" },
      { displayName: "风险评分", name: "risk_score", type: "double" },
    ],
    "dv-risk-payment": [
      { displayName: "付款单号", name: "payment_no", type: "string" },
      { displayName: "付款金额", name: "amount", type: "double" },
      { displayName: "付款时间", name: "paid_at", type: "string" },
    ],
    "dv-risk-product": [
      { displayName: "商品 ID", name: "product_id", type: "string" },
      { displayName: "商品名称", name: "product_name", type: "string" },
    ],
    "dv-risk-order-detail": [
      { displayName: "明细 ID", name: "detail_id", type: "string" },
      { displayName: "订单 ID", name: "order_id", type: "string" },
      { displayName: "数量", name: "quantity", type: "integer" },
    ],
  },
  "kn-domain-supply": {
    "dv-supplier": [
      { displayName: "Supplier ID", name: "supplier_id", type: "string" },
      { displayName: "Supplier Name", name: "supplier_name", type: "string" },
    ],
  },
  "kn-domain-customer": {
    "dv-customer": [
      { displayName: "Customer ID", name: "customer_id", type: "string" },
      { displayName: "Customer Name", name: "customer_name", type: "string" },
    ],
  },
};

export const mockRelationTypes: Record<string, KnowledgeNetworkRelationTypeRecord[]> = {
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

export const mockRelationTypeMappings: Record<
  string,
  Record<string, RelationTypePropertyMapping[]>
> = {
  "kn-domain-risk": {
    "rt-risk-bind": [
      {
        sourcePropertyName: "order_id",
        targetPropertyName: "device_id",
      },
    ],
  },
};

export const mockRelationTypeDataViewMappings: Record<
  string,
  Record<
    string,
    {
      backingDataSourceId: string;
      backingDataSourceName?: string;
      dataViewMappings: RelationTypeDataViewRowMapping[];
    }
  >
> = {
  "kn-domain-supply": {
    "rt-supply-service": {
      backingDataSourceId: "dv-supplier",
      backingDataSourceName: "Supplier View",
      dataViewMappings: [
        {
          dataViewSourcePropertyName: "supplier_id",
          dataViewTargetPropertyName: "supplier_name",
          sourceObjectPropertyName: "supplier_id",
          targetObjectPropertyName: "supplier_name",
        },
      ],
    },
  },
};

export function cloneRelationTypeDataViewMappings(
  mappings: RelationTypeDataViewRowMapping[],
): RelationTypeDataViewRowMapping[] {
  return mappings.map((item) => ({ ...item }));
}

export function persistMockRelationTypeDataViewMappings(
  networkId: string,
  relationTypeId: string,
  store: {
    backingDataSourceId: string;
    backingDataSourceName?: string;
    dataViewMappings: RelationTypeDataViewRowMapping[];
  },
) {
  mockRelationTypeDataViewMappings[networkId] = {
    ...(mockRelationTypeDataViewMappings[networkId] ?? {}),
    [relationTypeId]: {
      backingDataSourceId: store.backingDataSourceId,
      backingDataSourceName: store.backingDataSourceName,
      dataViewMappings: cloneRelationTypeDataViewMappings(store.dataViewMappings),
    },
  };
}

export function removeMockRelationTypeDataViewMappings(networkId: string, relationTypeId: string) {
  if (mockRelationTypeDataViewMappings[networkId]) {
    delete mockRelationTypeDataViewMappings[networkId][relationTypeId];
  }
}

export function cloneRelationTypePropertyMappings(
  mappings: RelationTypePropertyMapping[],
): RelationTypePropertyMapping[] {
  return mappings.map((item) => ({ ...item }));
}

export function persistMockRelationTypeMappings(
  networkId: string,
  relationTypeId: string,
  propertyMappings: RelationTypePropertyMapping[],
) {
  mockRelationTypeMappings[networkId] = {
    ...(mockRelationTypeMappings[networkId] ?? {}),
    [relationTypeId]: cloneRelationTypePropertyMappings(propertyMappings),
  };
}

export function removeMockRelationTypeMappings(networkId: string, relationTypeId: string) {
  if (mockRelationTypeMappings[networkId]) {
    delete mockRelationTypeMappings[networkId][relationTypeId];
  }
}

export const mockActionTypes: Record<string, KnowledgeNetworkActionTypeRecord[]> = {
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

export type ActionTypeDetailExtras = {
  affect?: ActionTypeAffect;
  condition?: ActionTypeCondition;
};

export const mockActionTypeExecutionConfigs: Record<
  string,
  Record<string, ActionTypeExecutionConfig>
> = {
  "kn-domain-risk": {
    "at-risk-block": {
      actionSource: {
        boxId: "box-risk",
        boxName: "Risk Tools",
        toolId: "block_order_tool",
        toolName: "Block Order",
        type: "tool",
      },
      parameters: [
        {
          name: "order_id",
          sourcePropertyName: "order_id",
          valueFrom: "property",
        },
      ],
      sourceName: "Risk Tools/Block Order",
      sourceType: "tool",
    },
  },
};

export const mockActionTypeDetailExtras: Record<
  string,
  Record<string, ActionTypeDetailExtras>
> = {
  "kn-domain-risk": {
    "at-risk-block": {
      affect: {
        comment: "Blocks the order and notifies downstream systems.",
      },
      condition: {
        field: "risk_level",
        objectTypeId: "ot-risk-order",
        operation: ">=",
        value: "HIGH",
        valueFrom: "const",
      },
    },
  },
};

export { cloneActionTypeExecutionConfig, createDefaultActionTypeExecutionConfig };

export function persistMockActionTypeExecutionConfig(
  networkId: string,
  actionTypeId: string,
  executionConfig: ActionTypeExecutionConfig,
) {
  mockActionTypeExecutionConfigs[networkId] = {
    ...(mockActionTypeExecutionConfigs[networkId] ?? {}),
    [actionTypeId]: cloneActionTypeExecutionConfig(executionConfig),
  };
}

export function removeMockActionTypeExecutionConfig(networkId: string, actionTypeId: string) {
  if (mockActionTypeExecutionConfigs[networkId]) {
    delete mockActionTypeExecutionConfigs[networkId][actionTypeId];
  }
}

export function persistMockActionTypeDetailExtras(
  networkId: string,
  actionTypeId: string,
  extras: ActionTypeDetailExtras,
) {
  const current = mockActionTypeDetailExtras[networkId]?.[actionTypeId] ?? {};
  mockActionTypeDetailExtras[networkId] = {
    ...(mockActionTypeDetailExtras[networkId] ?? {}),
    [actionTypeId]: {
      affect:
        extras.affect !== undefined
          ? extras.affect
            ? { ...extras.affect }
            : undefined
          : current.affect,
      condition:
        extras.condition !== undefined
          ? extras.condition
            ? { ...extras.condition }
            : undefined
          : current.condition,
    },
  };
}

export function removeMockActionTypeDetailExtras(networkId: string, actionTypeId: string) {
  if (mockActionTypeDetailExtras[networkId]) {
    delete mockActionTypeDetailExtras[networkId][actionTypeId];
  }
}

export const mockActionTypeExecutionLogs: Record<string, ActionTypeExecutionLogDetail[]> = {
  "kn-domain-risk": [
    {
      actionTypeId: "at-risk-block",
      actionTypeName: "Block Order",
      durationMs: 1280,
      endTime: "2026-06-04 18:06:18",
      executorName: "Knowledge Team",
      failedCount: 0,
      id: "exec-risk-001",
      results: [
        {
          displayName: "Risk Order / order-1001",
          durationMs: 1280,
          status: "success",
        },
      ],
      startTime: "2026-06-04 18:06:17",
      status: "completed",
      successCount: 1,
      totalCount: 1,
      triggerType: "manual",
    },
  ],
};

function cloneActionTypeExecutionLog(log: ActionTypeExecutionLogDetail): ActionTypeExecutionLogDetail {
  return {
    ...log,
    results: log.results?.map((item) => ({ ...item })),
  };
}

function filterMockActionTypeExecutionLogs(
  networkId: string,
  query: ActionTypeExecutionLogQuery,
): ActionTypeExecutionLogDetail[] {
  const keyword = query.keyword?.trim().toLowerCase() ?? "";
  return (mockActionTypeExecutionLogs[networkId] ?? []).filter((item) => {
    if (query.actionTypeId && item.actionTypeId !== query.actionTypeId) {
      return false;
    }
    if (query.status && item.status !== query.status) {
      return false;
    }
    if (query.triggerType && item.triggerType !== query.triggerType) {
      return false;
    }
    if (keyword && !item.id.toLowerCase().includes(keyword)) {
      return false;
    }
    return true;
  });
}

export function listMockActionTypeExecutionLogs(
  networkId: string,
  query: ActionTypeExecutionLogQuery,
) {
  const filtered = filterMockActionTypeExecutionLogs(networkId, query);
  const offset = query.offset ?? 0;
  const limit = query.limit ?? 10;
  const entries = filtered.slice(offset, offset + limit).map((item) => cloneActionTypeExecutionLog(item));

  return {
    entries,
    totalCount: filtered.length,
  };
}

export function getMockActionTypeExecutionLogDetail(networkId: string, logId: string) {
  const log = (mockActionTypeExecutionLogs[networkId] ?? []).find((item) => item.id === logId);
  return log ? cloneActionTypeExecutionLog(log) : null;
}

export function createMockActionTypeExecutionLog(
  networkId: string,
  input: {
    actionTypeId: string;
    actionTypeName: string;
  },
) {
  const nextLog: ActionTypeExecutionLogDetail = {
    actionTypeId: input.actionTypeId,
    actionTypeName: input.actionTypeName,
    durationMs: 0,
    executorName: "Local Admin",
    failedCount: 0,
    id: `exec-${crypto.randomUUID().slice(0, 8)}`,
    results: [],
    startTime: formatTimestamp(Date.now()),
    status: "pending",
    successCount: 0,
    totalCount: 1,
    triggerType: "manual",
  };

  mockActionTypeExecutionLogs[networkId] = [
    nextLog,
    ...(mockActionTypeExecutionLogs[networkId] ?? []),
  ];

  return cloneActionTypeExecutionLog(nextLog);
}

export function completeMockActionTypeExecutionLog(networkId: string, logId: string) {
  mockActionTypeExecutionLogs[networkId] = (mockActionTypeExecutionLogs[networkId] ?? []).map(
    (item) =>
      item.id === logId
        ? {
            ...item,
            durationMs: 980,
            endTime: formatTimestamp(Date.now()),
            failedCount: 0,
            results: [
              {
                displayName: `${item.actionTypeName} / manual-run`,
                durationMs: 980,
                status: "success" as const,
              },
            ],
            status: "completed" as const,
            successCount: 1,
          }
        : item,
  );
}

export function cancelMockActionTypeExecutionLog(networkId: string, logId: string) {
  mockActionTypeExecutionLogs[networkId] = (mockActionTypeExecutionLogs[networkId] ?? []).map(
    (item) =>
      item.id === logId && (item.status === "pending" || item.status === "running")
        ? {
            ...item,
            durationMs: 0,
            endTime: formatTimestamp(Date.now()),
            status: "cancelled",
          }
        : item,
  );
}

export function removeMockActionTypeExecutionLogs(networkId: string, actionTypeId: string) {
  mockActionTypeExecutionLogs[networkId] = (mockActionTypeExecutionLogs[networkId] ?? []).filter(
    (item) => item.actionTypeId !== actionTypeId,
  );
}

export const mockMetrics: Record<string, KnowledgeNetworkMetricRecord[]> = {
  "kn-domain-risk": [
    {
      calculationFormula: {
        aggregation: {
          aggr: "avg",
          property: "risk_score",
        },
        analysisDimensions: ["order_name"],
        groupBy: ["order_name"],
        orderBy: {
          direction: "desc",
          property: "risk_score",
        },
      },
      description: "统计命中风控策略的订单占比。",
      id: "metric-risk-hit-rate",
      metricType: "atomic",
      name: "风险命中率",
      scopeRef: "ot-risk-order",
      scopeType: "object_type",
      tags: ["风控"],
      timeDimension: {
        defaultRangePolicy: "last_24h",
        property: "created_at",
      },
      unit: "%",
      unitType: "percent",
      updateTime: "2026-06-04 12:00:00",
      updaterName: "Knowledge Team",
    },
  ],
};

export const mockTasks: Record<string, KnowledgeNetworkTaskRecord[]> = {
  "kn-domain-risk": [
    {
      id: "job-full-001",
      name: "全量同步任务",
      jobType: "full",
      state: "completed",
      startTime: "2026-06-03 10:00:00",
      finishTime: "2026-06-03 10:45:00",
      duration: "45m",
    },
  ],
};

export const mockTaskChildren: Record<string, KnowledgeNetworkTaskChildRecord[]> = {
  "job-full-001": [
    {
      id: "child-001",
      conceptName: "风险订单",
      conceptType: "object_type",
      state: "completed",
      duration: "12m",
    },
    {
      id: "child-002",
      conceptName: "命中关系",
      conceptType: "relation_type",
      state: "completed",
      duration: "8m",
    },
    {
      id: "child-003",
      conceptName: "告警行动",
      conceptType: "action_type",
      state: "running",
      duration: "--",
    },
  ],
};

export function syncKnowledgeNetworkStatistics(networkId: string) {
  const objectTypeCount = (mockObjectTypes[networkId] ?? []).length;
  const conceptGroupCount = (mockConceptGroups[networkId] ?? []).length;
  const relationTypeCount = (mockRelationTypes[networkId] ?? []).length;
  const actionTypeCount = (mockActionTypes[networkId] ?? []).length;
  const metricCount = (mockMetrics[networkId] ?? []).length;

  mockKnowledgeNetworks = mockKnowledgeNetworks.map((item) =>
    item.id === networkId
      ? {
          ...item,
          updateTime: formatTimestamp(Date.now()),
          updaterName: "Local Admin",
          statistics: {
            ...item.statistics,
            actionTypesTotal: actionTypeCount,
            conceptGroupsTotal: conceptGroupCount,
            metricsTotal: metricCount,
            objectTypesTotal: objectTypeCount,
            relationTypesTotal: relationTypeCount,
          },
        }
      : item,
  );
}

function buildConceptGroupObjectTypeRef(
  networkId: string,
  objectTypeId?: string,
): ConceptGroupRelatedResourceRef | undefined {
  if (!objectTypeId) {
    return undefined;
  }

  const objectType = (mockObjectTypes[networkId] ?? []).find((item) => item.id === objectTypeId);
  if (!objectType) {
    return undefined;
  }

  return {
    color: objectType.color,
    icon: objectType.icon,
    id: objectType.id,
    name: objectType.name,
  };
}

export function enrichConceptGroupDetail(
  networkId: string,
  group: ConceptGroupDetail,
): ConceptGroupDetail {
  const relationTypes = mockRelationTypes[networkId] ?? [];
  const actionTypes = mockActionTypes[networkId] ?? [];
  const objectTypes = mockObjectTypes[networkId] ?? [];

  return {
    ...group,
    actionTypes: group.actionTypes.map((item) => {
      const record = actionTypes.find((entry) => entry.id === item.id);
      return {
        ...item,
        actionKind: record?.actionKind,
        boundObjectType: buildConceptGroupObjectTypeRef(networkId, record?.objectTypeId),
      };
    }),
    objectTypes: group.objectTypes.map((item) => {
      const record = objectTypes.find((entry) => entry.id === item.id);
      return {
        ...item,
        color: record?.color ?? item.color,
        description: record?.description ?? item.description,
        icon: record?.icon ?? item.icon,
        tags: record?.tags ?? item.tags,
      };
    }),
    relationTypes: group.relationTypes.map((item) => {
      const record = relationTypes.find((entry) => entry.id === item.id);
      return {
        ...item,
        sourceObjectType: buildConceptGroupObjectTypeRef(networkId, record?.sourceObjectTypeId),
        targetObjectType: buildConceptGroupObjectTypeRef(networkId, record?.targetObjectTypeId),
      };
    }),
  };
}

export function syncMockConceptGroups(networkId: string) {
  const objectTypes = mockObjectTypes[networkId] ?? [];

  mockConceptGroups[networkId] = (mockConceptGroups[networkId] ?? []).map((group) => {
    const relatedObjectTypes = objectTypes.filter((item) =>
      item.conceptGroupIds.includes(group.id),
    );

    const nextGroup: ConceptGroupDetail = {
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
      relationTypesTotal: group.relationTypes.length,
      actionTypesTotal: group.actionTypes.length,
    };

    return enrichConceptGroupDetail(networkId, nextGroup);
  });
}

export function buildMockObjectTypeDetail(
  networkId: string,
  objectTypeId: string,
): ObjectTypeDetail | null {
  const record = (mockObjectTypes[networkId] ?? []).find(
    (item) => item.id === objectTypeId,
  );

  if (!record) {
    return null;
  }

  const properties = cloneDataProperties(
    mockObjectTypeDataProperties[networkId]?.[objectTypeId] ?? [],
  );
  const logicProperties = (
    mockObjectTypeLogicProperties[networkId]?.[objectTypeId] ?? []
  ).map((item) => ({ ...item }));
  const primaryKeys = properties.filter((item) => item.primaryKey).map((item) => item.name);
  const displayKey = properties.find((item) => item.displayKey)?.name ?? "";
  const incrementalKey = properties.find((item) => item.incrementalKey)?.name ?? "";

  return {
    ...record,
    dataProperties: properties,
    dataSource: mockObjectTypeDataSources[networkId]?.[objectTypeId],
    displayKey,
    incrementalKey,
    logicProperties,
    primaryKeys,
  };
}

export function replaceMockKnowledgeNetworks(next: KnowledgeNetworkRecord[]) {
  mockKnowledgeNetworks.splice(0, mockKnowledgeNetworks.length, ...next);
}
