/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type CatalogRecordStatus = "disabled" | "enabled";

export type CatalogHealthStatus =
  | "degraded"
  | "healthy"
  | "offline"
  | "unchecked"
  | "unhealthy";

export type CatalogConnectionTestInput = {
  connectorConfig: Record<string, unknown>;
  connectorType: string;
};

export type CatalogConnectionTestResult = {
  message?: string;
  success: boolean;
};

export type CatalogHealthCheckScheduleMode =
  | "disabled"
  | "enabled"
  | "inherit";

export type CatalogHealthCheckScheduleInput = {
  cronExpr?: string;
  mode: CatalogHealthCheckScheduleMode;
};

export type CatalogHealthCheckSchedule = {
  catalogId: string;
  cronExpr: string;
  expectedUpdateTime: number;
  lastRun: string;
  mode: CatalogHealthCheckScheduleMode;
  nextRun: string;
  updateTime: string;
};

export type CatalogMutationOptions = {
  allowUnhealthy?: boolean;
  skipErrorToast?: boolean;
};

export type CatalogDeletionBlocker =
  | "build_tasks_running_or_stopping"
  | "discover_tasks_running"
  | "protected_resources"
  | "semantic_understanding_tasks_running";

export type CatalogDeletionTaskImpact = {
  blocking: number;
  willCancel: number;
};

export type CatalogDeletionImpact = {
  blockers: CatalogDeletionBlocker[];
  buildTasks: CatalogDeletionTaskImpact;
  canDelete: boolean;
  catalogHealthCheckSchedules: number;
  catalogId: string;
  discoverSchedules: number;
  discoverTasks: CatalogDeletionTaskImpact;
  protectedResources: number;
  resources: number;
  semanticUnderstandingTasks: CatalogDeletionTaskImpact;
};

export type CatalogRecord = {
  category: string;
  connectorConfig: Record<string, unknown>;
  connectorType: string;
  createTime: string;
  creatorName: string;
  description: string;
  enabled: boolean;
  healthCheckResult: string;
  healthStatus: CatalogHealthStatus;
  id: string;
  /** System-managed catalogs are visible but must remain read-only in Studio. */
  internal: boolean;
  lastCheckTime: string;
  metadata: Record<string, unknown>;
  mode: string;
  name: string;
  operations: string[];
  status: CatalogRecordStatus;
  tags: string[];
  type: string;
  updateTime: string;
  expectedUpdateTime: number;
  updaterName: string;
};

export type CatalogListQuery = {
  connectorType?: string;
  keyword: string;
  page: number;
  pageSize: number;
  /** Defaults to physical; data catalogs pass all when logical catalogs must also be shown. */
  type?: "all" | "logical" | "physical";
};

export type CatalogListResult = {
  items: CatalogRecord[];
  total: number;
};
