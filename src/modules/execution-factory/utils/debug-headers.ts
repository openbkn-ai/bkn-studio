/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ToolDebugInput } from "@/modules/execution-factory/types/tool";

/**
 * 传输层请求头由转发器接管，调试面板手填会让实际请求与预览不一致（甚至发不出去），
 * 因此直接拒绝。
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

/** 允许发送但不落运行记录的凭据类请求头。 */
const SENSITIVE_HEADERS = new Set([
  "api-key",
  "authorization",
  "cookie",
  "proxy-authorization",
  "set-cookie",
  "token",
  "x-access-token",
  "x-api-key",
  "x-auth-token",
  "x-csrf-token",
  "x-session-token",
]);

export const MASKED_HEADER_VALUE = "***";

export function isTransportHeader(name: string) {
  return TRANSPORT_HEADERS.has(name.trim().toLowerCase());
}

export function isSensitiveHeader(name: string) {
  return SENSITIVE_HEADERS.has(name.trim().toLowerCase());
}

export function assertDebugHeadersAllowed(header?: Record<string, unknown>) {
  const rejected = Object.keys(header ?? {}).filter((name) => isTransportHeader(name));

  if (rejected.length > 0) {
    throw new Error(`Header: not allowed here (set by the forwarder): ${rejected.join(", ")}`);
  }
}

/**
 * 运行记录会长期留在会话里并可被复制分享，凭据类请求头的值在写入前打码。
 */
export function maskDebugRequestSecrets(request: ToolDebugInput): ToolDebugInput {
  if (!request.header) {
    return request;
  }

  return {
    ...request,
    header: Object.fromEntries(
      Object.entries(request.header).map(([name, value]) => [
        name,
        isSensitiveHeader(name) && value !== undefined && value !== null && value !== ""
          ? MASKED_HEADER_VALUE
          : value,
      ]),
    ),
  };
}
