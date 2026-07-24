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

/**
 * 共享 mock 存储:数据资源 / 构建任务 / 扫描记录。
 * 模拟 SDK 行为:batch 任务按 synced/vectorized 双计数推进,
 * streaming 任务追平存量后进入常驻监听(增量随机流入),
 * 停用连接时监听任务由服务层暂停。
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

const now = Date.now();
const minutesAgo = (minutes: number) => now - minutes * 60_000;
const daysAgo = (days: number) => now - days * 86_400_000;

function makeResource(
  input: Omit<CatalogResource, "columnCount" | "updateTime"> & { updatedAt: number },
): CatalogResource {
  return {
    ...input,
    columnCount: input.schema.length,
    updateTime: formatMockTimestamp(input.updatedAt),
  };
}

export const mockResources: CatalogResource[] = [
  makeResource({
    id: "res-customers",
    catalogId: "cat-001",
    name: "customers",
    category: "table",
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
          { featureType: "vector", config: { embedding_model: "bge-m3" } },
        ],
      },
      { name: "updated_at", displayName: "更新时间", type: "datetime" },
    ],
    indexConfig: {
      buildKeyFields: ["updated_at"],
      defaultFulltextAnalyzer: "ik_max_word",
      defaultEmbeddingModel: "bge-m3",
    },
    rowCount: 182_340,
    updatedAt: minutesAgo(42),
  }),
  makeResource({
    id: "res-orders",
    catalogId: "cat-001",
    name: "orders",
    category: "table",
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
    updatedAt: minutesAgo(18),
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
    updatedAt: minutesAgo(160),
  }),
  makeResource({
    id: "res-support-tickets",
    catalogId: "cat-004",
    name: "support_tickets",
    category: "logicview",
    sourceIdentifier:
      "SELECT id, title, body, updated_at FROM ops.support_tickets",
    description: "客服工单逻辑视图,持续增量流入。",
    schema: [
      { name: "id", type: "bigint" },
      { name: "title", type: "varchar(256)" },
      { name: "body", type: "text" },
      { name: "updated_at", type: "datetime" },
    ],
    rowCount: 23_412,
    updatedAt: minutesAgo(3),
  }),
];

function makeTask(
  input: Omit<
    BuildTask,
    | "createTime"
    | "embeddingDegraded"
    | "failureDetail"
    | "finishTime"
    | "fulltextAnalyzer"
    | "fulltextFields"
    | "indexUsable"
  > & {
    finishedAt?: number | null;
    embeddingDegraded?: boolean;
    failureDetail?: string;
    fulltextAnalyzer?: string;
    fulltextFields?: string[];
    indexUsable?: boolean;
  },
): BuildTask {
  // Derive the index-health fields so existing mock literals stay terse: an
  // index is "indexed" once succeeded/listening, degraded if vectorization
  // didn't catch up to the row count, and unusable while degraded or unbuilt.
  const indexed = input.status === "succeeded" || input.status === "listening";
  const embeddingDegraded =
    input.embeddingDegraded ?? (indexed && input.vectorizedCount < input.totalCount);
  return {
    ...input,
    fulltextAnalyzer: input.fulltextAnalyzer ?? "ik_max_word",
    fulltextFields: input.fulltextFields ?? input.embeddingFields,
    embeddingDegraded,
    failureDetail: input.failureDetail ?? input.error ?? "",
    indexUsable: input.indexUsable ?? (indexed && !embeddingDegraded),
    createTime: formatMockTimestamp(input.createdAt),
    finishTime: input.finishedAt ? formatMockTimestamp(input.finishedAt) : null,
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
    embeddingModel: "bge-m3",
    modelDimensions: 1024,
    totalCount: 182_340,
    syncedCount: 182_340,
    vectorizedCount: 182_340,
    createdAt: daysAgo(2),
    finishedAt: daysAgo(2) + 25 * 60_000,
    lastEventAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-orders-01",
    resourceId: "res-orders",
    mode: "batch",
    status: "running",
    embeddingFields: ["item_summary"],
    buildKeyFields: ["created_at"],
    embeddingModel: "bge-m3",
    modelDimensions: 1024,
    totalCount: 96_120,
    syncedCount: 41_280,
    vectorizedCount: 28_660,
    createdAt: minutesAgo(9),
    finishedAt: null,
    lastEventAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-chunks-02",
    resourceId: "res-kn-chunks",
    mode: "batch",
    status: "failed",
    embeddingFields: ["content"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "bge-large-zh-v1.5",
    modelDimensions: 1024,
    totalCount: 48_206,
    syncedCount: 18_440,
    vectorizedCount: 12_020,
    createdAt: minutesAgo(75),
    finishedAt: minutesAgo(63),
    lastEventAt: null,
    error: "embedding service timeout: 504 upstream",
  }),
  makeTask({
    id: "bt-chunks-01",
    resourceId: "res-kn-chunks",
    mode: "batch",
    status: "succeeded",
    embeddingFields: ["content"],
    buildKeyFields: ["updated_at"],
    embeddingModel: "bge-m3",
    modelDimensions: 1024,
    totalCount: 46_010,
    syncedCount: 46_010,
    vectorizedCount: 46_010,
    createdAt: daysAgo(6),
    finishedAt: daysAgo(6) + 19 * 60_000,
    lastEventAt: null,
    error: null,
  }),
  makeTask({
    id: "bt-tickets-01",
    resourceId: "res-support-tickets",
    mode: "streaming",
    status: "listening",
    embeddingFields: ["title", "body"],
    buildKeyFields: ["id"],
    embeddingModel: "bge-m3",
    modelDimensions: 1024,
    totalCount: 23_412,
    syncedCount: 23_412,
    vectorizedCount: 23_412,
    createdAt: daysAgo(1),
    finishedAt: null,
    lastEventAt: minutesAgo(2),
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

/** finance_dw(cat-003)探查后会“发现”的资源，模拟 discover 行为 */
const discoverableResources: CatalogResource[] = [
  makeResource({
    id: "res-contracts",
    catalogId: "cat-003",
    name: "contracts",
    category: "table",
    sourceIdentifier: "finance_dw.contracts",
    description: "合同台账，由 discover 探查登记。",
    schema: [
      { name: "contract_id", type: "bigint" },
      { name: "counterparty", type: "varchar(128)" },
      { name: "summary", type: "text" },
      { name: "signed_at", type: "datetime" },
    ],
    rowCount: 12_840,
    updatedAt: now,
  }),
  makeResource({
    id: "res-invoices",
    catalogId: "cat-003",
    name: "invoices",
    category: "table",
    sourceIdentifier: "finance_dw.invoices",
    description: "发票明细，由 discover 探查登记。",
    schema: [
      { name: "invoice_id", type: "bigint" },
      { name: "contract_id", type: "bigint" },
      { name: "memo", type: "text" },
      { name: "issued_at", type: "datetime" },
    ],
    rowCount: 30_204,
    updatedAt: now,
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

/* ---------------- 构建任务推进引擎 ---------------- */

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
      changed = true;
      return;
    }

    if (task.status === "running") {
      const step = Math.max(
        60,
        Math.floor(task.totalCount * (0.025 + Math.random() * 0.02)),
      );
      task.syncedCount = Math.min(task.totalCount, task.syncedCount + step);
      task.vectorizedCount = Math.min(
        task.syncedCount,
        task.vectorizedCount + Math.max(40, Math.floor(step * (0.55 + Math.random() * 0.35))),
      );

      if (
        task.syncedCount >= task.totalCount &&
        task.vectorizedCount >= task.totalCount
      ) {
        task.status = "succeeded";
        const finishedAt = Date.now();
        task.finishTime = formatMockTimestamp(finishedAt);
        const resource = mockResources.find((item) => item.id === task.resourceId);
        if (resource) {
          resource.updatedAt = finishedAt;
          resource.updateTime = formatMockTimestamp(finishedAt);
        }
      }
      changed = true;
      return;
    }

    if (task.status === "listening") {
      if (task.syncedCount < task.totalCount) {
        const step = Math.max(80, Math.floor(task.totalCount * 0.06));
        task.syncedCount = Math.min(task.totalCount, task.syncedCount + step);
        task.vectorizedCount = task.syncedCount;
        task.lastEventAt = Date.now();
        changed = true;
        return;
      }

      if (Math.random() < 0.16) {
        const delta = 1 + Math.floor(Math.random() * 36);
        task.totalCount += delta;
        task.syncedCount += delta;
        task.vectorizedCount += delta;
        task.lastEventAt = Date.now();
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
