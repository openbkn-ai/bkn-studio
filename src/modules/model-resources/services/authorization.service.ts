import { http } from "@/framework/request/http";
import { getRuntimeConfig } from "@/framework/runtime/config";

export type AuthorizationResource = {
  id: string;
  type: string;
};

type ResourceOperationItem = {
  id: string;
  operation?: string[];
};

/**
 * bkn-safe operations check — `/api/safe/v1/authz/operations`.
 * Single resource per call: body `{accessor_id, resource:{type,id}}`,
 * response `{operations: [...]}`. (Migrated from the old ISF
 * `/authorization/v1/resource-operation`, which took a `resources[]` batch.)
 */
type AuthzOperationsRequest = {
  accessor_id: string;
  resource: {
    type: string;
    id: string;
  };
};

type AuthzOperationsResponse = {
  operations?: string[];
};

async function fetchResourceOperation(
  accessorId: string,
  resource: AuthorizationResource,
): Promise<ResourceOperationItem> {
  const response = await http.post<AuthzOperationsResponse>(
    "/safe/v1/authz/operations",
    {
      accessor_id: accessorId,
      resource: { type: resource.type, id: resource.id },
    } satisfies AuthzOperationsRequest,
  );

  return { id: resource.id, operation: response.data?.operations ?? [] };
}

export async function getResourceOperations(
  resources: AuthorizationResource[],
): Promise<ResourceOperationItem[]> {
  const accessorId = getRuntimeConfig().currentUser.id;

  if (!accessorId || resources.length === 0) {
    return [];
  }

  // The endpoint is single-resource, so query each resource and reassemble the
  // batch the callers expect.
  return Promise.all(
    resources.map((resource) => fetchResourceOperation(accessorId, resource)),
  );
}
