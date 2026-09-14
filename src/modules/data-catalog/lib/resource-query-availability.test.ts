/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import type { CatalogResource } from "@/modules/data-catalog/types/data-catalog";

import { resourceQueryBlockReason } from "./resource-query-availability";

const resource: CatalogResource = {
  catalogId: "catalog-1",
  localIndexStatus: "unavailable",
  category: "table",
  columnCount: 1,
  description: "",
  id: "resource-1",
  name: "orders",
  rowCount: 0,
  schema: [{ name: "id", type: "integer" }],
  sourceIdentifier: "public.orders",
  expectedUpdateTime: 0,
  updateTime: "-",
};

describe("resourceQueryBlockReason", () => {
  it("gives disabled state precedence over a missing discovery result", () => {
    expect(resourceQueryBlockReason({
      ...resource,
      enabled: false,
      lastDiscoverStatus: "missing",
    })).toBe("disabled");
  });

  it("blocks a missing resource even when its previous fields remain", () => {
    expect(resourceQueryBlockReason({ ...resource, lastDiscoverStatus: "missing" })).toBe(
      "missing",
    );
  });

  it("blocks any resource with no fields", () => {
    expect(resourceQueryBlockReason({ ...resource, category: "dataset", schema: [] })).toBe(
      "metadata_unavailable",
    );
  });

  it("uses the list endpoint field count when supplied", () => {
    expect(resourceQueryBlockReason({ ...resource, schema: [] }, 1)).toBeNull();
  });

  it("does not treat an omitted list field count as an empty schema", () => {
    expect(resourceQueryBlockReason({ ...resource, columnCount: null, schema: [] }, null)).toBeNull();
  });

  it("blocks a stale resource even when its previous fields remain", () => {
    expect(resourceQueryBlockReason({ ...resource, status: "stale" })).toBe("stale");
  });

  it("gives stale lifecycle status precedence over a missing discovery result", () => {
    expect(resourceQueryBlockReason({
      ...resource,
      lastDiscoverStatus: "missing",
      status: "stale",
    })).toBe("stale");
  });

  it("allows deprecated resources while metadata remains available", () => {
    expect(resourceQueryBlockReason({ ...resource, status: "deprecated" })).toBeNull();
  });

  it("allows a discovery error when the last known fields remain", () => {
    expect(resourceQueryBlockReason({ ...resource, lastDiscoverStatus: "error" })).toBeNull();
  });
});
