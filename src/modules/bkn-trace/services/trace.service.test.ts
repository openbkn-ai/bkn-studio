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
    });
    expect(getMock.mock.calls.flat().join(" ")).not.toContain("roles");
  });
});
