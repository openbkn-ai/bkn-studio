/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { atLeast, parseEdition } from "@/framework/entitlement/edition";
import {
  throwMockRequestError,
  validateMockExpectedUpdateTime,
} from "@/framework/request/mock-error";
import {
  parsePrecisionPreservingJSON,
  transformNumberLiteralJSONRequest,
} from "@/framework/request/precision-safe-json";
import { filterMockOperations } from "@/framework/runtime/mock-user";
import { objectValue } from "@/shared/api-definition/model";
import { findMockCatalog } from "@/shared/catalog/catalog-mock";
import { hasCatalogOperation } from "@/shared/catalog/catalog-operations";
import {
  apiResourceChanges,
  apiResourcePagingRule,
  apiResourceSupportsTotal,
  validateApiResourceInput,
} from "../lib/api-resource";
import type {
  ApiResource,
  ApiResourceInput,
  ApiResourceQuery,
  ApiResourceResult,
} from "../types/api-resource";
import { hasCatalogResourceOperation } from "../utils/resource-operations";
import { apiResourceMockSummary, mockApiOrderRows } from "./api-resource-mock-data";
import { emitMockChange, mockApiDefinitions, mockResources, mockSlug } from "./mock-db";

/** Use the wire transform to preserve BigNumber literals when copying editable definitions. */
function copyDefinition<T>(value: T): T {
  return parsePrecisionPreservingJSON(transformNumberLiteralJSONRequest(value), {
    allowSpecialKeys: true,
    preserveNumberLiterals: true,
  }) as T;
}
function privateResource(id: string): ApiResource {
  const summary = mockResources.find(
    (resource) => resource.id === id && resource.category === "api",
  );
  const definition = mockApiDefinitions.get(id);
  if (!summary || !definition)
    throwMockRequestError(404, "VegaBackend.Resource.NotFound", "API Resource not found.");
  return {
    ...definition,
    id,
    category: "api",
    api_effect_type: "read",
    catalog_id: summary.catalogId,
    name: summary.name,
    description: summary.description,
    source_identifier: summary.sourceIdentifier,
    enabled: summary.enabled === true,
    status: summary.status ?? "active",
    tags: summary.tags ?? [],
    operations: filterMockOperations(summary.operations ?? []),
    update_time: summary.expectedUpdateTime,
  };
}
function catalogFor(resource: Pick<ApiResourceInput, "catalog_id">) {
  const catalog = findMockCatalog(resource.catalog_id);
  if (!catalog || catalog.category !== "api" || catalog.builtin || catalog.connectorType !== "http")
    throwMockRequestError(
      400,
      "VegaBackend.Resource.InvalidParameter",
      "A compatible API Catalog is required.",
    );
  if (!atLeast(parseEdition(import.meta.env.VITE_MOCK_EDITION), "professional"))
    throwMockRequestError(403, "VegaBackend.Resource.Forbidden", "API capability is unavailable.");
  return catalog;
}
function requireQueryable(resource: ApiResource) {
  const catalog = catalogFor(resource);
  if (
    !catalog.enabled ||
    catalog.status !== "enabled" ||
    !resource.enabled ||
    resource.status !== "active" ||
    !hasCatalogResourceOperation(resource, "query_data")
  )
    throwMockRequestError(
      403,
      "VegaBackend.Resource.QueryUnavailable",
      "Resource or Catalog is disabled or lacks query permission.",
    );
}

export function getMockApiResourceConnector(type: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (type !== "http")
    throwMockRequestError(404, "VegaBackend.ConnectorType.NotFound", "API connector not found.");
  return {
    category: "api",
    enabled: true,
    available: atLeast(parseEdition(import.meta.env.VITE_MOCK_EDITION), "professional"),
  };
}
export function getMockApiResource(id: string, signal?: AbortSignal): ApiResource {
  signal?.throwIfAborted();
  const resource = privateResource(id);
  if (!hasCatalogResourceOperation(resource, "view_detail"))
    throwMockRequestError(
      403,
      "VegaBackend.Resource.Forbidden",
      "Resource detail permission is required.",
    );
  const result = copyDefinition(resource);
  const variables = objectValue(result.api_definition.variables);
  if (Object.hasOwn(result.api_definition, "variables"))
    result.api_definition.variables = Object.fromEntries(
      Object.entries(variables).map(([name, entry]) => {
        const variable = objectValue(entry);
        return [
          name,
          variable.sensitive === true
            ? Object.fromEntries(Object.entries(variable).filter(([key]) => key !== "value"))
            : variable,
        ];
      }),
    );
  return result;
}

function outputMapping(fields: ApiResourceInput["schema_definition"]) {
  return fields.map(({ name, original_name, type, attributes }) => ({
    name,
    original_name,
    type,
    attributes,
  }));
}

export function saveMockApiResource(input: ApiResourceInput, previous?: ApiResource): string {
  const current = previous ? privateResource(previous.id) : undefined;
  const catalog = catalogFor(current ?? input);
  const allowed = current
    ? hasCatalogResourceOperation(current, "modify")
    : hasCatalogOperation(
        { operations: filterMockOperations(catalog.operations) },
        "resource_manage",
      );
  if (!allowed)
    throwMockRequestError(
      403,
      "VegaBackend.Resource.Forbidden",
      "API Resource management permission is required.",
    );
  if (previous && current) {
    validateMockExpectedUpdateTime(previous.update_time);
    if (previous.update_time !== current.update_time)
      throwMockRequestError(409, "VegaBackend.Resource.UpdateConflict", "Resource has changed.");
    if (input.catalog_id !== current.catalog_id)
      throwMockRequestError(
        400,
        "VegaBackend.Resource.InvalidParameter",
        "A Resource cannot change Catalog.",
      );
  }
  const changes = apiResourceChanges(input, previous);
  const mappingChanged =
    current &&
    changes.schema &&
    transformNumberLiteralJSONRequest(outputMapping(current.schema_definition)) !==
      transformNumberLiteralJSONRequest(outputMapping(input.schema_definition));
  const requiresValidation = changes.definition || mappingChanged;
  if (requiresValidation && (!catalog.enabled || catalog.status !== "enabled"))
    throwMockRequestError(403, "VegaBackend.Resource.QueryUnavailable", "Catalog is disabled.");
  if (requiresValidation && current && !hasCatalogResourceOperation(current, "query_data"))
    throwMockRequestError(
      403,
      "VegaBackend.Resource.QueryUnavailable",
      "Query permission is required to validate changes.",
    );
  const id = current?.id ?? `res-api-${mockSlug(10)}`;
  const candidate: ApiResource = {
    ...copyDefinition(input),
    ...(!changes.definition && current ? { api_definition: current.api_definition } : {}),
    ...(!changes.schema && current ? { schema_definition: current.schema_definition } : {}),
    id,
    source_identifier: current?.source_identifier ?? id,
    category: "api",
    api_effect_type: "read",
    operations: current?.operations ?? ["view_detail", "query_data", "modify", "delete"],
    status: current?.status ?? "active",
    update_time: Math.max(Date.now(), (current?.update_time ?? 0) + 1),
  };
  const invalid = validateApiResourceInput(candidate, changes);
  if (invalid) throwMockRequestError(400, "VegaBackend.Resource.DefinitionInvalid", invalid);
  if (
    mockResources.some(
      (resource) =>
        resource.id !== candidate.id &&
        resource.catalogId === candidate.catalog_id &&
        (resource.name === candidate.name ||
          resource.sourceIdentifier === candidate.source_identifier),
    )
  )
    throwMockRequestError(
      409,
      "VegaBackend.Resource.AlreadyExists",
      "Resource name or source identifier already exists in this Catalog.",
    );
  const summary = apiResourceMockSummary(candidate);
  const index = mockResources.findIndex((resource) => resource.id === candidate.id);
  if (index < 0) mockResources.unshift(summary);
  else mockResources[index] = summary;
  mockApiDefinitions.set(
    candidate.id,
    copyDefinition({
      api_definition: candidate.api_definition,
      schema_definition: candidate.schema_definition,
    }),
  );
  emitMockChange();
  return candidate.id;
}

/** Fixed demonstration data, never an HTTP/template interpreter or a live-call fallback. */
export function queryMockApiResource(
  id: string,
  query: ApiResourceQuery,
  signal?: AbortSignal,
): ApiResourceResult {
  signal?.throwIfAborted();
  const resource = privateResource(id);
  requireQueryable(resource);
  if (Object.hasOwn(query, "filter_condition"))
    throwMockRequestError(
      400,
      "VegaBackend.Resource.UnsupportedFilter",
      "Mock API examples do not simulate caller filters.",
    );
  if (query.need_total && !apiResourceSupportsTotal(resource.api_definition))
    throwMockRequestError(
      400,
      "VegaBackend.Resource.InvalidPaging",
      "Totals require paging and a total path for every successful API response.",
    );
  const request = objectValue(resource.api_definition.request);
  const rule = apiResourcePagingRule(resource.api_definition);
  const offset = query.paging?.offset ?? 0;
  const requestedLimit = query.paging?.limit ?? 0;
  if (!rule && (offset !== 0 || requestedLimit !== 0)) {
    throwMockRequestError(
      400,
      "VegaBackend.Resource.InvalidPaging",
      "This API Resource does not support paging.",
    );
  }
  const variables = objectValue(resource.api_definition.variables);
  let rows: Record<string, unknown>[];
  if (request.path === "orders") {
    const status = objectValue(variables.order_status).value;
    rows = mockApiOrderRows.filter((row) => !status || row.status === status);
  } else if (request.path === "orders/detail") {
    const number = objectValue(variables.order_number).value;
    rows = mockApiOrderRows.filter((row) => row.order_no === number);
    if (!rows.length)
      throwMockRequestError(
        404,
        "VegaBackend.Resource.MockOrderNotFound",
        "The demonstration order was not found.",
      );
  } else {
    throwMockRequestError(
      400,
      "VegaBackend.Resource.MockUnsupportedRequest",
      "Mock calls support only the demonstration orders and orders/detail paths.",
    );
  }
  const limit = requestedLimit === 0 ? (rule ? rule.default_limit : rows.length) : requestedLimit;
  if (
    (query.paging && query.paging.mode !== "single") ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit < 0 ||
    (rule && limit === 0) ||
    (typeof rule?.max_limit === "number" && limit > rule.max_limit)
  )
    throwMockRequestError(
      400,
      "VegaBackend.Resource.InvalidPaging",
      "Mock paging requires nonnegative safe integers within the saved limit.",
    );
  if (rule?.mode === "page" && offset % limit !== 0)
    throwMockRequestError(
      400,
      "VegaBackend.Resource.InvalidPaging",
      "The offset must align with the page size.",
    );
  const page = rows.slice(offset, offset + limit);
  const entries = page.map((row) =>
    Object.fromEntries(
      resource.schema_definition.map((field) => {
        if (!Object.hasOwn(row, field.original_name))
          throwMockRequestError(
            400,
            "VegaBackend.Resource.MappingInvalid",
            "The demonstration response does not contain a mapped source field.",
          );
        return [field.name, structuredClone(row[field.original_name])];
      }),
    ),
  );
  return {
    entries,
    query_source: "mock",
    is_approximate: false,
    ...(query.need_total ? { total_count: rows.length } : {}),
    paging: { next_cursor: null, expires_at_sec: null },
  };
}
