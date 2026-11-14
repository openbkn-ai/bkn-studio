/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { ScheduleLastStatus } from "./types";

export type BuildSchedule = {
  id: string;
  name: string;
  resourceId: string;
  resourceName?: string;
  catalogId: string;
  catalogName?: string;
  cronExpr: string;
  executeType: "full" | "incremental";
  enabled: boolean;
  startTime: number;
  endTime: number;
  readonly lastRun: number;
  readonly nextRun: number;
  readonly lastStatus: ScheduleLastStatus;
  readonly lastMessage: string;
  readonly creator?: { id: string; name?: string; type: string };
  readonly createTime?: number;
  readonly updater?: { id: string; name?: string; type: string };
  readonly updateTime: number;
};

export type BuildScheduleInput = {
  name: string;
  resourceId: string;
  cronExpr: string;
  executeType: "full" | "incremental";
  enabled?: boolean;
  startTime?: number;
  endTime?: number;
};

export type BuildSchedulePageQuery = {
  page?: number;
  pageSize?: number;
  resourceId?: string;
  catalogId?: string;
  name?: string;
  enabled?: boolean;
  executeType?: "full" | "incremental";
  sort?: "name" | "create_time" | "update_time" | "next_run";
  direction?: "asc" | "desc";
};

export type BuildSchedulePageResult = {
  items: BuildSchedule[];
  total: number;
};
