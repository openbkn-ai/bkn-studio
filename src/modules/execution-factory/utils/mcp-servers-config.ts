/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { McpMode } from "@/modules/execution-factory/types/mcp";
import { CAPABILITY_NAME_PATTERN } from "@/modules/execution-factory/utils/capability-name";
import { isSensitiveName, MASKED_VALUE } from "@/modules/execution-factory/utils/debug-secrets";

/**
 * Parses the `mcpServers` JSON that MCP providers hand out (Claude Desktop / Cursor / Claude Code
 * style) into register-ready entries. Only remote HTTP transports are supported: the backend
 * connects to the URL itself, and there is no host to run `command`/`args` stdio servers on, so
 * those entries are rejected instead of being registered as something that can never connect.
 */

export type McpServersConfigError = "invalid_json" | "missing_mcp_servers" | "empty";

/** Issues that block an entry from being registered. */
export type McpServerEntryError =
  | "not_object"
  | "stdio_unsupported"
  | "unknown_type"
  | "missing_url"
  | "invalid_url"
  | "invalid_headers"
  | "duplicate_name";

/** Issues the user should see but that do not block registration. */
export type McpServerEntryWarning = "type_missing" | "name_adjusted" | "fields_ignored";

export type McpServerConfigEntry = {
  /** The key under `mcpServers`, as written by the provider. */
  key: string;
  /** Default registration name: the key, adjusted to the platform naming rule when needed. */
  name: string;
  mode: McpMode;
  url: string;
  headers: Record<string, string>;
  /** The raw `type` value, kept for error messages. */
  type?: string;
  ignoredFields: string[];
  errors: McpServerEntryError[];
  warnings: McpServerEntryWarning[];
};

export type McpServersConfigParseResult =
  { ok: true; entries: McpServerConfigEntry[] } | { ok: false; error: McpServersConfigError };

const TRANSPORT_TYPES: Record<string, McpMode> = {
  http: "stream",
  streamable_http: "stream",
  "streamable-http": "stream",
  streamablehttp: "stream",
  sse: "sse",
};

const KNOWN_FIELDS = new Set(["type", "transport", "url", "headers"]);
const STDIO_FIELDS = ["command", "args"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Maps a provider key onto the platform naming rule, e.g. `Bazi-MCP` becomes `Bazi_MCP`. */
export function toCapabilityName(key: string) {
  const name = key
    .trim()
    .replace(/[^一-龥A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return name || "mcp_server";
}

function parseEntry(key: string, raw: unknown): McpServerConfigEntry {
  const entry: McpServerConfigEntry = {
    key,
    name: CAPABILITY_NAME_PATTERN.test(key) ? key : toCapabilityName(key),
    mode: "stream",
    url: "",
    headers: {},
    ignoredFields: [],
    errors: [],
    warnings: [],
  };

  if (entry.name !== key) {
    entry.warnings.push("name_adjusted");
  }

  if (!isPlainObject(raw)) {
    entry.errors.push("not_object");
    return entry;
  }

  if (STDIO_FIELDS.some((field) => field in raw)) {
    entry.errors.push("stdio_unsupported");
    return entry;
  }

  const rawType = raw.type ?? raw.transport;

  if (rawType === undefined) {
    // Several clients infer the transport from the URL. Default to Streamable HTTP; the connection
    // test retries SSE when the handshake fails, so a wrong guess is corrected before registering.
    entry.warnings.push("type_missing");
  } else {
    entry.type = typeof rawType === "string" ? rawType : JSON.stringify(rawType);
    const mode = TRANSPORT_TYPES[entry.type.trim().toLowerCase()];

    if (mode) {
      entry.mode = mode;
    } else {
      entry.errors.push("unknown_type");
    }
  }

  if (typeof raw.url !== "string" || raw.url.trim() === "") {
    entry.errors.push("missing_url");
  } else {
    entry.url = raw.url.trim();

    if (!isHttpUrl(entry.url)) {
      entry.errors.push("invalid_url");
    }
  }

  if (raw.headers !== undefined) {
    if (
      isPlainObject(raw.headers) &&
      Object.values(raw.headers).every((value) => typeof value === "string")
    ) {
      entry.headers = { ...(raw.headers as Record<string, string>) };
    } else {
      entry.errors.push("invalid_headers");
    }
  }

  entry.ignoredFields = Object.keys(raw).filter((field) => !KNOWN_FIELDS.has(field));

  if (entry.ignoredFields.length > 0) {
    entry.warnings.push("fields_ignored");
  }

  return entry;
}

export function parseMcpServersConfig(text: string): McpServersConfigParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  if (!isPlainObject(parsed) || !("mcpServers" in parsed)) {
    return { ok: false, error: "missing_mcp_servers" };
  }

  if (!isPlainObject(parsed.mcpServers)) {
    return { ok: false, error: "missing_mcp_servers" };
  }

  const entries = Object.entries(parsed.mcpServers).map(([key, raw]) => parseEntry(key, raw));

  if (entries.length === 0) {
    return { ok: false, error: "empty" };
  }

  const seen = new Set<string>();

  for (const entry of entries) {
    if (seen.has(entry.name)) {
      entry.errors.push("duplicate_name");
    }
    seen.add(entry.name);
  }

  return { ok: true, entries };
}

/** Header preview with credential-like values replaced, for display only. */
export function maskHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveName(name) && value !== "" ? MASKED_VALUE : value,
    ]),
  );
}

/**
 * Removes header values from a message before showing it. Backends and proxies sometimes echo the
 * request back in errors; a pasted config's credentials must not end up on screen that way.
 */
export function redactHeaderValues(text: string, headers: Record<string, string>) {
  return Object.values(headers)
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length)
    .reduce((result, value) => result.split(value).join(MASKED_VALUE), text);
}
