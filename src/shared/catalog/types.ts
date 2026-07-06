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

export type CatalogRecord = {
  category: string;
  connectorConfig: Record<string, unknown>;
  connectorType: string;
  createTime: string;
  creatorName: string;
  description: string;
  enabled: boolean;
  healthCheckEnabled: boolean;
  healthCheckResult: string;
  healthStatus: CatalogHealthStatus;
  id: string;
  metadata: Record<string, unknown>;
  mode: string;
  name: string;
  operations: string[];
  status: CatalogRecordStatus;
  tags: string[];
  type: string;
  updateTime: string;
  updaterName: string;
};

export type CatalogListQuery = {
  connectorType?: string;
  keyword: string;
  page: number;
  pageSize: number;
  /** 默认 physical；数据目录需同时展示逻辑 catalog 时传 all */
  type?: "all" | "logical" | "physical";
};

export type CatalogListResult = {
  items: CatalogRecord[];
  total: number;
};
