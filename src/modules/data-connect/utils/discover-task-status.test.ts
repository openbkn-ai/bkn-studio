/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { isPartiallyCompletedDiscoverTask } from "./discover-task-status";

describe("isPartiallyCompletedDiscoverTask", () => {
  it("identifies completed tasks with failed or skipped resources", () => {
    expect(isPartiallyCompletedDiscoverTask("completed", { failedCount: 1 })).toBe(true);
    expect(isPartiallyCompletedDiscoverTask("completed", { failedCount: 0, skippedCount: 1 })).toBe(
      true,
    );
  });

  it("keeps successful and legacy results completed", () => {
    expect(isPartiallyCompletedDiscoverTask("completed")).toBe(false);
    expect(isPartiallyCompletedDiscoverTask("completed", { failedCount: 0 })).toBe(false);
    expect(isPartiallyCompletedDiscoverTask("completed", { failedCount: 0, skippedCount: 0 })).toBe(
      false,
    );
  });

  it.each(["cancelled", "failed", "pending", "running"] as const)(
    "preserves the %s status even with partial results",
    (status) => {
      expect(isPartiallyCompletedDiscoverTask(status, { failedCount: 1, skippedCount: 1 })).toBe(
        false,
      );
    },
  );
});
