/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { transformNumberLiteralJSONRequest } from "@/framework/request/precision-safe-json";
import { validateApiLoginDefinition } from "@/shared/api-definition";
import { isDefinitionObject, objectValue } from "@/shared/api-definition/model";
import BigNumber from "bignumber.js";
import type { CatalogResource } from "../types/data-catalog";
import { formatDateTimeYmdHms } from "@/framework/i18n/format";
import type { ApiResource, ApiResourceInput } from "../types/api-resource";

export function createApiResourceInput(catalogId: string): ApiResourceInput {
  return {
    catalog_id: catalogId,
    name: "",
    description: "",
    tags: [],
    enabled: true,
    schema_definition: [],
    api_definition: {
      request: { method: "GET", path: "", headers: {} },
      response: {
        content_type: "application/json",
        statuses: {
          "200": {
            description: "Response",
            schema: { type: "array", items: { type: "object", properties: {} } },
            result_rows: "",
          },
        },
      },
      success_rule: { http_status: [200] },
    },
  };
}

function outputMapping(fields: ApiResourceInput["schema_definition"]) {
  return fields.map(({ name, original_name, type, attributes, filterable }) => ({
    name,
    original_name,
    type,
    attributes,
    filterable,
  }));
}

export function apiResourceChanges(input: ApiResourceInput, saved?: ApiResource) {
  if (!saved) return { definition: true, schema: true, requiresValidation: true };

  const definition =
    transformNumberLiteralJSONRequest(input.api_definition) !==
    transformNumberLiteralJSONRequest(saved.api_definition);
  const schema =
    transformNumberLiteralJSONRequest(input.schema_definition) !==
    transformNumberLiteralJSONRequest(saved.schema_definition);
  // Display names and descriptions are saved with the schema but do not affect invocation.
  const requiresValidation =
    definition ||
    (schema &&
      transformNumberLiteralJSONRequest(outputMapping(input.schema_definition)) !==
        transformNumberLiteralJSONRequest(outputMapping(saved.schema_definition)));
  return { definition, schema, requiresValidation };
}

export function apiResourcePagingRule(
  definition: ApiResourceInput["api_definition"],
): (Record<string, unknown> & { mode: "offset" | "page" }) | undefined {
  const rule = objectValue(definition.paging_rule);
  const { mode } = rule;
  return mode === "offset" || mode === "page" ? { ...rule, mode } : undefined;
}

export function apiResourceSupportsTotal(definition: ApiResourceInput["api_definition"]): boolean {
  if (!apiResourcePagingRule(definition)) return false;

  const successStatuses = objectValue(definition.success_rule).http_status;
  if (!Array.isArray(successStatuses) || successStatuses.length === 0) return false;

  const responses = objectValue(objectValue(definition.response).statuses);
  return successStatuses.every((status: unknown) => {
    if (typeof status !== "number" || !Number.isInteger(status) || status < 100 || status > 599)
      return false;

    // Match the server's exact, class, and default precedence, including explicitly empty entries.
    const exact = String(status);
    const statusClass = `${Math.floor(status / 100)}XX`;
    let response = responses.default;
    if (Object.hasOwn(responses, exact)) response = responses[exact];
    else if (Object.hasOwn(responses, statusClass)) response = responses[statusClass];

    const { schema, result_total: totalPath } = objectValue(response);
    return (schema === true || isDefinitionObject(schema)) && typeof totalPath === "string";
  });
}

export function validateApiResourceInput(
  input: ApiResourceInput,
  changes: Pick<ReturnType<typeof apiResourceChanges>, "definition" | "schema"> = {
    definition: true,
    schema: true,
  },
): string | undefined {
  if (!input.name.trim()) return "dataCatalog.apiResource.errors.metadata";
  if (changes.schema) {
    const error = validateApiResourceSchema(input.schema_definition);
    if (error) return error;
  }
  if (!changes.definition) return;
  for (const [name, variable] of Object.entries(objectValue(input.api_definition.variables))) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
      !isDefinitionObject(variable) ||
      variable.value == null ||
      (variable.sensitive != null && typeof variable.sensitive !== "boolean") ||
      (variable.sensitive === true && typeof variable.value !== "string")
    )
      return "dataCatalog.apiResource.errors.variables";
  }
  return validateApiLoginDefinition(input.api_definition);
}

function validateApiResourceSchema(fields: ApiResourceInput["schema_definition"]) {
  if (
    !fields.length ||
    new Set(fields.map((f) => f.name)).size !== fields.length ||
    fields.some(
      (f) => !f.name.trim() || !f.display_name?.trim() || !f.original_name.trim() || !f.type,
    )
  )
    return "dataCatalog.apiResource.errors.mapping";
  for (const field of fields) {
    if (field.type !== "decimal") continue;
    const precision = field.attributes?.precision;
    const scale = field.attributes?.scale;
    const p = new BigNumber(String(precision));
    const s = new BigNumber(String(scale));
    if (
      (typeof precision !== "number" && !BigNumber.isBigNumber(precision)) ||
      (typeof scale !== "number" && !BigNumber.isBigNumber(scale)) ||
      !p.isInteger() ||
      !s.isInteger() ||
      !p.isPositive() ||
      p.isZero() ||
      p.isGreaterThan("9223372036854775807") ||
      s.isLessThan("-9223372036854775808") ||
      s.isGreaterThan("9223372036854775807")
    )
      return "dataCatalog.apiResource.errors.decimal";
  }
}

/** Adapt API detail fields for the common Resource detail and preview components. */
export function apiResourceView(resource: ApiResource): CatalogResource {
  return {
    id: resource.id,
    catalogId: resource.catalog_id,
    name: resource.name,
    category: "api",
    sourceIdentifier: resource.source_identifier,
    description: resource.description,
    tags: [...resource.tags],
    status: resource.status as CatalogResource["status"],
    enabled: resource.enabled,
    operations: [...resource.operations],
    localIndexStatus: "unavailable",
    schema: resource.schema_definition.map((field) => ({
      name: field.name,
      originalName: field.original_name,
      displayName: field.display_name ?? field.name,
      description: field.description ?? "",
      originalType: typeof field.original_type === "string" ? field.original_type : undefined,
      originalDescription:
        typeof field.original_description === "string" ? field.original_description : undefined,
      type: field.type,
      attributes: field.attributes,
      filterable: field.filterable,
      raw: field,
    })),
    columnCount: resource.schema_definition.length,
    rowCount: null,
    creatorName: resource.creator?.name ?? resource.creator?.id,
    updaterName: resource.updater?.name ?? resource.updater?.id,
    createTime: resource.create_time ? formatDateTimeYmdHms(resource.create_time) : undefined,
    expectedUpdateTime: resource.update_time,
    updateTime: formatDateTimeYmdHms(resource.update_time),
  };
}
