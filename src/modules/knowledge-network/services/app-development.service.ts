/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

/** Reads behind the workspace "App development" page. All of them are read-only. */

import { http } from "@/framework/request/http";
import { parsePrecisionSafeJSON } from "@/framework/request/precision-safe-json";
import { REST_KN_PREFIX } from "@/modules/knowledge-network/services/app-development-examples";
import type { OAuthEndpoints } from "@/modules/knowledge-network/services/app-development-render";
import {
  restPost,
  type ContextLoaderEnv,
  type McpAuth,
} from "@/modules/knowledge-network/services/context-loader.service";

/** The platform version the TypeScript SDK checks itself against. */
export async function fetchPlatformVersion(): Promise<string | null> {
  const response = await http.get<{ ServerVersion?: unknown }>("/bkn-backend/v1/health", {
    skipErrorToast: true,
  });
  const version = response.data?.ServerVersion;
  return typeof version === "string" && version ? version : null;
}

async function postKnTool(
  env: ContextLoaderEnv,
  auth: McpAuth | undefined,
  tool: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const base = env.base.replace(/\/+$/, "");
  const response = await restPost(
    env,
    auth,
    `${base}${REST_KN_PREFIX}/${tool}?response_format=json`,
    body,
    signal,
  );
  const text = await response.text();
  if (!response.ok) throw new Error(text || `${tool} failed (${response.status})`);
  return parsePrecisionSafeJSON(text);
}

export type MountedFunction = {
  toolboxId: string;
  toolId: string;
  name: string;
  inputSchema: unknown;
};

/** The first function mounted on the network, with the input schema the call is filled from. */
export async function fetchFirstMountedFunction(
  env: ContextLoaderEnv,
  auth?: McpAuth,
  signal?: AbortSignal,
): Promise<MountedFunction | null> {
  const payload = (await postKnTool(
    env,
    auth,
    "search_capabilities",
    { kn_id: env.knId, types: ["function"], limit: 1 },
    signal,
  )) as { capabilities?: Array<Record<string, unknown>> } | null;
  const first = payload?.capabilities?.find(
    (item) =>
      item.capability_type === "function" &&
      typeof item.owner_id === "string" &&
      typeof item.capability_id === "string",
  );
  if (!first) return null;
  return {
    toolboxId: first.owner_id as string,
    toolId: first.capability_id as string,
    name: typeof first.name === "string" ? first.name : (first.capability_id as string),
    inputSchema: first.input_schema,
  };
}

export type SearchHit = { objectTypeName: string; display: string };

/** Runs one semantic search for the page's try-it box. */
export async function trySearchInstances(
  env: ContextLoaderEnv,
  query: string,
  auth?: McpAuth,
  signal?: AbortSignal,
): Promise<{ hits: SearchHit[]; message?: string }> {
  const payload = (await postKnTool(
    env,
    auth,
    "search_instance",
    { kn_id: env.knId, query },
    signal,
  )) as { nodes?: Array<Record<string, unknown>>; message?: unknown } | null;
  const hits = (payload?.nodes ?? []).map((node) => {
    const properties = (node.properties ?? {}) as Record<string, unknown>;
    const display = properties._display ?? node._display ?? node.display;
    const typeName = node.object_type_name ?? node.object_type_id;
    return {
      objectTypeName: typeof typeName === "string" ? typeName : "",
      display: typeof display === "string" || typeof display === "number" ? String(display) : "",
    };
  });
  return {
    hits,
    message: typeof payload?.message === "string" ? payload.message : undefined,
  };
}

/**
 * The platform's OAuth endpoints from its public metadata (RFC 8414). `device` and `registration`
 * are present only where the deployment publishes them. Null when the metadata is missing; the
 * page then shows no sign-in examples rather than guessed endpoints.
 */
export async function fetchOAuthEndpoints(signal?: AbortSignal): Promise<OAuthEndpoints | null> {
  const response = await fetch(`${window.location.origin}/.well-known/oauth-authorization-server`, {
    signal,
  });
  if (!response.ok) return null;
  const metadata = (await response.json()) as Record<string, unknown>;
  const text = (name: string) => {
    const value = metadata[name];
    return typeof value === "string" && value ? value : undefined;
  };
  const authorization = text("authorization_endpoint");
  const token = text("token_endpoint");
  if (!authorization || !token) return null;
  return {
    authorization,
    token,
    device: text("device_authorization_endpoint"),
    registration: text("registration_endpoint"),
  };
}

export type CypherResult = { columns: string[]; rows: string[][]; truncated: boolean };

/** One cell as text: a returned node shows its key, any other value its JSON. */
function cypherCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const node = value as { kind?: unknown; key?: Record<string, { value?: unknown } | undefined> };
  if (node.kind === "object" && node.key && typeof node.key === "object") {
    return Object.entries(node.key)
      .map(([name, item]) => `${name}=${cypherCell(item?.value)}`)
      .join(", ");
  }
  return JSON.stringify(value);
}

/** The run_cypher payload as a table, at most `limit` rows. */
export function cypherTable(payload: unknown, limit = 20): CypherResult {
  const record = (payload ?? {}) as { columns?: unknown; entries?: unknown };
  const columns = Array.isArray(record.columns)
    ? record.columns.map((column) =>
        typeof column === "object" && column !== null && "name" in column
          ? String((column as { name: unknown }).name)
          : String(column),
      )
    : [];
  const entries = Array.isArray(record.entries)
    ? (record.entries as Record<string, unknown>[])
    : [];
  return {
    columns,
    rows: entries
      .slice(0, limit)
      .map((entry) => columns.map((column) => cypherCell(entry[column]))),
    truncated: entries.length > limit,
  };
}

/** Runs one read-only statement for the page's try-it box. */
export async function tryRunCypher(
  env: ContextLoaderEnv,
  query: string,
  parameters: Record<string, unknown> | undefined,
  auth?: McpAuth,
  signal?: AbortSignal,
): Promise<CypherResult> {
  const payload = await postKnTool(
    env,
    auth,
    "run_cypher",
    { kn_id: env.knId, query, ...(parameters ? { parameters } : {}) },
    signal,
  );
  return cypherTable(payload);
}

export type RegisteredClient = { clientId: string; clientName: string; redirectUris: string[] };

/**
 * Registers a public OAuth client (RFC 7591). The endpoint needs no sign-in; the platform admits
 * only authorization-code clients with PKCE and the callbacks it allows.
 */
export async function registerOAuthClient(
  endpoint: string,
  clientName: string,
  redirectUri: string,
): Promise<RegisteredClient> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: clientName, redirect_uris: [redirectUri] }),
  });
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || typeof payload?.client_id !== "string") {
    const reason =
      payload?.error_description ?? payload?.error ?? `HTTP ${String(response.status)}`;
    throw new Error(typeof reason === "string" ? reason : JSON.stringify(reason));
  }
  return {
    clientId: payload.client_id,
    clientName: typeof payload.client_name === "string" ? payload.client_name : clientName,
    redirectUris: Array.isArray(payload.redirect_uris)
      ? payload.redirect_uris.filter((uri): uri is string => typeof uri === "string")
      : [redirectUri],
  };
}
