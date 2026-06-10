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
  BuildTaskStatus,
} from "@/modules/data-catalog/types/data-catalog";

type BackendBuildTask = {
  build_key_fields?: string | string[];
  create_time?: number;
  embedding_fields?: string | string[];
  embedding_model?: string;
  error_msg?: string;
  id: string;
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

function mapBuildTask(item: BackendBuildTask): BuildTask {
  const createdAt = item.create_time ?? 0;
  const mode: BuildMode = item.mode === "streaming" ? "streaming" : "batch";
  const status = normalizeStatus(item.status, mode);

  return {
    id: item.id,
    resourceId: item.resource_id ?? "",
    mode,
    status,
    embeddingFields: splitFields(item.embedding_fields),
    buildKeyFields: splitFields(item.build_key_fields),
    embeddingModel: item.embedding_model ?? "",
    modelDimensions: item.model_dimensions ?? 0,
    totalCount: item.total_count ?? 0,
    syncedCount: item.synced_count ?? 0,
    vectorizedCount: item.vectorized_count ?? 0,
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
    return wait(filterTasks([...mockBuildTasks], query), 120);
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
      },
    },
  );

  return filterTasks(response.data.entries.map(mapBuildTask), query);
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
    const createdAt = Date.now();
    const task: BuildTask = {
      id: `bt-${mockSlug(8)}`,
      resourceId: input.resourceId,
      mode: input.mode,
      status: "pending",
      embeddingFields: input.embeddingFields,
      buildKeyFields: input.buildKeyFields,
      embeddingModel: input.embeddingModel,
      modelDimensions: input.modelDimensions,
      totalCount: resource?.rowCount ?? 0,
      syncedCount: 0,
      vectorizedCount: 0,
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

  // 创建仅返回 {id, resource_id, status: "init"},完整任务体再查一次
  const response = await http.post<BackendBuildTask>(
    "/vega-backend/v1/build-tasks",
    {
      build_key_fields: input.buildKeyFields.join(","),
      embedding_fields: input.embeddingFields.join(","),
      embedding_model: input.embeddingModel,
      mode: input.mode,
      model_dimensions: input.modelDimensions,
      resource_id: input.resourceId,
    },
  );

  const created = await getBuildTask(response.data.id);
  return created ?? mapBuildTask(response.data);
}

export async function pauseBuildTask(id: string) {
  if (useMock) {
    const task = mockBuildTasks.find((item) => item.id === id);
    if (task && task.status === "listening") {
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
      task.status = "listening";
      task.lastEventAt = Date.now();
      emitMockChange();
      ensureMockTicker();
    }
    await wait(undefined, 120);
    return;
  }

  // 后端语义:start = 恢复运行(body 可选)
  await http.post(`/vega-backend/v1/build-tasks/${id}/start`);
}

export async function retryBuildTask(id: string): Promise<BuildTask | null> {
  if (useMock) {
    const source = mockBuildTasks.find((item) => item.id === id);
    if (!source) {
      return wait(null);
    }
    return createBuildTask({
      buildKeyFields: source.buildKeyFields,
      embeddingFields: source.embeddingFields,
      embeddingModel: source.embeddingModel,
      mode: source.mode,
      modelDimensions: source.modelDimensions,
      resourceId: source.resourceId,
    });
  }

  // 后端没有独立 retry:对失败任务重新 start
  await http.post(`/vega-backend/v1/build-tasks/${id}/start`);
  return getBuildTask(id);
}

/** 停用连接时,暂停其下所有监听中的 streaming 任务(mock 行为;真实后端由服务端联动) */
export async function pauseListeningTasksOfCatalog(resourceIds: string[]) {
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
