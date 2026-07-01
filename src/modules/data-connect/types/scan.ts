/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

export type DataConnectScanStrategy =
  | "cleanup_only"
  | "create_only"
  | "full_sync";

export type DataConnectScanTaskStatus =
  | "completed"
  | "failed"
  | "pending"
  | "running";

export type DataConnectScanTaskTriggerType = "manual" | "scheduled";

export type DataConnectScanSchedule = {
  catalogId: string;
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
  strategy: DataConnectScanStrategy;
  updateTime: string;
  updaterName: string;
};

export type DataConnectScanTask = {
  catalogId: string;
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
  status: DataConnectScanTaskStatus;
  strategy: DataConnectScanStrategy;
  triggerType: DataConnectScanTaskTriggerType;
};

export type DataConnectScanScheduleListQuery = {
  catalogId?: string;
  enabled?: boolean;
  keyword: string;
  page: number;
  pageSize: number;
};

export type DataConnectScanTaskListQuery = {
  catalogId?: string;
  page: number;
  pageSize: number;
  scheduleId?: string;
  status?: DataConnectScanTaskStatus;
  triggerType?: DataConnectScanTaskTriggerType;
};

export type DataConnectScanScheduleListResult = {
  items: DataConnectScanSchedule[];
  total: number;
};

export type DataConnectScanTaskListResult = {
  items: DataConnectScanTask[];
  total: number;
};

export type DataConnectScanSchedulePayload = {
  catalogId: string;
  cronExpr: string;
  enabled: boolean;
  endTime?: number;
  name: string;
  startTime?: number;
  strategy: DataConnectScanStrategy;
};
