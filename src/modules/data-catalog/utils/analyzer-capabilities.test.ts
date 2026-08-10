/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it, vi } from "vitest";

const getIndexCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/modules/data-catalog/services/index-capability.service", () => ({
  getIndexCapabilities: getIndexCapabilitiesMock,
}));

import { findUnavailableAnalyzers, loadAnalyzerCapabilities } from "./analyzer-capabilities";

describe("loadAnalyzerCapabilities", () => {
  it("keeps english when the server advertises it", async () => {
    getIndexCapabilitiesMock.mockResolvedValue({ checkedAt: 1, fulltextAnalyzers: ["standard", "english"] });

    await expect(loadAnalyzerCapabilities()).resolves.toEqual({
      state: "ready",
      options: ["standard", "english"],
      errorMessage: null,
    });
  });

  it("does not create a fallback when the server returns no analyzers", async () => {
    getIndexCapabilitiesMock.mockResolvedValue({ checkedAt: 1, fulltextAnalyzers: [] });

    await expect(loadAnalyzerCapabilities()).resolves.toEqual({ state: "empty", options: [], errorMessage: null });
  });

  it("identifies saved analyzers not in the snapshot", () => {
    expect(findUnavailableAnalyzers(["standard"], ["standard", "ik_max_word", "ik_max_word", " "])).toEqual(["ik_max_word"]);
  });
});
