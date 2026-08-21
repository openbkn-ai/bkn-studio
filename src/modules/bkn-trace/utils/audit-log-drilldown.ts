/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type AuditLogDrilldown = {
  apiResourceType: string;
  displayType: string;
  targetId: string;
};

export function readAuditLogDrilldown(parameters: URLSearchParams): AuditLogDrilldown {
  const targetId = parameters.get("target_id")?.trim() ?? "";
  const rawType = (parameters.get("target_type") ?? parameters.get("resource") ?? "").trim();
  const displayType = rawType === "users" ? "user" : rawType;
  return {
    apiResourceType: displayType,
    displayType,
    targetId,
  };
}
