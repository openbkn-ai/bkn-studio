/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";
import type {
  SandboxRuntimeHealth,
  SandboxRuntimePool,
  SandboxSessionDetail,
  SandboxSessionListResult,
  SandboxSessionQuery,
  SandboxSessionSummary,
} from "@/modules/execution-factory-lab/types/sandbox-runtime";

export const SANDBOX_RUNTIME_API_PREFIX =
  "/agent-operator-integration/internal-v1/sandbox";

type BackendHealth = {
  status?: string;
  control_plane_reachable?: boolean;
  checked_at?: string;
  max_sessions?: number;
  current_active_sessions?: number;
  current_running_tasks?: number;
  failed_sessions?: number;
  message?: string;
};

type BackendPool = {
  max_sessions?: number;
  active_sessions?: number;
  max_concurrent_tasks?: number;
  current_active_sessions?: number;
  current_running_tasks?: number;
  template_id?: string;
  session_resources?: Record<string, unknown>;
};

type BackendSessionSummary = {
  id?: string;
  status?: string;
  source?: string;
  task_id?: string;
  capability_id?: string;
  capability_name?: string;
  user_id?: string;
  user_name?: string;
  template_id?: string;
  runtime_type?: string;
  language_runtime?: string;
  resource_limit?: Record<string, unknown>;
  dependency_install_status?: string;
  recent_error_summary?: string;
  created_at?: string;
  updated_at?: string;
  last_activity_at?: string;
};

type BackendSessionDetail = BackendSessionSummary & {
  workspace_path?: string;
  runtime_node?: string;
  pod_name?: string;
  timeout?: number;
  python_package_index_url?: string;
  requested_dependencies?: SandboxSessionDetail["requestedDependencies"];
  installed_dependencies?: SandboxSessionDetail["installedDependencies"];
  dependency_install_started_at?: string;
  dependency_install_completed_at?: string;
  full_stdout_stderr_available?: boolean;
  governance_actions_available?: boolean;
  sensitive_diagnostics_redacted?: boolean;
};

type BackendSessionList = {
  items?: BackendSessionSummary[];
  total?: number;
  limit?: number;
  offset?: number;
  has_more?: boolean;
};

export function buildSandboxSessionQuery(query: SandboxSessionQuery) {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  return {
    limit: pageSize,
    offset: Math.max(page - 1, 0) * pageSize,
    status: query.status && query.status !== "all" ? query.status : undefined,
    source: query.source && query.source !== "all" ? query.source : undefined,
    runtime: query.runtime && query.runtime !== "all" ? query.runtime : undefined,
    abnormal_only: query.abnormalOnly || undefined,
  };
}

function textValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const text =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? String(value).trim()
      : (JSON.stringify(value) ?? "").trim();
  return text || undefined;
}

export function formatResourceLimit(resource?: Record<string, unknown>): string {
  if (!resource) {
    return "-";
  }
  const cpu = textValue(resource.cpu) ?? textValue(resource.CPU) ?? "-";
  const memory = textValue(resource.memory) ?? textValue(resource.Memory) ?? "-";
  return `${cpu} / ${memory}`;
}

export function mapSandboxSessionSummary(item: BackendSessionSummary): SandboxSessionSummary {
  return {
    id: item.id ?? "",
    status: item.status ?? "unknown",
    source: item.source ?? "unknown",
    taskId: item.task_id,
    capabilityId: item.capability_id,
    capabilityName: item.capability_name,
    userId: item.user_id,
    userName: item.user_name,
    templateId: item.template_id,
    runtimeType: item.runtime_type,
    languageRuntime: item.language_runtime,
    resourceLimit: item.resource_limit,
    resourceText: formatResourceLimit(item.resource_limit),
    dependencyInstallStatus: item.dependency_install_status,
    recentErrorSummary: item.recent_error_summary,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    lastActivityAt: item.last_activity_at,
  };
}

export function mapSandboxSessionDetail(item: BackendSessionDetail): SandboxSessionDetail {
  return {
    ...mapSandboxSessionSummary(item),
    workspacePath: item.workspace_path,
    runtimeNode: item.runtime_node,
    podName: item.pod_name,
    timeout: item.timeout,
    pythonPackageIndexUrl: item.python_package_index_url,
    requestedDependencies: item.requested_dependencies ?? [],
    installedDependencies: item.installed_dependencies ?? [],
    dependencyInstallStartedAt: item.dependency_install_started_at,
    dependencyInstallCompletedAt: item.dependency_install_completed_at,
    fullStdoutStderrAvailable: Boolean(item.full_stdout_stderr_available),
    governanceActionsAvailable: Boolean(item.governance_actions_available),
    sensitiveDiagnosticsRedacted: item.sensitive_diagnostics_redacted !== false,
  };
}

export function isAbnormalSandboxSession(item: SandboxSessionSummary): boolean {
  return (
    item.status === "failed" ||
    item.dependencyInstallStatus === "failed" ||
    Boolean(item.recentErrorSummary?.trim())
  );
}

export async function getSandboxRuntimeHealth(): Promise<SandboxRuntimeHealth> {
  const response = await http.get<BackendHealth>(`${SANDBOX_RUNTIME_API_PREFIX}/health`, {
    skipErrorToast: true,
  });
  return {
    status: response.data.status ?? "unknown",
    controlPlaneReachable: Boolean(response.data.control_plane_reachable),
    checkedAt: response.data.checked_at,
    maxSessions: response.data.max_sessions ?? 0,
    currentActiveSessions: response.data.current_active_sessions ?? 0,
    currentRunningTasks: response.data.current_running_tasks ?? 0,
    failedSessions: response.data.failed_sessions ?? 0,
    message: response.data.message,
  };
}

export async function getSandboxRuntimePool(): Promise<SandboxRuntimePool> {
  const response = await http.get<BackendPool>(`${SANDBOX_RUNTIME_API_PREFIX}/pool`, {
    skipErrorToast: true,
  });
  return {
    maxSessions: response.data.max_sessions ?? 0,
    activeSessions: response.data.active_sessions ?? 0,
    maxConcurrentTasks: response.data.max_concurrent_tasks ?? 0,
    currentActiveSessions: response.data.current_active_sessions ?? 0,
    currentRunningTasks: response.data.current_running_tasks ?? 0,
    templateId: response.data.template_id,
    sessionResources: response.data.session_resources,
  };
}

export async function listSandboxSessions(
  query: SandboxSessionQuery,
): Promise<SandboxSessionListResult> {
  const response = await http.get<BackendSessionList>(`${SANDBOX_RUNTIME_API_PREFIX}/sessions`, {
    params: buildSandboxSessionQuery(query),
    skipErrorToast: true,
  });
  return {
    items: (response.data.items ?? []).map(mapSandboxSessionSummary),
    total: response.data.total ?? response.data.items?.length ?? 0,
    limit: response.data.limit ?? query.pageSize ?? 20,
    offset: response.data.offset ?? 0,
    hasMore: Boolean(response.data.has_more),
  };
}

export async function getSandboxSessionDetail(sessionId: string): Promise<SandboxSessionDetail> {
  const response = await http.get<BackendSessionDetail>(
    `${SANDBOX_RUNTIME_API_PREFIX}/sessions/${encodeURIComponent(sessionId)}`,
    { skipErrorToast: true },
  );
  return mapSandboxSessionDetail(response.data);
}
