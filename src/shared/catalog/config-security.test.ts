/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";
import { isCatalogVariable, protectCatalogConfigVariables } from "./config-security";

describe("Catalog sensitive variable metadata", () => {
  it("hides only the sensitive value while retaining its name and metadata", () => {
    const config = {
      variables: {
        arbitrary: { value: "private-fixture", sensitive: true },
        tenant: { value: "public" },
      },
      options: { timeout_seconds: 30 },
    };
    expect(protectCatalogConfigVariables(config, "display")).toEqual({
      ...config,
      variables: { arbitrary: { value: "••••••••", sensitive: true }, tenant: { value: "public" } },
    });
    expect(protectCatalogConfigVariables(config, "edit")).toEqual({
      ...config,
      variables: { arbitrary: { sensitive: true }, tenant: { value: "public" } },
    });
    expect(config.variables.arbitrary.value).toBe("private-fixture");
  });
  it.each([
    null,
    "private-fixture",
    { value: "private-fixture", sensitive: "true" },
    { value: "private-fixture", sensitive: null },
    { value: "private-fixture", type: "string" },
    { value: null },
    { value: undefined },
    {},
  ])("hides malformed definitions without turning them into editable values: %j", (variable) => {
    const config = { variables: { arbitrary: variable }, options: { encrypt: true } };
    for (const mode of ["display", "edit"] as const) {
      const result = protectCatalogConfigVariables(config, mode);
      expect(JSON.stringify(result)).not.toContain("private-fixture");
      expect(result.variables).toEqual({ arbitrary: "••••••••" });
      expect(result.options).toEqual({ encrypt: true });
      expect(isCatalogVariable((result.variables as Record<string, unknown>).arbitrary)).toBe(
        false,
      );
    }
  });
  it("preserves false, zero, empty strings and nested null without interpreting business keys as metadata", () => {
    const config = {
      variables: {
        zero: { value: 0 },
        flag: { value: false },
        empty: { value: "" },
        object: { value: { value: "business", sensitive: true } },
        array: { value: [false, null] },
        secret: { sensitive: true },
      },
    };
    expect(protectCatalogConfigVariables(config, "edit")).toEqual(config);
    expect(Object.values(config.variables).every(isCatalogVariable)).toBe(true);
  });
  it("leaves ordinary connector options unchanged", () => {
    const config = { options: { encrypt: true, timeout: 30 } };
    expect(protectCatalogConfigVariables(config, "display")).toEqual(config);
    expect(protectCatalogConfigVariables(config, "edit")).toEqual(config);
  });
});
