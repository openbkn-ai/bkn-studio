/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { coerceSampleValue, logicValueFrom } from "./logic-statement-trial";

describe("logicValueFrom", () => {
  it("takes the one value of one row", () => {
    expect(logicValueFrom({ columns: [{ name: "value" }], entries: [{ value: 42 }] })).toEqual({
      ok: true,
      value: 42,
    });
  });

  it("answers null for no row", () => {
    expect(logicValueFrom({ columns: [{ name: "value" }], entries: [] })).toEqual({
      ok: true,
      value: null,
    });
  });

  it("refuses more than one row or column", () => {
    expect(logicValueFrom({ columns: [{ name: "v" }], entries: [{ v: 1 }, { v: 2 }] })).toEqual({
      ok: false,
      reason: "rows",
    });
    expect(
      logicValueFrom({ columns: [{ name: "a" }, { name: "b" }], entries: [{ a: 1, b: 2 }] }),
    ).toEqual({ ok: false, reason: "columns" });
  });
});

describe("coerceSampleValue", () => {
  it("reads numbers and booleans by the property type", () => {
    expect(coerceSampleValue("12", "integer")).toBe(12);
    expect(coerceSampleValue("true", "boolean")).toBe(true);
    expect(coerceSampleValue("12", "string")).toBe("12");
    expect(coerceSampleValue("x", "integer")).toBe("x");
  });
});
