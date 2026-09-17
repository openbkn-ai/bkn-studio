/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  hasCatalogOperation,
  isCatalogSummaryOnly,
} from "@/shared/catalog/catalog-operations";

describe("hasCatalogOperation", () => {
  it("does not leak an operation from one catalog to another", () => {
    const writableCatalog = { operations: ["modify", "view_detail"] };
    const viewOnlyCatalog = { operations: ["view_detail"] };

    expect(hasCatalogOperation(writableCatalog, "modify")).toBe(true);
    expect(hasCatalogOperation(viewOnlyCatalog, "modify")).toBe(false);
  });

  it("honors object-level wildcards and fails closed without an object", () => {
    expect(hasCatalogOperation({ operations: ["*"] }, "delete")).toBe(true);
    expect(hasCatalogOperation(undefined, "delete")).toBe(false);
  });

  it("identifies the Catalog summary derived from child Resource access", () => {
    expect(isCatalogSummaryOnly({ operations: ["view_summary"] })).toBe(true);
    expect(isCatalogSummaryOnly({ operations: ["view_detail", "view_summary"] })).toBe(false);
    expect(isCatalogSummaryOnly({ operations: ["modify"] })).toBe(false);
    expect(isCatalogSummaryOnly({ operations: ["*"] })).toBe(false);
    expect(isCatalogSummaryOnly(undefined)).toBe(false);
  });
});
