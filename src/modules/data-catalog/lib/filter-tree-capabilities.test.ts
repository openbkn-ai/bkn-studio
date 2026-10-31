/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import {
  parsePrecisionPreservingJSON,
  transformPrecisionSafeJSONRequest,
} from "@/framework/request/precision-safe-json";
import type { FilterGroup } from "./filter-tree";
import { describe, expect, it } from "vitest";
import {
  filterOperationsForField,
  filterToBackend,
  filterValidationError,
  parseFilterCondition,
} from "./filter-tree";

const fields = [
  { name: "n", type: "integer" },
  { name: "peer", type: "integer" },
  { name: "amount", type: "decimal" },
  { name: "title", type: "string" },
  { name: "day", type: "date" },
  { name: "at", type: "datetime" },
  { name: "end", type: "datetime" },
  { name: "flag", type: "boolean" },
  { name: "document", type: "json" },
];

describe("structured filter capabilities", () => {
  it.each([
    "12345678901234567890123",
    "0.0000000000000000001234500",
    "1.234567890123456789E+40",
    "1e-10000000",
    "1e10000000",
  ])(
    "keeps the original precise numeric spelling for scalar and collection inputs: %s",
    (literal) => {
      for (const operation of ["==", "in"] as const) {
        const raw = parsePrecisionPreservingJSON(
          `{"field":"amount","operation":"${operation}","value":${operation === "in" ? `[${literal}]` : literal}}`,
        );
        const parsed = parseFilterCondition(raw)!;
        expect(parsed.children[0]).toMatchObject({
          value: operation === "in" ? [literal] : literal,
        });
        expect(filterValidationError(parsed, fields)).toBeNull();
      }
    },
  );

  it.each(["before", "current"] as const)(
    "round-trips %s week on the source channel",
    (operation) => {
      const raw = { field: "at", operation, value: operation === "before" ? [3, "week"] : "week" };
      const parsed = parseFilterCondition(raw, "source");
      expect(parsed).not.toBeNull();
      expect(filterValidationError(parsed!, fields, "source")).toBeNull();
      expect(filterToBackend(parsed!, fields, "source")).toEqual({
        operation: "and",
        sub_conditions: [{ ...raw, value_from: "const" }],
      });
    },
  );

  it.each([
    { field: "n", operation: ">=", value: 10 },
    { field: "n", operation: "in", value: [10, 11, 12] },
    { field: "n", operation: "range", value: [10, 12] },
    { field: "title", operation: "like", value: "a\\%_b" },
    { field: "title", operation: "contain", value: ["a", "b"] },
    { field: "day", operation: "between", value: ["2026-10-19", "2026-10-22"] },
    { field: "at", operation: ">=", value: "2026-10-19T00:00:00.123456789+08:00" },
    { field: "at", operation: "<", value: "end", value_from: "field" },
    { field: "flag", operation: "==", value: false },
    { field: "document", operation: "null" },
    { field: "at", operation: "before", value: [3, "day"] },
    { field: "at", operation: "current", value: "month" },
  ])("round-trips $field $operation without changing typed values", (raw) => {
    const parsed = parseFilterCondition(raw);
    expect(parsed).not.toBeNull();
    expect(filterValidationError(parsed!, fields)).toBeNull();
    const expected = "value" in raw ? { value_from: "const", ...raw } : raw;
    expect(filterToBackend(parsed!, fields)).toEqual({
      operation: "and",
      sub_conditions: [expected],
    });
  });

  it.each([
    ["day", "==", "2026-02-30", "invalidDate"],
    ["at", "==", "2026-10-19", "invalidDate"],
    ["at", "==", "2026-10-19 25:00:00", "invalidDate"],
    ["at", "==", "2026-10-19T00:00:00.1234567890Z", "invalidDate"],
    ["n", "in", ["1", "bad"], "invalidNumber"],
    ["n", "between", ["3", "2"], "invalidRange"],
    ["at", "before", ["0", "day"], "invalidRelativeTime"],
  ])("rejects invalid %s %s input", (field, operation, value, error) => {
    const parsed = parseFilterCondition({ field, operation, value });
    expect(parsed).not.toBeNull();
    expect(filterValidationError(parsed!, fields)).toBe(error);
  });

  it("validates right field compatibility", () => {
    const parsed = parseFilterCondition({
      field: "n",
      operation: "<",
      value_from: "field",
      value: "at",
    });
    expect(parsed).not.toBeNull();
    expect(filterValidationError(parsed!, fields)).toBe("incompatibleField");
  });

  it.each(["source", "local_index"] as const)("rejects self-comparison on the %s path", (path) => {
    const group = parseFilterCondition({
      field: "n",
      operation: "==",
      value_from: "field",
      value: "n",
    })!;
    expect(filterValidationError(group, fields, path)).toBe("sameField");
    const different = parseFilterCondition({
      field: "n",
      operation: "==",
      value_from: "field",
      value: "peer",
    })!;
    expect(filterValidationError(different, fields, path)).toBeNull();
  });

  it("keeps JSON and decimal out of the local index filter schema", () => {
    expect(filterOperationsForField(fields[8], "source")).toEqual(["null", "not_null"]);
    expect(filterOperationsForField(fields[8], "local_index")).toEqual([]);
    expect(filterOperationsForField(fields[2], "local_index")).toEqual([]);
  });

  it("does not infer capabilities for unverified platform types", () => {
    for (const type of ["time", "timestamp", "ip", "point", "shape", "binary", "other", "vector"]) {
      expect(filterOperationsForField({ name: "x", type })).toEqual([]);
    }
  });

  it("requires fulltext features and keyword for exact Text operations", () => {
    const field = { name: "body", type: "text", features: [{ featureType: "fulltext" as const }] };
    expect(filterOperationsForField(field, "local_index")).toEqual([
      "null",
      "not_null",
      "exist",
      "not_exist",
      "match",
      "match_phrase",
    ]);
    expect(filterOperationsForField(field, "source")).not.toContain("match");
  });
});

describe("filter boundaries and precision", () => {
  it.each([
    ["day", "2024-02-29", true],
    ["day", "2025-02-29", false],
    ["day", "2026-00-10", false],
    ["day", "2026-01-00", false],
    ["at", "2026-10-19T00:00:00Z", true],
    ["at", "2026-10-19T00:00:00+25:00", false],
    ["at", "2026-10-19T00:00:00", false],
    ["at", "2026-10-19 00:00:00.123456789", true],
    ["at", "9223372036854775807", true],
    ["at", "9223372036854775808", false],
  ])("validates %s literal %s", (field, value, valid) => {
    const group = parseFilterCondition({ field, value, operation: "==" })!;
    expect(filterValidationError(group, fields)).toBe(valid ? null : "invalidDate");
  });

  it.each([
    ["2026-10-19T08:00:00.000000002+08:00", "2026-10-19T00:00:00.000000001Z", "invalidRange"],
    ["2026-10-19T08:00:00+08:00", "2026-10-19T00:00:00Z", null],
    ["2026-10-19 00:00:00.000000002", "2026-10-19 00:00:00.000000001", "invalidRange"],
  ])("compares range boundaries at nanosecond precision", (lower, upper, error) => {
    const group = parseFilterCondition({ field: "at", operation: "range", value: [lower, upper] })!;
    expect(filterValidationError(group, fields)).toBe(error);
  });

  it("preserves high precision decimals and int64 values in collections", () => {
    const group = parseFilterCondition({
      field: "amount",
      operation: "in",
      value: ["123456789012345678.123456789", "0.000000001"],
    })!;
    expect(filterValidationError(group, fields)).toBeNull();
    expect(transformPrecisionSafeJSONRequest(filterToBackend(group, fields))).toContain(
      '"value":[123456789012345678.123456789,1e-9]',
    );
    const integer = parseFilterCondition({
      field: "n",
      operation: "range",
      value: ["9007199254740993", "9223372036854775807"],
    })!;
    expect(filterValidationError(integer, fields)).toBeNull();
    expect(transformPrecisionSafeJSONRequest(filterToBackend(integer, fields))).toContain(
      '"value":[9007199254740993,9223372036854775807]',
    );
  });

  it("does not convert a right field name to a number", () => {
    const group = parseFilterCondition({
      field: "n",
      operation: ">=",
      value_from: "field",
      value: "peer",
    })!;
    expect(filterValidationError(group, fields)).toBeNull();
    expect(filterToBackend(group, fields)).toMatchObject({
      sub_conditions: [{ value_from: "field", value: "peer" }],
    });
  });

  it("keeps legacy wildcard filters read-only and validates newly entered substrings", () => {
    expect(parseFilterCondition({ field: "title", operation: "like", value: "%old%" })).toBeNull();
    const group: FilterGroup = {
      kind: "group",
      operation: "and",
      children: [{ kind: "rule", field: "title", operation: "like", value: "%new%" }],
    };
    expect(filterValidationError(group, fields)).toBe("invalidSubstring");
  });

  it.each([
    ["n", "1.5"],
    ["n", "9223372036854775808"],
  ])("rejects invalid integer %s = %s", (field, value) => {
    expect(
      filterValidationError(parseFilterCondition({ field, operation: "==", value })!, fields),
    ).toBe("invalidNumber");
  });

  it("rejects malformed arrays, units and incompatible sources", () => {
    expect(parseFilterCondition({ field: "n", operation: "in", value: 1 })).toBeNull();
    expect(parseFilterCondition({ field: "n", operation: "in", value: [null] })).toBeNull();
    expect(
      parseFilterCondition({ field: "n", operation: "in", value: "peer", value_from: "field" }),
    ).toBeNull();
    expect(
      parseFilterCondition({ field: "n", operation: "==", value: "peer", value_from: "user" }),
    ).toBeNull();
    expect(
      filterValidationError(
        parseFilterCondition({ field: "n", operation: "in", value: [] })!,
        fields,
      ),
    ).toBe("missingValue");
    expect(
      filterValidationError(
        parseFilterCondition({ field: "n", operation: "range", value: [1] })!,
        fields,
      ),
    ).toBe("invalidRange");
    expect(
      filterValidationError(
        parseFilterCondition({ field: "at", operation: "current", value: "quarter" })!,
        fields,
      ),
    ).toBe("invalidRelativeTime");
  });
});

describe("PR review regressions", () => {
  it.each(["1e-1000000000", "-1e-1000000000", "1e1000000000"])(
    "rejects a Decimal outside the precision library range: %s",
    (value) => {
      const group = parseFilterCondition({ field: "amount", operation: "==", value })!;
      expect(filterValidationError(group, fields)).toBe("invalidNumber");
      expect(() => filterToBackend(group, fields)).toThrow(RangeError);
    },
  );

  it.each(["==", "in", "range"] as const)(
    "preserves extreme Decimal exponents for %s",
    (operation) => {
      const value = operation === "==" ? "1e309" : ["1e-1000", "1e-999"];
      const group = parseFilterCondition({ field: "amount", operation, value })!;
      expect(filterValidationError(group, fields)).toBeNull();
      const serialized = transformPrecisionSafeJSONRequest(filterToBackend(group, fields));
      expect(serialized).toContain(
        operation === "==" ? '"value":1e+309' : '"value":[1e-1000,1e-999]',
      );
    },
  );

  it("supports relative before on both channels and preserves legacy index reference times", () => {
    for (const path of ["source", "local_index"] as const) {
      const raw = { field: "at", operation: "before", value: [3, "month"] };
      expect(filterOperationsForField(fields[5], path)).toContain("before");
      const parsed = parseFilterCondition(raw, path);
      expect(parsed).not.toBeNull();
      expect(filterValidationError(parsed!, fields, path)).toBeNull();
      expect(filterToBackend(parsed!, fields, path)).toEqual({
        operation: "and",
        sub_conditions: [{ ...raw, value_from: "const" }],
      });
    }
    expect(
      parseFilterCondition(
        { field: "at", operation: "before", value: [3, "2026-10-30T00:00:00Z"] },
        "local_index",
      ),
    ).toBeNull();
  });

  it("validates the index date-math interval limit without narrowing source intervals", () => {
    const rule = {
      kind: "rule" as const,
      field: "at",
      operation: "before" as const,
      value: ["2147483647", "minute"],
    };
    const group: FilterGroup = { kind: "group", operation: "and", children: [rule] };
    expect(filterValidationError(group, fields, "local_index")).toBeNull();
    rule.value = ["2147483648", "minute"];
    expect(filterValidationError(group, fields, "local_index")).toBe("invalidRelativeTime");
    expect(filterValidationError(group, fields, "source")).toBeNull();
  });

  it("supports TEXT keyword patterns and collections only with a keyword Feature", () => {
    const text = { name: "body", type: "text", features: [{ featureType: "keyword" as const }] };
    for (const operation of ["prefix", "not_prefix", "regex", "contain", "not_contain"] as const) {
      expect(filterOperationsForField(text, "local_index")).toContain(operation);
      const raw = {
        field: "body",
        operation,
        value: operation.includes("contain") ? ["word", "other"] : "word",
      };
      const parsed = parseFilterCondition(raw, "local_index");
      expect(parsed).not.toBeNull();
      expect(filterValidationError(parsed!, [text], "local_index")).toBeNull();
      expect(filterOperationsForField({ ...text, features: [] }, "local_index")).not.toContain(
        operation,
      );
    }
  });

  it.each(["==", "!=", "in", "not_in"] as const)(
    "preserves empty and whitespace strings in %s",
    (operation) => {
      for (const value of operation === "in" || operation === "not_in"
        ? [
            ["", "active"],
            [" ", "active"],
          ]
        : ["", " "]) {
        const raw = { field: "title", operation, value, value_from: "const" };
        const group = parseFilterCondition(raw)!;
        expect(filterValidationError(group, fields)).toBeNull();
        expect(filterToBackend(group, fields)).toMatchObject({ sub_conditions: [raw] });
      }
    },
  );

  it("keeps an untouched draft value distinct from an explicitly empty string", () => {
    const group: FilterGroup = {
      kind: "group",
      operation: "and",
      children: [{ kind: "rule", field: "title", operation: "==", value: undefined }],
    };
    expect(filterValidationError(group, fields)).toBe("missingValue");
    group.children[0] = {
      kind: "rule",
      field: "title",
      operation: "in",
      value: [undefined, "active"],
    };
    expect(filterValidationError(group, fields)).toBe("missingValue");
  });

  it.each(["source", "local_index"] as const)(
    "encodes exact emptiness on %s without NULL",
    (path) => {
      const empty: FilterGroup = {
        kind: "group",
        operation: "and",
        children: [{ kind: "rule", field: "title", operation: "empty", value: undefined }],
      };
      const serialized = filterToBackend(empty, fields, path);
      expect(serialized).toEqual({
        operation: "and",
        sub_conditions: [{ field: "title", operation: "==", value: "", value_from: "const" }],
      });
      const notEmpty: FilterGroup = {
        kind: "group",
        operation: "and",
        children: [{ kind: "rule", field: "title", operation: "not_empty", value: undefined }],
      };
      expect(filterToBackend(notEmpty, fields, path)).toEqual({
        operation: "and",
        sub_conditions: [
          {
            operation: "and",
            sub_conditions: [
              { field: "title", operation: "not_null" },
              { field: "title", operation: "!=", value: "", value_from: "const" },
            ],
          },
        ],
      });
      for (const nextPath of ["source", "local_index"] as const) {
        expect(
          filterToBackend(parseFilterCondition(serialized, nextPath)!, fields, nextPath),
        ).toEqual(serialized);
        const nonEmptySerialized = filterToBackend(notEmpty, fields, path);
        expect(
          filterToBackend(parseFilterCondition(nonEmptySerialized, nextPath)!, fields, nextPath),
        ).toEqual(nonEmptySerialized);
        for (const operation of ["empty", "not_empty"]) {
          expect(parseFilterCondition({ field: "title", operation }, nextPath)).toBeNull();
        }
      }
    },
  );
});
