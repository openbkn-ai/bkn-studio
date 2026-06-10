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
  error?: string;
  finish_time?: number;
  id: string;
  last_event_time?: number;
  mode?: string;
  model_dimensions?: number;
  resource_id?: string;
  state?: string;
  status?: string;
  synced_count?: number;
  total_count?: number;
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

function normalizeStatus(value?: string): BuildTaskStatus {
  switch (value) {
    case "pending":
    case "running":
    case "listening":
    case "paused":
    case "succeeded":
    case "failed":
      return value;
    default:
      return "pending";
  }
}

function mapBuildTask(item: BackendBuildTask): BuildTask {
  const createdAt = item.create_time ?? 0;

  return {
    id: item.id,
    resourceId: item.resource_id ?? "",
    mode: (item.mode === "streaming" ? "streaming" : "batch") as BuildMode,
    status: normalizeStatus(item.status ?? item.state),
    embeddingFields: splitFields(item.embedding_fields),
    buildKeyFields: splitFields(item.build_key_fields),
    embeddingModel: item.embedding_model ?? "",
    modelDimensions: item.model_dimensions ?? 0,
    totalCount: item.total_count ?? 0,
    syncedCount: item.synced_count ?? 0,
    vectorizedCount: item.vectorized_count ?? 0,
    createdAt,
    createTime: createdAt ? formatMockTimestamp(createdAt) : "-",
    finishTime: item.finish_time ? formatMockTimestamp(item.finish_time) : null,
    lastEventAt: item.last_event_time ?? null,
    error: item.error ?? null,
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

  const response = await http.get<ListResponse<BackendBuildTask>>(
    "/vega-backend/v1/build-tasks",
    {
      params: {
        limit: 200,
        offset: 0,
        resource_id: query.resourceId || undefined,
        status: query.statuses?.join(",") || undefined,
      },
    },
  );

  return response.data.entries.map(mapBuildTask);
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

  return mapBuildTask(response.data);
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

  await http.post(`/vega-backend/v1/build-tasks/${id}/pause`);
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

  await http.post(`/vega-backend/v1/build-tasks/${id}/resume`);
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

  const response = await http.post<BackendBuildTask>(
    `/vega-backend/v1/build-tasks/${id}/retry`,
  );

  return response.data ? mapBuildTask(response.data) : null;
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
