/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const postMock = vi.hoisted(() => vi.fn());
const putMock = vi.hoisted(() => vi.fn());
const requestMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { post: postMock, put: putMock, request: requestMock },
}));

describe("admin.service · role writes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    postMock.mockReset();
    putMock.mockReset();
    requestMock.mockReset();
    postMock.mockResolvedValue({ data: { id: "role-1" } });
    putMock.mockResolvedValue({});
    requestMock.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("forwards local error-toast suppression for role writes", async () => {
    const { createRole, setRolePermission, updateRole } = await import("./admin.service");
    const options = { skipErrorToast: true };

    await createRole({ name: "readers", description: "" }, options);
    await updateRole("role-1", { name: "writers", description: "" }, options);
    await setRolePermission(
      "role-1",
      true,
      {
        resource: { type: "catalog", id: "*" },
        operations: ["view_detail"],
      },
      options,
    );

    expect(postMock).toHaveBeenCalledWith(
      "/safe/v1/admin/roles",
      {
        name: "readers",
        description: "",
      },
      options,
    );
    expect(putMock).toHaveBeenCalledWith(
      "/safe/v1/admin/roles/role-1",
      {
        name: "writers",
        description: "",
      },
      options,
    );
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/safe/v1/admin/roles/role-1/permissions",
        skipErrorToast: true,
      }),
    );
  });
});
