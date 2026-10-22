/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import { parsePrecisionSafeJSON } from "@/framework/request/precision-safe-json";
import { cypherPlanFrom } from "@/modules/knowledge-network/cypher/cypher-plan";
import type { CypherResult } from "@/modules/knowledge-network/cypher/graph-values";
import type {
  BackendListResponse,
  BackendObjectType,
} from "@/modules/knowledge-network/services/mappers/backend-types";
import {
  REST_PREFIX,
  restPost,
  type ContextLoaderEnv,
  type McpAuth,
} from "@/modules/knowledge-network/services/context-loader.service";

export const RUN_CYPHER_PATH = `${REST_PREFIX}/kn/run_cypher`;

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One call as sent and received, for the frame's raw view. */
export type CypherExchange = {
  url: string;
  request: Rec;
  status: number;
  latencyMs: number;
  /** Parsed JSON when the body was JSON, else the text. */
  response: unknown;
};

export type CypherRun =
  | { ok: true; result: CypherResult; exchange: CypherExchange }
  | { ok: false; error: CypherRunError; exchange: CypherExchange };

/** The backend's refusal as it gave it: code, message and how to fix the query. */
export type CypherRunError = { message: string; code?: string; solution?: string };

/** Reads run_cypher's body into a result. */
export function cypherResultFrom(payload: unknown): CypherResult | null {
  if (!isRec(payload)) return null;
  // Some routes wrap the business payload under `data`.
  const body = isRec(payload.data) && !("entries" in payload) ? payload.data : payload;
  if (!Array.isArray(body.entries) && !Array.isArray(body.columns)) return null;
  const columns = Array.isArray(body.columns)
    ? body.columns.filter(isRec).map((column) => ({
        name: typeof column.name === "string" ? column.name : String(column.name),
        ...(typeof column.type === "string" ? { type: column.type } : {}),
      }))
    : [];
  const execution = isRec(body.execution) ? body.execution : undefined;
  const plan = cypherPlanFrom(body.plan);
  return {
    columns,
    entries: Array.isArray(body.entries) ? body.entries.filter(isRec) : [],
    ...(isRec(body.value_types) ? { valueTypes: body.value_types } : {}),
    ...(plan ? { plan } : {}),
    ...(execution
      ? {
          execution: {
            ...(typeof execution.match_rows === "number"
              ? { match_rows: execution.match_rows }
              : {}),
            ...(typeof execution.match_complete === "boolean"
              ? { match_complete: execution.match_complete }
              : {}),
            ...(typeof execution.conclusions_limited === "boolean"
              ? { conclusions_limited: execution.conclusions_limited }
              : {}),
          },
        }
      : {}),
  };
}

/** The backend's error envelope, whichever field names it uses. */
export function cypherErrorFrom(payload: unknown, status: number, text: string): CypherRunError {
  if (isRec(payload)) {
    const pick = (...names: string[]) => {
      for (const name of names) {
        const value = payload[name];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return undefined;
    };
    const message = pick("description", "message", "error");
    // bkn-backend puts the parser's own words, with the fix, in `details`.
    const nested = [payload.details, payload.error_details].find(isRec);
    const detailText =
      pick("details", "error_details", "detail") ??
      (nested && typeof nested.message === "string" ? nested.message : undefined);
    return {
      message: [message, detailText].filter(Boolean).join(": ") || text || `HTTP ${status}`,
      ...(pick("error_code", "code") ? { code: pick("error_code", "code") } : {}),
      ...(pick("solution", "hint") ? { solution: pick("solution", "hint") } : {}),
    };
  }
  return { message: text || `HTTP ${status}` };
}

/**
 * The display property of each given object type, keyed by id ("" when it has none). Only the
 * bkn-backend definition carries it: neither Context Loader nor the list returns it. One call
 * reads them all, and an unknown id fails the whole call, so pass ids from the network's schema.
 * Failures leave nodes named by their keys, so no toast.
 */
export async function getObjectTypeDisplayKeys(
  networkId: string,
  objectTypeIds: readonly string[],
): Promise<Record<string, string>> {
  if (objectTypeIds.length === 0) return {};
  const response = await http.get<BackendListResponse<BackendObjectType>>(
    `/bkn-backend/v1/knowledge-networks/${encodeURIComponent(networkId)}/object-types/${objectTypeIds.map(encodeURIComponent).join(",")}`,
    { skipErrorToast: true },
  );
  const keys: Record<string, string> = Object.fromEntries(objectTypeIds.map((id) => [id, ""]));
  for (const entry of response.data.entries ?? []) {
    if (entry.id) keys[entry.id] = entry.display_key ?? "";
  }
  return keys;
}

export type ObjectTypeProperty = { name: string; displayName?: string; type?: string };

/**
 * The properties of the given object types, keyed by id, through Context Loader's
 * get_object_types (get_kn_detail lists the types without them).
 */
export async function getObjectTypeProperties(params: {
  env: ContextLoaderEnv;
  auth?: McpAuth;
  objectTypeIds: readonly string[];
  signal?: AbortSignal;
}): Promise<Record<string, ObjectTypeProperty[]>> {
  if (params.objectTypeIds.length === 0) return {};
  const base = params.env.base.replace(/\/+$/, "");
  const response = await restPost(
    params.env,
    params.auth,
    `${base}${REST_PREFIX}/kn/get_object_types?response_format=json`,
    { kn_id: params.env.knId, ids: params.objectTypeIds },
    params.signal,
  );
  const text = await response.text();
  if (!response.ok) throw new Error(text || `get_object_types failed (${response.status})`);
  const payload: unknown = parsePrecisionSafeJSON(text);
  const body = isRec(payload) && isRec(payload.data) ? payload.data : payload;
  const list = isRec(body) && Array.isArray(body.object_types) ? body.object_types : [];
  const properties: Record<string, ObjectTypeProperty[]> = {};
  for (const item of list) {
    if (!isRec(item) || typeof item.id !== "string") continue;
    properties[item.id] = (Array.isArray(item.data_properties) ? item.data_properties : [])
      .filter(isRec)
      .filter((property) => typeof property.name === "string")
      .map((property) => ({
        name: property.name as string,
        ...(typeof property.display_name === "string" && property.display_name
          ? { displayName: property.display_name }
          : {}),
        ...(typeof property.type === "string" ? { type: property.type } : {}),
      }));
  }
  return properties;
}

/** Whether the backend refused only because of the object_properties the page added. */
function refusedObjectProperties(error: CypherRunError): boolean {
  return /object_properties/i.test(error.message);
}

async function post(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  body: Rec,
  signal?: AbortSignal,
): Promise<CypherRun> {
  const base = env.base.replace(/\/+$/, "");
  const url = `${base}${RUN_CYPHER_PATH}?response_format=json`;
  const started = performance.now();
  const response = await restPost(env, auth, url, body, signal);
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = parsePrecisionSafeJSON(text);
  } catch {
    // Not JSON; the text is the answer.
  }
  const exchange: CypherExchange = {
    url: `${RUN_CYPHER_PATH}?response_format=json`,
    request: body,
    status: response.status,
    latencyMs: Math.round(performance.now() - started),
    response: payload,
  };
  if (!response.ok) {
    return { ok: false, error: cypherErrorFrom(payload, response.status, text), exchange };
  }
  const result = cypherResultFrom(payload);
  if (!result)
    return { ok: false, error: { message: text || "run_cypher returned no result" }, exchange };
  return { ok: true, result, exchange };
}

/**
 * Runs one query as written. `objectProperties` asks returned nodes to carry their display
 * property; the page guesses the returned node variables from the text, so when the backend
 * refuses them the query runs again without. `explain` returns the plan in place of rows.
 */
export async function runCypherQuery(params: {
  env: ContextLoaderEnv;
  auth?: McpAuth;
  query: string;
  objectProperties?: Record<string, string[]>;
  /** Check and plan the query without reading any data. */
  explain?: boolean;
  signal?: AbortSignal;
}): Promise<CypherRun> {
  const body: Rec = {
    kn_id: params.env.knId,
    query: params.query,
    ...(params.explain ? { explain: true } : {}),
  };
  // A plan returns no nodes, so there is nothing to name.
  const extra = params.explain ? {} : (params.objectProperties ?? {});
  if (Object.keys(extra).length === 0) return post(params.env, params.auth, body, params.signal);
  const first = await post(
    params.env,
    params.auth,
    { ...body, object_properties: extra },
    params.signal,
  );
  if (first.ok || !refusedObjectProperties(first.error)) return first;
  return post(params.env, params.auth, body, params.signal);
}
