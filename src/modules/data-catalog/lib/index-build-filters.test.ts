/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  applyIndexBuildListFilters,
  readIndexBuildListFilters,
  readResourceIndexView,
} from "@/modules/data-catalog/lib/index-build-filters";

describe("index build list filters", () => {
  it("ignores and clears retired catalog and resource filters", () => {
    const filters = readIndexBuildListFilters(
      new URLSearchParams("catalogId=cat-001&resourceId=res-001&mode=batch"),
    );

    expect(filters).toEqual({ executeType: undefined, mode: "batch", statuses: [] });
    expect(applyIndexBuildListFilters(
      new URLSearchParams("catalogId=cat-001&resourceId=res-001"),
      filters,
    ).toString()).toBe("mode=batch");
  });

  it("persists a valid execution-type filter and ignores an invalid value", () => {
    expect(readIndexBuildListFilters(new URLSearchParams("execute_type=incremental")))
      .toEqual({ executeType: "incremental", mode: undefined, statuses: [] });
    expect(readIndexBuildListFilters(new URLSearchParams("execute_type=streaming")))
      .toEqual({ executeType: undefined, mode: undefined, statuses: [] });
    expect(applyIndexBuildListFilters(
      new URLSearchParams(),
      { executeType: "full", mode: undefined, statuses: [] },
    ).toString()).toBe("execute_type=full");
  });
});

describe("readResourceIndexView", () => {
  it("opens configuration when the data-index sub-tab is not specified", () => {
    expect(readResourceIndexView("index", null)).toBe("config");
  });

  it("preserves an explicitly requested task view", () => {
    expect(readResourceIndexView("index", "tasks")).toBe("tasks");
  });
});
