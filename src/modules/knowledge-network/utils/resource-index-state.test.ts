/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  formatResourceIndexStateLabel,
  hasServingResourceIndex,
} from "@/modules/knowledge-network/utils/resource-index-state";

describe("hasServingResourceIndex", () => {
  it("returns true only for an available Resource index", () => {
    expect(hasServingResourceIndex("available")).toBe(true);
  });

  it("returns false for unavailable Resource indexes", () => {
    expect(hasServingResourceIndex("stale")).toBe(false);
    expect(hasServingResourceIndex("unavailable")).toBe(false);
  });
});

describe("formatResourceIndexStateLabel", () => {
  it("uses data-catalog index state labels", () => {
    const t = ((key: string) => key) as never;
    expect(formatResourceIndexStateLabel("available", t)).toBe("dataCatalog.indexState.built");
    expect(formatResourceIndexStateLabel("unavailable", t)).toBe("dataCatalog.indexState.none");
  });
});
