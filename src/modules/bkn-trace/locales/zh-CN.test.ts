/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { bknTraceZhCN } from "@/modules/bkn-trace/locales/zh-CN";

describe("BKN Trace Chinese business hierarchy", () => {
  it("uses business-readable labels for all three provenance levels", () => {
    expect(bknTraceZhCN.bknTrace.views).toEqual({
      conversations: "业务会话",
      interactions: "交互轮次",
      requests: "OpenBKN 调用",
    });
    expect(bknTraceZhCN.bknTrace.businessProvenance.description).toContain(
      "业务会话、交互轮次和 OpenBKN 调用",
    );
  });

  it("provides a readable label for sources that are not integrated", () => {
    expect(bknTraceZhCN.bknTrace.settings.status.not_integrated).toBe("未接入");
  });

  it("describes source integration without treating runtime telemetry as a business module", () => {
    expect(bknTraceZhCN.bknTrace.settings.status.healthy).toBe("已接入");
    expect(bknTraceZhCN.bknTrace.logs.modules.openbkn).toBe("技术运行日志（非操作日志）");
  });
});
