/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

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

export async function getPermissionRequestTodoSummary() {
  const response = await http.get<PermissionRequestTodoSummary>(
    "/safe/v1/me/permission-requests/todo/summary",
  );
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
  const response = await http.post<PermissionRequest>(
    `/safe/v1/me/permission-requests/${id}/decision`,
    { decision, comment },
    { skipErrorToast: true },
  );
  return response.data;
}

export async function cancelPermissionRequest(id: string) {
  await http.post(`/safe/v1/me/permission-requests/${id}/cancel`, {}, { skipErrorToast: true });
}

export async function getPermissionRequest(id: string) {
  const response = await http.get<PermissionRequest>(`/safe/v1/me/permission-requests/${id}`);
  return response.data;
}

export async function listPermissionRequestReviews(id: string) {
  const response = await http.get<{ entries: PermissionRequestReview[] }>(
    `/safe/v1/me/permission-requests/${id}/reviews`,
  );
  return response.data.entries;
}

export async function createPermissionRequest(payload: {
  resourceType: string;
  resourceID: string;
  resourceName?: string;
  operations: string[];
  reason: string;
}) {
  await http.post(
    "/safe/v1/permission-requests",
    {
      resource: { type: payload.resourceType, id: payload.resourceID, name: payload.resourceName },
      operations: payload.operations,
      reason: payload.reason,
    },
    { skipErrorToast: true },
  );
}
