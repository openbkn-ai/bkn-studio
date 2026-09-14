/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { mapBackendCatalog } from "@/shared/catalog/catalog-mapper";

describe("catalog-mapper · health status", () => {
  it("maps the latest health check time from the catalog response", () => {
    const lastCheckTime = Date.UTC(2026, 6, 30, 8, 0, 0);

    const catalog = mapBackendCatalog({
      connector_type: "postgresql",
      enabled: true,
      health_check_result: "Connection test succeeded.",
      health_check_status: "healthy",
      id: "catalog-1",
      last_check_time: lastCheckTime,
      name: "orders",
    });

    expect(catalog.lastCheckTime).toBe(lastCheckTime);
    expect(catalog.healthCheckResult).toBe("Connection test succeeded.");
    expect(catalog.healthStatus).toBe("healthy");
    expect(catalog.internal).toBe(false);
  });

  it("preserves the backend internal marker", () => {
    const catalog = mapBackendCatalog({
      connector_type: "",
      enabled: true,
      id: "catalog-internal",
      internal: true,
      name: "system-catalog",
      type: "logical",
    });

    expect(catalog.internal).toBe(true);
  });

  it("uses the empty display value before the first health check", () => {
    const catalog = mapBackendCatalog({
      connector_type: "postgresql",
      enabled: true,
      id: "catalog-1",
      name: "orders",
    });

    expect(catalog.lastCheckTime).toBeNull();
    expect(catalog.healthStatus).toBe("unchecked");
  });

  it("treats zero backend timestamps as missing values", () => {
    const catalog = mapBackendCatalog({
      connector_type: "postgresql",
      create_time: 0,
      enabled: true,
      id: "catalog-1",
      last_check_time: 0,
      name: "orders",
      update_time: 0,
    });

    expect(catalog.createTime).toBeNull();
    expect(catalog.lastCheckTime).toBeNull();
    expect(catalog.updateTime).toBeNull();
  });
});
