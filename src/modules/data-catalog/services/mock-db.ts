/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  BuildTask,
  CatalogResource,
  CatalogDiscoverRecord,
} from "@/modules/data-catalog/types/data-catalog";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";

/**
 * Shared mock storage for data resources, build tasks, and discovery records. It models SDK behavior:
 * batch tasks advance through synced/vectorized counts, streaming tasks become persistent listeners
 * after catching up with existing data, and services pause listeners when connections are disabled.
 */

const listeners = new Set<() => void>();

export function subscribeMockDb(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error(error);
    }
  });
}

const SLUG_ALPHABET = "0123456789abcdefghijklmnopqrstuv";

export function mockSlug(length = 20) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)];
  }
  return value;
}

export function formatMockTimestamp(value: number) {
  return formatDateTimeYmdHms(value);
}

const now = Date.now();
const minutesAgo = (minutes: number) => now - minutes * 60_000;
const daysAgo = (days: number) => now - days * 86_400_000;

function makeResource(
  input: Omit<CatalogResource, "columnCount" | "enabled" | "localIndexStatus" | "updateTime"> &
    Partial<Pick<CatalogResource, "enabled" | "localIndexStatus">>,
): CatalogResource {
  return {
    ...input,
    columnCount: input.schema.length,
    enabled: input.enabled ?? true,
    localIndexStatus: input.localIndexStatus ?? "unavailable",
    updateTime: formatMockTimestamp(input.expectedUpdateTime),
  };
}

export const mockResources: CatalogResource[] = [
  makeResource({
    id: "res-customers",
    catalogId: "cat-001",
    name: "customers",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.customers",
    description: "客户主数据表,含联系方式与生命周期状态。",
    tags: ["crm", "core"],
    creatorName: "Platform Admin",
    createTime: formatMockTimestamp(daysAgo(28)),
    updaterName: "Data Steward",
    lastDiscoverStatus: "updated",
    localIndexName: "idx_customers_v3",
    localIndexStatus: "available",
    status: "active",
    schema: [
      {
        name: "customer_id",
        displayName: "客户ID",
        description: "客户唯一标识",
        type: "bigint",
        features: [{ featureType: "keyword" }],
      },
      {
        name: "name",
        displayName: "客户名称",
        description: "客户显示名称",
        type: "varchar(128)",
        features: [
          { featureType: "fulltext", config: { analyzer: "ik_max_word" } },
        ],
      },
      {
        name: "segment",
        displayName: "客户分层",
        type: "varchar(32)",
      },
      {
        name: "profile_text",
        displayName: "客户画像",
        description: "结构化画像文本，供检索与向量化",
        type: "text",
        features: [
          { featureType: "fulltext", config: { analyzer: "ik_max_word" } },
          { featureType: "vector", config: { embedding_model: "sm-1" } },
        ],
      },
      { name: "updated_at", displayName: "更新时间", type: "datetime" },
    ],
    indexConfig: {
      buildKeyFields: ["updated_at"],
      defaultFulltextAnalyzer: "ik_max_word",
      defaultEmbeddingModel: "sm-1",
    },
    rowCount: 182_340,
    expectedUpdateTime: minutesAgo(42),
  }),
  makeResource({
    id: "res-orders",
    catalogId: "cat-001",
    name: "orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.orders",
    description: "订单事实表。",
    tags: ["crm", "orders"],
    creatorName: "Platform Admin",
    createTime: formatMockTimestamp(daysAgo(26)),
    updaterName: "Data Steward",
    lastDiscoverStatus: "unchanged",
    status: "active",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "customer_id", type: "bigint" },
      { name: "item_summary", type: "text" },
      { name: "amount", type: "decimal(18,2)" },
      { name: "created_at", type: "datetime" },
    ],
    rowCount: 96_120,
    expectedUpdateTime: minutesAgo(18),
  }),
  makeResource({
    id: "res-source-missing",
    catalogId: "cat-001",
    name: "archived_orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.archived_orders",
    description: "用于验证源端资源消失后，即使保留旧字段也禁止查询和预览。",
    lastDiscoverStatus: "missing",
    statusMessage: "The resource was not found during the latest discovery.",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "archived_at", type: "datetime" },
    ],
    rowCount: 12_480,
    expectedUpdateTime: minutesAgo(30),
  }),
  makeResource({
    id: "res-discovery-error",
    catalogId: "cat-001",
    name: "discover_error_orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.discover_error_orders",
    description: "用于验证最近一次探查失败但仍保留旧字段的降级预览。",
    lastDiscoverStatus: "error",
    statusMessage: "The latest metadata discovery failed.",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "updated_at", type: "datetime" },
    ],
    rowCount: 8_640,
    expectedUpdateTime: minutesAgo(35),
  }),
  makeResource({
    id: "res-discovery-error-no-schema",
    catalogId: "cat-001",
    name: "discover_error_no_schema",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.discover_error_no_schema",
    description: "用于验证探查失败且没有任何可用字段时禁止查询和预览。",
    lastDiscoverStatus: "error",
    statusMessage: "Metadata discovery failed before any fields were available.",
    schema: [],
    rowCount: 0,
    expectedUpdateTime: minutesAgo(36),
  }),
  makeResource({
    id: "res-discovery-new",
    catalogId: "cat-001",
    name: "discover_new_orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.discover_new_orders",
    description: "用于验证新发现资源的探查状态。",
    lastDiscoverStatus: "new",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "created_at", type: "datetime" },
    ],
    rowCount: 320,
    expectedUpdateTime: minutesAgo(4),
  }),
  makeResource({
    id: "res-discovery-restored",
    catalogId: "cat-001",
    name: "discover_restored_orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.discover_restored_orders",
    description: "用于验证源端资源重新出现后的恢复状态。",
    lastDiscoverStatus: "restored",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "restored_at", type: "datetime" },
    ],
    rowCount: 1_280,
    expectedUpdateTime: minutesAgo(6),
  }),
  makeResource({
    id: "res-discovery-unchanged",
    catalogId: "cat-001",
    name: "discover_unchanged_orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.discover_unchanged_orders",
    description: "用于验证源端元数据未变化的探查状态。",
    lastDiscoverStatus: "unchanged",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "checked_at", type: "datetime" },
    ],
    rowCount: 24_000,
    expectedUpdateTime: minutesAgo(8),
  }),
  makeResource({
    id: "res-discovery-updated",
    catalogId: "cat-001",
    name: "discover_updated_orders",
    category: "table",
    schemaName: "customer_center",
    sourceIdentifier: "crm_core.discover_updated_orders",
    description: "用于验证源端元数据发生变化后的探查状态。",
    lastDiscoverStatus: "updated",
    schema: [
      { name: "order_id", type: "bigint" },
      { name: "amount", type: "decimal(18,2)" },
      { name: "updated_at", type: "datetime" },
    ],
    rowCount: 16_800,
    expectedUpdateTime: minutesAgo(10),
  }),
  makeResource({
    id: "res-kn-chunks",
    catalogId: "cat-002",
    name: "kn_chunks",
    category: "dataset",
    sourceIdentifier: "knowledge_index.kn_chunks",
    description: "知识网络切片数据集,供向量检索。",
    schema: [
      { name: "chunk_id", type: "varchar(64)" },
      { name: "doc_id", type: "varchar(64)" },
      { name: "content", type: "text" },
      { name: "updated_at", type: "datetime" },
    ],
    rowCount: 48_206,
    expectedUpdateTime: minutesAgo(160),
  }),
  makeResource({
    id: "res-metadata-unavailable",
    catalogId: "cat-002",
    name: "metadata_pending_dataset",
    category: "dataset",
    sourceIdentifier: "knowledge_index.metadata_pending_dataset",
    description: "用于验证资源字段元数据尚未就绪时的查询与预览保护。",
    schema: [],
    rowCount: 0,
    expectedUpdateTime: minutesAgo(5),
  }),
  makeResource({
    id: "adp_bkn_concept_dataset",
    catalogId: "adp_bkn_catalog",
    name: "adp_bkn_concept_dataset",
    category: "dataset",
    sourceIdentifier: "",
    description: "BKN的概念存储数据集",
    schema: [
      {
        name: "module_type",
        displayName: "module_type",
        description: "bkn中的概念模块类型",
        type: "string",
        features: [{ featureType: "keyword", name: "keyword_module_type", isDefault: true }],
      },
      {
        name: "id",
        displayName: "id",
        description: "BKN中概念的唯一标识符",
        type: "string",
        features: [{ featureType: "keyword", name: "keyword_id", isDefault: true }],
      },
      {
        name: "name",
        displayName: "name",
        description: "BKN中概念的名称",
        type: "text",
        features: [
          { featureType: "keyword", name: "keyword_name", isDefault: true },
          { featureType: "fulltext", name: "fulltext_name", isDefault: true, config: { analyzer: "standard" } },
        ],
      },
      {
        name: "comment",
        displayName: "comment",
        description: "BKN中概念的注释说明",
        type: "text",
        features: [
          { featureType: "keyword", name: "keyword_comment", isDefault: true },
          { featureType: "fulltext", name: "fulltext_comment", isDefault: true, config: { analyzer: "standard" } },
        ],
      },
      {
        name: "detail",
        displayName: "detail",
        description: "BKN中概念的详细信息描述",
        type: "text",
        features: [
          { featureType: "keyword", name: "keyword_detail", isDefault: true },
          { featureType: "fulltext", name: "fulltext_detail", isDefault: true, config: { analyzer: "standard" } },
        ],
      },
      { name: "kn_id", displayName: "kn_id", type: "string" },
      { name: "branch", displayName: "branch", type: "string" },
      { name: "creator", displayName: "creator", type: "json" },
      { name: "create_time", displayName: "create_time", type: "datetime" },
      { name: "updater", displayName: "updater", type: "json" },
      { name: "update_time", displayName: "update_time", type: "datetime" },
    ],
    indexConfig: { defaultFulltextAnalyzer: "standard" },
    rowCount: 0,
    expectedUpdateTime: minutesAgo(3),
  }),
];

const mockCatalogNames: Record<string, string> = {
  "cat-001": "customer_master",
  "cat-002": "knowledge_index",
  "cat-003": "finance_dw",
};

export function mockCatalogName(id?: string) {
  return id ? mockCatalogNames[id] : undefined;
}

function makeTask(
  input: Omit<
    BuildTask,
    | "finishTime"
    | "fulltextAnalyzer"
    | "fulltextFields"
    | "lastProgressTime"
    | "startTime"
  > & {
    finishedAt?: number | null;
    lastProgressAt?: number | null;
    startedAt?: number | null;
    fulltextAnalyzer?: string;
    fulltextFields?: string[];
  },
): BuildTask {
  const resource = mockResources.find((item) => item.id === input.resourceId);
  const catalogId = input.catalogId ?? resource?.catalogId;
  return {
    ...input,
    catalogId,
    catalogName: input.catalogName ?? mockCatalogName(catalogId),
    resourceName: input.resourceName ?? resource?.name,
    executeType: input.mode === "batch" ? (input.executeType ?? "full") : undefined,
    fulltextAnalyzer: input.fulltextAnalyzer ?? "ik_max_word",
    fulltextFields: input.fulltextFields ?? input.embeddingFields,
    startTime: input.startedAt ?? (input.status === "pending" ? null : input.createTime),
    finishTime: input.finishedAt ?? null,
    lastProgressTime: input.lastProgressAt ?? null,
  };
}

export const mockBuildTasks: BuildTask[] = [
  makeTask({
    id: "bt-pending-01",
    resourceId: "res-customers",
    mode: "batch",
    status: "pending",
    embeddingFields: ["profile_text"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 182_340,
    syncedCount: 0,
    createTime: minutesAgo(3),
    finishedAt: null,
    lastProgressAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-empty-01",
    resourceId: "res-metadata-unavailable",
    mode: "batch",
    status: "completed",
    embeddingFields: [],
    buildKeyFields: [],
    embeddingModel: "",
    modelDimensions: 0,
    totalCount: 0,
    syncedCount: 0,
    createTime: minutesAgo(18),
    finishedAt: minutesAgo(17),
    lastProgressAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-cust-01",
    resourceId: "res-customers",
    mode: "batch",
    status: "completed",
    embeddingFields: ["profile_text"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 182_340,
    syncedCount: 182_340,
    createTime: daysAgo(2),
    finishedAt: daysAgo(2) + 25 * 60_000,
    lastProgressAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-orders-01",
    resourceId: "res-orders",
    mode: "batch",
    status: "running",
    embeddingFields: ["item_summary"],
    buildKeyFields: ["created_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 96_120,
    syncedCount: 41_280,
    createTime: minutesAgo(9),
    finishedAt: null,
    lastProgressAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-chunks-02",
    resourceId: "res-kn-chunks",
    mode: "batch",
    status: "failed",
    embeddingFields: ["content"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 48_206,
    syncedCount: 18_440,
    createTime: minutesAgo(75),
    finishedAt: minutesAgo(63),
    lastProgressAt: null,
    error: "embedding service timeout: 504 upstream",
  }),
  makeTask({
    id: "bt-cancelled-01",
    resourceId: "res-orders",
    mode: "batch",
    status: "cancelled",
    embeddingFields: ["item_summary"],
    buildKeyFields: ["created_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 96_120,
    syncedCount: 24_030,
    createTime: minutesAgo(48),
    finishedAt: minutesAgo(43),
    lastProgressAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-stopping-01",
    resourceId: "res-orders",
    mode: "batch",
    status: "stopping",
    embeddingFields: ["item_summary"],
    buildKeyFields: ["created_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 96_120,
    syncedCount: 56_340,
    createTime: minutesAgo(16),
    finishedAt: null,
    lastProgressAt: minutesAgo(1),
    error: null,
  }),
  makeTask({
    id: "bt-stopped-01",
    resourceId: "res-kn-chunks",
    mode: "batch",
    status: "stopped",
    embeddingFields: ["content"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 48_206,
    syncedCount: 21_000,
    createTime: minutesAgo(35),
    finishedAt: minutesAgo(29),
    lastProgressAt: minutesAgo(29),
    error: null,
  }),
  makeTask({
    id: "bt-chunks-01",
    resourceId: "res-kn-chunks",
    mode: "batch",
    executeType: "incremental",
    status: "completed",
    embeddingFields: ["content"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "sm-1",
    modelDimensions: 1536,
    totalCount: 46_010,
    syncedCount: 46_010,
    createTime: daysAgo(6),
    finishedAt: daysAgo(6) + 19 * 60_000,
    lastProgressAt: null,
    error: null,
  }),
];

export const mockDiscoverRecords = new Map<string, CatalogDiscoverRecord[]>([
  [
    "cat-001",
    [
      {
        id: mockSlug(12),
        status: "succeeded",
        trigger: "manual",
        startedAt: minutesAgo(42),
        startTime: formatMockTimestamp(minutesAgo(42)),
        durationSec: 14,
        foundResources: 2,
        newResources: 0,
      },
      {
        id: mockSlug(12),
        status: "succeeded",
        trigger: "scheduled",
        startedAt: daysAgo(1),
        startTime: formatMockTimestamp(daysAgo(1)),
        durationSec: 18,
        foundResources: 2,
        newResources: 1,
      },
    ],
  ],
  [
    "cat-002",
    [
      {
        id: mockSlug(12),
        status: "succeeded",
        trigger: "manual",
        startedAt: daysAgo(3),
        startTime: formatMockTimestamp(daysAgo(3)),
        durationSec: 9,
        foundResources: 1,
        newResources: 1,
      },
    ],
  ],
]);

export const mockDiscoveringCatalogs = new Set<string>();

export function mockStartScan(catalogId: string) {
  if (mockDiscoveringCatalogs.has(catalogId)) {
    return;
  }

  mockDiscoveringCatalogs.add(catalogId);
  const startedAt = Date.now();
  const foundResources = mockResources.filter((item) => item.catalogId === catalogId).length;
  const record: CatalogDiscoverRecord = {
    id: mockSlug(12),
    status: "succeeded",
    trigger: "manual",
    startedAt,
    startTime: formatMockTimestamp(startedAt),
    durationSec: 0,
    foundResources,
    newResources: 0,
  };
  const records = mockDiscoverRecords.get(catalogId) ?? [];
  mockDiscoverRecords.set(catalogId, [record, ...records]);
  mockDiscoveringCatalogs.delete(catalogId);
  emit();
}

export function emitMockChange() {
  emit();
}
