/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { KnowledgeNetworkRecord } from "@/modules/knowledge-network/types/knowledge-network";

import {
  commitMetricsTotalUpdate,
  createMetricsTotalPending,
  mergePendingMetricsTotalIntoDetail,
} from "./workspaceMetricsTotal";

function createDetail(metricsTotal = 0): KnowledgeNetworkRecord {
  return {
    color: "#1677ff",
    createTime: "2026-01-01",
    creatorName: "admin",
    description: "",
    id: "kn-1",
    identifier: "kn-1",
    name: "Test KN",
    statistics: {
      actionTypesTotal: 0,
      conceptGroupsTotal: 0,
      metricsTotal,
      objectTypesTotal: 0,
      relationTypesTotal: 0,
    },
    tags: [],
    updateTime: "2026-01-01",
    updaterName: "admin",
  };
}

describe("workspaceMetricsTotal", () => {
  it("stores total in pending synchronously when detail is not loaded yet", () => {
    const pending = createMetricsTotalPending();

    expect(commitMetricsTotalUpdate(null, 12, pending)).toBeNull();
    expect(pending.value).toBe(12);
  });

  it("merges pending total when detail arrives after metrics list", () => {
    const pending = createMetricsTotalPending();
    commitMetricsTotalUpdate(null, 12, pending);

    const merged = mergePendingMetricsTotalIntoDetail(createDetail(0), pending);

    expect(merged.statistics.metricsTotal).toBe(12);
    expect(pending.value).toBeNull();
  });

  it("survives loadDetail reading pending before React applies detail updates", () => {
    const pending = createMetricsTotalPending();
    commitMetricsTotalUpdate(null, 12, pending);

    const merged = mergePendingMetricsTotalIntoDetail(createDetail(0), pending);

    expect(merged.statistics.metricsTotal).toBe(12);
  });

  it("applies total immediately when detail is already loaded", () => {
    const pending = createMetricsTotalPending();

    const updated = commitMetricsTotalUpdate(createDetail(0), 8, pending);

    expect(updated?.statistics.metricsTotal).toBe(8);
    expect(pending.value).toBeNull();
  });
});
