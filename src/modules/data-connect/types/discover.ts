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
  | "completed"
  | "failed"
  | "pending"
  | "running";

export type DataConnectDiscoverTaskTriggerType = "manual" | "scheduled";
export type DataConnectDiscoverTaskSort = "create_time" | "default";

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
  updaterName: string;
};

export type DataConnectDiscoverTask = {
  catalogId: string;
  catalogName?: string;
  createTime: string;
  creatorName: string;
  finishTime: string;
  finishTimeValue?: number;
  id: string;
  message: string;
  progress: number;
  scheduleId: string;
  startTime: string;
  startTimeValue?: number;
  status: DataConnectDiscoverTaskStatus;
  strategy: DataConnectDiscoverStrategy;
  triggerType: DataConnectDiscoverTaskTriggerType;
};

export type DataConnectDiscoverScheduleListQuery = {
  catalogId?: string;
  enabled?: boolean;
  keyword: string;
  page: number;
  pageSize: number;
};

export type DataConnectDiscoverTaskListQuery = {
  catalogId?: string;
  page: number;
  pageSize: number;
  scheduleId?: string;
  direction?: "asc" | "desc";
  sort?: DataConnectDiscoverTaskSort;
  status?: DataConnectDiscoverTaskStatus;
  strategy?: DataConnectDiscoverStrategy;
  triggerType?: DataConnectDiscoverTaskTriggerType;
};

export type DataConnectDiscoverScheduleListResult = {
  items: DataConnectDiscoverSchedule[];
  total: number;
};

export type DataConnectDiscoverTaskListResult = {
  items: DataConnectDiscoverTask[];
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
