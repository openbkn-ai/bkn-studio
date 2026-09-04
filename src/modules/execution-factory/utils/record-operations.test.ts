/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { hasExecutionUnitRecordOperation } from "./record-operations";

describe("hasExecutionUnitRecordOperation", () => {
  it("fails closed for missing operations and supports the wildcard operation", () => {
    expect(hasExecutionUnitRecordOperation(undefined, "authorize")).toBe(false);
    expect(hasExecutionUnitRecordOperation({}, "authorize")).toBe(false);
    expect(hasExecutionUnitRecordOperation({ operations: ["view"] }, "authorize")).toBe(false);
    expect(hasExecutionUnitRecordOperation({ operations: ["*"] }, "authorize")).toBe(true);
  });
});
