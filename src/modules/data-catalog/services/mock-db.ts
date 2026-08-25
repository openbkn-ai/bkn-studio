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
import { formatDateTime } from "@/framework/i18n/format";

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
  return formatDateTime(value, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric",
  }).replace(/\//g, "-");
}

const now = Date.now();
const minutesAgo = (minutes: number) => now - minutes * 60_000;
const daysAgo = (days: number) => now - days * 86_400_000;

function makeResource(
  input: Omit<CatalogResource, "columnCount" | "localIndexStatus" | "updateTime"> &
    Partial<Pick<CatalogResource, "localIndexStatus">>,
): CatalogResource {
  return {
    ...input,
    columnCount: input.schema.length,
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
  return {
    ...input,
    fulltextAnalyzer: input.fulltextAnalyzer ?? "ik_max_word",
    fulltextFields: input.fulltextFields ?? input.embeddingFields,
    startTime: input.startedAt ?? (input.status === "pending" ? null : input.createTime),
    finishTime: input.finishedAt ?? null,
    lastProgressTime: input.lastProgressAt ?? null,
  };
}

export const mockBuildTasks: BuildTask[] = [
  makeTask({
    id: "bt-cust-01",
    resourceId: "res-customers",
    mode: "batch",
    status: "succeeded",
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
    id: "bt-chunks-01",
    resourceId: "res-kn-chunks",
    mode: "batch",
    status: "succeeded",
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

/** Resources discovered after probing finance_dw (cat-003), used to simulate discovery behavior. */
const discoverableResources: CatalogResource[] = [
  makeResource({
    id: "res-contracts",
    catalogId: "cat-003",
    name: "contracts",
    category: "table",
    schemaName: "public",
    sourceIdentifier: "finance_dw.contracts",
    description: "合同台账，由 discover 探查登记。",
    schema: [
      { name: "contract_id", type: "bigint" },
      { name: "counterparty", type: "varchar(128)" },
      { name: "summary", type: "text" },
      { name: "signed_at", type: "datetime" },
    ],
    rowCount: 12_840,
    expectedUpdateTime: now,
  }),
  makeResource({
    id: "res-invoices",
    catalogId: "cat-003",
    name: "invoices",
    category: "table",
    schemaName: "public",
    sourceIdentifier: "finance_dw.invoices",
    description: "发票明细，由 discover 探查登记。",
    schema: [
      { name: "invoice_id", type: "bigint" },
      { name: "contract_id", type: "bigint" },
      { name: "memo", type: "text" },
      { name: "issued_at", type: "datetime" },
    ],
    rowCount: 30_204,
    expectedUpdateTime: now,
  }),
];

export function mockStartScan(catalogId: string) {
  if (mockDiscoveringCatalogs.has(catalogId)) {
    return;
  }

  mockDiscoveringCatalogs.add(catalogId);
  const record: CatalogDiscoverRecord = {
    id: mockSlug(12),
    status: "running",
    trigger: "manual",
    startedAt: Date.now(),
    startTime: formatMockTimestamp(Date.now()),
    durationSec: null,
    foundResources: null,
    newResources: null,
  };
  const records = mockDiscoverRecords.get(catalogId) ?? [];
  mockDiscoverRecords.set(catalogId, [record, ...records]);
  emit();

  window.setTimeout(() => {
    mockDiscoveringCatalogs.delete(catalogId);
    record.status = "succeeded";
    record.durationSec = 8 + Math.floor(Math.random() * 14);

    let discovered = 0;
    discoverableResources.forEach((resource) => {
      if (
        resource.catalogId === catalogId &&
        !mockResources.some((item) => item.id === resource.id)
      ) {
        mockResources.push(resource);
        discovered += 1;
      }
    });

    record.foundResources =
      mockResources.filter((item) => item.catalogId === catalogId).length;
    record.newResources = discovered;
    emit();
  }, 2600);
}

/* ---------------- Build task progression engine ---------------- */

let tickTimer: number | null = null;

function hasActiveTask() {
  return mockBuildTasks.some(
    (task) =>
      task.status === "pending" ||
      task.status === "running" ||
      task.status === "listening",
  );
}

function tick() {
  let changed = false;

  mockBuildTasks.forEach((task) => {
    if (task.status === "pending") {
      task.status = task.mode === "streaming" ? "listening" : "running";
      task.startTime = Date.now();
      changed = true;
      return;
    }

    if (task.status === "running") {
      task.lastProgressTime = Date.now();
      const step = Math.max(
        60,
        Math.floor(task.totalCount * (0.025 + Math.random() * 0.02)),
      );
      task.syncedCount = Math.min(task.totalCount, task.syncedCount + step);
      if (task.syncedCount >= task.totalCount) {
        task.status = "succeeded";
        const finishedAt = Date.now();
        task.finishTime = finishedAt;
      }
      changed = true;
      return;
    }

    if (task.status === "listening") {
      if (task.syncedCount < task.totalCount) {
        const step = Math.max(80, Math.floor(task.totalCount * 0.06));
        task.syncedCount = Math.min(task.totalCount, task.syncedCount + step);
        task.lastProgressTime = Date.now();
        changed = true;
        return;
      }

      if (Math.random() < 0.16) {
        const delta = 1 + Math.floor(Math.random() * 36);
        task.totalCount += delta;
        task.syncedCount += delta;
        task.lastProgressTime = Date.now();
        const resource = mockResources.find((item) => item.id === task.resourceId);
        if (resource) {
          resource.rowCount = task.totalCount;
        }
        changed = true;
      }
    }
  });

  if (changed) {
    emit();
  }

  if (!hasActiveTask() && tickTimer !== null) {
    window.clearInterval(tickTimer);
    tickTimer = null;
  }
}

export function ensureMockTicker() {
  if (tickTimer === null && hasActiveTask()) {
    tickTimer = window.setInterval(tick, 1100);
  }
}

export function emitMockChange() {
  emit();
}
