/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const httpMock = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }));
vi.mock("@/framework/request/http", () => ({ http: httpMock }));

describe("current-user profile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_MOCK_USER", "viewer");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uses the selected runtime identity instead of the administrator fixture", async () => {
    const { getMyProfile } = await import("./profile.service");
    const { getDevRuntimeUser } = await import("@/framework/runtime/dev-profile");
    const user = getDevRuntimeUser();
    const profile = await getMyProfile();
    expect(profile).toMatchObject({
      id: user.id,
      name: "业务只读用户",
      roles: user.roles,
      account: "local-viewer",
      email: "viewer@bkn.local",
    });
    expect(profile.roles).not.toContain("admin");
    expect(profile.roles).not.toContain("super_admin");
    expect(httpMock.get).not.toHaveBeenCalled();
  });

  it("keeps profile edits separate when switching between viewer and administrator", async () => {
    const { getMyProfile, updateMyProfile } = await import("./profile.service");
    await updateMyProfile({ name: "Edited viewer", email: "viewer@example.test" });
    vi.stubEnv("VITE_MOCK_USER", "admin");
    const { getDevRuntimeUser } = await import("@/framework/runtime/dev-profile");
    const administrator = getDevRuntimeUser();
    expect(await getMyProfile()).toMatchObject({
      id: administrator.id,
      name: administrator.name,
      roles: administrator.roles,
      account: "local-admin",
      email: "admin@bkn.local",
    });
    await updateMyProfile({ name: "Edited admin" });
    vi.stubEnv("VITE_MOCK_USER", "viewer");
    expect(await getMyProfile()).toMatchObject({
      id: "local-mock-viewer",
      name: "Edited viewer",
      email: "viewer@example.test",
      roles: ["viewer"],
    });
    expect(httpMock.put).not.toHaveBeenCalled();
  });

  it("continues loading and updating server profiles in real-backend mode", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    httpMock.get.mockResolvedValue({
      data: {
        id: "server-user",
        account: "server-account",
        name: "Server user",
        roles: ["operator"],
      },
    });
    httpMock.put.mockResolvedValue({ status: 204 });
    const { getMyProfile, updateMyProfile } = await import("./profile.service");
    expect(await getMyProfile()).toMatchObject({
      id: "server-user",
      name: "Server user",
      roles: ["operator"],
    });
    expect(httpMock.get).toHaveBeenCalledWith("/safe/v1/me");
    await updateMyProfile({ name: "Updated server user" });
    expect(httpMock.put).toHaveBeenCalledWith(
      "/safe/v1/me",
      { name: "Updated server user" },
      { skipErrorToast: true },
    );
    expect(httpMock.get).toHaveBeenCalledTimes(2);
  });
});
