/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { readResourceIndexView } from "@/modules/data-catalog/lib/index-build-filters";

describe("readResourceIndexView", () => {
  it("opens configuration when the data-index sub-tab is not specified", () => {
    expect(readResourceIndexView("index", null)).toBe("config");
  });

  it("preserves an explicitly requested task view", () => {
    expect(readResourceIndexView("index", "tasks")).toBe("tasks");
  });
});
