/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import i18n from "@/app/locales/i18n";
import { http } from "@/framework/request/http";

export type SemanticUnderstandingTaskStatus =
  | "cancelled"
  | "failed"
  | "pending"
  | "running"
  | "completed";

export type SemanticUnderstandingTaskSummary = {
  agentId: string;
  agentTaskId?: string;
  applied: boolean;
  applyMode: "dry_run" | "fill_empty" | "force";
  catalogId: string;
  catalogName?: string;
  confidence: number;
  confidenceThreshold: number;
  createTime: number;
  creator: { id: string; name?: string; type: string };
  id: string;
  resourceId?: string;
  resourceName?: string;
  scope: "catalog" | "resource";
  finishTime?: number;
  startTime?: number;
  status: SemanticUnderstandingTaskStatus;
};

export type SemanticUnderstandingTask = SemanticUnderstandingTaskSummary & {
  applyDetailJson?: string;
  confidenceDetailJson?: string;
  failureDetail?: string;
  input?: string;
  inputHash?: string;
  resultJson?: string;
};

export type BackendSemanticUnderstandingTaskSummary = {
  agent_id: string;
  agent_task_id?: string;
  applied: boolean;
  apply_mode: SemanticUnderstandingTaskSummary["applyMode"];
  catalog_id: string;
  catalog_name?: string;
  confidence: number;
  confidence_threshold: number;
  create_time: number;
  creator: { id: string; name?: string; type: string };
  id: string;
  resource_id?: string;
  resource_name?: string;
  scope: SemanticUnderstandingTaskSummary["scope"];
  status: "cancelled" | "completed" | "failed" | "pending" | "running";
  finish_time?: number;
  start_time?: number;
};

export type BackendSemanticUnderstandingTask = BackendSemanticUnderstandingTaskSummary & {
  apply_detail_json?: string;
  confidence_detail_json?: string;
  failure_detail?: string;
  input?: string;
  input_hash?: string;
  result_json?: string;
};

export function mapSemanticUnderstandingTaskSummary(task: BackendSemanticUnderstandingTaskSummary): SemanticUnderstandingTaskSummary {
  return {
    id: task.id,
    scope: task.scope,
    catalogId: task.catalog_id,
    catalogName: task.catalog_name,
    resourceId: task.resource_id,
    resourceName: task.resource_name,
    agentId: task.agent_id,
    agentTaskId: task.agent_task_id,
    status: task.status,
    applyMode: task.apply_mode,
    confidenceThreshold: task.confidence_threshold,
    confidence: task.confidence,
    applied: task.applied,
    creator: { id: task.creator.id, name: task.creator.name, type: task.creator.type },
    createTime: task.create_time,
    startTime: task.start_time,
    finishTime: task.finish_time,
  };
}

export type SemanticUnderstandingTaskListFilters = {
  applied?: boolean;
  applyMode?: string;
  catalogId?: string;
  direction?: "asc" | "desc";
  resourceId?: string;
  scope?: SemanticUnderstandingTaskSummary["scope"];
  sort?: "create_time" | "start_time" | "finish_time";
  statuses?: SemanticUnderstandingTaskSummary["status"][];
};

export function buildSemanticUnderstandingTaskListParams(
  page: number,
  pageSize: number,
  filters: SemanticUnderstandingTaskListFilters,
  /** Raw window, when the caller scans by offset because the backend filters after paging (#977). */
  window?: { limit: number; offset: number },
) {
  return {
    direction: filters.direction ?? "desc",
    limit: window?.limit ?? pageSize,
    offset: window?.offset ?? (page - 1) * pageSize,
    sort: filters.sort ?? "create_time",
    scope: filters.scope,
    catalog_id: filters.catalogId,
    resource_id: filters.resourceId,
    status: filters.statuses,
    apply_mode: filters.applyMode,
    applied: filters.applied,
  };
}

export function mapSemanticUnderstandingTask(task: BackendSemanticUnderstandingTask): SemanticUnderstandingTask {
  return {
    ...mapSemanticUnderstandingTaskSummary(task),
    confidenceDetailJson: task.confidence_detail_json,
    input: task.input,
    inputHash: task.input_hash,
    resultJson: task.result_json,
    applyDetailJson: task.apply_detail_json,
    failureDetail: task.failure_detail,
  };
}

export type CreateSemanticUnderstandingTaskPayload = {
  applyMode: SemanticUnderstandingTask["applyMode"];
  confidenceThreshold?: number;
  includeSampleRows?: boolean;
  resourceId: string;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const mockNow = Date.now();

function semanticMockText(key: string) {
  return i18n.t(`dataCatalog.taskManagement.semantic.mock.${key}`);
}

let mockTasks: SemanticUnderstandingTask[] = [
  {
    id: "semantic-task-001",
    scope: "resource",
    catalogId: "cat-001",
    catalogName: semanticMockText("customerCatalog"),
    resourceId: "res-customers",
    resourceName: "customers",
    agentId: "resource-semantic-understanding",
    agentTaskId: "agent-task-001",
    status: "completed",
    applyMode: "fill_empty",
    confidenceThreshold: 0.75,
    confidence: 0.94,
    applied: true,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 45,
    startTime: mockNow - 1000 * 60 * 44,
    finishTime: mockNow - 1000 * 60 * 40,
    confidenceDetailJson: JSON.stringify({
      quality: { resource_effective: true, field_effective: 3, field_total: 5 },
      warnings: [semanticMockText("phoneInsufficientSamplesWarning")],
    }),
    applyDetailJson: JSON.stringify({
      field_details: [
        { name: "customer_id", status: "updated", updated: ["description", "semantic_type"] },
        { name: "email", status: "updated", updated: ["description"] },
        { name: "phone", status: "skipped", reasons: [semanticMockText("insufficientSamples")] },
      ],
    }),
    input: JSON.stringify({ resource_id: "res-customers", include_sample_rows: false }),
    inputHash: "sha256:5eecaf1d9d8f0a8c",
    resultJson: JSON.stringify({
      quality: { resource_effective: true, field_effective: 3, field_total: 5 },
      summary: semanticMockText("customerSemanticSummary"),
    }),
  },
  {
    id: "semantic-task-002",
    scope: "catalog",
    catalogId: "cat-002",
    catalogName: "Knowledge Search",
    agentId: "catalog-semantic-understanding",
    agentTaskId: "agent-task-002",
    status: "running",
    applyMode: "dry_run",
    confidenceThreshold: 0.75,
    confidence: 0,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 8,
    startTime: mockNow - 1000 * 60 * 7,
    input: JSON.stringify({ catalog_id: "cat-002", include_sample_rows: false }),
  },
  {
    id: "semantic-task-006",
    scope: "resource",
    catalogId: "cat-002",
    catalogName: "Knowledge Search",
    resourceId: "res-kn-chunks",
    resourceName: "kn_chunks",
    agentId: "resource-semantic-understanding",
    agentTaskId: "agent-task-006",
    status: "completed",
    applyMode: "dry_run",
    confidenceThreshold: 0.75,
    confidence: 0.88,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 18,
    startTime: mockNow - 1000 * 60 * 17,
    finishTime: mockNow - 1000 * 60 * 13,
    resultJson: JSON.stringify({
      quality: { resource_effective: true, field_effective: 2, field_total: 4 },
      summary: "Semantic suggestions are ready for review.",
    }),
  },
  {
    id: "semantic-task-003",
    scope: "resource",
    catalogId: "cat-001",
    catalogName: semanticMockText("customerCatalog"),
    resourceId: "res-customers",
    resourceName: "customers",
    agentId: "resource-semantic-understanding",
    status: "pending",
    applyMode: "fill_empty",
    confidenceThreshold: 0.75,
    confidence: 0,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 2,
  },
  {
    id: "semantic-task-004",
    scope: "catalog",
    catalogId: "cat-003",
    catalogName: "Finance Warehouse",
    agentId: "catalog-semantic-understanding",
    status: "failed",
    applyMode: "force",
    confidenceThreshold: 0.8,
    confidence: 0,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 24,
    startTime: mockNow - 1000 * 60 * 23,
    finishTime: mockNow - 1000 * 60 * 21,
    failureDetail: "Semantic-understanding agent did not return a valid result.",
  },
  {
    id: "semantic-task-005",
    scope: "resource",
    catalogId: "cat-002",
    catalogName: "Knowledge Search",
    resourceId: "res-kn-chunks",
    resourceName: "kn_chunks",
    agentId: "resource-semantic-understanding",
    status: "cancelled",
    applyMode: "dry_run",
    confidenceThreshold: 0.75,
    confidence: 0,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 32,
    startTime: mockNow - 1000 * 60 * 31,
    finishTime: mockNow - 1000 * 60 * 30,
  },
];

export async function listSemanticUnderstandingTasks(
  filters: SemanticUnderstandingTaskListFilters,
  window: { limit: number; offset: number },
): Promise<{ items: SemanticUnderstandingTaskSummary[]; total: number }> {
  if (useMock) {
    const filtered = mockTasks.filter(
      (task) =>
        (filters.scope === undefined || task.scope === filters.scope) &&
        (filters.catalogId === undefined || task.catalogId === filters.catalogId) &&
        (filters.resourceId === undefined || task.resourceId === filters.resourceId) &&
        (!filters.statuses?.length || filters.statuses.includes(task.status)) &&
        (filters.applyMode === undefined || task.applyMode === filters.applyMode) &&
        (filters.applied === undefined || task.applied === filters.applied),
    );
    const timeOf = (task: SemanticUnderstandingTask) =>
      filters.sort === "start_time"
        ? task.startTime ?? 0
        : filters.sort === "finish_time"
          ? task.finishTime ?? 0
          : task.createTime;
    const direction = filters.direction === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((left, right) => (timeOf(left) - timeOf(right)) * direction);
    return {
      items: sorted.slice(window.offset, window.offset + window.limit),
      total: sorted.length,
    };
  }

  const response = await http.get<{ entries: BackendSemanticUnderstandingTaskSummary[]; total_count: number }>(
    "/vega-backend/v1/semantic-understanding-tasks",
    {
      params: buildSemanticUnderstandingTaskListParams(1, window.limit, filters, window),
      paramsSerializer: { indexes: null },
    },
  );
  return {
    items: response.data.entries.map(mapSemanticUnderstandingTaskSummary),
    total: response.data.total_count,
  };
}

export async function listResourceSemanticUnderstandingTasks(resourceId: string): Promise<SemanticUnderstandingTaskSummary[]> {
  if (useMock) {
    return [...mockTasks]
      .filter((task) => task.resourceId === resourceId)
      .sort((left, right) => right.createTime - left.createTime);
  }
  const response = await http.get<{ entries: BackendSemanticUnderstandingTaskSummary[] }>("/vega-backend/v1/semantic-understanding-tasks", { params: { resource_id: resourceId, scope: "resource", limit: 100, offset: 0, sort: "create_time", direction: "desc" } });
  return response.data.entries.map(mapSemanticUnderstandingTaskSummary);
}

export async function getSemanticUnderstandingTask(id: string) {
  if (useMock) return mockTasks.find((task) => task.id === id) ?? null;
  const response = await http.get<BackendSemanticUnderstandingTask>(`/vega-backend/v1/semantic-understanding-tasks/${id}`);
  return response.data ? mapSemanticUnderstandingTask(response.data) : null;
}

export async function createResourceSemanticUnderstandingTask(payload: CreateSemanticUnderstandingTaskPayload) {
  if (useMock) {
    const task = { id: `semantic-task-${Date.now()}`, scope: "resource" as const, catalogId: "", resourceId: payload.resourceId, agentId: "resource-semantic-understanding", status: "pending" as const, applyMode: payload.applyMode, confidenceThreshold: payload.confidenceThreshold ?? 0.75, confidence: 0, applied: false, creator: { id: "mock-user", name: "Mock User", type: "user" }, createTime: Date.now() };
    mockTasks = [task, ...mockTasks];
    return task;
  }
  const includeSampleRows = payload.includeSampleRows ?? false;
  const response = await http.post<{ id: string }>("/vega-backend/v1/semantic-understanding-tasks", {
    scope: "resource",
    resource_id: payload.resourceId,
    apply_mode: payload.applyMode,
    confidence_threshold: payload.confidenceThreshold,
    include_sample_rows: includeSampleRows,
    sample_policy: includeSampleRows ? { masked: false, max_rows: 10 } : undefined,
  });
  return response.data;
}

export async function deleteSemanticUnderstandingTask(id: string) {
  if (useMock) {
    mockTasks = mockTasks.filter((task) => task.id !== id);
    return;
  }
  await http.delete(`/vega-backend/v1/semantic-understanding-tasks/${id}`);
}
