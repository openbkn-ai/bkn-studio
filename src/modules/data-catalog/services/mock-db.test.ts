/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mockResources } from "./mock-db";

describe("data catalog discover-status mocks", () => {
  it("provides one resource for every discover status in customer_master", () => {
    const expectedStatuses = [
      "error",
      "missing",
      "new",
      "restored",
      "unchanged",
      "updated",
    ];
    const resources = mockResources.filter(
      (resource) =>
        resource.catalogId === "cat-001" &&
        expectedStatuses.includes(resource.lastDiscoverStatus ?? ""),
    );

    expect([...new Set(resources.map((resource) => resource.lastDiscoverStatus))].sort()).toEqual(
      [...expectedStatuses].sort(),
    );

    const errorResources = resources.filter(
      (resource) => resource.lastDiscoverStatus === "error",
    );
    expect(errorResources.some((resource) => resource.schema.length === 0)).toBe(true);
    expect(errorResources.some((resource) => resource.schema.length > 0)).toBe(true);
  });
});
