/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const AUDIT_ACTOR_PARAM = "actor_id";
export const AUDIT_ACTOR_MATCH_PARAM = "actor_match";

export function buildAuditLogHref(actorId: string) {
  const params = new URLSearchParams();
  params.set(AUDIT_ACTOR_PARAM, actorId);
  params.set(AUDIT_ACTOR_MATCH_PARAM, "exact");
  return `/system/audit?${params.toString()}`;
}
