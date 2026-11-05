/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  decimalBuildSchemaIssues,
  invalidKeyFields,
  isIncrementalField,
  isPrimaryKeyField,
  excludedBuildSchemaFields,
} from "./build-guards";

const schema = [
  { name: "id", type: "integer" },
  { name: "updated_at", type: "timestamp" },
  { name: "body", type: "text" },
  { name: "interests", originalType: "_text", type: "other" },
];

describe("build guards", () => {
  it("distinguishes supported primary and incremental field types", () => {
    expect(isPrimaryKeyField(schema[0])).toBe(true);
    expect(isPrimaryKeyField(schema[1])).toBe(false);
    expect(isIncrementalField(schema[1])).toBe(true);
    expect(isIncrementalField(schema[2])).toBe(false);
  });

  it("identifies missing and unsupported configured key fields", () => {
    expect(invalidKeyFields(schema, ["id", "body", "missing"], isPrimaryKeyField)).toEqual([
      "body",
      "missing",
    ]);
  });

  it("identifies binary and other fields excluded from builds", () => {
    const binary = { name: "attachment", originalType: "bytea", type: "binary" };
    expect(excludedBuildSchemaFields([...schema, binary])).toEqual([schema[3], binary]);
  });
});

describe("decimal build readiness", () => {
  it.each([
    "decimal(12,2)",
    "NUMERIC(38,0)",
    "number(2,-3)",
    "decimal(38,18)",
    "numeric(3,5)",
    "decimal(12,13)",
  ])("allows declared decimal %s without guessing actual values", (originalType) => {
    expect(
      decimalBuildSchemaIssues({
        schema: [{ name: "price", type: "decimal", originalType }],
      }),
    ).toEqual([]);
  });
  it.each(["DECIMAL", "DECIMAL64", "decimal(0,13)", "decimal(1000,309)"])(
    "identifies unsupported declaration %s",
    (originalType) => {
      expect(
        decimalBuildSchemaIssues({
          schema: [{ name: "price", type: "decimal", originalType }],
        }),
      ).toEqual([{ name: "price", type: "decimal", originalType }]);
    },
  );
  it("uses authoritative column precision ahead of field attributes and raw type", () => {
    const resource = {
      schema: [
        {
          name: "price",
          originalName: "PRICE",
          type: "decimal",
          originalType: "DECIMALV3",
          attributes: { precision: 2, scale: 9 },
        },
      ],
      sourceMetadata: { columns: [{ name: "PRICE", numPrecision: 12, numScale: 2 }] },
    };
    expect(decimalBuildSchemaIssues(resource)).toEqual([]);
    resource.sourceMetadata.columns[0].numScale = 309;
    expect(decimalBuildSchemaIssues(resource)).toHaveLength(1);
  });
  it("keeps other and binary field exclusion independent", () => {
    expect(decimalBuildSchemaIssues({ schema })).toEqual([]);
  });
});
