/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteMock = vi.hoisted(() => vi.fn());
const getMock = vi.hoisted(() => vi.fn());
const postMock = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { delete: deleteMock, get: getMock, post: postMock },
}));

describe("admin.service · role bindings", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCK", "false");
    deleteMock.mockReset();
    getMock.mockReset();
    postMock.mockReset();
    getMock.mockResolvedValue({ data: { role_ids: ["admin"] } });
    postMock.mockResolvedValue({});
  });

  afterEach(() => vi.unstubAllEnvs());

  it("removes existing roles before binding replacements", async () => {
    let completeRemoval: () => void = () => undefined;
    deleteMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          completeRemoval = resolve;
        }),
    );
    const { syncUserRoleBindings } = await import("./admin.service");

    const sync = syncUserRoleBindings("user-1", ["security"]);

    await vi.waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
    expect(postMock).not.toHaveBeenCalled();

    completeRemoval();
    await sync;

    expect(deleteMock).toHaveBeenCalledWith("/safe/v1/admin/role-bindings", {
      data: { accessor_id: "user-1", role_id: "admin" },
      skipErrorToast: undefined,
    });
    expect(postMock).toHaveBeenCalledWith(
      "/safe/v1/admin/role-bindings",
      { accessor_id: "user-1", role_id: "security" },
      { skipErrorToast: undefined },
    );
  });
});
