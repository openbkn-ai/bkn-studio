/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { fixedFilterSourceBlockReason, sourceFilterQueryPath } from "./view-query-source";

describe("sourceFilterQueryPath", () => {
  it.each([
    [null, "source"],
    [{ category: "table", localIndexStatus: "unavailable" }, "source"],
    [
      { category: "table", localIndexStatus: "unavailable", localIndexName: "idx_orders" },
      "source",
    ],
    [{ category: "table", localIndexStatus: "available" }, "source"],
    [{ category: "table", localIndexStatus: "available", localIndexName: "" }, "source"],
    [
      { category: "table", localIndexStatus: "available", localIndexName: "idx_orders" },
      "managed_local_index",
    ],
    [{ category: "index", localIndexStatus: "unavailable" }, "local_index"],
  ] as const)("uses %j as the %s channel", (source, expected) => {
    expect(sourceFilterQueryPath(source)).toBe(expected);
  });
});

describe("fixedFilterSourceBlockReason", () => {
  it.each([undefined, null])("allows an absent fixed filter (%s)", (filter) => {
    expect(fixedFilterSourceBlockReason(filter)).toBeNull();
  });

  it.each([
    "==",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "eq",
    "not_eq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "not_in",
    "like",
    "not_like",
    "contain",
    "not_contain",
    "range",
    "out_range",
    "exist",
    "not_exist",
    "empty",
    "not_empty",
    "regex",
    "prefix",
    "not_prefix",
    "null",
    "not_null",
    "before",
    "current",
    "between",
  ])("allows source operation %s without needing the source schema", (operation) => {
    expect(fixedFilterSourceBlockReason({ field: "unpublished", operation, value: 4 })).toBeNull();
  });

  it.each(["true", "false"])("allows constant %s conditions", (operation) => {
    expect(fixedFilterSourceBlockReason({ operation })).toBeNull();
  });

  it("allows nested groups and field references without rewriting them", () => {
    const filter = {
      operation: "and",
      sub_conditions: [
        { field: "hidden_id", operation: "==", value_from: "field", value: "other_id" },
        {
          operation: "or",
          sub_conditions: [{ field: "name", operation: "like", value: "%keep%" }],
        },
      ],
    };
    const original = structuredClone(filter);
    expect(fixedFilterSourceBlockReason(filter)).toBeNull();
    expect(filter).toEqual(original);
  });

  it.each(["match", "match_phrase", "multi_match", "knn_vector"])(
    "blocks nested index operation %s",
    (operation) => {
      expect(
        fixedFilterSourceBlockReason({
          operation: "or",
          sub_conditions: [
            {
              operation: "and",
              sub_conditions: [{ operation, field: "hidden_title", value: "keep" }],
            },
          ],
        }),
      ).toBe("indexRequired");
    },
  );

  it.each([
    "invalid",
    [],
    {},
    { operation: "future_operation" },
    { operation: "and" },
    { operation: "or", sub_conditions: [] },
    { operation: "and", sub_conditions: [null] },
    { operation: "and", sub_conditions: [{ operation: "future_operation" }] },
    { operation: "==" },
    { operation: "==", field: "id", extra: true },
    { operation: "==", field: "id", sub_conditions: [] },
  ])("conservatively blocks an unrecognized condition %j", (filter) => {
    expect(fixedFilterSourceBlockReason(filter)).toBe("unknownFilter");
  });
});
