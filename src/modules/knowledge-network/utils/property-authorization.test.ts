/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  basePropertyAccessLevel,
  clampPropertyAccessLevel,
  propertyAccessRowState,
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
});
