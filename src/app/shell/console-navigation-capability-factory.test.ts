/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  consoleNavigation,
  findConsoleNavItemByPath,
  getConsoleNavTrail,
} from "@/app/shell/console-navigation";

const keys = (items: { key: string }[]) => items.map((item) => item.key);

describe("capability factory navigation", () => {
  const factoryGroup = () => consoleNavigation.find((item) => item.key === "execution-factory");

  it("keeps the official factory entry visible and hides the lab entry", () => {
    expect(keys(consoleNavigation)).toContain("execution-factory");
    expect(keys(consoleNavigation)).not.toContain("execution-factory-lab");
  });

  it("groups management, market, and sandbox runtime under the official factory", () => {
    const group = factoryGroup();
    expect(group).toBeDefined();
    expect(keys(group!.children ?? [])).toEqual(
      expect.arrayContaining([
        "execution-unit-management",
        "all-execution-units",
        "execution-factory-sandbox-runtime",
      ]),
    );
  });

  it("resolves the official sandbox runtime path and breadcrumb trail", () => {
    expect(findConsoleNavItemByPath("/execution-factory/sandbox-runtime")?.key).toBe(
      "execution-factory-sandbox-runtime",
    );
    expect(keys(getConsoleNavTrail("execution-factory-sandbox-runtime"))).toEqual([
      "execution-factory",
      "execution-factory-sandbox-runtime",
    ]);
  });
});

