/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { BuildTask } from "@/modules/data-catalog/types/data-catalog";
import {
  formatResourceIndexStateLabel,
  hasServingResourceIndex,
} from "@/modules/knowledge-network/utils/resource-index-state";

const succeededTask: BuildTask = {
  createdAt: 2,
  id: "task-2",
  mode: "batch",
  resourceId: "res-1",
  status: "succeeded",
  syncedCount: 10,
  totalCount: 10,
  vectorizedCount: 10,
};

const failedTask: BuildTask = {
  createdAt: 3,
  id: "task-3",
  mode: "batch",
  resourceId: "res-1",
  status: "failed",
  syncedCount: 0,
  totalCount: 10,
  vectorizedCount: 0,
};

describe("hasServingResourceIndex", () => {
  it("returns true when a succeeded build exists", () => {
    expect(hasServingResourceIndex([failedTask, succeededTask])).toBe(true);
  });

  it("returns false when there are no serving tasks", () => {
    expect(hasServingResourceIndex([])).toBe(false);
    expect(hasServingResourceIndex([failedTask])).toBe(false);
  });
});

describe("formatResourceIndexStateLabel", () => {
  it("uses data-catalog index state labels", () => {
    const t = ((key: string) => key) as never;
    expect(formatResourceIndexStateLabel([succeededTask], t)).toBe("dataCatalog.indexState.built");
    expect(formatResourceIndexStateLabel([], t)).toBe("dataCatalog.indexState.none");
  });
});
