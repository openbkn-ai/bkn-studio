/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  applyPropertySelectionBatch,
  basePropertyAccessLevel,
  clampPropertyAccessLevel,
  propertyAccessRowState,
  summarizePropertyGrantChanges,
} from "@/modules/knowledge-network/utils/property-authorization";

describe("property-authorization", () => {
  it("maps object operations to the base property ceiling", () => {
    expect(basePropertyAccessLevel([])).toBe("none");
    expect(basePropertyAccessLevel(["view_detail"])).toBe("schema");
    expect(basePropertyAccessLevel(["view_detail", "query_data"])).toBe("full");
  });

  it("never lets explicit property access raise the object base level", () => {
    expect(clampPropertyAccessLevel("schema", "full")).toBe("schema");
    expect(clampPropertyAccessLevel("full", "none")).toBe("none");
    expect(clampPropertyAccessLevel("full", "inherit")).toBe("full");
  });

  it("downgrades masked access without a valid rule to schema", () => {
    const state = propertyAccessRowState(
      {
        displayKey: false,
        displayName: "Mobile",
        incrementalKey: false,
        name: "mobile",
        primaryKey: false,
        type: "string",
      },
      "full",
      new Map(),
      new Map(),
      new Map([["mobile", "masked"]]),
    );
    expect(state.effective).toBe("schema");
    expect(state.maskState).toBe("missing");
  });

  it("uses the draft selection instead of a stale server decision for the preview", () => {
    const state = propertyAccessRowState(
      {
        displayKey: false,
        displayName: "Email",
        incrementalKey: false,
        name: "email",
        primaryKey: false,
        type: "string",
      },
      "full",
      new Map(),
      new Map([["email", { level: "full", name: "email", source: "role" }]]),
      new Map([["email", "none"]]),
    );

    expect(state.effective).toBe("none");
    expect(state.source).toBe("property");
  });

  it("applies a batch to selected properties outside the current filtered rows", () => {
    const draft = applyPropertySelectionBatch(
      ["visible", "filtered-out", "not-selected"],
      ["visible", "filtered-out"],
      "schema",
      new Map(),
      new Map(),
    );

    expect([...draft]).toEqual([
      ["visible", "schema"],
      ["filtered-out", "schema"],
    ]);
  });

  it("summarizes changes from inherited access using the actual base ceiling", () => {
    expect(
      summarizePropertyGrantChanges(
        "schema",
        new Map(),
        new Map([["email", "schema"]]),
      ),
    ).toEqual({ full: 0, inherited: 0, lowered: 0, raised: 0, total: 1 });
    expect(
      summarizePropertyGrantChanges(
        "full",
        new Map(),
        new Map([["email", "none"]]),
      ),
    ).toEqual({ full: 0, inherited: 0, lowered: 1, raised: 0, total: 1 });
  });
});
