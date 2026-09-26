/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("BKN Trace access profile service", () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
  });

  it("uses only the server-derived whole-record access profile", async () => {
    getMock.mockResolvedValue({
      data: {
        access_scope_fingerprint: "sha256:scope-a",
        allowed_log_categories: [],
        business_provenance_managed_networks: true,
        business_provenance_own: true,
        global_log_search: false,
        log_export: false,
        log_policy_read: false,
        observability_archive_manage: false,
        log_sensitive_fields: false,
        management_audit: false,
        security_audit: false,
        technical_trace: false,
      },
    });
    const { getAccessProfile } = await import("@/modules/bkn-trace/services/trace.service");

    const profile = await getAccessProfile();

    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/access-profile");
    expect(profile).toEqual({
      accessScopeFingerprint: "sha256:scope-a",
      allowedLogCategories: [],
      businessProvenanceManagedNetworks: true,
      businessProvenanceOwn: true,
      globalLogSearch: false,
      logExport: false,
      logPolicyRead: false,
      observabilityArchiveManage: false,
      logSensitiveFields: false,
      managementAudit: false,
      securityAudit: false,
      technicalTrace: false,
      traceEvidenceConfigurationRead: false,
    });
    expect(getMock.mock.calls.flat().join(" ")).not.toContain("roles");
  });

  it("reads the frozen configuration_get contract without inventing operation or queue fields", async () => {
    getMock.mockResolvedValue({
      data: {
        kind: "configuration_get",
        desired_state: "enabled",
        effective_state: "enabled",
        policy_revision: 9,
        last_stable_revision: 8,
        active_operation_id: "op-9",
        heartbeat_interval_seconds: 10,
        lease_ttl_seconds: 30,
        admission_budget: { contract_version: "AdmissionBudgetV1" },
      },
    });

    const { getTraceEvidenceConfiguration } =
      await import("@/modules/bkn-trace/services/trace.service");

    await expect(getTraceEvidenceConfiguration()).resolves.toEqual({
      kind: "configuration_get",
      desiredState: "enabled",
      effectiveState: "enabled",
      policyRevision: 9,
      lastStableRevision: 8,
      activeOperationId: "op-9",
      heartbeatIntervalSeconds: 10,
      leaseTtlSeconds: 30,
    });
    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/trace-evidence-configuration");
  });

  it("reads an active operation through its separate operation resource", async () => {
    getMock.mockResolvedValue({
      data: {
        id: "op-9",
        phase: "enabling",
        requested_state: "enabled",
        expected_revision: 9,
      },
    });
    const { getTraceEvidenceConfiguration } =
      await import("@/modules/bkn-trace/services/trace.service");
    const { getTraceEvidenceOperation } =
      await import("@/modules/bkn-trace/services/trace.service");

    await expect(getTraceEvidenceOperation("op-9")).resolves.toEqual({
      id: "op-9",
      phase: "enabling",
      requestedState: "enabled",
      expectedRevision: 9,
    });
    expect(getMock).toHaveBeenCalledWith("/agent-observability/v1/trace-evidence-operations/op-9");
    expect(getTraceEvidenceConfiguration).toBeTypeOf("function");
  });

  it("normalizes missing configuration states without fabricating queue or gap data", async () => {
    getMock.mockResolvedValue({ data: { kind: "configuration_get", policy_revision: 10 } });
    const { getTraceEvidenceConfiguration } =
      await import("@/modules/bkn-trace/services/trace.service");

    await expect(getTraceEvidenceConfiguration()).resolves.toMatchObject({
      desiredState: "unknown",
      effectiveState: "unknown",
      policyRevision: 10,
      activeOperationId: undefined,
    });
  });
});
