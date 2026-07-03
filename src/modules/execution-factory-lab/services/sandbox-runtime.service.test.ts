/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  SANDBOX_RUNTIME_API_PREFIX,
  buildSandboxSessionQuery,
  formatResourceLimit,
  isAbnormalSandboxSession,
  mapSandboxSessionSummary,
} from "@/modules/execution-factory-lab/services/sandbox-runtime.service";

describe("sandbox-runtime.service", () => {
  it("uses the http client relative API prefix without duplicating /api", () => {
    expect(SANDBOX_RUNTIME_API_PREFIX).toBe(
      "/agent-operator-integration/internal-v1/sandbox",
    );
    expect(SANDBOX_RUNTIME_API_PREFIX).not.toMatch(/^\/api\//);
  });

  it("builds query params for the real operator-integration sandbox API", () => {
    expect(
      buildSandboxSessionQuery({
        page: 2,
        pageSize: 20,
        status: "failed",
        source: "function_debug",
        runtime: "python",
        abnormalOnly: true,
      }),
    ).toEqual({
      limit: 20,
      offset: 20,
      status: "failed",
      source: "function_debug",
      runtime: "python",
      abnormal_only: true,
    });
  });

  it("maps business troubleshooting fields from backend session summaries", () => {
    const mapped = mapSandboxSessionSummary({
      id: "sess_aoi_1",
      status: "failed",
      source: "skill_execution",
      task_id: "task_001",
      capability_id: "cap_001",
      capability_name: "合同摘要 Skill",
      user_id: "user_001",
      user_name: "alice",
      template_id: "python-basic",
      runtime_type: "python",
      language_runtime: "python3.11",
      resource_limit: { cpu: "1", memory: "512Mi" },
      dependency_install_status: "failed",
      recent_error_summary: "numpy version conflict",
      last_activity_at: "2026-07-02T09:30:00Z",
    });

    expect(mapped.id).toBe("sess_aoi_1");
    expect(mapped.capabilityName).toBe("合同摘要 Skill");
    expect(mapped.userName).toBe("alice");
    expect(mapped.resourceText).toBe("1 / 512Mi");
    expect(isAbnormalSandboxSession(mapped)).toBe(true);
  });

  it("formats missing resources without inventing values", () => {
    expect(formatResourceLimit(undefined)).toBe("-");
    expect(formatResourceLimit({ cpu: "2" })).toBe("2 / -");
    expect(formatResourceLimit({ memory: "1Gi" })).toBe("- / 1Gi");
  });
});
