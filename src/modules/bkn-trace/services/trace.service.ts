/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { http } from "@/framework/request/http";

const OBSERVABILITY_API_PREFIX = "/agent-observability/v1";

export type TraceAccessProfile = {
  accessScopeFingerprint: string;
  allowedLogCategories: string[];
  businessProvenanceManagedNetworks: boolean;
  businessProvenanceOwn: boolean;
  globalLogSearch: boolean;
  logExport: boolean;
  logPolicyRead: boolean;
  observabilityArchiveManage: boolean;
  logSensitiveFields: boolean;
  managementAudit: boolean;
  securityAudit: boolean;
  technicalTrace: boolean;
  traceEvidenceConfigurationRead: boolean;
};

export type CapturePolicyState =
  "enabled" | "disabled" | "enabling" | "disabling" | "rolling_back" | "unknown";
export type CapturePolicyPhase =
  | "pending"
  | "enabling"
  | "disabling"
  | "rolling_back"
  | "succeeded"
  | "failed"
  | "rollback_completed"
  | "rollback_failed"
  | "unknown";

const capturePolicyStates = new Set<CapturePolicyState>([
  "enabled",
  "disabled",
  "enabling",
  "disabling",
  "rolling_back",
]);
const capturePolicyPhases = new Set<CapturePolicyPhase>([
  "pending",
  "enabling",
  "disabling",
  "rolling_back",
  "succeeded",
  "failed",
  "rollback_completed",
  "rollback_failed",
]);

function normalizeCapturePolicyState(value?: string): CapturePolicyState {
  return value && capturePolicyStates.has(value as CapturePolicyState)
    ? (value as CapturePolicyState)
    : "unknown";
}

function normalizeCapturePolicyPhase(value?: string): CapturePolicyPhase {
  return value && capturePolicyPhases.has(value as CapturePolicyPhase)
    ? (value as CapturePolicyPhase)
    : "unknown";
}
export type CapturePolicyConfiguration = {
  kind?: string;
  desiredState: CapturePolicyState;
  effectiveState: CapturePolicyState;
  policyRevision: number;
  lastStableRevision: number;
  activeOperationId?: string;
  heartbeatIntervalSeconds: number;
  leaseTtlSeconds: number;
};

export type CapturePolicyOperation = {
  id: string;
  phase: CapturePolicyPhase;
  requestedState: CapturePolicyState;
  expectedRevision: number;
  errorCode?: string;
};

type BackendTraceAccessProfile = {
  access_scope_fingerprint?: string;
  allowed_log_categories?: string[];
  business_provenance_managed_networks?: boolean;
  business_provenance_own?: boolean;
  global_log_search?: boolean;
  log_export?: boolean;
  log_policy_read?: boolean;
  observability_archive_manage?: boolean;
  log_sensitive_fields?: boolean;
  management_audit?: boolean;
  security_audit?: boolean;
  technical_trace?: boolean;
  trace_evidence_configuration_read?: boolean;
};

type BackendCapturePolicyOperation = {
  id?: string;
  phase?: CapturePolicyPhase;
  requested_state?: CapturePolicyState;
  expected_revision?: number;
  error_code?: string;
};

function normalizeCapturePolicyOperation(
  data: BackendCapturePolicyOperation,
): CapturePolicyOperation {
  return {
    id: data.id ?? "",
    phase: normalizeCapturePolicyPhase(data.phase),
    requestedState: normalizeCapturePolicyState(data.requested_state),
    expectedRevision: data.expected_revision ?? 0,
    errorCode: data.error_code,
  };
}

type BackendCapturePolicy = {
  kind?: string;
  desired_state?: CapturePolicyState;
  effective_state?: CapturePolicyState;
  policy_revision?: number;
  last_stable_revision?: number;
  active_operation_id?: string;
  heartbeat_interval_seconds?: number;
  lease_ttl_seconds?: number;
};

export async function getAccessProfile(): Promise<TraceAccessProfile> {
  const response = await http.get<BackendTraceAccessProfile>(
    `${OBSERVABILITY_API_PREFIX}/access-profile`,
  );
  return {
    accessScopeFingerprint: response.data.access_scope_fingerprint ?? "",
    allowedLogCategories: response.data.allowed_log_categories ?? [],
    businessProvenanceManagedNetworks: Boolean(response.data.business_provenance_managed_networks),
    businessProvenanceOwn: Boolean(response.data.business_provenance_own),
    globalLogSearch: Boolean(response.data.global_log_search),
    logExport: Boolean(response.data.log_export),
    logPolicyRead: Boolean(response.data.log_policy_read),
    observabilityArchiveManage: Boolean(response.data.observability_archive_manage),
    logSensitiveFields: Boolean(response.data.log_sensitive_fields),
    managementAudit: Boolean(response.data.management_audit),
    securityAudit: Boolean(response.data.security_audit),
    technicalTrace: Boolean(response.data.technical_trace),
    traceEvidenceConfigurationRead: Boolean(response.data.trace_evidence_configuration_read),
  };
}

export async function getTraceEvidenceConfiguration(): Promise<CapturePolicyConfiguration> {
  const response = await http.get<BackendCapturePolicy>(
    `${OBSERVABILITY_API_PREFIX}/trace-evidence-configuration`,
  );
  const data = response.data;
  return {
    kind: data.kind,
    desiredState: normalizeCapturePolicyState(data.desired_state),
    effectiveState: normalizeCapturePolicyState(data.effective_state),
    policyRevision: data.policy_revision ?? 0,
    lastStableRevision: data.last_stable_revision ?? 0,
    activeOperationId: data.active_operation_id,
    heartbeatIntervalSeconds: data.heartbeat_interval_seconds ?? 0,
    leaseTtlSeconds: data.lease_ttl_seconds ?? 0,
  };
}

export async function getTraceEvidenceOperation(
  operationId: string,
): Promise<CapturePolicyOperation> {
  const response = await http.get<BackendCapturePolicyOperation>(
    `${OBSERVABILITY_API_PREFIX}/trace-evidence-operations/${encodeURIComponent(operationId)}`,
  );
  return normalizeCapturePolicyOperation(response.data);
}
