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
  catalog_id?: string;
  catalog_name?: string;
  create_time?: number;
  creator?: { id?: string; name?: string; type?: string };
  embedding_fields?: string | string[];
  embedding_model?: string;
  error_msg?: string;
  execute_type?: "incremental" | "full";
  failure_detail?: string;
  fulltext_analyzer?: string;
  fulltext_fields?: string | string[];
  id: string;
  index_config?: BackendBuildTaskIndexConfig | null;
  index_health?: { embedding?: string; fulltext?: string; usable?: boolean };
  mode?: string;
  model_dimensions?: number;
  resource_id?: string;
  resource_name?: string;
  status?: string;
  synced_count?: number;
  synced_mark?: string;
  total_count?: number;
  update_time?: number;
  vectorized_count?: number;
};

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
 * Vega backend enum values: init, running, completed, stopping, stopped, and failed.
 * In streaming mode, running means persistent listening, while stopped/stopping means paused.
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
 * Status label keys use paused internally, but stopping a batch aborts rather than creates a
 * resumable pause. Display batch as statuses.stopped and streaming as statuses.paused.
 */
export function buildTaskStatusLabelKey(status: BuildTaskStatus, mode: BuildMode) {
  if (status === "paused" && mode === "batch") {
    return "stopped";
  }
  return status;
}

/** Vectorization health: prefer backend index_health.embedding and fall back to counts when absent. */
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

export function snapshotFieldsOf(item: BackendBuildTask) {
  const snapshot = item.index_config;
  if (snapshot?.features || snapshot?.build_key_fields) {
    const embeddingFields: string[] = [];
    const fulltextFields: string[] = [];
    let embeddingModel = "";
    let modelDimensions = 0;
    let fulltextAnalyzer = "";
    const fulltextAnalyzers: Record<string, string> = {};
    const embeddingConfigs: Record<string, { modelId: string; dimensions: number }> = {};

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
        embeddingConfigs[fieldName] = { modelId: model, dimensions };
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
      buildKeyFields: snapshot.build_key_fields ?? [],
      embeddingFields,
      embeddingModel,
      embeddingConfigs,
      modelDimensions,
      fulltextFields,
      fulltextAnalyzer,
      fulltextAnalyzers,
    };
  }

  // Supports legacy flattened fields used during transition or by mocks.
  const fulltextFields = splitFields(item.fulltext_fields);
  const fulltextAnalyzer = item.fulltext_analyzer || "standard";
  const fulltextAnalyzers: Record<string, string> = {};
  for (const field of fulltextFields) {
    fulltextAnalyzers[field] = fulltextAnalyzer;
  }
  return {
    buildKeyFields: splitFields(item.build_key_fields),
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
  const createdAt = item.create_time ?? 0;
  const mode: BuildMode = item.mode === "streaming" ? "streaming" : "batch";
  const status = normalizeStatus(item.status, mode);
  const snapshot = snapshotFieldsOf(item);

  // Completed with incomplete embeddings (vectorized < synced) means a degraded index due to vectorization failure or partial failure.
  const synced = item.synced_count ?? 0;
  const vectorized = item.vectorized_count ?? 0;
  const wantsEmbedding = snapshot.embeddingFields.length > 0;
  const embeddingDegraded = wantsEmbedding && status === "succeeded" && vectorized < synced;

  // Prefer real backend index_health; otherwise fall back to counts consistently with embeddingDegraded.
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
    catalogId: item.catalog_id,
    catalogName: item.catalog_name,
    creator: item.creator?.id
      ? { id: item.creator.id, name: item.creator.name, type: item.creator.type ?? "" }
      : undefined,
    resourceId: item.resource_id ?? "",
    resourceName: item.resource_name,
    mode,
    executeType:
      mode === "batch"
        ? item.execute_type === "incremental"
          ? "incremental"
          : "full"
        : undefined,
    status,
    embeddingFields: snapshot.embeddingFields,
    embeddingConfigs: snapshot.embeddingConfigs,
    buildKeyFields: snapshot.buildKeyFields,
    embeddingModel: snapshot.embeddingModel,
    embeddingDegraded,
    modelDimensions: snapshot.modelDimensions,
    fulltextFields: snapshot.fulltextFields,
    fulltextAnalyzer: snapshot.fulltextAnalyzer,
    fulltextAnalyzers: snapshot.fulltextAnalyzers,
    totalCount: item.total_count ?? 0,
    syncedCount: synced,
    syncedMark: item.synced_mark,
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
    updatedAt: item.update_time,
    updateTime: item.update_time ? formatMockTimestamp(item.update_time) : null,
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

  // The backend supports only one status value and uses different enum values, so load all and
  // filter in the frontend by normalized status.
  const tasks: BuildTask[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (tasks.length < total) {
    const response = await http.get<ListResponse<BackendBuildTask>>(
      "/vega-backend/v1/build-tasks",
      {
        params: {
          limit: BUILD_TASK_LIST_PAGE_SIZE,
          offset,
          resource_id: query.resourceId || undefined,
          catalog_id: query.catalogId || undefined,
        },
        skipErrorToast: query.silent,
      },
    );
    const pageItems = response.data.entries.map(mapBuildTask);
    tasks.push(...pageItems);
    total = response.data.total_count;

    if (pageItems.length === 0 || pageItems.length < BUILD_TASK_LIST_PAGE_SIZE) {
      break;
    }
    offset += pageItems.length;
  }

  return filterTasks(tasks, query);
}

// Frontend normalized states mapped to backend enums. paused covers stopping/stopped; listening maps to backend running.
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
    // Active builds first, then descending createdAt within each bucket.
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
 * Server-paginated list with sorting and status filtering. Integrates backend pagination through
 * limit/offset, order_by/order, comma-separated status values, and active=true for active builds only.
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
    if (query.mode) {
      items = items.filter((task) => task.mode === query.mode);
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
    mode: query.mode || undefined,
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
      executeType: input.mode === "batch" ? (input.executeType ?? "full") : undefined,
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
    if (task && (task.status === "listening" || task.status === "running")) {
      task.status = "paused";
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
    if (task && task.status === "paused") {
      task.status = task.mode === "streaming" ? "listening" : "running";
      task.lastEventAt = Date.now();
      emitMockChange();
      ensureMockTicker();
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

/** Pauses all listening streaming tasks when a connection is disabled; this is mock behavior and the real backend coordinates it server-side. */
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
