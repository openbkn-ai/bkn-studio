/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import {
  operationsForType as mockOperationsForType,
  RESOURCE_TYPES,
} from "@/modules/system-admin/utils/resource-catalog";

export type AuthorizationCatalogOperation = {
  id: string;
  name: string;
  parentOperation?: string;
  requires: string[];
};

export type AuthorizationCatalogResourceType = {
  id: string;
  name: string;
  parentType?: string;
  operations: AuthorizationCatalogOperation[];
};

export type AuthorizationCatalog = {
  resourceTypes: AuthorizationCatalogResourceType[];
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const AUTHZ = "/safe/v1/authz";

export const usesMockAuthorizationCatalog = useMock;

let catalogPromise: Promise<AuthorizationCatalog> | undefined;

/**
 * Reads the catalog persisted by bkn-safe, rather than a Studio-maintained
 * operation list. The mock conversion is intentionally confined to demo mode;
 * real authorization authoring has no stale fallback when this request fails.
 */
export function getAuthorizationCatalog(): Promise<AuthorizationCatalog> {
  if (useMock) {
    return Promise.resolve(mockAuthorizationCatalog());
  }
  catalogPromise ??= http.get<BackendAuthorizationCatalog>(`${AUTHZ}/catalog`)
    .then((response) => normalizeAuthorizationCatalog(response.data));
  return catalogPromise;
}

export function resetAuthorizationCatalogCache() {
  catalogPromise = undefined;
}

export type BackendAuthorizationCatalog = {
  resource_types?: Array<{
    id?: string;
    name?: string;
    parent_type?: string;
    operations?: Array<{
      id?: string;
      name?: string;
      parent_operation?: string;
      requires?: string[];
    }>;
  }>;
};

export function normalizeAuthorizationCatalog(input: BackendAuthorizationCatalog): AuthorizationCatalog {
  return {
    resourceTypes: (input.resource_types ?? [])
      .filter((resourceType) => Boolean(resourceType.id))
      .map((resourceType) => ({
        id: resourceType.id as string,
        name: resourceType.name || (resourceType.id as string),
        parentType: resourceType.parent_type || undefined,
        operations: (resourceType.operations ?? [])
          .filter((operation) => Boolean(operation.id))
          .map((operation) => ({
            id: operation.id as string,
            name: operation.name || (operation.id as string),
            parentOperation: operation.parent_operation || undefined,
            requires: [...new Set(operation.requires ?? [])],
          })),
      })),
  };
}

export function mockAuthorizationCatalog(): AuthorizationCatalog {
  return {
    resourceTypes: RESOURCE_TYPES.map((resourceType) => ({
      id: resourceType.type,
      name: resourceType.label,
      operations: mockOperationsForType(resourceType.type).map((operation) => ({
        id: operation.key,
        name: operation.label,
        requires: operation.requires,
      })),
    })),
  };
}
