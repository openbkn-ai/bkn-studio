/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CatalogRecord } from "@/shared/catalog";
import type {
  BuildTask,
  IndexState,
  ResourceLocalIndexStatus,
  ResourceGate,
} from "@/modules/data-catalog/types/data-catalog";

/** All tasks for a resource, ordered by creation time descending. */
export function sortTasks(tasks: BuildTask[]) {
  return [...tasks].sort((left, right) => right.createTime - left.createTime);
}

export function isLocalIndexReadable(status: ResourceLocalIndexStatus | undefined): boolean {
  return status === "available" || status === "readonly";
}

/** Most recent task that can supply historical display context for a readable Resource index. */
export function effectiveIndexOf(tasks: BuildTask[]): BuildTask | null {
  return (
    sortTasks(tasks).find(
      (task) =>
        task.status === "completed" ||
        (task.mode === "streaming" &&
          (task.status === "running" || task.status === "stopped") &&
          task.syncedCount > 0),
    ) ?? null
  );
}

/**
 * Index state combines Resource-owned query availability with the latest task's progress/error.
 */
export function indexStateOf(
  tasks: BuildTask[],
  localIndexStatus: ResourceLocalIndexStatus | undefined,
): IndexState {
  const sorted = sortTasks(tasks);
  const latest = sorted[0] ?? null;
  // Resource local_status is the source of truth for query availability. A task is only
  // retained here as optional display context for history and progress.
  const readable = isLocalIndexReadable(localIndexStatus);
  const effective = readable ? effectiveIndexOf(sorted) : null;

  if (!latest) {
    return {
      key: readable ? "built" : "none",
      latest: null,
      effective,
    };
  }

  if (latest.status === "running" || latest.status === "pending" || latest.status === "stopping") {
    return {
      key: readable ? "rebuilding" : "building",
      latest,
      effective,
    };
  }

  if (latest.status === "failed") {
    return {
      key: readable ? "failed-stale" : "failed",
      latest,
      effective,
    };
  }

  return {
    key: readable ? "built" : "none",
    latest,
    effective,
  };
}

/**
 * Disable gate: after a physical connection is disabled, its resources cannot be previewed or built.
 * A logical catalog is a platform-internal namespace and is not governed by connection state.
 */
export function resourceGateOf(catalog: CatalogRecord | null): ResourceGate {
  if (!catalog) {
    return { ok: false };
  }

  if (catalog.type === "logical" || catalog.enabled) {
    return { ok: true, catalogName: catalog.name };
  }

  return { ok: false, catalogName: catalog.name };
}

export function isCatalogPhysical(catalog: CatalogRecord) {
  return catalog.type !== "logical";
}
