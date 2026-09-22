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

export type CapturePolicyState = "enabled" | "disabled" | "enabling" | "disabling" | "rolling_back";
export type CapturePolicyPhase =
  | "pending"
  | "enabling"
  | "disabling"
  | "rolling_back"
  | "succeeded"
  | "failed"
  | "rollback_completed"
  | "rollback_failed";
export type CapturePolicy = {
  revision: number;
  desiredState: CapturePolicyState;
  effectiveState: CapturePolicyState;
  lastStableRevision: number;
  coverageGap: boolean;
  operation: {
    id: string;
    phase: CapturePolicyPhase;
    requestedState: CapturePolicyState;
    expectedRevision: number;
    errorCode?: string;
  };
  acknowledgements: Array<{
    instanceId: string;
    generation: string;
    ready: boolean;
    state: string;
    queueDisposition: {
      exported: number;
      dropped: number;
      unaccounted: number | null;
    };
    revision: number;
  }>;
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

type BackendCapturePolicy = {
  revision?: number;
  desired_state?: CapturePolicyState;
  effective_state?: CapturePolicyState;
  last_stable_revision?: number;
  coverage_gap?: boolean;
  operation?: {
    id?: string;
    phase?: CapturePolicyPhase;
    requested_state?: CapturePolicyState;
    expected_revision?: number;
    error_code?: string;
  };
  acknowledgements?: Array<{
    instance_id?: string;
    generation?: string;
    ready?: boolean;
    state?: string;
    queue_disposition?: {
      exported?: number;
      dropped?: number;
      unaccounted?: number | null;
    };
    revision?: number;
  }>;
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

export async function getTraceEvidenceConfiguration(): Promise<CapturePolicy> {
  const response = await http.get<BackendCapturePolicy>(
    `${OBSERVABILITY_API_PREFIX}/trace-evidence-configuration`,
  );
  const data = response.data;
  return {
    revision: data.revision ?? 0,
    desiredState: data.desired_state ?? "disabled",
    effectiveState: data.effective_state ?? "disabled",
    lastStableRevision: data.last_stable_revision ?? 0,
    coverageGap: Boolean(data.coverage_gap),
    operation: {
      id: data.operation?.id ?? "",
      phase: data.operation?.phase ?? "failed",
      requestedState: data.operation?.requested_state ?? "disabled",
      expectedRevision: data.operation?.expected_revision ?? 0,
      errorCode: data.operation?.error_code,
    },
    acknowledgements: (data.acknowledgements ?? []).map((ack) => ({
      instanceId: ack.instance_id ?? "",
      generation: ack.generation ?? "",
      ready: Boolean(ack.ready),
      state: ack.state ?? "gap",
      queueDisposition: {
        exported: ack.queue_disposition?.exported ?? 0,
        dropped: ack.queue_disposition?.dropped ?? 0,
        unaccounted: ack.queue_disposition?.unaccounted ?? null,
      },
      revision: ack.revision ?? 0,
    })),
  };
}
