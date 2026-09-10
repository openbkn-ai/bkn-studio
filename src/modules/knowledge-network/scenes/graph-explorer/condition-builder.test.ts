/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildCondition, propertyKind } from "./condition-builder";

describe("propertyKind", () => {
  it("maps backend type names onto operator families", () => {
    expect(propertyKind("string")).toBe("string");
    expect(propertyKind("VARCHAR(64)")).toBe("string");
    expect(propertyKind("integer")).toBe("number");
    expect(propertyKind("decimal(10,2)")).toBe("number");
    expect(propertyKind("boolean")).toBe("bool");
    expect(propertyKind("datetime")).toBe("date");
    expect(propertyKind(undefined)).toBe("any");
    expect(propertyKind("geometry")).toBe("any");
  });
});

describe("buildCondition", () => {
  const properties = [
    { name: "name", type: "string" },
    { name: "amount", type: "double" },
    { name: "active", type: "bool" },
  ];

  it("ignores incomplete rows and returns null when nothing is left", () => {
    expect(buildCondition([{ field: "", operator: "==", value: "x" }, { field: "name", operator: "==", value: "  " }], properties)).toBeNull();
  });

  it("emits a single leaf for one row and coerces by property type", () => {
    expect(buildCondition([{ field: "amount", operator: ">", value: " 12.5 " }], properties)).toEqual({ field: "amount", operation: ">", value: 12.5 });
    expect(buildCondition([{ field: "active", operator: "==", value: "true" }], properties)).toEqual({ field: "active", operation: "==", value: true });
    expect(buildCondition([{ field: "name", operator: "like", value: "华东" }], properties)).toEqual({ field: "name", operation: "like", value: "华东" });
  });

  it("splits in-lists on commas and wraps several rows in an and-group", () => {
    expect(buildCondition([{ field: "amount", operator: "in", value: "1, 2,x" }, { field: "name", operator: "!=", value: "a" }], properties)).toEqual({
      operation: "and",
      sub_conditions: [
        { field: "amount", operation: "in", value: [1, 2, "x"] },
        { field: "name", operation: "!=", value: "a" },
      ],
    });
  });
});
