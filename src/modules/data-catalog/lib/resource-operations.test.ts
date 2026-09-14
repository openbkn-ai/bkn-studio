/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { hasResourceOperation } from "@/modules/data-catalog/lib/resource-operations";

describe("hasResourceOperation", () => {
  it("keeps view-only resources from inheriting another resource's modify grant", () => {
    expect(hasResourceOperation({ operations: ["modify"] }, "modify")).toBe(true);
    expect(hasResourceOperation({ operations: ["view_detail"] }, "modify")).toBe(false);
  });

  it("honors object-level wildcards and fails closed when operations are absent", () => {
    expect(hasResourceOperation({ operations: ["*"] }, "query_data")).toBe(true);
    expect(hasResourceOperation({}, "query_data")).toBe(false);
  });
});
