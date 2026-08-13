/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { formatDiscoverTaskTime } from "@/modules/data-connect/utils/discover-task-time";

describe("formatDiscoverTaskTime", () => {
  it("renders missing and zero task timestamps as empty values", () => {
    expect(formatDiscoverTaskTime()).toBe("-");
    expect(formatDiscoverTaskTime(0)).toBe("-");
  });

  it("formats a populated task timestamp", () => {
    expect(formatDiscoverTaskTime(Date.UTC(2026, 7, 13))).not.toBe("-");
  });
});
