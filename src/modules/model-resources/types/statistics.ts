/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type ModelStatisticsSummary = {
  totalUsage: number;
  errorRate: number;
  avgResponseTime: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
};

export type ModelStatisticsTrendPoint = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  avgTotalTime: number;
  avgFirstTime: number;
  avgRate: number;
};

export type ModelStatisticsQpsPoint = {
  date: string;
  avgQps: number;
};

export type ModelStatisticsOverviewQuery = {
  modelId?: string;
  startTime: string;
  endTime: string;
};

export type ModelStatisticsOverview = {
  summary: ModelStatisticsSummary;
  trends: ModelStatisticsTrendPoint[];
  qpsData: ModelStatisticsQpsPoint[];
};
