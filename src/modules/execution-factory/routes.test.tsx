/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { executionFactoryLabRoutes } from "@/modules/execution-factory-lab/routes";
import { executionFactoryRoutes } from "@/modules/execution-factory/routes";

function routeByPath(path: string) {
  return executionFactoryRoutes.find((route) => route.path === path);
}

describe("execution factory routes", () => {
  it("mounts sandbox runtime management under the official execution factory", () => {
    const route = routeByPath("execution-factory/sandbox-runtime");

    expect(route).toBeDefined();
    expect(route?.handle).toMatchObject({
      console: {
        descriptionKey: "executionFactory.sandboxRuntimeDescription",
        menuKey: "execution-factory-sandbox-runtime",
        titleKey: "executionFactory.sandboxRuntimeTitle",
      },
    });
  });

  it("keeps the lab sandbox runtime route for direct-link compatibility", () => {
    expect(
      executionFactoryLabRoutes.some(
        (route) => route.path === "execution-factory-lab/sandbox-runtime",
      ),
    ).toBe(true);
  });
});

