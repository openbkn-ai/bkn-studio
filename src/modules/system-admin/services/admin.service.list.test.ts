/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: getMock },
}));

describe("admin.service complete lookups", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    getMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("collects every user page", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          total: 501,
          users: Array.from({ length: 500 }, (_, index) => ({ id: `user-${index}` })),
        },
      })
      .mockResolvedValueOnce({ data: { total: 501, users: [{ id: "user-500" }] } });
    const { listUsers } = await import("@/modules/system-admin/services/admin.service");

    await expect(listUsers()).resolves.toHaveLength(501);
    expect(getMock).toHaveBeenNthCalledWith(2, "/safe/v1/admin/users", {
      params: {
        department_id: undefined,
        enabled: undefined,
        include_subtree: undefined,
        limit: 500,
        offset: 500,
        role_id: undefined,
        search: undefined,
      },
      skipErrorToast: undefined,
    });
  });

  it("collects every department page using the endpoint's total contract", async () => {
    getMock
      .mockResolvedValueOnce({
        data: {
          total: 1001,
          departments: Array.from({ length: 1000 }, (_, index) => ({ ID: `department-${index}` })),
        },
      })
      .mockResolvedValueOnce({
        data: { total: 1001, departments: [{ ID: "department-1000" }] },
      });
    const { listDepartments } = await import("@/modules/system-admin/services/admin.service");

    await expect(listDepartments()).resolves.toHaveLength(1001);
    expect(getMock).toHaveBeenNthCalledWith(2, "/safe/v1/admin/departments", {
      params: { limit: 1000, offset: 1000 },
      skipErrorToast: undefined,
    });
  });
});
