/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { extractRequestErrorDetails } from "@/framework/request/error-message";

export type ObjectTypeProxyReadFailureKind =
  | "binding-invalid"
  | "caller-forbidden"
  | "dependency-unavailable"
  | "mapping-missing"
  | "proxy-disabled"
  | "proxy-permission-denied"
  | "sync-failed"
  | "sync-pending"
  | "unknown";

export type ObjectTypeProxyReadFailure = {
  code?: string;
  kind: ObjectTypeProxyReadFailureKind;
};

const PROXY_DEPENDENCY_ERROR_CODES = new Set([
  "OntologyQuery.InternalError.CheckPermissionFailed",
  "OntologyQuery.Proxy.Unavailable",
]);

const PROXY_FAILURE_KINDS_BY_CODE: Record<string, ObjectTypeProxyReadFailureKind> = {
  "OntologyQuery.Proxy.BindingInvalid": "binding-invalid",
  "OntologyQuery.Proxy.Disabled": "proxy-disabled",
  "OntologyQuery.Proxy.MappingNotFound": "mapping-missing",
  "OntologyQuery.Proxy.PermissionDenied": "proxy-permission-denied",
  "OntologyQuery.Proxy.SyncFailed": "sync-failed",
  "OntologyQuery.Proxy.SyncPending": "sync-pending",
};

function getResponseErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError<unknown>(error)) {
    return undefined;
  }
  const data: unknown = error.response?.data;
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const code = (data as Record<string, unknown>).error_code;
  return typeof code === "string" && code.trim() ? code : undefined;
}

export function classifyObjectTypeProxyReadFailure(
  error: unknown,
): ObjectTypeProxyReadFailure {
  const extractedCode = extractRequestErrorDetails(error).code;
  const code = extractedCode ?? getResponseErrorCode(error);
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;

  if (code && PROXY_FAILURE_KINDS_BY_CODE[code]) {
    return { code, kind: PROXY_FAILURE_KINDS_BY_CODE[code] };
  }

  if (status === 403) {
    return { code, kind: "caller-forbidden" };
  }

  if (status === 503 || (code && PROXY_DEPENDENCY_ERROR_CODES.has(code))) {
    return { code, kind: "dependency-unavailable" };
  }

  return { code, kind: "unknown" };
}

export function getObjectTypeProxyReadFailureTranslationKeys(
  failure: ObjectTypeProxyReadFailure,
) {
  const suffixByKind: Record<ObjectTypeProxyReadFailureKind, string> = {
    "binding-invalid": "BindingInvalid",
    "caller-forbidden": "Forbidden",
    "dependency-unavailable": "Unavailable",
    "mapping-missing": "MappingMissing",
    "proxy-disabled": "ProxyDisabled",
    "proxy-permission-denied": "ProxyPermissionDenied",
    "sync-failed": "SyncFailed",
    "sync-pending": "SyncPending",
    unknown: "Unknown",
  };
  const suffix = suffixByKind[failure.kind];
  return {
    description: `knowledgeNetwork.objectTypeProxyRead${suffix}Description`,
    message: `knowledgeNetwork.objectTypeProxyRead${suffix}`,
  } as const;
}
