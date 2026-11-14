/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type {
  BuildMode,
  BuildTaskExecuteType,
  BuildTaskStatus,
} from "@/modules/data-catalog/types/data-catalog";

const STATUS_SET = new Set<BuildTaskStatus>([
  "cancelled",
  "completed",
  "failed",
  "pending",
  "running",
  "stopping",
  "stopped",
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
  executeType?: BuildTaskExecuteType;
  mode?: BuildMode;
  scheduleId?: string;
  triggerType?: "manual" | "scheduled";
  statuses: BuildTaskStatus[];
};

export function readIndexBuildListFilters(params: URLSearchParams): IndexBuildListFilters {
  const rawMode = params.get("mode");
  const mode = rawMode === "batch" || rawMode === "streaming" ? rawMode : undefined;
  const rawExecuteType = params.get("execute_type");
  const executeType =
    rawExecuteType === "full" || rawExecuteType === "incremental" ? rawExecuteType : undefined;
  const statuses = parseIndexBuildStatusParam(params.get("status"));
  const rawTriggerType = params.get("trigger_type");
  const triggerType =
    rawTriggerType === "manual" || rawTriggerType === "scheduled" ? rawTriggerType : undefined;
  const scheduleId = params.get("schedule_id")?.trim() || undefined;
  return { executeType, mode, scheduleId, triggerType, statuses };
}

export function applyIndexBuildListFilters(
  base: URLSearchParams,
  filters: IndexBuildListFilters,
): URLSearchParams {
  const next = new URLSearchParams(base);
  next.delete("catalogId");
  if (filters.mode) {
    next.set("mode", filters.mode);
  } else {
    next.delete("mode");
  }
  if (filters.executeType) {
    next.set("execute_type", filters.executeType);
  } else {
    next.delete("execute_type");
  }
  next.delete("resourceId");
  if (filters.scheduleId) next.set("schedule_id", filters.scheduleId);
  else next.delete("schedule_id");
  if (filters.triggerType) next.set("trigger_type", filters.triggerType);
  else next.delete("trigger_type");
  const statusValue = writeIndexBuildStatusParam(filters.statuses);
  if (statusValue) {
    next.set("status", statusValue);
  } else {
    next.delete("status");
  }
  return next;
}

export type ResourceIndexView = "config" | "tasks" | "schedules";

/** True when the URL explicitly names a data-index sub-tab. */
export function isExplicitResourceIndexView(view: string | null): boolean {
  return (
    view === "config" ||
    view === "tasks" ||
    view === "schedules" ||
    view === "configure" ||
    view === "overview"
  );
}

export function readResourceIndexView(tab: string | null, view: string | null): ResourceIndexView {
  if (tab !== "index") {
    return "tasks";
  }
  if (view === "config" || view === "configure") {
    return "config";
  }
  if (view === "tasks" || view === "overview") {
    return "tasks";
  }
  if (view === "schedules") return "schedules";
  // No view param: always open configuration first.
  return "config";
}

export function applyResourceIndexView(
  base: URLSearchParams,
  indexView: ResourceIndexView,
): URLSearchParams {
  const next = new URLSearchParams(base);
  next.set("view", indexView);
  next.delete("action");
  return next;
}
