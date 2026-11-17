/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

export type ApiCatalogTestResource = {
  id: string;
  name: string;
  catalogId: string;
  category: string;
  effectType: string;
  enabled: boolean;
  status: string;
  operations: string[];
  pagingRule?: Record<string, unknown>;
};

type BackendResource = {
  id?: string;
  name?: string;
  catalog_id?: string;
  category?: string;
  api_effect_type?: string;
  enabled?: boolean;
  status?: string;
  operations?: string[];
  api_definition?: { paging_rule?: Record<string, unknown> };
};

type ResourcePage = { entries: BackendResource[]; total_count: number };

type CandidateOptions = {
  keyword?: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
};

const useMock = import.meta.env.VITE_USE_MOCK !== "false";

function mapResource(resource: BackendResource): ApiCatalogTestResource {
  return {
    id: resource.id ?? "",
    name: resource.name ?? "",
    catalogId: resource.catalog_id ?? "",
    category: resource.category ?? "",
    effectType: resource.api_effect_type ?? "",
    enabled: resource.enabled === true,
    status: resource.status ?? "",
    operations:
      Array.isArray(resource.operations) &&
      resource.operations.every((operation) => typeof operation === "string")
        ? resource.operations
        : [],
    ...(resource.api_definition?.paging_rule !== undefined
      ? { pagingRule: resource.api_definition.paging_rule }
      : {}),
  };
}

/** List metadata only; selecting a candidate never invokes its upstream operation. */
export async function listApiCatalogTestResources(
  catalogId: string,
  options: CandidateOptions = {},
): Promise<{ items: ApiCatalogTestResource[]; total: number }> {
  options.signal?.throwIfAborted();
  if (useMock) return { items: [], total: 0 };

  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 20;
  const response = await http.get<ResourcePage>("/vega-backend/v1/resources", {
    skipErrorToast: true,
    params: {
      catalog_id: catalogId,
      category: "api",
      name: options.keyword?.trim() || undefined,
      offset: Math.max(0, (page - 1) * pageSize),
      limit: pageSize,
      sort: "name",
      direction: "asc",
    },
    signal: options.signal,
  });
  options.signal?.throwIfAborted();
  return { items: response.data.entries.map(mapResource), total: response.data.total_count };
}

/** Refresh the selected Resource's own scope, state and permissions before testing. */
export async function getApiCatalogTestResource(
  id: string,
  options: { signal?: AbortSignal } = {},
): Promise<ApiCatalogTestResource | null> {
  options.signal?.throwIfAborted();
  if (useMock) return null;

  const response = await http.get<{ entries?: BackendResource[] }>(
    `/vega-backend/v1/resources/${encodeURIComponent(id)}`,
    { signal: options.signal, skipErrorToast: true },
  );
  options.signal?.throwIfAborted();
  const resource = response.data.entries?.[0];
  return resource ? mapResource(resource) : null;
}

/** UI eligibility is conservative and never replaces the execution endpoint's checks. */
export function canTestApiCatalogResource(
  resource: ApiCatalogTestResource,
  catalogId: string,
): boolean {
  return (
    resource.catalogId === catalogId &&
    resource.category === "api" &&
    resource.effectType === "read" &&
    resource.enabled === true &&
    resource.status === "active" &&
    Array.isArray(resource.operations) &&
    (resource.operations.includes("*") || resource.operations.includes("query_data"))
  );
}
