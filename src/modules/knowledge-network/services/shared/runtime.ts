/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { getRuntimeConfig } from "@/framework/runtime/config";
import type {
  KnowledgeNetworkListQuery,
  KnowledgeNetworkRecord,
  KnowledgeNetworkStatistics,
} from "@/modules/knowledge-network/types/knowledge-network";

export class KnowledgeNetworkImportConflictError extends Error {
  readonly isConflict = true as const;

  constructor(message: string) {
    super(message);
    this.name = "KnowledgeNetworkImportConflictError";
  }
}

export function stringFromUnknown(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return fallback;
}

export function readFileReaderText(result: string | ArrayBuffer | null | undefined) {
  return typeof result === "string" ? result : "{}";
}

export const useMock = import.meta.env.VITE_USE_MOCK !== "false";

/** Metrics are visible in every environment and degrade with a warning if the backend is absent. */
export const integrateWorkspaceMetrics = true;
export const integrateWorkspaceTasks = useMock;

export const wait = async <T,>(value: T) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(value), 160);
  });

export function formatTimestamp(value?: number) {
  if (!value) {
    return "-";
  }

  const timestamp = normalizeEpochToMillis(value);
  if (timestamp == null) {
    return "-";
  }

  const locale = getRuntimeConfig().locale;

  const formatted = new Intl.DateTimeFormat(locale, {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);

  if (locale === "zh-CN") {
    return formatted.replace(/\//g, "-");
  }

  return formatted.replace(",", "");
}

/** Convert epoch seconds / ms / µs / ns to milliseconds; return null if invalid. */
export function normalizeEpochToMillis(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  // nanoseconds
  if (value >= 1e18) {
    return Math.floor(value / 1e6);
  }
  // microseconds
  if (value >= 1e15) {
    return Math.floor(value / 1e3);
  }
  // milliseconds (13 digits around current era)
  if (value >= 1e12) {
    return Math.floor(value);
  }
  // seconds
  return Math.floor(value * 1000);
}

/**
 * Format metric query time labels for display.
 * Accepts epoch (s/ms/µs/ns), numeric strings, ISO/RFC3339, and already-readable date strings.
 */
export function formatMetricTimeLabel(value: unknown): string {
  if (value == null || value === "") {
    return "--";
  }

  if (typeof value === "number") {
    const formatted = formatTimestamp(value);
    return formatted === "-" ? String(value) : formatted;
  }

  if (typeof value === "bigint") {
    return formatMetricTimeLabel(Number(value));
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (typeof value !== "string") {
    return "--";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "--";
  }

  // Pure numeric epoch string: "1672531200000" / "1672531200"
  if (/^\d{10,19}$/.test(trimmed)) {
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      const formatted = formatTimestamp(asNumber);
      return formatted === "-" ? trimmed : formatted;
    }
  }

  // ISO / RFC3339 / common date-time strings
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    const formatted = formatTimestamp(parsed);
    return formatted === "-" ? trimmed : formatted;
  }

  // Calendar bucket leftovers (e.g. "2023-Q1") — keep original
  return trimmed;
}

export function getRequestErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } }).response?.status;
}

function formatServiceFallbackReason(error: unknown): string {
  const status = getRequestErrorStatus(error);
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";

  return [status ? `status=${status}` : null, message].filter(Boolean).join(" · ");
}

/** Dev-only breadcrumb when a service intentionally degrades instead of throwing. */
export function logServiceFallback(scope: string, error: unknown, detail?: string): void {
  if (!import.meta.env.DEV) {
    return;
  }

  const parts = [formatServiceFallbackReason(error), detail].filter(Boolean).join(" · ");
  console.debug(`[knowledge-network] ${scope} fallback${parts ? `: ${parts}` : ""}`);
}

export function emptyStatistics(): KnowledgeNetworkStatistics {
  return {
    objectTypesTotal: 0,
    relationTypesTotal: 0,
    actionTypesTotal: 0,
    conceptGroupsTotal: 0,
    metricsTotal: 0,
  };
}

export function filterKnowledgeNetworks(
  items: KnowledgeNetworkRecord[],
  query: KnowledgeNetworkListQuery,
) {
  const keyword = query.keyword.trim().toLowerCase();
  const tag = query.tag?.trim().toLowerCase();
  const filtered = items.filter((item) => {
    const matchesKeyword =
      keyword.length === 0 ||
      item.name.toLowerCase().includes(keyword) ||
      item.identifier.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword);
    const matchesTag =
      !tag || item.tags.some((itemTag) => itemTag.toLowerCase() === tag);

    return matchesKeyword && matchesTag;
  });

  const sortBy = query.sortBy ?? "updateTime";
  const direction = query.direction ?? "desc";

  filtered.sort((left, right) => {
    const leftValue = sortBy === "name" ? left.name : left.updateTime;
    const rightValue = sortBy === "name" ? right.name : right.updateTime;
    const compareResult =
      sortBy === "name"
        ? leftValue.localeCompare(rightValue, "zh-CN")
        : leftValue.localeCompare(rightValue);

    return direction === "asc" ? compareResult : -compareResult;
  });

  return filtered;
}

export function throwImportConflict(message: string): never {
  throw new KnowledgeNetworkImportConflictError(message);
}

export function rethrowImportConflict(error: unknown): never {
  const response = (
    error as { response?: { data?: { error_code?: string; description?: string } } }
  ).response?.data;

  if (response?.error_code) {
    throwImportConflict(response.description ?? "Import conflict");
  }

  throw error;
}

export function downloadJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
