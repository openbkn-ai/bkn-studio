/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { parsePrecisionSafeJSON } from "@/framework/request/precision-safe-json";
import {
  buildInstanceId,
  pickDisplay,
  stringifyValue,
  type Rec,
} from "@/modules/knowledge-network/lib/instance-label";
import {
  REST_PREFIX,
  restPost,
  type ContextLoaderEnv,
  type McpAuth,
} from "@/modules/knowledge-network/services/context-loader.service";

/*
 * The Context Loader calls the graph overview makes: Cypher for the instances and relations,
 * object type definitions for keys and properties, and one instance in full for the drawer.
 * These are page clicks, not agent turns, so no bkn_context is sent.
 */

export type PropertyMeta = { name: string; displayName?: string; type?: string };

export type ObjectTypeMeta = {
  id: string;
  name: string;
  primaryKeys: string[];
  properties: PropertyMeta[];
  /** Display property configured on the object type definition, when known. */
  displayKey?: string;
};

export type CypherResult = {
  columns: { name: string; type?: string }[];
  entries: Record<string, unknown>[];
};

/** A query and the values it refers to as `$p0`, `$p1`, …, as run_cypher takes them. */
export type CypherQuery = { query: string; parameters: Record<string, unknown> };

/** run_cypher's ceiling on LIMIT. */
export const MAX_CYPHER_LIMIT = 10000;

/** One instance as the drawer shows it. */
export type OverviewInstance = {
  id: string;
  otId: string;
  otName: string;
  identity: Rec;
  display: string;
  props: Rec;
};

/**
 * Backtick-quotes an identifier. Real object type ids carry `-` (`01a08f67-…`,
 * `crm-management-rules`), so every label, relation type, property and alias is quoted.
 */
export function quoteIdentifier(id: string): string {
  if (!id || id.includes("`")) throw new Error(`identifier ${id} cannot be quoted`);
  return `\`${id}\``;
}

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Posts to one Context Loader capability route and returns its JSON object. */
async function postCapability(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  tool: string,
  query: Record<string, string>,
  body: Rec,
  signal?: AbortSignal,
): Promise<Rec> {
  const base = env.base.replace(/\/+$/, "");
  const params = new URLSearchParams({ ...query, response_format: "json" });
  const response = await restPost(
    env,
    auth,
    `${base}${REST_PREFIX}/kn/${tool}?${params.toString()}`,
    body,
    signal,
  );
  const text = await response.text();
  if (!response.ok) throw new Error(text || `${tool} failed (${response.status})`);
  let payload: unknown;
  try {
    payload = parsePrecisionSafeJSON(text);
  } catch {
    throw new Error(`${tool} did not return JSON`);
  }
  if (!isRecord(payload)) throw new Error(`${tool} did not return an object`);
  // Some routes wrap the business payload under `data`.
  if (
    isRecord(payload.data) &&
    !("nodes" in payload) &&
    !("datas" in payload) &&
    !("objects" in payload)
  ) {
    return payload.data;
  }
  return payload;
}

/** Normalises one get_object_types entry into what the overview needs. */
export function objectTypeMetaFrom(raw: unknown): ObjectTypeMeta | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const primaryKeys = Array.isArray(raw.primary_keys)
    ? raw.primary_keys.filter((item): item is string => typeof item === "string" && item !== "")
    : [];
  const properties: PropertyMeta[] = Array.isArray(raw.data_properties)
    ? raw.data_properties
        .filter((item): item is Rec => isRecord(item) && typeof item.name === "string")
        .map((item) => ({
          name: item.name as string,
          displayName: typeof item.display_name === "string" ? item.display_name : undefined,
          type: typeof item.type === "string" ? item.type : undefined,
        }))
    : [];
  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name ? raw.name : raw.id,
    primaryKeys,
    properties,
  };
}

export type OverviewClient = {
  runCypher(
    query: string,
    signal?: AbortSignal,
    parameters?: Record<string, unknown>,
  ): Promise<CypherResult>;
  loadObjectTypes(ids: string[]): Promise<ObjectTypeMeta[]>;
  /** The instance with this identity in full, or null when none matches. */
  fetchInstance(
    meta: ObjectTypeMeta,
    identity: Rec,
    labelKey?: string,
  ): Promise<OverviewInstance | null>;
};

export function createOverviewClient(env: ContextLoaderEnv, auth?: McpAuth): OverviewClient {
  const knId = env.knId;
  return {
    async runCypher(query, signal, parameters) {
      const body: Rec = { kn_id: knId, query };
      if (parameters && Object.keys(parameters).length > 0) body.parameters = parameters;
      const payload = await postCapability(env, auth, "run_cypher", {}, body, signal);
      const columns = Array.isArray(payload.columns)
        ? payload.columns.filter(isRecord).map((column) => ({
            name: stringifyValue(column.name),
            type: typeof column.type === "string" ? column.type : undefined,
          }))
        : [];
      return {
        columns,
        entries: Array.isArray(payload.entries) ? payload.entries.filter(isRecord) : [],
      };
    },
    async loadObjectTypes(ids) {
      if (ids.length === 0) return [];
      const payload = await postCapability(env, auth, "get_object_types", {}, { kn_id: knId, ids });
      const list = Array.isArray(payload.object_types) ? payload.object_types : [];
      return list.map(objectTypeMetaFrom).filter((meta): meta is ObjectTypeMeta => meta !== null);
    },
    async fetchInstance(meta, identity, labelKey) {
      const leaves = meta.primaryKeys.map((field) => ({
        field,
        operation: "==",
        value: identity[field],
      }));
      if (leaves.length === 0 || leaves.some((leaf) => leaf.value === undefined)) return null;
      const condition =
        leaves.length === 1 ? leaves[0] : { operation: "and", sub_conditions: leaves };
      const payload = await postCapability(
        env,
        auth,
        "query_object_instance",
        { kn_id: knId, ot_id: meta.id },
        { condition, limit: 1 },
      );
      const rows = Array.isArray(payload.datas) ? payload.datas.filter(isRecord) : [];
      const row = rows[0];
      if (!row) return null;
      const id = buildInstanceId(meta.id, meta.primaryKeys, identity);
      if (!id) return null;
      const props: Rec = { ...row };
      delete props._score;
      return {
        id,
        otId: meta.id,
        otName: meta.name,
        identity,
        display: pickDisplay(props, id, labelKey, meta.name),
        props,
      };
    },
  };
}

/**
 * Turns a backend error into one readable sentence. Context Loader wraps a downstream
 * failure as JSON whose `details` string embeds the downstream JSON, which may embed yet
 * another one (ontology-query → bkn-backend / vega). Every layer is unwrapped and the
 * innermost description — the actual cause — leads the message.
 */
export function friendlyError(error: unknown): string {
  const text = (error instanceof Error ? error.message : String(error)).trim();
  const outer = parseErrorEnvelope(text);
  if (!outer) return text;
  let deepest = outer;
  for (let depth = 0; depth < 6; depth += 1) {
    const next =
      parseErrorEnvelope(deepest.details) ?? parseErrorEnvelope(lastJsonObject(deepest.details));
    if (!next || (!next.description && !next.details)) break;
    deepest = next;
  }
  const head = outer.description || outer.details || text;
  const cause = deepest === outer ? "" : deepest.description || deepest.details;
  if (cause && cause !== head) return `${head}：${cause}`;
  if (!cause && outer.details && outer.details !== head) {
    const tail = outer.details.length > 160 ? `…${outer.details.slice(-160)}` : outer.details;
    return `${head}：${tail}`;
  }
  return head;
}

type ErrorEnvelope = { description: string; details: string };

function parseErrorEnvelope(text: string): ErrorEnvelope | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: unknown = tryParseJson(trimmed);
  // A downstream envelope embedded as a string arrives with escaped quotes ({\"error_code\":…});
  // unescape one level and try again before giving up.
  if (parsed === undefined && trimmed.includes('\\"'))
    parsed = tryParseJson(trimmed.replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
  if (!isRecord(parsed)) return null;
  const body = isRecord(parsed.error) ? parsed.error : parsed;
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };
  const code = pick("error_code", "code");
  const rawDetails = body.error_details ?? body.details;
  const details =
    typeof rawDetails === "string"
      ? rawDetails.trim()
      : rawDetails !== null && typeof rawDetails === "object"
        ? JSON.stringify(rawDetails)
        : typeof rawDetails === "number" || typeof rawDetails === "boolean"
          ? String(rawDetails)
          : "";
  return {
    description: pick("error_code")
      ? pick("description") || code
      : pick("description", "message") || code,
    details,
  };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The last `{…}` block inside a string, for details that read `… error: {"error_code": …}`. */
function lastJsonObject(text: string): string {
  const start = text.lastIndexOf("{");
  if (start < 0) return "";
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return "";
}
