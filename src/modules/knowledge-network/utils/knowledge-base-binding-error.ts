/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import axios from "axios";

import { extractRequestErrorDetails } from "@/framework/request/error-message";

/**
 * Why mounting a knowledge base, or listing the ones to mount, failed, in terms the page can
 * explain: each kind has its own wording and next step, never the backend's code.
 *
 *   gone          the knowledge base no longer exists
 *   notSupported  this deployment has no knowledge-base service
 *   unavailable   the knowledge-base service did not answer; try again later
 *   noPermission  the caller may not query the knowledge base; they can request it
 *   other         anything else
 */
export type KnowledgeBaseBindingFailure =
  "gone" | "noPermission" | "notSupported" | "other" | "unavailable";

const FAILURES_BY_CODE: Record<string, KnowledgeBaseBindingFailure> = {
  "BknBackend.CapabilityBinding.KnowledgeBaseNotSupported": "notSupported",
  "BknBackend.CapabilityBinding.KnowledgeBaseServiceUnavailable": "unavailable",
  "BknBackend.CapabilityBinding.TargetNotFound": "gone",
  "BknBackend.KnowledgeNetwork.Proxy.PermissionMissing": "noPermission",
};

export function knowledgeBaseBindingFailure(error: unknown): KnowledgeBaseBindingFailure {
  const { code } = extractRequestErrorDetails(error);
  const known = code ? FAILURES_BY_CODE[code] : undefined;
  if (known) {
    return known;
  }
  // kb-api answers the list itself, without bkn-backend's codes.
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  if (status === 403) {
    return "noPermission";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "unavailable";
  }
  return "other";
}
