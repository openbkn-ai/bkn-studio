/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { dataCatalogRoutes } from "@/modules/data-catalog/routes";

describe("data-catalog routes", () => {
  it("preserves the data-catalog console handle at the index route", () => {
    const rootRoute = dataCatalogRoutes.find((route) => route.path === "data-catalog");
    const indexRoute = rootRoute?.children?.find((route) => route.index);

    expect(rootRoute).toBeDefined();
    expect(indexRoute).toBeDefined();
    expect(indexRoute?.handle).toEqual(rootRoute?.handle);
  });

  it("does not register retired compatibility routes", () => {
    expect(dataCatalogRoutes.map((route) => route.path)).not.toEqual(
      expect.arrayContaining([
        "data-directory",
        "data-directory/catalog/:catalogId",
        "data-directory/resource/:resourceId",
        "index-builds",
      ]),
    );
  });
});
