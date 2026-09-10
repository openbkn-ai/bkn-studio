/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { isValidSemanticUnderstandingSampleRows } from "./semantic-understanding-task-validation";

describe("isValidSemanticUnderstandingSampleRows", () => {
  it.each([1, 20])("accepts valid sample row limits: %s", (value) => {
    expect(isValidSemanticUnderstandingSampleRows(value)).toBe(true);
  });

  it.each([0, 21, 30, -1, 1.5, Number.NaN, undefined])("rejects invalid sample row limits: %s", (value) => {
    expect(isValidSemanticUnderstandingSampleRows(value)).toBe(false);
  });
});
