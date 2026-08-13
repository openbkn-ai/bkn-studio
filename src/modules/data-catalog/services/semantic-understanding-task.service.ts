/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type SemanticUnderstandingTaskStatus =
  | "cancelled"
  | "failed"
  | "pending"
  | "running"
  | "succeeded";

export type SemanticUnderstandingTaskSummary = {
  agentId: string;
  agentTaskId?: string;
  applied: boolean;
  appliedTime?: number;
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
  status: SemanticUnderstandingTaskStatus;
  updateTime?: number;
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
  applied_time?: number;
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
  update_time: number;
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
    status: task.status === "completed" ? "succeeded" : task.status,
    applyMode: task.apply_mode,
    confidenceThreshold: task.confidence_threshold,
    confidence: task.confidence,
    applied: task.applied,
    appliedTime: task.applied_time,
    creator: { id: task.creator.id, name: task.creator.name, type: task.creator.type },
    createTime: task.create_time,
    updateTime: task.update_time,
  };
}

export type SemanticUnderstandingTaskListFilters = {
  applied?: boolean;
  applyMode?: string;
  catalogId?: string;
  direction?: "asc" | "desc";
  resourceId?: string;
  scope?: SemanticUnderstandingTaskSummary["scope"];
  sort?: "create_time";
  status?: SemanticUnderstandingTaskSummary["status"];
};

export function buildSemanticUnderstandingTaskListParams(
  page: number,
  pageSize: number,
  filters: SemanticUnderstandingTaskListFilters,
) {
  return {
    direction: filters.direction ?? "desc",
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sort: filters.sort ?? "create_time",
    scope: filters.scope,
    catalog_id: filters.catalogId,
    resource_id: filters.resourceId,
    status: filters.status === "succeeded" ? "completed" : filters.status,
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
let mockTasks: Array<SemanticUnderstandingTask & { resourceId: string }> = [];

export async function listResourceSemanticUnderstandingTasks(resourceId: string): Promise<SemanticUnderstandingTaskSummary[]> {
  if (useMock) return mockTasks.filter((task) => task.resourceId === resourceId).sort((left, right) => right.createTime - left.createTime);
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
