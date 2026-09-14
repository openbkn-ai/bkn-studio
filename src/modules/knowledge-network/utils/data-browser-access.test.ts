/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { canQueryDataBrowserObjectType } from "@/modules/knowledge-network/utils/data-browser-access";

describe("data browser record access", () => {
  it("allows dynamic requests while access is unknown", () => {
    expect(canQueryDataBrowserObjectType({ id: "order" })).toBe(true);
  });

  it("blocks known-denied object types and accepts query_data or wildcard access", () => {
    expect(canQueryDataBrowserObjectType({ id: "order", operations: ["view_detail"] })).toBe(false);
    expect(canQueryDataBrowserObjectType({ id: "order", operations: ["query_data"] })).toBe(true);
    expect(canQueryDataBrowserObjectType({ id: "order", operations: ["*"] })).toBe(true);
  });
});
