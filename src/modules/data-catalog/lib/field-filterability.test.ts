/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { canEnableFieldFiltering, findUnsupportedFilterableField } from "./field-filterability";

describe("field filterability", () => {
  it.each([
    "integer",
    "unsigned integer",
    "large_integer",
    "float",
    "decimal",
    "string",
    "text",
    "date",
    "time",
    "datetime",
    "timestamp",
    "boolean",
    "vector",
  ])("permits enabling unified type %s", (type) => {
    expect(canEnableFieldFiltering(type)).toBe(true);
  });

  it.each(["binary", "other", "json", "point", "shape", "ip", "future_type", "", "keyword", "int"])(
    "does not enable unsupported or native type %s",
    (type) => expect(canEnableFieldFiltering(type)).toBe(false),
  );

  it("only rejects explicitly enabled unsupported fields without changing source metadata", () => {
    const schema = [
      { name: "missing", type: "future_type" },
      { name: "disabled", type: "binary", filterable: false },
      { name: "enabled", type: "string", filterable: true },
      { name: "invalid", type: "json", filterable: true },
    ];
    const before = structuredClone(schema);
    expect(findUnsupportedFilterableField(schema)).toBe(schema[3]);
    expect(schema).toEqual(before);
    expect(findUnsupportedFilterableField(schema.slice(0, 3))).toBeUndefined();
  });
});
