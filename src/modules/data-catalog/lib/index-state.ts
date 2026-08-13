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
  ResourceGate,
} from "@/modules/data-catalog/types/data-catalog";

/** All tasks for a resource, ordered by creation time descending. */
export function sortTasks(tasks: BuildTask[]) {
  return [...tasks].sort((left, right) => right.createdAt - left.createdAt);
}

/**
 * Current effective index: the most recent successful build or a streaming task still serving
 * data (listening, or paused after synchronizing data). Queries use this version.
 */
export function effectiveIndexOf(tasks: BuildTask[]): BuildTask | null {
  return (
    sortTasks(tasks).find(
      (task) =>
        task.status === "succeeded" ||
        (task.mode === "streaming" &&
          (task.status === "listening" || task.status === "paused") &&
          task.syncedCount > 0),
    ) ?? null
  );
}

/**
 * Index state combines the effective index and latest task. When the latest task fails but an
 * older index still serves, the state is failed-stale (rebuild failed, retaining old index).
 */
export function indexStateOf(tasks: BuildTask[]): IndexState {
  const sorted = sortTasks(tasks);
  const latest = sorted[0] ?? null;
  const effective = effectiveIndexOf(sorted);

  if (!latest) {
    return { key: "none", latest: null, effective: null };
  }

  if (
    latest.status === "running" ||
    latest.status === "pending" ||
    latest.status === "stopping"
  ) {
    return {
      key: effective && effective.id !== latest.id ? "rebuilding" : "building",
      latest,
      effective,
    };
  }

  if (latest.status === "listening") {
    return { key: "listening", latest, effective };
  }

  if (latest.status === "paused") {
    return { key: "paused", latest, effective };
  }

  if (latest.status === "succeeded") {
    return { key: "built", latest, effective };
  }

  if (latest.status === "cancelled") {
    if (!effective) {
      return { key: "none", latest, effective };
    }
    if (effective.status === "listening") {
      return { key: "listening", latest, effective };
    }
    if (effective.status === "paused") {
      return { key: "paused", latest, effective };
    }
    return { key: "built", latest, effective };
  }

  return { key: effective ? "failed-stale" : "failed", latest, effective };
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
