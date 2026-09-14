/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { dataConnectRoutes } from "@/modules/data-connect/routes";

describe("data-connect routes", () => {
  it("requires a catalog identifier in the discover route", () => {
    const paths = dataConnectRoutes.map((route) => route.path);

    expect(paths).toContain("data-connect/:catalogId/discover");
    expect(paths).not.toContain("data-connect/discover");
  });
});
