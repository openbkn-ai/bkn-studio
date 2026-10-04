/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { isRequestNotFound } from "@/framework/request/error-message";
import {
  cancelMockPermissionRequest,
  createMockPermissionRequest,
  decideMockPermissionRequest,
  getMockPermissionRequest,
  getMockPermissionRequestProposalPreview,
  getMockPermissionRequestTodoSummary,
  listMockPermissionRequestReviews,
  listMockPermissionRequests,
} from "./permission-requests.mock";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const todoSummaryNotFoundRetryMs = 2 * 60 * 1000;
let todoSummaryRetryAfter = 0;

type PermissionRequestErrorResponse = {
  error_code?: string;
  error_details?: { reason?: string };
};

function permissionRequestConflictReason(error: unknown): string | undefined {
  const data = (error as { response?: { data?: PermissionRequestErrorResponse } })?.response?.data;
  if (data?.error_code !== "BknSafe.Conflict") return undefined;
  return data.error_details?.reason;
}

export function isPermissionAlreadyGrantedError(error: unknown) {
  return permissionRequestConflictReason(error) === "permission_already_granted";
}

export function isPermissionRequestResourceDeletedError(error: unknown) {
  return permissionRequestConflictReason(error) === "resource_deleted";
}

export type PermissionRequest = {
  id: string;
  requester_id: string;
  requester_name: string;
  reviewer_id?: string;
  reviewer_name?: string;
  resource_type: string;
  resource_id: string;
  resource_name?: string;
  operation: string;
  operations: string[];
  proposal_kind?: "grant" | "row_filter" | "property_grants";
  proposal_payload?: string;
  reason: string;
  status: string;
  created_at: string;
  reviewed_at?: string;
};

export type PermissionRequestPage = { entries: PermissionRequest[]; total_count: number };
export type PermissionRequestTodoSummary = {
  pending_count: number;
};
export type PermissionRequestFilters = {
  requester?: string;
  resourceID?: string;
  resourceName?: string;
  resourceType?: string;
  status?: string;
};

export async function listPermissionRequests(
  kind: "mine" | "todo" | "reviewed",
  limit = 20,
  offset = 0,
  filters: PermissionRequestFilters = {},
) {
  if (useMock) return listMockPermissionRequests(kind, limit, offset, filters);

  const response = await http.get<PermissionRequestPage>(
    `/safe/v1/me/permission-requests/${kind}`,
    {
      params: {
        limit,
        offset,
        sort: "created_at",
        direction: "desc",
        resource_type: filters.resourceType || undefined,
        resource_id: filters.resourceID || undefined,
        status: filters.status || undefined,
        resource_name: filters.resourceName || undefined,
        requester: filters.requester || undefined,
      },
    },
  );
  return response.data;
}

export async function getPermissionRequestTodoSummary(): Promise<PermissionRequestTodoSummary | null> {
  if (useMock) {
    return getMockPermissionRequestTodoSummary();
  }
  if (Date.now() < todoSummaryRetryAfter) return null;

  try {
    const response = await http.get<PermissionRequestTodoSummary>(
      "/safe/v1/me/permission-requests/todo/summary",
      { skipErrorToast: true },
    );
    todoSummaryRetryAfter = 0;
    return response.data;
  } catch (error) {
    if (!isRequestNotFound(error)) throw error;
    todoSummaryRetryAfter = Date.now() + todoSummaryNotFoundRetryMs;
    return null;
  }
}

export async function getPermissionRequestProposalPreview(resourceID: string) {
  if (useMock) return getMockPermissionRequestProposalPreview();

  const response = await http.get<{
    property_grants: unknown;
    row_filter: unknown;
  }>("/safe/v1/me/permission-requests/proposal-preview", {
    params: { resource_id: resourceID, resource_type: "object_type" },
  });
  return response.data;
}

const permissionRequestTodoSummaryChangedEvent = "permission-request-todo-summary-changed";

export function notifyPermissionRequestTodoSummaryChanged() {
  window.dispatchEvent(new Event(permissionRequestTodoSummaryChangedEvent));
}

export function onPermissionRequestTodoSummaryChanged(listener: () => void) {
  window.addEventListener(permissionRequestTodoSummaryChangedEvent, listener);
  return () => window.removeEventListener(permissionRequestTodoSummaryChangedEvent, listener);
}

export type PermissionRequestReview = {
  id: string;
  reviewer_id: string;
  reviewer_name?: string;
  decision: string;
  comment: string;
  created_at: string;
};

export async function decidePermissionRequest(
  id: string,
  decision: "approve" | "reject",
  comment = "",
) {
  if (useMock) return decideMockPermissionRequest(id, decision, comment);

  const response = await http.post<PermissionRequest>(
    `/safe/v1/me/permission-requests/${id}/decision`,
    { decision, comment },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function cancelPermissionRequest(id: string) {
  if (useMock) {
    cancelMockPermissionRequest(id);
    return;
  }

  await http.post(`/safe/v1/me/permission-requests/${id}/cancel`, {}, { skipErrorToast: true });
}

export async function getPermissionRequest(id: string) {
  if (useMock) return getMockPermissionRequest(id);

  const response = await http.get<PermissionRequest>(`/safe/v1/me/permission-requests/${id}`);
  return response.data;
}

export async function listPermissionRequestReviews(id: string) {
  if (useMock) return listMockPermissionRequestReviews(id);

  const response = await http.get<{ entries: PermissionRequestReview[] }>(
    `/safe/v1/me/permission-requests/${id}/reviews`,
  );
  return response.data.entries;
}

export async function createPermissionRequest(payload: {
  resourceType: string;
  resourceID: string;
  resourceName?: string;
  operations?: string[];
  proposal?: { kind: "row_filter" | "property_grants"; payload: unknown };
  reason: string;
}) {
  if (useMock) {
    createMockPermissionRequest(payload);
    return;
  }

  await http.post(
    "/safe/v1/permission-requests",
    {
      resource: { type: payload.resourceType, id: payload.resourceID, name: payload.resourceName },
      operations: payload.operations,
      proposal: payload.proposal,
      reason: payload.reason,
    },
    { skipErrorToast: true },
  );
}
