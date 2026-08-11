/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolDebugInput } from "@/modules/execution-factory/types/tool";

/**
 * Transport-layer headers are owned by the forwarder. Letting users enter them in the debug panel
 * would make actual requests differ from previews or fail outright, so reject them.
 */
const TRANSPORT_HEADERS = new Set([
  "connection",
  "content-length",
  "expect",
  "host",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/**
 * Name fragments with credential semantics. Header names are standardized, but query names are
 * author-defined (token, api_key, apikey, accessToken, key, sk, and sign all occur), so match
 * fragments on both. Over-redaction is far safer than leaking a real credential in execution logs.
 *
 * Platform public endpoints support `?token=` fallback, including operator-integration GetToken
 * and agent-retrieval getToken, and accept bak_-prefixed API keys. Credential-bearing queries are real usage here.
 */
const SENSITIVE_NAME_SEGMENTS = new Set([
  "apikey",
  "auth",
  "authorization",
  "cookie",
  "credential",
  "credentials",
  "key",
  "passwd",
  "password",
  "pwd",
  "secret",
  "sig",
  "sign",
  "signature",
  "sk",
  "token",
]);

export const MASKED_VALUE = "***";

/** Extracts name fragments across kebab-case, snake_case, and camelCase. */
function nameSegments(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

export function isTransportHeader(name: string) {
  return TRANSPORT_HEADERS.has(name.trim().toLowerCase());
}

export function isSensitiveName(name: string) {
  return nameSegments(name).some((segment) => SENSITIVE_NAME_SEGMENTS.has(segment));
}

export function assertDebugHeadersAllowed(header?: Record<string, unknown>) {
  const rejected = Object.keys(header ?? {}).filter((name) => isTransportHeader(name));

  if (rejected.length > 0) {
    throw new Error(`Header: not allowed here (set by the forwarder): ${rejected.join(", ")}`);
  }
}

function maskRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).map(([name, value]) => [
      name,
      isSensitiveName(name) && value !== undefined && value !== null && value !== ""
        ? MASKED_VALUE
        : value,
    ]),
  );
}

/**
 * Execution records persist in conversations and can be copied or shared, so redact credential-like
 * header and query values before writing. Leave request bodies unchanged: guessing from arbitrary
 * user JSON field names would damage business fields; true body redaction belongs in field schemas.
 */
export function maskDebugRequestSecrets(request: ToolDebugInput): ToolDebugInput {
  if (!request.header && !request.query) {
    return request;
  }

  return {
    ...request,
    ...(request.header ? { header: maskRecord(request.header) } : {}),
    ...(request.query ? { query: maskRecord(request.query) } : {}),
  };
}
