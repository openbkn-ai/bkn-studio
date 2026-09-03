/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  invalidKeyFields,
  isIncrementalField,
  isPrimaryKeyField,
  unsupportedSchemaFields,
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

  it("identifies all other-type schema fields", () => {
    expect(unsupportedSchemaFields(schema)).toEqual([schema[3]]);
  });
});
