/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { z } from "zod";

import i18n from "@/app/locales/i18n";
import { http } from "@/framework/request/http";
import { throwMockRequestError } from "@/framework/request/mock-error";
import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";
import {
  emitMockChange,
  formatMockTimestamp,
  mockCatalogName,
  mockResources,
} from "@/modules/data-catalog/services/mock-db";
import { isValidSemanticUnderstandingSampleRows } from "@/modules/data-catalog/components/semantic-understanding-task-validation";

export type SemanticUnderstandingTaskStatus =
  "cancelled" | "failed" | "pending" | "running" | "completed";

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

export function mapSemanticUnderstandingTaskSummary(
  task: BackendSemanticUnderstandingTaskSummary,
): SemanticUnderstandingTaskSummary {
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
  /** Server pagination window; Vega applies task visibility and filters before limit and offset. */
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

export function mapSemanticUnderstandingTask(
  task: BackendSemanticUnderstandingTask,
): SemanticUnderstandingTask {
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
  language?: "zh-CN" | "en-US";
  applyMode: SemanticUnderstandingTask["applyMode"];
  confidenceThreshold?: number;
  includeSampleRows?: boolean;
  resourceId: string;
  sampleMaxRows?: number;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const mockNow = Date.now();

function assertValidSemanticSampleMaxRows(value: number) {
  if (!isValidSemanticUnderstandingSampleRows(value)) {
    throw new RangeError("sampleMaxRows must be an integer between 1 and 20");
  }
}

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
    applyMode: "dry_run",
    confidenceThreshold: 0.75,
    confidence: 0.95,
    applied: false,
    creator: { id: "mock-user", name: "Mock User", type: "user" },
    createTime: mockNow - 1000 * 60 * 45,
    startTime: mockNow - 1000 * 60 * 44,
    finishTime: mockNow - 1000 * 60 * 40,
    confidenceDetailJson: JSON.stringify({
      warning_details: [
        {
          code: "sample_omitted_by_policy",
          params: { field_name: "attachment_blob", field_type: "binary" },
        },
      ],
    }),
    applyDetailJson: JSON.stringify({
      field_details: [
        { name: "customer_id", status: "updated", updated: ["description", "semantic_type"] },
        { name: "email", status: "updated", updated: ["description"] },
      ],
    }),
    input: JSON.stringify({
      resource_id: "res-customers",
      options: {
        apply_mode: "dry_run",
        confidence_threshold: 0.75,
        include_sample_rows: true,
        language: "zh-CN",
        sample_policy: { masked: false, max_rows: 8 },
      },
    }),
    inputHash: "sha256:5eecaf1d9d8f0a8c",
    resultJson: JSON.stringify({
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

type ApplySemanticUnderstandingMode = "fill_empty" | "force";

const mockSchemaField = z.object({
  name: z.string(),
  type: z.string(),
  original_name: z.string().optional(),
  original_type: z.string().optional(),
  original_description: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).nullish(),
});
const mockResourceSnapshot = z.object({
  id: z.string(),
  category: z.string(),
  source_identifier: z.string(),
  schema: z.string().optional(),
  schema_definition: z.array(mockSchemaField),
});
const mockSemanticMetadata = z.object({
  display_name: z.string().optional(),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});
const mockSemanticResult = z.object({
  resource: mockSemanticMetadata,
  fields: z.array(mockSemanticMetadata.extend({ name: z.string() })),
});

function mockSemanticSnapshot(resource: CatalogResource) {
  return {
    id: resource.id,
    category: resource.category,
    source_identifier: resource.sourceIdentifier,
    schema: resource.schemaName ?? "",
    schema_definition: resource.schema.map((field) => ({
      name: field.name,
      type: field.type,
      original_name: field.originalName,
      original_type: field.originalType,
      original_description: field.originalDescription,
      attributes: field.attributes,
    })),
  };
}

function mockSemanticSuggestions(resource: CatalogResource) {
  return {
    resource: {},
    fields: resource.schema.map((field) => ({
      name: field.name,
      description: i18n.t("dataCatalog.taskManagement.semantic.mock.fieldDescription", {
        field: field.name,
      }),
    })),
  };
}

// Mock comparisons use the same participating schema fields as Vega. The backend
// remains authoritative for fingerprint validation in connected mode.
function canonicalMockSemanticValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalMockSemanticValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, canonicalMockSemanticValue(item)]),
    );
  return value;
}

function mockSemanticSchemaKey(snapshot: z.infer<typeof mockResourceSnapshot>) {
  return JSON.stringify(
    canonicalMockSemanticValue({
      ...snapshot,
      schema: snapshot.schema ?? "",
      schema_definition: snapshot.schema_definition
        .map((field) => ({
          ...field,
          original_name: field.original_name ?? "",
          original_type: field.original_type ?? "",
          original_description: field.original_description ?? "",
          attributes: field.attributes ?? {},
        }))
        .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0)),
    }),
  );
}

// Construct demo fixtures with source snapshots at initialization. Application
// never repairs a saved task from the current resource.
for (const task of mockTasks) {
  const resource = mockResources.find((item) => item.id === task.resourceId);
  if (task.status !== "completed" || task.applyMode !== "dry_run" || !resource) continue;
  const input = JSON.parse(task.input ?? "{}") as Record<string, unknown>;
  task.input = JSON.stringify({ ...input, resource: mockSemanticSnapshot(resource) });
  const result = JSON.parse(task.resultJson ?? "{}") as Record<string, unknown>;
  task.resultJson = JSON.stringify({ ...result, ...mockSemanticSuggestions(resource) });
}

export async function applySemanticUnderstandingTask(
  id: string,
  applyMode: ApplySemanticUnderstandingMode,
): Promise<SemanticUnderstandingTask> {
  if (!useMock) {
    const response = await http.post<BackendSemanticUnderstandingTask>(
      `/vega-backend/v1/semantic-understanding-tasks/${encodeURIComponent(id)}/apply`,
      { apply_mode: applyMode },
      { skipErrorToast: true },
    );
    return mapSemanticUnderstandingTask(response.data);
  }
  if (applyMode !== "fill_empty" && applyMode !== "force") {
    throwMockRequestError(
      400,
      "VegaBackend.InvalidParameter.RequestBody",
      "Invalid application mode.",
    );
  }
  const task = mockTasks.find((item) => item.id === id);
  if (!task)
    throwMockRequestError(404, "VegaBackend.SemanticUnderstandingTask.NotFound", "Task not found.");
  if (
    task.status !== "completed" ||
    task.scope !== "resource" ||
    task.applyMode !== "dry_run" ||
    !task.resultJson
  ) {
    throwMockRequestError(
      409,
      "VegaBackend.SemanticUnderstandingTask.NotApplicable",
      "This task cannot be applied.",
    );
  }
  if (task.applied) return { ...task };
  if (task.confidence < task.confidenceThreshold) {
    throwMockRequestError(
      409,
      "VegaBackend.SemanticUnderstandingTask.ConfidenceBelowThreshold",
      "Confidence is below the original threshold.",
    );
  }
  const resource = mockResources.find((item) => item.id === task.resourceId);
  if (!resource) throwMockRequestError(404, "VegaBackend.Resource.NotFound", "Resource not found.");
  let snapshot: z.infer<typeof mockResourceSnapshot>, result: z.infer<typeof mockSemanticResult>;
  try {
    const input = z.object({ resource: mockResourceSnapshot }).parse(JSON.parse(task.input ?? ""));
    snapshot = input.resource;
  } catch {
    throwMockRequestError(
      409,
      "VegaBackend.SemanticUnderstandingTask.SchemaMismatch",
      "Saved schema snapshot is invalid.",
    );
  }
  try {
    result = mockSemanticResult.parse(JSON.parse(task.resultJson));
  } catch {
    throwMockRequestError(
      409,
      "VegaBackend.SemanticUnderstandingTask.InvalidResult",
      "Saved semantic output is invalid.",
    );
  }
  if (
    task.catalogId !== resource.catalogId ||
    mockSemanticSchemaKey(snapshot) !== mockSemanticSchemaKey(mockSemanticSnapshot(resource))
  ) {
    throwMockRequestError(
      409,
      "VegaBackend.SemanticUnderstandingTask.SchemaMismatch",
      "Resource schema changed; create a new semantic-understanding task.",
    );
  }
  const names = new Set<string>();
  for (const field of result.fields) {
    if (names.has(field.name) || !resource.schema.some((item) => item.name === field.name)) {
      throwMockRequestError(
        409,
        "VegaBackend.SemanticUnderstandingTask.InvalidResult",
        "Saved semantic fields do not match the resource schema.",
      );
    }
    names.add(field.name);
  }
  const updatedFields: string[] = [];
  const nextSchema = resource.schema.map((field) => {
    const suggestion = result.fields.find((item) => item.name === field.name);
    if (
      !suggestion ||
      (suggestion.confidence !== undefined && suggestion.confidence < task.confidenceThreshold)
    )
      return field;
    const next = { ...field };
    if (
      suggestion.display_name &&
      (applyMode === "force" || !field.displayName || field.displayName === field.name)
    )
      next.displayName = suggestion.display_name;
    if (
      suggestion.description &&
      (applyMode === "force" ||
        !field.description ||
        field.description === field.originalDescription)
    )
      next.description = suggestion.description;
    if (next.displayName !== field.displayName || next.description !== field.description)
      updatedFields.push(field.name);
    return next;
  });
  const nextName =
    result.resource.display_name &&
    (applyMode === "force" || !resource.name || resource.name === resource.sourceIdentifier)
      ? result.resource.display_name
      : resource.name;
  const nextDescription =
    result.resource.description &&
    (applyMode === "force" ||
      !resource.description ||
      resource.description === resource.sourceMetadata?.originalDescription)
      ? result.resource.description
      : resource.description;
  const resourceUpdated = nextName !== resource.name || nextDescription !== resource.description;
  const metadataChanged = resourceUpdated || updatedFields.length > 0;
  if (metadataChanged) {
    resource.name = nextName;
    resource.description = nextDescription;
    resource.schema = nextSchema;
    resource.expectedUpdateTime = Date.now();
    resource.updateTime = formatMockTimestamp(resource.expectedUpdateTime);
  }
  const nextTask = {
    ...task,
    applied: true,
    applyDetailJson: JSON.stringify({
      apply_mode: applyMode,
      resource_updated: resourceUpdated,
      updated_fields: updatedFields,
      ...(!metadataChanged ? { reason: "no_resource_changes" } : {}),
    }),
  };
  mockTasks = mockTasks.map((item) => (item.id === id ? nextTask : item));
  if (metadataChanged) emitMockChange();
  return { ...nextTask };
}

export async function listSemanticUnderstandingTasks(
  filters: SemanticUnderstandingTaskListFilters,
  window: { limit: number; offset: number },
  options: { skipErrorToast?: boolean } = {},
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
        ? (task.startTime ?? 0)
        : filters.sort === "finish_time"
          ? (task.finishTime ?? 0)
          : task.createTime;
    const direction = filters.direction === "asc" ? 1 : -1;
    const sorted = [...filtered].sort((left, right) => (timeOf(left) - timeOf(right)) * direction);
    return {
      items: sorted.slice(window.offset, window.offset + window.limit),
      total: sorted.length,
    };
  }

  const response = await http.get<{
    entries: BackendSemanticUnderstandingTaskSummary[];
    total_count: number;
  }>("/vega-backend/v1/semantic-understanding-tasks", {
    ...options,
    params: buildSemanticUnderstandingTaskListParams(1, window.limit, filters, window),
    paramsSerializer: { indexes: null },
  });
  return {
    items: response.data.entries.map(mapSemanticUnderstandingTaskSummary),
    total: response.data.total_count,
  };
}

export async function getSemanticUnderstandingTask(id: string) {
  if (useMock) return mockTasks.find((task) => task.id === id) ?? null;
  const response = await http.get<BackendSemanticUnderstandingTask>(
    `/vega-backend/v1/semantic-understanding-tasks/${id}`,
  );
  return response.data ? mapSemanticUnderstandingTask(response.data) : null;
}

export async function createResourceSemanticUnderstandingTask(
  payload: CreateSemanticUnderstandingTaskPayload,
) {
  if (useMock) {
    const resource = mockResources.find((item) => item.id === payload.resourceId);
    const now = Date.now();
    const task: SemanticUnderstandingTask = {
      id: `semantic-task-${now}`,
      scope: "resource",
      catalogId: resource?.catalogId ?? "",
      catalogName: mockCatalogName(resource?.catalogId),
      resourceId: payload.resourceId,
      resourceName: resource?.name,
      agentId: "resource-semantic-understanding",
      status: "completed",
      applyMode: payload.applyMode,
      confidenceThreshold: payload.confidenceThreshold ?? 0.75,
      confidence: 0.88,
      applied: payload.applyMode !== "dry_run",
      creator: { id: "mock-user", name: "Mock User", type: "user" },
      createTime: now,
      startTime: now,
      finishTime: now,
      input: JSON.stringify({
        ...(resource ? { resource: mockSemanticSnapshot(resource) } : {}),
        options: {
          language: payload.language ?? i18n.resolvedLanguage ?? i18n.language,
          apply_mode: payload.applyMode,
        },
      }),
      resultJson: JSON.stringify({
        quality: {
          resource_effective: true,
          field_effective: 0,
          field_total: resource?.schema.length ?? 0,
        },
        summary: "Mock semantic-understanding task completed.",
        ...(resource ? mockSemanticSuggestions(resource) : {}),
      }),
    };
    mockTasks = [task, ...mockTasks];
    return task;
  }
  const includeSampleRows = payload.includeSampleRows ?? false;
  const sampleMaxRows = payload.sampleMaxRows ?? 10;
  if (includeSampleRows) assertValidSemanticSampleMaxRows(sampleMaxRows);
  const response = await http.post<{ id: string }>(
    "/vega-backend/v1/semantic-understanding-tasks",
    {
      scope: "resource",
      resource_id: payload.resourceId,
      ...(payload.language ? { language: payload.language } : {}),
      apply_mode: payload.applyMode,
      confidence_threshold: payload.confidenceThreshold,
      include_sample_rows: includeSampleRows,
      sample_policy: includeSampleRows ? { masked: false, max_rows: sampleMaxRows } : undefined,
    },
  );
  return response.data;
}

export async function deleteSemanticUnderstandingTask(id: string) {
  if (useMock) {
    mockTasks = mockTasks.filter((task) => task.id !== id);
    return;
  }
  await http.delete(`/vega-backend/v1/semantic-understanding-tasks/${id}`);
}
