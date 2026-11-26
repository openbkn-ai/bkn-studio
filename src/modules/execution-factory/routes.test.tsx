/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { isValidElement } from "react";
import { describe, expect, it } from "vitest";

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import { RequireEdition } from "@/framework/entitlement/RequireEdition";
import { executionFactoryLabNavigation } from "@/modules/execution-factory-lab/navigation";
import { executionFactoryLabRoutes } from "@/modules/execution-factory-lab/routes";
import { executionFactoryNavigation } from "@/modules/execution-factory/navigation";
import { executionFactoryRoutes } from "@/modules/execution-factory/routes";

function routeByPath(path: string) {
  return executionFactoryRoutes.find((route) => route.path === path);
}

describe("execution factory routes", () => {
  it.each([...executionFactoryRoutes, ...executionFactoryLabRoutes])(
    "requires Professional for $path",
    ({ element }) => {
      expect(isValidElement(element)).toBe(true);
      if (!isValidElement(element)) return;
      expect(element.type).toBe(RequireEdition);
      expect(element.props).toMatchObject({
        capability: CAPABILITIES.EXECUTION_FACTORY,
        minEdition: "professional",
        mountLockedContent: false,
      });
    },
  );

  it.each([...executionFactoryNavigation.items, ...executionFactoryLabNavigation.items])(
    "labels $key with its tier and uses its name in the upgrade page",
    ({ path, labelKey, paidCapability, paidEdition }) => {
      expect(paidCapability).toBe(CAPABILITIES.EXECUTION_FACTORY);
      expect(paidEdition).toBe("professional");
      const route = [...executionFactoryRoutes, ...executionFactoryLabRoutes].find(
        (candidate) => `/${candidate.path}` === path,
      );
      const element = route?.element;
      expect(isValidElement(element)).toBe(true);
      if (!isValidElement(element)) return;
      expect(element.props).toMatchObject({
        upgradeCopy: { titleKey: labelKey },
      });
    },
  );

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

  it("keeps sandbox runtime restricted to its dedicated permission", () => {
    const sandboxItem = executionFactoryNavigation.items.find(
      (item) => item.key === "execution-factory-sandbox-runtime",
    );

    expect(sandboxItem).toMatchObject({
      permission: "execution-factory-lab:sandbox-runtime:view",
    });
  });
});
