/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  filterOperationsForField,
  filterToBackend,
  filterValidationError,
  parseFilterCondition,
} from "./filter-tree";

const fields = [
  { name: "age", type: "integer" },
  { name: "state", type: "string" },
];

describe("filter-tree", () => {
  it("keeps large integer input as text and limits index operations", () => {
    const wide = { name: "wide", type: "large_integer" };
    for (const value of ["-09", "+010", "170141183460469231731687303715884105727"]) {
      const rule = parseFilterCondition({ field: "wide", operation: ">", value })!;
      expect(filterValidationError(rule, [wide])).toBeNull();
      expect(filterToBackend(rule, [wide])).toMatchObject({ sub_conditions: [{ value }] });
    }
    expect(filterOperationsForField(wide, "source")).toEqual(
      expect.arrayContaining(["==", "!=", ">", "<", ">=", "<=", "in", "range"]),
    );
    expect(filterOperationsForField(wide, "local_index")).toEqual(
      expect.arrayContaining(["==", "!=", "in"]),
    );
    expect(filterOperationsForField(wide, "local_index")).not.toContain(">");
    // Local indexes store LARGEINT as keyword text, so equality accepts string literals.
    for (const value of ["1.2", "1e3", "NaN", "abc"]) {
      const rule = parseFilterCondition({ field: "wide", operation: "==", value })!;
      expect(filterValidationError(rule, [wide])).toBe("invalidNumber");
      expect(filterValidationError(rule, [wide], "local_index")).toBeNull();
      expect(filterToBackend(rule, [wide])).toMatchObject({ sub_conditions: [{ value }] });
    }
  });
  it("trims source integer literals while preserving signs, zeros and keyword text", () => {
    const wide = { name: "wide", type: "large_integer" };
    for (const value of [" 9007199254740993 ", "\t+010\n", " -09 "]) {
      const rule = parseFilterCondition({ field: "wide", operation: "==", value })!;
      expect(filterValidationError(rule, [wide], "source")).toBeNull();
      expect(filterToBackend(rule, [wide])).toMatchObject({
        sub_conditions: [{ value: value.trim() }],
      });
      expect(filterToBackend(rule, [wide], "local_index")).toMatchObject({
        sub_conditions: [{ value }],
      });
      expect(rule.children[0]).toMatchObject({ value });
    }
  });
  it("uses keyword Feature for exact Text filters on the local index path", () => {
    const text = { name: "description", type: "text" };
    const rule = parseFilterCondition({ field: "description", operation: "==", value: "open" })!;
    expect(filterOperationsForField(text, "source")).toEqual(
      expect.arrayContaining(["==", "!=", "like"]),
    );
    expect(filterValidationError(rule, [text], "source")).toBeNull();
    expect(filterOperationsForField(text, "local_index")).not.toContain("==");
    expect(filterValidationError(rule, [text], "local_index")).toBe("invalidField");
    const indexed = { ...text, features: [{ featureType: "keyword" as const }] };
    expect(filterOperationsForField(indexed, "local_index")).toEqual(
      expect.arrayContaining(["==", "!=", "in"]),
    );
    expect(filterValidationError(rule, [indexed], "local_index")).toBeNull();
  });

  it("round-trips nested AND/OR groups and keeps numeric values numeric", () => {
    const raw = {
      operation: "and",
      sub_conditions: [
        { field: "age", operation: ">", value: 18 },
        {
          operation: "or",
          sub_conditions: [
            { field: "state", operation: "==", value: "active" },
            { field: "state", operation: "==", value: "pending" },
          ],
        },
      ],
    };
    const parsed = parseFilterCondition(raw);
    expect(parsed).not.toBeNull();
    expect(filterValidationError(parsed!, fields)).toBeNull();
    expect(filterToBackend(parsed!, fields)).toEqual({
      operation: "and",
      sub_conditions: [
        { field: "age", operation: ">", value_from: "const", value: 18 },
        {
          operation: "or",
          sub_conditions: [
            { field: "state", operation: "==", value_from: "const", value: "active" },
            { field: "state", operation: "==", value_from: "const", value: "pending" },
          ],
        },
      ],
    });
  });

  it("rejects invalid or unsupported filters before submission", () => {
    expect(
      parseFilterCondition({ field: "age", operation: "knn_vector", value: [1, 2] }),
    ).toBeNull();
    const parsed = parseFilterCondition({ field: "age", operation: ">", value: 3 })!;
    parsed.children.push({ kind: "group", operation: "or", children: [] });
    expect(filterValidationError(parsed, fields)).toBe("emptyGroup");
    parsed.children.pop();
    parsed.children[0] = { kind: "rule", field: "age", operation: ">", value: "NaN" };
    expect(filterValidationError(parsed, fields)).toBe("invalidNumber");
  });

  it("keeps an unsafe bigint literal exact for the request serializer", async () => {
    const parsed = parseFilterCondition({
      field: "age",
      operation: ">",
      value: "9007199254740993",
    })!;
    expect(filterValidationError(parsed, fields)).toBeNull();
    const { transformPrecisionSafeJSONRequest } =
      await import("@/framework/request/precision-safe-json");
    expect(transformPrecisionSafeJSONRequest(filterToBackend(parsed, fields))).toContain(
      '"value":9007199254740993',
    );
  });
});
