/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { buildSampleEvent } from "./function-sample-event";

describe("buildSampleEvent", () => {
  it("returns an empty object when nothing is declared", () => {
    expect(buildSampleEvent(undefined)).toBe("{}");
    expect(buildSampleEvent([])).toBe("{}");
  });

  it("uses type-appropriate placeholders", () => {
    const event = buildSampleEvent([
      { name: "text", type: "string" },
      { name: "limit", type: "number" },
      { name: "count", type: "integer" },
      { name: "flag", type: "boolean" },
    ]);

    expect(JSON.parse(event)).toEqual({ text: "", limit: 0, count: 0, flag: false });
  });

  it("expands nested objects and array items", () => {
    const event = buildSampleEvent([
      {
        name: "customers",
        type: "array",
        sub_parameters: [
          {
            name: "item",
            type: "object",
            sub_parameters: [
              { name: "id", type: "string" },
              { name: "amount", type: "number" },
            ],
          },
        ],
      },
      {
        name: "profile",
        type: "object",
        sub_parameters: [{ name: "age", type: "integer" }],
      },
    ]);

    expect(JSON.parse(event)).toEqual({
      customers: [{ id: "", amount: 0 }],
      profile: { age: 0 },
    });
  });

  it("keeps unnamed parameters visible under a placeholder key", () => {
    expect(JSON.parse(buildSampleEvent([{ type: "string" }]))).toEqual({ arg1: "" });
  });

  it("treats an array without a declared item as empty", () => {
    expect(JSON.parse(buildSampleEvent([{ name: "tags", type: "array" }]))).toEqual({ tags: [] });
  });
});
