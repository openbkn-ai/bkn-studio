/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type DataConnectDiscoverStrategy =
  | "cleanup_only"
  | "create_only"
  | "full_sync";

export type DataConnectDiscoverTaskStatus =
  | "cancelled"
  | "completed"
  | "failed"
  | "pending"
  | "running";

export type DataConnectDiscoverTaskTriggerType = "manual" | "scheduled";
export type DataConnectDiscoverTaskSort =
  | "create_time"
  | "start_time"
  | "finish_time"
  | "last_progress_time";

export type DataConnectDiscoverSchedule = {
  catalogId: string;
  catalogName?: string;
  createTime: string;
  creatorName: string;
  cronExpr: string;
  enabled: boolean;
  endTime: string;
  endTimeValue?: number;
  id: string;
  lastRun: string;
  lastRunValue?: number;
  name: string;
  nextRun: string;
  nextRunValue?: number;
  startTime: string;
  startTimeValue?: number;
  strategy: DataConnectDiscoverStrategy;
  updateTime: string;
  expectedUpdateTime: number;
  updaterName: string;
};

export type DataConnectDiscoverTask = {
  catalogId: string;
  catalogName?: string;
  createTime: number;
  creatorName: string;
  finishTime?: number;
  id: string;
  lastProgressTime?: number;
  message: string;
  progress: number;
  /** Server-computed queue priority; greater values run earlier. */
  queuePriority: number;
  /** Present only for a resource-level metadata refresh task. */
  resourceId?: string;
  /** Current display name of the refreshed resource, populated by the server. */
  resourceName?: string;
  result?: DataConnectDiscoverResult;
  /** Present only for a task triggered by a discover schedule. */
  scheduleId?: string;
  startTime?: number;
  status: DataConnectDiscoverTaskStatus;
  strategy: DataConnectDiscoverStrategy;
  triggerType: DataConnectDiscoverTaskTriggerType;
};

export type DataConnectDiscoverTaskSummary = Omit<
  DataConnectDiscoverTask,
  "message" | "result"
> & {
  result?: DataConnectDiscoverTaskResultSummary;
};

export type DataConnectDiscoverResult = {
  catalogId: string;
  failedCount: number;
  message: string;
  newCount: number;
  restoredCount: number;
  staleCount: number;
  unchangedCount: number;
  updatedCount: number;
};

export type DataConnectDiscoverTaskResultSummary = Omit<
  DataConnectDiscoverResult,
  "message"
>;

export type DataConnectDiscoverScheduleListQuery = {
  catalogId?: string;
  enabled?: boolean;
  keyword: string;
  page: number;
  pageSize: number;
};

export type DataConnectDiscoverTaskListQuery = {
  catalogId?: string;
  /** Raw window. Callers scan by offset because the backend filters after paging (#977). */
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  resourceId?: string;
  scheduleId?: string;
  direction?: "asc" | "desc";
  sort?: DataConnectDiscoverTaskSort;
  statuses?: DataConnectDiscoverTaskStatus[];
  strategy?: DataConnectDiscoverStrategy;
  triggerType?: DataConnectDiscoverTaskTriggerType;
};

export type DataConnectDiscoverScheduleListResult = {
  items: DataConnectDiscoverSchedule[];
  total: number;
};

export type DataConnectDiscoverTaskListResult = {
  items: DataConnectDiscoverTaskSummary[];
  total: number;
};

export type DataConnectDiscoverSchedulePayload = {
  catalogId: string;
  cronExpr: string;
  enabled: boolean;
  endTime?: number;
  name: string;
  startTime?: number;
  strategy: DataConnectDiscoverStrategy;
};

export type DataConnectDiscoverScheduleUpdatePayload =
  DataConnectDiscoverSchedulePayload & {
    expectedUpdateTime: number;
  };
