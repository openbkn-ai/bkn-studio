import { http } from "@/framework/request/http";

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

export async function listPermissionRequests(kind: "mine" | "todo" | "reviewed", limit = 20, offset = 0) {
  const response = await http.get<PermissionRequestPage>(`/safe/v1/me/permission-requests/${kind}`, { params: { limit, offset, sort: "created_at", direction: "desc" } });
  return response.data;
}

export type PermissionRequestReview = { id: string; reviewer_id: string; reviewer_name?: string; decision: string; comment: string; created_at: string };

export async function decidePermissionRequest(id: string, decision: "approve" | "reject", comment = "") {
  await http.post(`/safe/v1/me/permission-requests/${id}/decision`, { decision, comment }, { skipErrorToast: true });
}

export async function cancelPermissionRequest(id: string) {
  await http.post(`/safe/v1/me/permission-requests/${id}/cancel`, {}, { skipErrorToast: true });
}

export async function getPermissionRequest(id: string) {
  const response = await http.get<PermissionRequest>(`/safe/v1/me/permission-requests/${id}`);
  return response.data;
}

export async function listPermissionRequestReviews(id: string) {
  const response = await http.get<{ entries: PermissionRequestReview[] }>(`/safe/v1/me/permission-requests/${id}/reviews`);
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
