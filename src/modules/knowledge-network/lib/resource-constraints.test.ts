/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  RESOURCE_IDENTIFIER_PATTERN,
  RESOURCE_ID_MAX_LENGTH,
  RESOURCE_NAME_COUNT,
  RESOURCE_NAME_MAX_LENGTH,
} from "./resource-constraints";

describe("knowledge-network resource constraints", () => {
  it("matches the backend 128-character identity contract", () => {
    const validId = "a".repeat(RESOURCE_ID_MAX_LENGTH);
    expect(validId).toHaveLength(128);
    expect(RESOURCE_IDENTIFIER_PATTERN.test(validId)).toBe(true);
    expect(RESOURCE_IDENTIFIER_PATTERN.test(`${validId}a`)).toBe(false);
    expect("名".repeat(RESOURCE_NAME_MAX_LENGTH)).toHaveLength(128);
  });

  it("keeps the resource ID character rules", () => {
    expect(RESOURCE_IDENTIFIER_PATTERN.test("_resource")).toBe(false);
    expect(RESOURCE_IDENTIFIER_PATTERN.test("Resource")).toBe(false);
    expect(RESOURCE_IDENTIFIER_PATTERN.test("resource@id")).toBe(false);
  });

  it("counts and truncates resource names by Unicode code point", () => {
    const validName = "😀".repeat(RESOURCE_NAME_MAX_LENGTH);
    const oversizedName = `${validName}😀`;

    expect(RESOURCE_NAME_COUNT.strategy(validName)).toBe(128);
    expect(
      RESOURCE_NAME_COUNT.exceedFormatter(oversizedName, {
        max: RESOURCE_NAME_MAX_LENGTH,
      }),
    ).toBe(validName);
  });
});
