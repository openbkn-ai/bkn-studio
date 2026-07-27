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

/**
 * 凭据语义的名字片段。请求头名字标准化程度高，query 参数名则完全由接口作者自定
 * （token / api_key / apikey / accessToken / key / sk / sign 都见过），所以两边统一
 * 按片段匹配，宁可多打码：运行记录里多几个 *** 的代价远小于漏一个真凭据。
 *
 * 平台自身的公开面就支持 `?token=` 回落（operator-integration 的 GetToken、
 * agent-retrieval 的 getToken），并接受 bak_ 前缀的 API Key，所以 query 带凭据
 * 在本系统里是真实存在的用法，不是假想。
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

/** 拆出名字片段，兼顾 kebab、snake 与 camel 三种写法。 */
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
 * 运行记录会长期留在会话里并可被复制分享，凭据类请求头与 query 参数的值在写入前打码。
 * 请求体不动：用户自填任意 JSON，按名字猜会误伤业务字段，真要脱敏应在字段 schema 层面做。
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
