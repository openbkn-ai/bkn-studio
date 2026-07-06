/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { BuildTaskStatus } from "@/modules/data-catalog/types/data-catalog";

const STATUS_SET = new Set<BuildTaskStatus>([
  "failed",
  "listening",
  "paused",
  "pending",
  "running",
  "succeeded",
]);

export function parseIndexBuildStatusParam(value: string | null): BuildTaskStatus[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is BuildTaskStatus => STATUS_SET.has(item as BuildTaskStatus));
}

export function writeIndexBuildStatusParam(statuses: BuildTaskStatus[]): string | undefined {
  if (statuses.length === 0) {
    return undefined;
  }
  return statuses.join(",");
}

export type IndexBuildListFilters = {
  catalogId?: string;
  resourceId?: string;
  statuses: BuildTaskStatus[];
};

export function readIndexBuildListFilters(params: URLSearchParams): IndexBuildListFilters {
  const catalogId = params.get("catalogId")?.trim() || undefined;
  const resourceId = params.get("resourceId")?.trim() || undefined;
  const statuses = parseIndexBuildStatusParam(params.get("status"));
  return { catalogId, resourceId, statuses };
}

export function applyIndexBuildListFilters(
  base: URLSearchParams,
  filters: IndexBuildListFilters,
): URLSearchParams {
  const next = new URLSearchParams(base);
  if (filters.catalogId) {
    next.set("catalogId", filters.catalogId);
  } else {
    next.delete("catalogId");
  }
  if (filters.resourceId) {
    next.set("resourceId", filters.resourceId);
  } else {
    next.delete("resourceId");
  }
  const statusValue = writeIndexBuildStatusParam(filters.statuses);
  if (statusValue) {
    next.set("status", statusValue);
  } else {
    next.delete("status");
  }
  return next;
}

export type ResourceIndexView = "configure" | "overview";

export function readResourceIndexView(
  tab: string | null,
  view: string | null,
): ResourceIndexView {
  if (tab === "index" && view === "configure") {
    return "configure";
  }
  return "overview";
}

export function applyResourceIndexView(
  base: URLSearchParams,
  indexView: ResourceIndexView,
): URLSearchParams {
  const next = new URLSearchParams(base);
  if (indexView === "configure") {
    next.set("view", "configure");
  } else {
    next.delete("view");
  }
  next.delete("action");
  return next;
}
