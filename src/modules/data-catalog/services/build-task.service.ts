/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { http } from "@/framework/request/http";
import {
  emitMockChange,
  ensureMockTicker,
  formatMockTimestamp,
  mockBuildTasks,
  mockResources,
  mockSlug,
} from "@/modules/data-catalog/services/mock-db";
import type {
  BuildMode,
  BuildTask,
  BuildTaskCreateInput,
  BuildTaskListQuery,
  BuildTaskOrderBy,
  BuildTaskPageQuery,
  BuildTaskPageResult,
  BuildTaskStatus,
  IndexHealth,
  IndexHealthState,
} from "@/modules/data-catalog/types/data-catalog";
import { indexFormValuesFromResource } from "@/modules/data-catalog/utils/resource-index-config";

type BackendBuildTaskFieldFeature = {
  fulltext?: { analyzer?: string; config?: { analyzer?: string } };
  vector?: {
    config?: {
      dimensions?: number;
      embedding_model?: string;
      model_id?: string;
    };
    dimensions?: number;
    model_id?: string;
  };
};

type BackendBuildTaskIndexConfig = {
  build_key_fields?: string[];
  features?: Record<string, BackendBuildTaskFieldFeature>;
};

type BackendBuildTask = {
  build_key_fields?: string | string[];
  create_time?: number;
  embedding_fields?: string | string[];
  embedding_model?: string;
  error_msg?: string;
  failure_detail?: string;
  fulltext_analyzer?: string;
  fulltext_fields?: string | string[];
  id: string;
  index_config?: BackendBuildTaskIndexConfig | null;
  index_health?: { embedding?: string; fulltext?: string; usable?: boolean };
  mode?: string;
  model_dimensions?: number;
  resource_id?: string;
  status?: string;
  synced_count?: number;
  total_count?: number;
  update_time?: number;
  vectorized_count?: number;
};

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

const wait = async <T,>(value: T, delay = 180) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), delay);
  });

function splitFields(value?: string | string[]): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * vega 后端枚举:init/running/completed/stopping/stopped/failed。
 * streaming 模式的 running 即“常驻监听”,stopped/stopping 即“已暂停”。
 */
function normalizeStatus(value: string | undefined, mode: BuildMode): BuildTaskStatus {
  switch (value) {
    case "running":
      return mode === "streaming" ? "listening" : "running";
    case "completed":
      return "succeeded";
    case "stopping":
    case "stopped":
      return "paused";
    case "failed":
      return "failed";
    case "listening":
    case "paused":
    case "succeeded":
    case "pending":
      return value;
    case "init":
    default:
      return "pending";
  }
}

/**
 * 状态文案 key:内部统一用 paused,但 batch 的 stop 是中止而非可续传的暂停,
 * 显示上 batch 用"已停止"(statuses.stopped)、streaming 用"已暂停"(statuses.paused)。
 */
export function buildTaskStatusLabelKey(status: BuildTaskStatus, mode: BuildMode) {
  if (status === "paused" && mode === "batch") {
    return "stopped";
  }
  return status;
}

/** 向量化健康态:优先后端 index_health.embedding,缺省按计数兜底。 */
export function embeddingStateOf(task: BuildTask): IndexHealthState {
  return (
    task.indexHealth?.embedding ??
    (task.embeddingDegraded
      ? task.vectorizedCount === 0
        ? "failed"
        : "partial"
      : "ok")
  );
}

function snapshotFieldsOf(item: BackendBuildTask) {
  const snapshot = item.index_config;
  if (snapshot?.features || snapshot?.build_key_fields) {
    const embeddingFields: string[] = [];
    const fulltextFields: string[] = [];
    let embeddingModel = "";
    let modelDimensions = 0;
    let fulltextAnalyzer = "";

    for (const [fieldName, feature] of Object.entries(snapshot.features ?? {})) {
      if (feature.vector) {
        embeddingFields.push(fieldName);
        const model =
          feature.vector.model_id ??
          feature.vector.config?.model_id ??
          feature.vector.config?.embedding_model ??
          "";
        if (model && !embeddingModel) {
          embeddingModel = model;
        }
        const dimensions =
          feature.vector.dimensions ?? feature.vector.config?.dimensions ?? 0;
        if (dimensions && !modelDimensions) {
          modelDimensions = dimensions;
        }
      }
      if (feature.fulltext) {
        fulltextFields.push(fieldName);
        const analyzer =
          feature.fulltext.analyzer ?? feature.fulltext.config?.analyzer ?? "";
        if (analyzer && !fulltextAnalyzer) {
          fulltextAnalyzer = analyzer;
        }
      }
    }

    return {
      buildKeyFields: snapshot.build_key_fields ?? [],
      embeddingFields,
      embeddingModel,
      modelDimensions,
      fulltextFields,
      fulltextAnalyzer,
    };
  }

  // 兼容旧扁平字段（过渡期 / mock）
  return {
    buildKeyFields: splitFields(item.build_key_fields),
    embeddingFields: splitFields(item.embedding_fields),
    embeddingModel: item.embedding_model ?? "",
    modelDimensions: item.model_dimensions ?? 0,
    fulltextFields: splitFields(item.fulltext_fields),
    fulltextAnalyzer: item.fulltext_analyzer ?? "",
  };
}

function mapBuildTask(item: BackendBuildTask): BuildTask {
  const createdAt = item.create_time ?? 0;
  const mode: BuildMode = item.mode === "streaming" ? "streaming" : "batch";
  const status = normalizeStatus(item.status, mode);
  const snapshot = snapshotFieldsOf(item);

  // 已完成但 embedding 没建满（vectorized < synced）= 索引降级：向量化失败/部分失败。
  const synced = item.synced_count ?? 0;
  const vectorized = item.vectorized_count ?? 0;
  const wantsEmbedding = snapshot.embeddingFields.length > 0;
  const embeddingDegraded = wantsEmbedding && status === "succeeded" && vectorized < synced;

  // 优先用后端真实 index_health;缺省则按计数兜底,保持与 embeddingDegraded 一致。
  const toHealthState = (value: string | undefined): IndexHealthState =>
    value === "failed" || value === "partial" || value === "building" ? value : "ok";
  const derivedEmbedding: IndexHealthState = embeddingDegraded
    ? vectorized === 0
      ? "failed"
      : "partial"
    : "ok";
  const indexHealth: IndexHealth = item.index_health
    ? {
        embedding: toHealthState(item.index_health.embedding),
        fulltext: toHealthState(item.index_health.fulltext),
        usable: item.index_health.usable ?? !embeddingDegraded,
      }
    : { embedding: derivedEmbedding, fulltext: "ok", usable: !embeddingDegraded };

  return {
    id: item.id,
    resourceId: item.resource_id ?? "",
    mode,
    status,
    embeddingFields: snapshot.embeddingFields,
    buildKeyFields: snapshot.buildKeyFields,
    embeddingModel: snapshot.embeddingModel,
    embeddingDegraded,
    modelDimensions: snapshot.modelDimensions,
    fulltextFields: snapshot.fulltextFields,
    fulltextAnalyzer: snapshot.fulltextAnalyzer,
    totalCount: item.total_count ?? 0,
    syncedCount: synced,
    vectorizedCount: vectorized,
    indexHealth,
    indexUsable: indexHealth.usable,
    failureDetail: item.failure_detail ?? "",
    createdAt,
    createTime: createdAt ? formatMockTimestamp(createdAt) : "-",
    finishTime:
      (status === "succeeded" || status === "failed") && item.update_time
        ? formatMockTimestamp(item.update_time)
        : null,
    lastEventAt: mode === "streaming" ? (item.update_time ?? null) : null,
    error: item.error_msg || null,
  };
}

function filterTasks(items: BuildTask[], query: BuildTaskListQuery) {
  return items
    .filter((item) => {
      const matchesResource = !query.resourceId || item.resourceId === query.resourceId;
      const matchesStatus =
        !query.statuses || query.statuses.length === 0 || query.statuses.includes(item.status);
      return matchesResource && matchesStatus;
    })
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function listBuildTasks(
  query: BuildTaskListQuery = {},
): Promise<BuildTask[]> {
  if (useMock) {
    ensureMockTicker();
    let tasks = [...mockBuildTasks];
    if (query.catalogId) {
      // mock 无 catalog_id 过滤,经 mockResources 解析 catalog → resourceIds。
      const resourceIds = new Set(
        mockResources
          .filter((resource) => resource.catalogId === query.catalogId)
          .map((resource) => resource.id),
      );
      tasks = tasks.filter((task) => resourceIds.has(task.resourceId));
    }
    return wait(filterTasks(tasks, query), 120);
  }

  // 后端 status 仅支持单值且枚举与前端不同(completed/stopped),
  // 统一拉全量后在前端按归一化状态过滤。
  const response = await http.get<ListResponse<BackendBuildTask>>(
    "/vega-backend/v1/build-tasks",
    {
      params: {
        limit: 200,
        offset: 0,
        resource_id: query.resourceId || undefined,
        catalog_id: query.catalogId || undefined,
      },
      skipErrorToast: query.silent,
    },
  );

  return filterTasks(response.data.entries.map(mapBuildTask), query);
}

// 前端归一状态 → 后端枚举。paused 同时覆盖 stopping/stopped;listening 即后端 running。
const FE_TO_BACKEND_STATUS: Record<BuildTaskStatus, string[]> = {
  pending: ["init"],
  running: ["running"],
  listening: ["running"],
  succeeded: ["completed"],
  paused: ["stopping", "stopped"],
  failed: ["failed"],
};

export function backendStatusParam(statuses: BuildTaskStatus[]): string {
  const set = new Set<string>();
  for (const status of statuses) {
    for (const backend of FE_TO_BACKEND_STATUS[status]) {
      set.add(backend);
    }
  }
  return Array.from(set).join(",");
}

const ACTIVE_FE_STATUSES = new Set<BuildTaskStatus>(["pending", "running", "listening"]);

function sortMockTasks(
  items: BuildTask[],
  orderBy: BuildTaskOrderBy,
  order: "asc" | "desc",
): BuildTask[] {
  const arr = [...items];
  if (orderBy === "default") {
    // 构建中置顶,桶内按 createdAt 倒序。
    return arr.sort((a, b) => {
      const aActive = ACTIVE_FE_STATUSES.has(a.status) ? 0 : 1;
      const bActive = ACTIVE_FE_STATUSES.has(b.status) ? 0 : 1;
      return aActive !== bActive ? aActive - bActive : b.createdAt - a.createdAt;
    });
  }
  const dir = order === "asc" ? 1 : -1;
  const keyOf = (task: BuildTask): number | string =>
    orderBy === "created_at"
      ? task.createdAt
      : orderBy === "updated_at"
        ? (task.lastEventAt ?? task.createdAt)
        : orderBy === "mode"
          ? task.mode
          : task.status;
  return arr.sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return 0;
  });
}

/**
 * 服务端分页 + 排序 + 状态过滤的列表。对接后端真分页:
 * limit/offset、order_by/order、status(多值逗号)、active=true(只看构建中)。
 */
export async function listBuildTaskPage(
  query: BuildTaskPageQuery,
): Promise<BuildTaskPageResult> {
  const { page, pageSize } = query;

  if (useMock) {
    ensureMockTicker();
    let items = [...mockBuildTasks];
    if (query.catalogId) {
      const resourceIds = new Set(
        mockResources
          .filter((resource) => resource.catalogId === query.catalogId)
          .map((resource) => resource.id),
      );
      items = items.filter((task) => resourceIds.has(task.resourceId));
    }
    if (query.resourceId) {
      items = items.filter((task) => task.resourceId === query.resourceId);
    }
    if (query.active) {
      items = items.filter((task) => ACTIVE_FE_STATUSES.has(task.status));
    } else if (query.statuses?.length) {
      const set = new Set(query.statuses);
      items = items.filter((task) => set.has(task.status));
    }
    items = sortMockTasks(items, query.orderBy ?? "default", query.order ?? "desc");
    const total = items.length;
    const start = (page - 1) * pageSize;
    return wait({ items: items.slice(start, start + pageSize), total }, 120);
  }

  const params: Record<string, unknown> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    resource_id: query.resourceId || undefined,
    catalog_id: query.catalogId || undefined,
  };
  if (query.orderBy && query.orderBy !== "default") {
    params.order_by = query.orderBy;
    params.order = query.order ?? "desc";
  }
  if (query.active) {
    params.active = true;
  } else if (query.statuses?.length) {
    params.status = backendStatusParam(query.statuses);
  }

  const response = await http.get<ListResponse<BackendBuildTask>>(
    "/vega-backend/v1/build-tasks",
    { params },
  );
  return {
    items: response.data.entries.map(mapBuildTask),
    total: response.data.total_count,
  };
}

export async function getBuildTask(id: string) {
  if (useMock) {
    return wait(mockBuildTasks.find((item) => item.id === id) ?? null, 120);
  }

  const response = await http.get<BackendBuildTask>(
    `/vega-backend/v1/build-tasks/${id}`,
  );

  return response.data ? mapBuildTask(response.data) : null;
}

function hasActiveTaskForResource(resourceId: string) {
  return mockBuildTasks.some(
    (task) =>
      task.resourceId === resourceId &&
      (task.status === "pending" ||
        task.status === "running" ||
        task.status === "listening"),
  );
}

export class BuildTaskConflictError extends Error {}

export async function createBuildTask(
  input: BuildTaskCreateInput,
): Promise<BuildTask> {
  if (useMock) {
    if (hasActiveTaskForResource(input.resourceId)) {
      throw new BuildTaskConflictError("active task exists");
    }

    const resource = mockResources.find((item) => item.id === input.resourceId);
    const form = resource
      ? indexFormValuesFromResource(resource)
      : {
          buildKeyFields: [] as string[],
          embeddingFields: [] as string[],
          embeddingModel: "",
          fulltextFields: [] as string[],
          fulltextAnalyzer: "",
        };
    const createdAt = Date.now();
    const task: BuildTask = {
      id: `bt-${mockSlug(8)}`,
      resourceId: input.resourceId,
      mode: input.mode,
      status: "pending",
      embeddingFields: form.embeddingFields,
      buildKeyFields: form.buildKeyFields,
      embeddingModel: form.embeddingModel,
      modelDimensions: 0,
      fulltextFields: form.fulltextFields,
      fulltextAnalyzer: form.fulltextAnalyzer ?? "",
      totalCount: resource?.rowCount ?? 0,
      syncedCount: 0,
      vectorizedCount: 0,
      embeddingDegraded: false,
      indexUsable: true,
      failureDetail: "",
      createdAt,
      createTime: formatMockTimestamp(createdAt),
      finishTime: null,
      lastEventAt: null,
      error: null,
    };
    mockBuildTasks.unshift(task);
    emitMockChange();
    ensureMockTicker();
    return wait(task);
  }

  // 创建仅返回 {id, resource_id, status: "init"},完整任务体再查一次。
  // 索引配置由服务端从 resource 派生快照，客户端不再传字段配置。
  const response = await http.post<BackendBuildTask>(
    "/vega-backend/v1/build-tasks",
    {
      resource_id: input.resourceId,
      mode: input.mode,
      ...(input.mode === "batch" && input.executeType
        ? { execute_type: input.executeType }
        : {}),
    },
  );

  const created = await getBuildTask(response.data.id);
  return created ?? mapBuildTask(response.data);
}

export async function pauseBuildTask(id: string) {
  if (useMock) {
    const task = mockBuildTasks.find((item) => item.id === id);
    if (task && (task.status === "listening" || task.status === "running")) {
      task.status = "paused";
      emitMockChange();
    }
    await wait(undefined, 120);
    return;
  }

  // 后端语义:stop = 暂停(streaming 监听停止 / batch 中止)
  await http.post(`/vega-backend/v1/build-tasks/${id}/stop`);
}

export async function resumeBuildTask(id: string) {
  if (useMock) {
    const task = mockBuildTasks.find((item) => item.id === id);
    if (task && task.status === "paused") {
      task.status = task.mode === "streaming" ? "listening" : "running";
      task.lastEventAt = Date.now();
      emitMockChange();
      ensureMockTicker();
    }
    await wait(undefined, 120);
    return;
  }

  // 后端语义:start = 恢复运行；默认 reset=false 按游标续跑
  await http.post(`/vega-backend/v1/build-tasks/${id}/start`, { reset: false });
}

export async function deleteBuildTask(
  id: string,
  options: { stopFirst?: boolean } = {},
) {
  if (useMock) {
    const index = mockBuildTasks.findIndex((item) => item.id === id);
    if (index >= 0) {
      mockBuildTasks.splice(index, 1);
      emitMockChange();
    }
    await wait(undefined, 120);
    return;
  }

  if (options.stopFirst) {
    // 已停止/已完成时 stop 会报错,忽略即可
    await http
      .post(`/vega-backend/v1/build-tasks/${id}/stop`, undefined, {
        skipErrorToast: true,
      })
      .catch(() => undefined);
  }

  // 后端拒删 running/stopping(409);stop 后短暂处于 stopping,小退避重试
  for (let attempt = 0; ; attempt += 1) {
    try {
      await http.delete(`/vega-backend/v1/build-tasks/${id}`, {
        skipErrorToast: true,
      });
      return;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (status !== 409 || attempt >= 4) {
        throw error;
      }
      await wait(undefined, 1000);
    }
  }
}

export type BuildExecuteType = "incremental" | "full";

/**
 * 重新 start 任务。
 * - reset=false：按 synced_mark 增量续跑（对应旧 execute_type=incremental）
 * - reset=true：忽略游标全量重跑（对应旧 execute_type=full）
 */
export async function retryBuildTask(
  id: string,
  resetOrExecuteType: boolean | BuildExecuteType = false,
): Promise<BuildTask | null> {
  const reset =
    typeof resetOrExecuteType === "boolean"
      ? resetOrExecuteType
      : resetOrExecuteType === "full";

  if (useMock) {
    const source = mockBuildTasks.find((item) => item.id === id);
    if (!source) {
      return wait(null);
    }
    if (reset) {
      source.syncedCount = 0;
      source.vectorizedCount = 0;
    }
    source.status = source.mode === "streaming" ? "listening" : "running";
    source.error = null;
    source.failureDetail = "";
    source.lastEventAt = Date.now();
    emitMockChange();
    ensureMockTicker();
    return wait(source);
  }

  await http.post(`/vega-backend/v1/build-tasks/${id}/start`, { reset });
  return getBuildTask(id);
}

/** 停用连接时,暂停其下所有监听中的 streaming 任务(mock 行为;真实后端由服务端联动) */
export function pauseListeningTasksOfCatalog(resourceIds: string[]) {
  if (!useMock) {
    return;
  }

  let changed = false;
  mockBuildTasks.forEach((task) => {
    if (resourceIds.includes(task.resourceId) && task.status === "listening") {
      task.status = "paused";
      changed = true;
    }
  });
  if (changed) {
    emitMockChange();
  }
}
