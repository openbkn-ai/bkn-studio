import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

export type AuthorizationResource = {
  id: string;
  type: string;
};

type ResourceOperationRequest = {
  method: "GET";
  accessor: {
    id: string;
    type: "user";
  };
  resources: AuthorizationResource[];
};

type ResourceOperationItem = {
  id: string;
  operation?: string[];
};

function buildResourceOperationRequest(
  resources: AuthorizationResource[],
): ResourceOperationRequest | null {
  const userId = getRuntimeConfig().currentUser.id;

  if (!userId) {
    return null;
  }

  return {
    method: "GET",
    accessor: {
      id: userId,
      type: "user",
    },
    resources,
  };
}

export async function getResourceOperations(
  resources: AuthorizationResource[],
): Promise<ResourceOperationItem[]> {
  const payload = buildResourceOperationRequest(resources);

  if (!payload) {
    return [];
  }

  const response = await http.post<ResourceOperationItem[]>(
    "/authorization/v1/resource-operation",
    payload,
  );

  return Array.isArray(response.data) ? response.data : [];
}
