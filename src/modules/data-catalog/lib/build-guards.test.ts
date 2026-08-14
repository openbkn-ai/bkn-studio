/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  invalidBuildKeyFields,
  isBuildKeyField,
  unsupportedSchemaFields,
} from "./build-guards";

const schema = [
  { name: "id", type: "integer" },
  { name: "updated_at", type: "timestamp" },
  { name: "body", type: "text" },
  { name: "interests", originalType: "_text", type: "other" },
];

describe("build guards", () => {
  it("accepts only stable build-key field types", () => {
    expect(isBuildKeyField(schema[0])).toBe(true);
    expect(isBuildKeyField(schema[1])).toBe(true);
    expect(isBuildKeyField(schema[2])).toBe(false);
  });

  it("identifies missing and unsupported configured build keys", () => {
    expect(invalidBuildKeyFields(schema, ["id", "body", "missing"])).toEqual([
      "body",
      "missing",
    ]);
  });

  it("identifies all other-type schema fields", () => {
    expect(unsupportedSchemaFields(schema)).toEqual([schema[3]]);
  });
});
