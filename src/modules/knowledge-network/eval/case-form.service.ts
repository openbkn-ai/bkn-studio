/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type { EvalCaseResource } from "./m0-run.service";
import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
  transformPrecisionSafeJSONResponse,
} from "@/framework/request/precision-safe-json";

export type CaseFormOptions = { version: number; predicates: string[] };
export type CaseSchema = Record<string, unknown>;
export type RelationEndpoint = {
  id: string;
  name: string;
  primary_keys: string[];
  data_properties: { name: string; type: string; display_name?: string }[];
};
export type RelationCheckInput = {
  rule: string;
  end?: string;
  limit?: number;
  source?: Record<string, unknown>;
  target?: Record<string, unknown>;
  via?: Record<string, unknown>;
  characteristic?: string;
  property?: string;
};
export type RelationCheckForm = {
  type: string;
  source: RelationEndpoint;
  target: RelationEndpoint;
  cardinality?: string;
  required: string[];
  characteristics: string[];
  properties: { name: string; type: string }[];
  checks: { id: string; title: string; applicable: boolean; reason?: string }[];
};
export type CaseTargetSchema = {
  rule_based?: boolean;
  relation?: RelationCheckForm;
  runner?: "direct_capability" | "resource_query";
  input?: CaseSchema;
  output?: CaseSchema;
  available?: boolean;
  reason?: string;
  help?: string;
  object_type_id?: string;
  metric_version?: number;
  metric_time_available?: boolean;
  metric_dimensions?: {
    object_type_id: string;
    property_name: string;
    relation_path_alias?: string;
  }[];
  system_arguments?: Record<string, unknown>;
};

export async function getCaseFormOptions(networkId: string): Promise<CaseFormOptions> {
  const response = await http.get<CaseFormOptions>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/case-form`,
    { skipErrorToast: true },
  );
  return response.data;
}

// The server resolves the selected resource and its current, authorized source
// contract. Credentials, source defaults and expected answers are not returned.
export async function getCaseTargetSchema(
  resource: EvalCaseResource,
  networkId: string,
): Promise<CaseTargetSchema> {
  const response = await http.get<{ target: CaseTargetSchema }>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/evals/case-form`,
    { params: { resource_kind: resource.kind, resource_id: resource.id }, skipErrorToast: true },
  );
  return response.data.target;
}

export async function listCaseActionInstances(
  networkId: string,
  objectTypeId: string,
  cursor?: string,
) {
  const response = await http.post<{
    datas?: Record<string, unknown>[];
    cursor?: string;
  }>(
    "/agent-retrieval/v1/kn/query_object_instance",
    { limit: 20, need_total: false, properties: [], ...(cursor ? { cursor } : {}) },
    {
      params: { kn_id: networkId, ot_id: objectTypeId, response_format: "json" },
      skipErrorToast: true,
      transformResponse: transformPrecisionSafeJSONResponse,
    },
  );
  return { rows: response.data.datas ?? [], nextCursor: response.data.cursor };
}

// Relation pickers search the authorized object query, not just the first page.
export async function listRelationCheckInstances(
  networkId: string,
  endpoint: RelationEndpoint,
  query = "",
  cursor?: string,
) {
  const needle = query.trim();
  const conditions: Record<string, unknown>[] = [];
  if (needle) {
    let identity: Record<string, unknown> | undefined;
    try {
      const parsed = parsePrecisionPreservingJSON(needle);
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        endpoint.primary_keys.every((key) => Object.hasOwn(parsed, key))
      )
        identity = parsed as Record<string, unknown>;
    } catch {
      /* ordinary text search */
    }
    if (identity)
      for (const key of endpoint.primary_keys)
        conditions.push({ field: key, operation: "==", value_from: "const", value: identity[key] });
    else {
      const textual = endpoint.data_properties.filter((p) =>
        ["string", "keyword", "text", "varchar", "char"].includes(p.type),
      );
      const preferred = textual
        .filter((p) => endpoint.primary_keys.includes(p.name) || /name|title|code/.test(p.name))
        .slice(0, 6);
      for (const p of preferred.length ? preferred : textual.slice(0, 3))
        conditions.push({
          field: p.name,
          operation: "like",
          value_from: "const",
          value: `%${needle.replace(/[%_\\]/g, (char) => "\\" + char)}%`,
        });
      if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(needle))
        for (const key of endpoint.primary_keys) {
          const property = endpoint.data_properties.find((p) => p.name === key);
          if (property && !textual.includes(property))
            conditions.push({
              field: key,
              operation: "==",
              value_from: "const",
              value: parsePrecisionPreservingJSON(needle),
            });
        }
    }
    if (!conditions.length) return { rows: [] as Record<string, unknown>[], nextCursor: undefined };
    const response = await http.post<{ datas?: Record<string, unknown>[]; cursor?: string }>(
      "/agent-retrieval/v1/kn/query_object_instance",
      {
        limit: 20,
        need_total: false,
        properties: [],
        condition: { operation: identity ? "and" : "or", sub_conditions: conditions },
        ...(cursor ? { cursor } : {}),
      },
      {
        params: { kn_id: networkId, ot_id: endpoint.id, response_format: "json" },
        skipErrorToast: true,
        transformRequest: transformPrecisionSafeJSONRequest,
        transformResponse: transformPrecisionSafeJSONResponse,
      },
    );
    return { rows: response.data.datas ?? [], nextCursor: response.data.cursor };
  }
  return listCaseActionInstances(networkId, endpoint.id, cursor);
}
