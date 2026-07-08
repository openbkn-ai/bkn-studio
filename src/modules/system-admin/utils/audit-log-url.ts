/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export const AUDIT_RESOURCE_PARAM = "resource";
export const AUDIT_ACTOR_PARAM = "actor_id";
export const AUDIT_TARGET_PARAM = "target_id";
export const AUDIT_FAILED_PARAM = "failed";
export const AUDIT_FROM_PARAM = "from";
export const AUDIT_TO_PARAM = "to";
export const AUDIT_PAGE_PARAM = "page";
export const AUDIT_PAGE_SIZE_PARAM = "pageSize";

export type AuditLogFilters = {
  actorId?: string;
  failedOnly: boolean;
  from?: string;
  page: number;
  pageSize: number;
  resource?: string;
  targetId?: string;
  to?: string;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = new Set([10, 20, 50]);

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readAuditLogFilters(params: URLSearchParams): AuditLogFilters {
  const pageSizeRaw = parsePositiveInt(params.get(AUDIT_PAGE_SIZE_PARAM), DEFAULT_PAGE_SIZE);
  const resource = params.get(AUDIT_RESOURCE_PARAM)?.trim();
  const actorId = params.get(AUDIT_ACTOR_PARAM)?.trim();
  const targetId = params.get(AUDIT_TARGET_PARAM)?.trim();
  const from = params.get(AUDIT_FROM_PARAM)?.trim();
  const to = params.get(AUDIT_TO_PARAM)?.trim();

  return {
    actorId: actorId || undefined,
    failedOnly: params.get(AUDIT_FAILED_PARAM) === "1",
    from: from || undefined,
    page: parsePositiveInt(params.get(AUDIT_PAGE_PARAM), DEFAULT_PAGE),
    pageSize: ALLOWED_PAGE_SIZES.has(pageSizeRaw) ? pageSizeRaw : DEFAULT_PAGE_SIZE,
    resource: resource || undefined,
    targetId: targetId || undefined,
    to: to || undefined,
  };
}

export function applyAuditLogFilters(
  base: URLSearchParams,
  filters: AuditLogFilters,
): URLSearchParams {
  const next = new URLSearchParams(base);

  if (filters.resource) {
    next.set(AUDIT_RESOURCE_PARAM, filters.resource);
  } else {
    next.delete(AUDIT_RESOURCE_PARAM);
  }

  if (filters.actorId) {
    next.set(AUDIT_ACTOR_PARAM, filters.actorId);
  } else {
    next.delete(AUDIT_ACTOR_PARAM);
  }

  if (filters.targetId) {
    next.set(AUDIT_TARGET_PARAM, filters.targetId);
  } else {
    next.delete(AUDIT_TARGET_PARAM);
  }

  if (filters.failedOnly) {
    next.set(AUDIT_FAILED_PARAM, "1");
  } else {
    next.delete(AUDIT_FAILED_PARAM);
  }

  if (filters.from) {
    next.set(AUDIT_FROM_PARAM, filters.from);
  } else {
    next.delete(AUDIT_FROM_PARAM);
  }

  if (filters.to) {
    next.set(AUDIT_TO_PARAM, filters.to);
  } else {
    next.delete(AUDIT_TO_PARAM);
  }

  if (filters.page > DEFAULT_PAGE) {
    next.set(AUDIT_PAGE_PARAM, String(filters.page));
  } else {
    next.delete(AUDIT_PAGE_PARAM);
  }

  if (filters.pageSize !== DEFAULT_PAGE_SIZE) {
    next.set(AUDIT_PAGE_SIZE_PARAM, String(filters.pageSize));
  } else {
    next.delete(AUDIT_PAGE_SIZE_PARAM);
  }

  return next;
}

export function buildAuditLogHref(targetId: string, resource = "users") {
  const params = new URLSearchParams();
  params.set(AUDIT_TARGET_PARAM, targetId);
  params.set(AUDIT_RESOURCE_PARAM, resource);
  return `/system/audit?${params.toString()}`;
}
