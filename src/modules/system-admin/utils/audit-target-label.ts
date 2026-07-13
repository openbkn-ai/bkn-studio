/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { AuditLog } from "@/modules/system-admin/types/admin";

function parseAuditDetail(detail?: string): Record<string, unknown> {
  if (!detail) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(detail);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";
}

type TargetResolver = (resource: string, id: string) => string | undefined;

/** 仅在 targetName / 目录映射不足时才解析 detail JSON。 */
export function resolveAuditTargetLabel(
  log: AuditLog,
  resolveTarget: TargetResolver,
): string | undefined {
  if (log.targetName) {
    return log.targetName;
  }

  if (log.targetId) {
    const mapped = resolveTarget(log.resource, log.targetId);
    if (mapped) {
      return mapped;
    }
  }

  if (!log.detail) {
    return undefined;
  }

  const detail = parseAuditDetail(log.detail);
  const directName = stringValue(detail.name);
  if (directName) {
    return directName;
  }

  const roleId = stringValue(detail.role_id);
  const accessorId = stringValue(detail.accessor_id);
  if (log.resource === "role-bindings" && roleId) {
    const roleName = resolveTarget("roles", roleId) ?? roleId;
    const accessorName =
      resolveTarget("users", accessorId) ??
      resolveTarget("departments", accessorId) ??
      accessorId;
    return accessorName ? `${roleName} / ${accessorName}` : roleName;
  }

  const resource = detail.resource;
  if (resource && typeof resource === "object" && !Array.isArray(resource)) {
    const resourceRecord = resource as Record<string, unknown>;
    const resourceType = stringValue(resourceRecord.type);
    const resourceId = stringValue(resourceRecord.id);
    if (resourceType === "users" || resourceType === "departments" || resourceType === "roles") {
      return resolveTarget(resourceType, resourceId) ?? resourceId;
    }
  }

  return undefined;
}

export function collectAuditUserIds(logs: AuditLog[]) {
  const ids = new Set<string>();
  for (const log of logs) {
    if (log.actorId) {
      ids.add(log.actorId);
    }
    if (!log.targetName && log.targetId && log.resource === "users") {
      ids.add(log.targetId);
    }
  }
  return [...ids];
}
