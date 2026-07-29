/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { parseResourceScope } from "@/modules/data-catalog/lib/resource-identifier";

describe("parseResourceScope", () => {
  it("parses PostgreSQL schema.table identifiers as scope groups", () => {
    expect(parseResourceScope("public.orders")).toEqual({
      database: "public",
    });
    expect(parseResourceScope("crm_core.public.customers")).toEqual({
      database: "crm_core",
      schema: "public",
    });
  });
});
