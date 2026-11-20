/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { releaseItemName } from "./itemName";

const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key}:${JSON.stringify(values)}` : key) as unknown as TFunction;

describe("releaseItemName", () => {
  it("names an item, a relation by the object types it joins, and one the model no longer has", () => {
    expect(releaseItemName(t, { name: "Customer" })).toBe("Customer");
    expect(
      releaseItemName(t, { name: "Material", source_name: "BOM", target_name: "Material" }),
    ).toBe(
      'bknProject.release.publish.relationEnds:{"name":"Material","source":"BOM","target":"Material"}',
    );
    // Never its id: an item without a name reads as one no longer in the model.
    expect(releaseItemName(t, { name: "" })).toBe("bknProject.release.publish.removedItem");
  });
});
