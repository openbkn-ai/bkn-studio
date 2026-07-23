/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type SemanticUnderstandingTask = {
  agentId?: string;
  applied: boolean;
  applyMode: "dry_run" | "fill_empty" | "force";
  confidence: number;
  createTime: number;
  failureDetail?: string;
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
};

export type CreateSemanticUnderstandingTaskPayload = {
  applyMode: SemanticUnderstandingTask["applyMode"];
  confidenceThreshold?: number;
  includeSampleRows?: boolean;
  resourceId: string;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
let mockTasks: Array<SemanticUnderstandingTask & { resourceId: string }> = [];

export async function listResourceSemanticUnderstandingTasks(resourceId: string) {
  if (useMock) return mockTasks.filter((task) => task.resourceId === resourceId).sort((left, right) => right.createTime - left.createTime);
  const response = await http.get<{ entries: Array<{ id: string; agent_id?: string; status: SemanticUnderstandingTask["status"]; apply_mode?: SemanticUnderstandingTask["applyMode"]; confidence?: number; applied?: boolean; create_time?: number; failure_detail?: string }> }>("/vega-backend/v1/semantic-understanding-tasks", { params: { resource_id: resourceId, scope: "resource", limit: 100, offset: 0, sort: "create_time", direction: "desc" } });
  return response.data.entries.map((task) => ({ id: task.id, agentId: task.agent_id, status: task.status, applyMode: task.apply_mode ?? "fill_empty", confidence: task.confidence ?? 0, applied: task.applied ?? false, createTime: task.create_time ?? 0, failureDetail: task.failure_detail }));
}

export async function createResourceSemanticUnderstandingTask(payload: CreateSemanticUnderstandingTaskPayload) {
  if (useMock) {
    const task = { id: `semantic-task-${Date.now()}`, resourceId: payload.resourceId, status: "pending" as const, applyMode: payload.applyMode, confidence: 0, applied: false, createTime: Date.now() };
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
    sample_policy: includeSampleRows ? { masked: true, max_rows: 10 } : undefined,
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
