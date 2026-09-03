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
  mockCatalogName,
  mockBuildTasks,
  mockResources,
  mockSlug,
} from "@/modules/data-catalog/services/mock-db";
import type {
  BuildMode,
  BuildTask,
  BuildTaskCreateInput,
  BuildTaskListQuery,
  BuildTaskSort,
  BuildTaskPageQuery,
  BuildTaskPageResult,
  BuildTaskStatus,
} from "@/modules/data-catalog/types/data-catalog";
import { indexFormValuesFromResource } from "@/modules/data-catalog/utils/resource-index-config";

type BackendBuildTaskFieldFeature = {
  fulltext?: { analyzer?: string; config?: { analyzer?: string } };
  vector?: {
    batch_size?: number;
    embedding_dim?: number;
    max_tokens?: number;
    model_id?: string;
    model_name?: string;
    model_type?: string;
  };
};

type BackendBuildTaskIndexConfig = {
  incremental_fields?: string[];
  primary_key_fields?: string[];
  features?: Record<string, BackendBuildTaskFieldFeature>;
};

type BackendBuildTask = {
  catalog_id?: string;
  catalog_name?: string;
  create_time?: number;
  creator?: { id?: string; name?: string; type?: string };
  embedding_fields?: string | string[];
  embedding_model?: string;
  error_msg?: string;
  execute_type?: "incremental" | "full";
  fulltext_analyzer?: string;
  fulltext_fields?: string | string[];
  id: string;
  index_config?: BackendBuildTaskIndexConfig | null;
  mode?: string;
  model_dimensions?: number;
  resource_id?: string;
  resource_name?: string;
  start_time?: number;
  status?: string;
  synced_count?: number;
  synced_mark?: string;
  total_count?: number;
  finish_time?: number;
  last_progress_time?: number;
};

type BackendBuildTaskSummary = Omit<BackendBuildTask, "index_config">;

type ListResponse<T> = {
  entries: T[];
  total_count: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const BUILD_TASK_LIST_PAGE_SIZE = 200;

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
 * Vega backend enum values: pending, running, completed, stopping, stopped, failed, and cancelled.
 */
function normalizeStatus(value: string | undefined): BuildTaskStatus {
  switch (value) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "stopped":
      return "stopped";
    case "stopping":
      return "stopping";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "pending":
      return value;
    default:
      return "pending";
  }
}

/**
 * Build-task status labels directly follow the backend enum.
 */
export function buildTaskStatusLabelKey(status: BuildTaskStatus) {
  return status;
}

export function snapshotFieldsOf(item: BackendBuildTask) {
  const snapshot = item.index_config;
  if (snapshot?.features || snapshot?.primary_key_fields || snapshot?.incremental_fields) {
    const embeddingFields: string[] = [];
    const fulltextFields: string[] = [];
    let embeddingModel = "";
    let modelDimensions = 0;
    let fulltextAnalyzer = "";
    const fulltextAnalyzers: Record<string, string> = {};
    const embeddingConfigs: Record<
      string,
      {
        batchSize?: number;
        dimensions: number;
        maxTokens?: number;
        modelId: string;
        modelName?: string;
        modelType?: string;
      }
    > = {};

    for (const [fieldName, feature] of Object.entries(snapshot.features ?? {})) {
      if (feature.vector) {
        embeddingFields.push(fieldName);
        const model = feature.vector.model_id ?? "";
        if (model && !embeddingModel) {
          embeddingModel = model;
        }
        const dimensions = feature.vector.embedding_dim ?? 0;
        if (dimensions && !modelDimensions) {
          modelDimensions = dimensions;
        }
        embeddingConfigs[fieldName] = {
          batchSize: feature.vector.batch_size,
          dimensions,
          maxTokens: feature.vector.max_tokens,
          modelId: model,
          modelName: feature.vector.model_name,
          modelType: feature.vector.model_type,
        };
      }
      if (feature.fulltext) {
        fulltextFields.push(fieldName);
        const analyzer =
          feature.fulltext.analyzer ?? feature.fulltext.config?.analyzer ?? "standard";
        if (analyzer && !fulltextAnalyzer) {
          fulltextAnalyzer = analyzer;
        }
        fulltextAnalyzers[fieldName] = analyzer;
      }
    }

    return {
      primaryKeyFields: snapshot.primary_key_fields ?? [],
      incrementalFields: snapshot.incremental_fields ?? [],
      embeddingFields,
      embeddingModel,
      embeddingConfigs,
      modelDimensions,
      fulltextFields,
      fulltextAnalyzer,
      fulltextAnalyzers,
    };
  }

  // List responses omit the configuration snapshot. Mocks use the legacy flattened fields.
  const fulltextFields = splitFields(item.fulltext_fields);
  const fulltextAnalyzer = item.fulltext_analyzer || "standard";
  const fulltextAnalyzers: Record<string, string> = {};
  for (const field of fulltextFields) {
    fulltextAnalyzers[field] = fulltextAnalyzer;
  }
  return {
    primaryKeyFields: [],
    incrementalFields: [],
    embeddingFields: splitFields(item.embedding_fields),
    embeddingModel: item.embedding_model ?? "",
    embeddingConfigs: Object.fromEntries(
      splitFields(item.embedding_fields).map((field) => [
        field,
        { dimensions: item.model_dimensions ?? 0, modelId: item.embedding_model ?? "" },
      ]),
    ),
    modelDimensions: item.model_dimensions ?? 0,
    fulltextFields,
    fulltextAnalyzer,
    fulltextAnalyzers,
  };
}

export function mapBuildTask(item: BackendBuildTask): BuildTask {
  const createTime = item.create_time ?? 0;
  const mode: BuildMode = item.mode === "streaming" ? "streaming" : "batch";
  const status = normalizeStatus(item.status);
  const snapshot = snapshotFieldsOf(item);

  const synced = item.synced_count ?? 0;

  return {
    id: item.id,
    catalogId: item.catalog_id,
    catalogName: item.catalog_name,
    creator: item.creator?.id
      ? { id: item.creator.id, name: item.creator.name, type: item.creator.type ?? "" }
      : undefined,
    resourceId: item.resource_id ?? "",
    resourceName: item.resource_name,
    mode,
    executeType: mode === "batch" ? item.execute_type : undefined,
    status,
    embeddingFields: snapshot.embeddingFields,
    embeddingConfigs: snapshot.embeddingConfigs,
    primaryKeyFields: snapshot.primaryKeyFields,
    incrementalFields: snapshot.incrementalFields,
    embeddingModel: snapshot.embeddingModel,
    modelDimensions: snapshot.modelDimensions,
    fulltextFields: snapshot.fulltextFields,
    fulltextAnalyzer: snapshot.fulltextAnalyzer,
    fulltextAnalyzers: snapshot.fulltextAnalyzers,
    totalCount: item.total_count ?? 0,
    syncedCount: synced,
    syncedMark: item.synced_mark,
    createTime,
    startTime: item.start_time ?? null,
    finishTime: item.finish_time ?? null,
    lastProgressTime: item.last_progress_time ?? null,
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
    .sort((left, right) => right.createTime - left.createTime);
}

export async function listBuildTasks(
  query: BuildTaskListQuery = {},
): Promise<BuildTask[]> {
  if (useMock) {
    let tasks = [...mockBuildTasks];
    if (query.catalogId) {
      // Mocks do not filter by catalog_id, so resolve catalog to resourceIds through mockResources.
      const resourceIds = new Set(
        mockResources
          .filter((resource) => resource.catalogId === query.catalogId)
          .map((resource) => resource.id),
      );
      tasks = tasks.filter((task) => resourceIds.has(task.resourceId));
    }
    return wait(filterTasks(tasks, query), 120);
  }

  const backendStatuses = query.statuses?.length
    ? backendStatusParams(query.statuses)
    : undefined;
  // The backend filters each page after reading it, so a short or empty page says nothing about
  // what comes after it and the count covers rows the caller may not see (#977). Walk the raw
  // space by the requested window until it runs out; stopping on a short page loses the rest.
  const tasks: BuildTask[] = [];
  let offset = 0;

  for (; ;) {
    const response = await http.get<ListResponse<BackendBuildTaskSummary>>(
      "/vega-backend/v1/build-tasks",
      {
        params: {
          limit: BUILD_TASK_LIST_PAGE_SIZE,
          offset,
          resource_id: query.resourceId || undefined,
          catalog_id: query.catalogId || undefined,
          status: backendStatuses,
        },
        paramsSerializer: { indexes: null },
        skipErrorToast: query.silent,
      },
    );
    tasks.push(...response.data.entries.map(mapBuildTask));
    offset += BUILD_TASK_LIST_PAGE_SIZE;

    if (offset >= response.data.total_count) {
      break;
    }
  }

  return filterTasks(tasks, query);
}

// Task statuses are passed through to the backend unchanged.
const FE_TO_BACKEND_STATUS: Record<BuildTaskStatus, string[]> = {
  pending: ["pending"],
  running: ["running"],
  completed: ["completed"],
  stopped: ["stopped"],
  stopping: ["stopping"],
  failed: ["failed"],
  cancelled: ["cancelled"],
};

export function backendStatusParams(statuses: BuildTaskStatus[]): string[] {
  const set = new Set<string>();
  for (const status of statuses) {
    for (const backend of FE_TO_BACKEND_STATUS[status]) {
      set.add(backend);
    }
  }
  return Array.from(set);
}

function sortMockTasks(
  items: BuildTask[],
  sort: BuildTaskSort,
  direction: "asc" | "desc",
): BuildTask[] {
  const arr = [...items];
  const dir = direction === "asc" ? 1 : -1;
  const keyOf = (task: BuildTask): number => {
    switch (sort) {
      case "start_time":
        return task.startTime ?? 0;
      case "finish_time":
        return task.finishTime ?? 0;
      case "last_progress_time":
        return task.lastProgressTime ?? 0;
      default:
        return task.createTime;
    }
  };
  return arr.sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka < kb) return -dir;
    if (ka > kb) return dir;
    return 0;
  });
}

/**
 * Server-paginated list with sorting and repeated status query parameters.
 */
export async function listBuildTaskPage(
  query: BuildTaskPageQuery,
): Promise<BuildTaskPageResult> {
  const pageSize = query.pageSize ?? 10;
  const limit = query.limit ?? pageSize;
  const offset = query.offset ?? ((query.page ?? 1) - 1) * pageSize;

  if (useMock) {
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
    if (query.mode) {
      items = items.filter((task) => task.mode === query.mode);
    }
    if (query.executeType) {
      items = items.filter((task) => task.executeType === query.executeType);
    }
    if (query.statuses?.length) {
      const set = new Set(query.statuses);
      items = items.filter((task) => set.has(task.status));
    }
    items = sortMockTasks(items, query.sort ?? "create_time", query.direction ?? "desc");
    const total = items.length;
    return wait({ items: items.slice(offset, offset + limit), total }, 120);
  }

  const params: Record<string, unknown> = {
    direction: query.direction ?? "desc",
    limit,
    offset,
    resource_id: query.resourceId || undefined,
    catalog_id: query.catalogId || undefined,
    execute_type: query.executeType || undefined,
    mode: query.mode || undefined,
    sort: query.sort ?? "create_time",
  };
  if (query.statuses?.length) {
    params.status = backendStatusParams(query.statuses);
  }

  const response = await http.get<ListResponse<BackendBuildTaskSummary>>(
    "/vega-backend/v1/build-tasks",
    { params, paramsSerializer: { indexes: null } },
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
        task.status === "stopping"),
  );
}

function settleInteractiveMockBuildTask(task: BuildTask) {
  const now = Date.now();
  task.startTime = task.startTime ?? now;
  task.lastProgressTime = now;
  if (task.mode === "streaming") {
    task.status = "running";
    task.finishTime = null;
    return;
  }
  task.status = "completed";
  task.syncedCount = task.totalCount;
  task.finishTime = now;
}

export class BuildTaskConflictError extends Error { }

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
        incrementalFields: [] as string[],
        primaryKeyFields: [] as string[],
        embeddingFields: [] as string[],
        embeddingModel: "",
        fulltextFields: [] as string[],
        fulltextAnalyzer: "",
      };
    const createTime = Date.now();
    const task: BuildTask = {
      id: `bt-${mockSlug(8)}`,
      catalogId: resource?.catalogId,
      catalogName: mockCatalogName(resource?.catalogId),
      resourceId: input.resourceId,
      resourceName: resource?.name,
      mode: input.mode,
      executeType: input.mode === "batch" ? (input.executeType ?? "full") : undefined,
      status: "pending",
      embeddingFields: form.embeddingFields,
      primaryKeyFields: form.primaryKeyFields ?? [],
      incrementalFields: form.incrementalFields ?? [],
      embeddingModel: form.embeddingModel,
      modelDimensions: 0,
      fulltextFields: form.fulltextFields,
      fulltextAnalyzer: form.fulltextAnalyzer ?? "",
      totalCount: resource?.rowCount ?? 0,
      syncedCount: 0,
      createTime,
      finishTime: null,
      lastProgressTime: null,
      startTime: null,
      error: null,
    };
    settleInteractiveMockBuildTask(task);
    mockBuildTasks.unshift(task);
    emitMockChange();
    return wait(task);
  }

  // Creation returns only {id}, so load the complete task afterward.
  // The server derives an index-configuration snapshot from the resource; clients no longer send field configuration.
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
  if (!created) {
    throw new Error(`Created build task ${response.data.id} could not be retrieved`);
  }
  return created;
}

export async function pauseBuildTask(id: string) {
  if (useMock) {
    const task = mockBuildTasks.find((item) => item.id === id);
    if (task && (task.status === "pending" || task.status === "running")) {
      task.status = "stopped";
      task.lastProgressTime = Date.now();
      emitMockChange();
    }
    await wait(undefined, 120);
    return;
  }

  // Backend semantics: stop pauses streaming listeners and aborts batches.
  await http.post(`/vega-backend/v1/build-tasks/${id}/stop`);
}

export async function resumeBuildTask(id: string) {
  if (useMock) {
    const task = mockBuildTasks.find((item) => item.id === id);
    if (task && task.status === "stopped") {
      task.startTime = null;
      task.finishTime = null;
      task.lastProgressTime = null;
      settleInteractiveMockBuildTask(task);
      emitMockChange();
    }
    await wait(undefined, 120);
    return;
  }

  // Backend semantics: start resumes execution; reset=false resumes from the checkpoint by default.
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
    // Stopping an already stopped or completed task errors and can be ignored.
    await http
      .post(`/vega-backend/v1/build-tasks/${id}/stop`, undefined, {
        skipErrorToast: true,
      })
      .catch(() => undefined);
  }

  // The backend rejects deleting running/stopping tasks with 409; retry after a short backoff while stop transitions through stopping.
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

/**
 * Restarts a task. reset applies only to full tasks; the backend forces incremental tasks to resume from their checkpoint.
 */
export async function retryBuildTask(
  id: string,
  reset = false,
): Promise<BuildTask | null> {
  if (useMock) {
    const source = mockBuildTasks.find((item) => item.id === id);
    if (!source) {
      return wait(null);
    }
    if (reset && source.executeType === "full") {
      source.syncedCount = 0;
    }
    source.error = null;
    source.startTime = null;
    source.finishTime = null;
    source.lastProgressTime = null;
    settleInteractiveMockBuildTask(source);
    emitMockChange();
    return wait(source);
  }

  await http.post(`/vega-backend/v1/build-tasks/${id}/start`, { reset });
  return getBuildTask(id);
}

/** Stops all running tasks when a connection is disabled; this is mock behavior only. */
export function pauseListeningTasksOfCatalog(resourceIds: string[]) {
  if (!useMock) {
    return;
  }

  let changed = false;
  mockBuildTasks.forEach((task) => {
    if (resourceIds.includes(task.resourceId) && task.status === "running") {
      task.status = "stopped";
      changed = true;
    }
  });
  if (changed) {
    emitMockChange();
  }
}
