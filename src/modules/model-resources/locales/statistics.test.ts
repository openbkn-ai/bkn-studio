/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { modelResourcesEnUS } from "@/modules/model-resources/locales/en-US";
import { modelResourcesZhCN } from "@/modules/model-resources/locales/zh-CN";

describe("model statistics locales", () => {
  it("uses standard model-call terminology in English", () => {
    const statistics = modelResourcesEnUS.modelResources.statistics;

    expect(statistics.metrics.usageCount).toBe("Model calls");
    expect(statistics.metrics.times).toBe("calls");
    expect(statistics.charts.timeAndFirstToken).toBe("Model latency and time to first token");
  });

  it("localizes token chart legends in Chinese", () => {
    const statistics = modelResourcesZhCN.modelResources.statistics;

    expect(statistics.charts.inputTokens).toBe("输入 Tokens");
    expect(statistics.charts.outputTokens).toBe("输出 Tokens");
  });
});
