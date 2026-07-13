/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

type UnknownSandboxStatus = string & {};

export type SandboxHealthStatus = "healthy" | "degraded" | "unhealthy" | UnknownSandboxStatus;
export type SandboxSessionStatus =
  | "creating"
  | "running"
  | "idle"
  | "failed"
  | "terminated"
  | UnknownSandboxStatus;

export type SandboxRuntimeHealth = {
  status: SandboxHealthStatus;
  controlPlaneReachable: boolean;
  checkedAt?: string;
  maxSessions: number;
  currentActiveSessions: number;
  currentRunningTasks: number;
  failedSessions: number;
  message?: string;
};

export type SandboxRuntimePool = {
  maxSessions: number;
  activeSessions: number;
  maxConcurrentTasks: number;
  currentActiveSessions: number;
  currentRunningTasks: number;
  templateId?: string;
  sessionResources?: Record<string, unknown>;
};

export type SandboxSessionSummary = {
  id: string;
  status: SandboxSessionStatus;
  source: string;
  taskId?: string;
  capabilityId?: string;
  capabilityName?: string;
  userId?: string;
  userName?: string;
  templateId?: string;
  runtimeType?: string;
  languageRuntime?: string;
  resourceLimit?: Record<string, unknown>;
  resourceText: string;
  dependencyInstallStatus?: string;
  recentErrorSummary?: string;
  createdAt?: string;
  updatedAt?: string;
  lastActivityAt?: string;
};

export type SandboxSessionDetail = SandboxSessionSummary & {
  workspacePath?: string;
  runtimeNode?: string;
  podName?: string;
  timeout?: number;
  pythonPackageIndexUrl?: string;
  requestedDependencies?: SandboxDependencyInfo[];
  installedDependencies?: SandboxDependencyInfo[];
  dependencyInstallStartedAt?: string;
  dependencyInstallCompletedAt?: string;
  fullStdoutStderrAvailable: boolean;
  governanceActionsAvailable: boolean;
  sensitiveDiagnosticsRedacted: boolean;
};

export type SandboxDependencyInfo = {
  name: string;
  version?: string;
  install_location?: string;
  install_time?: string;
  is_from_template?: boolean;
};

export type SandboxSessionListResult = {
  items: SandboxSessionSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type SandboxSessionQuery = {
  page?: number;
  pageSize?: number;
  status?: string;
  source?: string;
  runtime?: string;
  abnormalOnly?: boolean;
};

