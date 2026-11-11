/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { defaultDevRuntimeUser, getDevRuntimeUser } from "@/framework/runtime/dev-profile";

import type {
  PermissionRequest,
  PermissionRequestFilters,
  PermissionRequestReview,
} from "./permission-requests.service";

// Existing fixtures stay owned by the administrator when the active mock role changes.
const localUserID = defaultDevRuntimeUser.id ?? "";
const localReviewerID = localUserID;
const localAdminName = defaultDevRuntimeUser.name ?? "";

const requests: PermissionRequest[] = [
  {
    id: "mock-permission-request-1",
    requester_id: "mock-user-1",
    requester_name: "Demo User",
    reviewer_id: localReviewerID,
    reviewer_name: localAdminName,
    resource_type: "knowledge_network",
    resource_id: "demo-network",
    resource_name: "示例知识网络",
    operation: "query_data",
    operations: ["view", "query_data"],
    proposal_kind: "grant",
    reason: "需要查询示例知识网络中的业务数据。",
    status: "pending",
    created_at: "2026-08-18T09:30:00Z",
  },
  {
    id: "mock-permission-request-2",
    requester_id: "mock-user-2",
    requester_name: "Alex Chen",
    reviewer_id: localReviewerID,
    reviewer_name: localAdminName,
    resource_type: "object_type",
    resource_id: "demo-network/customer",
    resource_name: "客户",
    operation: "view_detail",
    operations: ["view", "view_detail"],
    proposal_kind: "property_grants",
    proposal_payload: JSON.stringify({ changes: [{ property_name: "phone", level: "read" }] }),
    reason: "需要查看客户联系方式以完成支持工作。",
    status: "pending",
    created_at: "2026-08-17T06:15:00Z",
  },
  {
    id: "mock-permission-request-3",
    requester_id: localUserID,
    requester_name: localAdminName,
    resource_type: "catalog",
    resource_id: "demo-catalog",
    resource_name: "示例数据目录",
    operation: "view",
    operations: ["view"],
    proposal_kind: "grant",
    reason: "用于本地 mock 展示我的申请。",
    status: "granted",
    created_at: "2026-08-15T03:00:00Z",
    reviewed_at: "2026-08-15T04:00:00Z",
    reviewer_id: "mock-reviewer-1",
    reviewer_name: "Demo Reviewer",
  },
];

const reviews: Record<string, PermissionRequestReview[]> = {
  "mock-permission-request-3": [
    {
      id: "mock-review-3",
      reviewer_id: "mock-reviewer-1",
      reviewer_name: "Demo Reviewer",
      decision: "approve",
      comment: "已确认申请用途。",
      created_at: "2026-08-15T04:00:00Z",
    },
  ],
};

export function listMockPermissionRequests(
  kind: "mine" | "todo" | "reviewed",
  limit: number,
  offset: number,
  filters: PermissionRequestFilters,
) {
  const userID = getDevRuntimeUser().id;
  const matching = requests
    .filter((request) => {
      if (kind === "mine" && request.requester_id !== userID) return false;
      if (kind === "todo" && (request.status !== "pending" || request.reviewer_id !== userID))
        return false;
      if (
        kind === "reviewed" &&
        !reviews[request.id]?.some((review) => review.reviewer_id === userID)
      )
        return false;
      if (
        filters.requester &&
        !request.requester_name.toLowerCase().includes(filters.requester.toLowerCase())
      )
        return false;
      if (filters.resourceID && request.resource_id !== filters.resourceID) return false;
      if (
        filters.resourceName &&
        !request.resource_name?.toLowerCase().includes(filters.resourceName.toLowerCase())
      )
        return false;
      if (filters.resourceType && request.resource_type !== filters.resourceType) return false;
      if (filters.status && request.status !== filters.status) return false;
      return true;
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
  return {
    entries: matching
      .slice(offset, offset + limit)
      .map((request) => ({ ...request, operations: [...request.operations] })),
    total_count: matching.length,
  };
}

function findVisibleRequest(id: string) {
  const userID = getDevRuntimeUser().id;
  const request = requests.find(
    (entry) => entry.id === id && (entry.requester_id === userID || entry.reviewer_id === userID),
  );
  if (!request) throw new Error("Permission request not found");
  return request;
}

export function getMockPermissionRequest(id: string) {
  const request = findVisibleRequest(id);
  return { ...request, operations: [...request.operations] };
}

export function listMockPermissionRequestReviews(id: string) {
  findVisibleRequest(id);
  return (reviews[id] ?? []).map((review) => ({ ...review }));
}

export function decideMockPermissionRequest(
  id: string,
  decision: "approve" | "reject",
  comment: string,
) {
  const request = findVisibleRequest(id);
  const user = getDevRuntimeUser();
  if (request.reviewer_id !== user.id || request.status !== "pending") {
    throw new Error("Permission request cannot be reviewed");
  }
  const now = new Date().toISOString();
  request.status = decision === "approve" ? "granted" : "rejected";
  request.reviewer_id = user.id ?? "";
  request.reviewer_name = user.name ?? "";
  request.reviewed_at = now;
  reviews[id] ??= [];
  reviews[id].push({
    id: `mock-review-${Date.now()}`,
    reviewer_id: user.id ?? "",
    reviewer_name: user.name ?? "",
    decision,
    comment,
    created_at: now,
  });
  return getMockPermissionRequest(id);
}

export function cancelMockPermissionRequest(id: string) {
  const request = findVisibleRequest(id);
  if (request.requester_id !== getDevRuntimeUser().id) {
    throw new Error("Permission request cannot be cancelled");
  }
  request.status = "cancelled";
}

export function createMockPermissionRequest(payload: {
  resourceType: string;
  resourceID: string;
  resourceName?: string;
  operations?: string[];
  proposal?: { kind: "row_filter" | "property_grants"; payload: unknown };
  reason: string;
}) {
  const id = `mock-permission-request-${Date.now()}-${requests.length}`;
  const user = getDevRuntimeUser();
  const request: PermissionRequest = {
    id,
    requester_id: user.id ?? "",
    requester_name: user.name ?? "",
    reviewer_id: localReviewerID,
    reviewer_name: localAdminName,
    resource_type: payload.resourceType,
    resource_id: payload.resourceID,
    resource_name: payload.resourceName,
    operation: payload.operations?.[0] ?? "view",
    operations: [...(payload.operations ?? ["view"])],
    proposal_kind: payload.proposal?.kind ?? "grant",
    proposal_payload: payload.proposal ? JSON.stringify(payload.proposal.payload) : undefined,
    reason: payload.reason,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  requests.unshift(request);
  return { ...request, operations: [...request.operations] };
}

export function getMockPermissionRequestTodoSummary() {
  const userID = getDevRuntimeUser().id;
  return {
    pending_count: requests.filter(
      (request) => request.status === "pending" && request.reviewer_id === userID,
    ).length,
  };
}

export function getMockPermissionRequestProposalPreview() {
  return { property_grants: { entries: [] }, row_filter: null };
}
