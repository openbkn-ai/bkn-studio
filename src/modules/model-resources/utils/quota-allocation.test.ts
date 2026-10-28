/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { UserQuotaRecord } from "../types/quota";
import { isQuotaAllocationExceeded } from "./quota-allocation";

function row(
  inputTokens: number,
  inputUnit = 1,
  outputTokens = 0,
  outputUnit = 1,
): UserQuotaRecord {
  return {
    userId: "u1",
    userName: "Test user",
    modelQuotaId: "q1",
    inputTokens,
    outputTokens,
    numType: [inputUnit, outputUnit],
  };
}

describe("net user quota allocation", () => {
  it("does not count an unchanged existing allocation against the remainder twice", () => {
    expect(isQuotaAllocationExceeded([row(9)], [row(9)], 1000, "inputTokens")).toBe(false);
  });

  it("allows exact exhaustion and rejects exceeding by one token", () => {
    expect(isQuotaAllocationExceeded([row(10)], [row(1)], 9000, "inputTokens")).toBe(false);
    expect(isQuotaAllocationExceeded([row(10.001)], [row(1)], 9000, "inputTokens")).toBe(true);
  });

  it("normalizes independently selected units, including the backend/UI hundred-million alias", () => {
    expect(isQuotaAllocationExceeded([row(0.01, 4)], [row(1)], 9000, "inputTokens")).toBe(false);
    expect(isQuotaAllocationExceeded([row(0.011, 4)], [row(1)], 9000, "inputTokens")).toBe(true);
    expect(isQuotaAllocationExceeded([row(1, 6)], [row(1, 3)], 0, "inputTokens")).toBe(false);
  });

  it("credits removals and reductions when allocating to other users", () => {
    expect(isQuotaAllocationExceeded([row(10)], [row(4), row(5)], 1000, "inputTokens")).toBe(false);
    expect(isQuotaAllocationExceeded([row(2), row(8)], [row(9)], 1000, "inputTokens")).toBe(false);
    expect(isQuotaAllocationExceeded([row(2), row(8.001)], [row(9)], 1000, "inputTokens")).toBe(
      true,
    );
    expect(isQuotaAllocationExceeded([], [row(9)], 1000, "inputTokens")).toBe(false);
  });

  it("checks output independently and keeps decimal arithmetic exact", () => {
    expect(
      isQuotaAllocationExceeded([row(0, 1, 2, 4)], [row(0, 1, 100, 1)], 1900000, "outputTokens"),
    ).toBe(false);
    expect(
      isQuotaAllocationExceeded(
        [row(0, 1, 2.000001, 4)],
        [row(0, 1, 100, 1)],
        1900000,
        "outputTokens",
      ),
    ).toBe(true);
    expect(isQuotaAllocationExceeded([row(0.1), row(0.2)], [], 300, "inputTokens")).toBe(false);
  });

  it("handles zero remainder, unconfigured quotas and an initially empty allocation", () => {
    expect(isQuotaAllocationExceeded([row(1)], [], 0, "inputTokens")).toBe(true);
    expect(isQuotaAllocationExceeded([row(0)], [], 0, "inputTokens")).toBe(false);
    expect(isQuotaAllocationExceeded([row(100)], [], -1, "inputTokens")).toBe(false);
  });
});
