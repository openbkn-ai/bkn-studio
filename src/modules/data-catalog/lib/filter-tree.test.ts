/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  compatibleFilterFields,
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
    expect(filterValidationError(rule, [text], "local_index")).toBe("unsupportedOperation");
    const indexed = { ...text, features: [{ featureType: "keyword" as const }] };
    expect(filterOperationsForField(indexed, "local_index")).toEqual(
      expect.arrayContaining(["==", "!=", "in"]),
    );
    expect(filterValidationError(rule, [indexed], "local_index")).toBeNull();
  });

  it.each(["match", "match_phrase"])(
    "distinguishes an unsupported %s operation from a missing field",
    (operation) => {
      const indexed = {
        name: "body",
        type: "string",
        features: [{ featureType: "fulltext" as const }],
      };
      const rule = parseFilterCondition({ field: "body", operation, value: "invoice copy" })!;
      expect(filterValidationError(rule, [indexed], "local_index")).toBeNull();
      expect(filterValidationError(rule, [indexed], "source")).toBe("unsupportedOperation");
      expect(filterValidationError(rule, [], "source")).toBe("invalidField");
      expect(filterValidationError(rule, [], "local_index")).toBe("invalidField");
    },
  );

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

describe("filterable resource fields", () => {
  it.each(["source", "local_index"] as const)(
    "rejects disabled fields on either side of nested conditions for %s",
    (path) => {
      const enabled = { name: "enabled", type: "integer", filterable: true };
      const disabled = { name: "disabled", type: "integer", filterable: false };
      expect(filterOperationsForField(disabled, path)).toEqual([]);
      expect(compatibleFilterFields(enabled, [enabled, disabled], "==", path)).toEqual([]);
      expect(compatibleFilterFields(disabled, [enabled, disabled], "==", path)).toEqual([]);
      for (const [left, right] of [
        ["enabled", "disabled"],
        ["disabled", "enabled"],
      ]) {
        const tree = parseFilterCondition({
          operation: "or",
          sub_conditions: [
            {
              operation: "and",
              sub_conditions: [{ field: left, operation: "==", value_from: "field", value: right }],
            },
          ],
        })!;
        expect(filterValidationError(tree, [enabled, disabled], path)).not.toBeNull();
      }
      expect(
        filterValidationError(
          { kind: "group", operation: "and", children: [] },
          [enabled, disabled],
          path,
        ),
      ).toBeNull();
      expect(filterOperationsForField(enabled, path)).toContain("==");
    },
  );

  it("does not grant unsupported operations when filtering is enabled", () => {
    expect(filterOperationsForField({ name: "payload", type: "binary", filterable: true })).toEqual(
      [],
    );
  });
});

describe("managed index schema replaces source filterability", () => {
  it.each(["match", "match_phrase"] as const)(
    "uses local ordinary and %s capabilities even when the source switch is false",
    (operation) => {
      const field = {
        name: "body",
        type: "string",
        filterable: false,
        features: [{ featureType: "fulltext" as const }, { featureType: "keyword" as const }],
      };
      const path = "managed_local_index";
      expect(filterOperationsForField(field, path)).toEqual(
        expect.arrayContaining(["==", "!=", "in", "match", "match_phrase"]),
      );
      for (const selectedOperation of ["==", operation] as const) {
        const condition = parseFilterCondition(
          { field: "body", operation: selectedOperation, value: "invoice" },
          path,
        )!;
        expect(filterValidationError(condition, [field], path)).toBeNull();
        expect(filterToBackend(condition, [field], path)).toMatchObject({
          sub_conditions: [{ field: "body", operation: selectedOperation, value: "invoice" }],
        });
      }
      expect(filterOperationsForField(field, "source")).toEqual([]);
      expect(filterOperationsForField(field, "local_index")).toEqual([]);
      expect(filterOperationsForField({ ...field, features: [] }, path)).not.toContain("match");
    },
  );

  it("validates nested range and field comparisons against the local schema on both sides", () => {
    const path = "managed_local_index";
    const localFields = [
      { name: "amount", type: "integer", filterable: false },
      { name: "ceiling", type: "integer", filterable: false },
    ];
    const condition = parseFilterCondition(
      {
        operation: "and",
        sub_conditions: [
          { field: "amount", operation: "range", value: [1, 10] },
          {
            operation: "or",
            sub_conditions: [
              { field: "amount", operation: "<=", value_from: "field", value: "ceiling" },
            ],
          },
        ],
      },
      path,
    )!;
    expect(filterOperationsForField(localFields[0], path)).toContain("range");
    expect(compatibleFilterFields(localFields[0], localFields, "<=", path)).toEqual([
      localFields[1],
    ]);
    expect(filterValidationError(condition, localFields, path)).toBeNull();
    expect(filterToBackend(condition, localFields, path)).toMatchObject({
      sub_conditions: [
        { field: "amount", operation: "range", value: [1, 10] },
        {
          sub_conditions: [
            { field: "amount", operation: "<=", value_from: "field", value: "ceiling" },
          ],
        },
      ],
    });
    for (const sourcePath of ["source", "local_index"] as const) {
      expect(compatibleFilterFields(localFields[0], localFields, "<=", sourcePath)).toEqual([]);
      expect(filterValidationError(condition, localFields, sourcePath)).not.toBeNull();
    }
  });

  it("uses native Text fulltext while keeping keyword requirements for exact comparisons", () => {
    const field = { name: "body", type: "text", filterable: false };
    expect(filterOperationsForField(field, "managed_local_index")).toEqual(
      expect.arrayContaining(["match", "match_phrase"]),
    );
    expect(filterOperationsForField(field, "managed_local_index")).not.toContain("==");
    expect(filterOperationsForField(field, "local_index")).toEqual([]);
    expect(filterOperationsForField(field, "source")).toEqual([]);
  });

  it("does not open unsupported types or widen existing local value constraints", () => {
    const path = "managed_local_index";
    for (const type of [
      "decimal",
      "json",
      "binary",
      "other",
      "point",
      "shape",
      "unknown",
      "bigint",
      "int",
      "double",
      "Integer",
      " string ",
    ]) {
      expect(filterOperationsForField({ name: "value", type, filterable: false }, path)).toEqual(
        [],
      );
    }
    const wide = { name: "wide", type: "large_integer", filterable: false };
    const condition = parseFilterCondition({ field: "wide", operation: "==", value: "abc" }, path)!;
    expect(filterValidationError(condition, [wide], path)).toBeNull();
    expect(filterToBackend(condition, [wide], path)).toMatchObject({
      sub_conditions: [{ value: "abc" }],
    });
    expect(filterOperationsForField(wide, path)).not.toContain(">");
  });
});
