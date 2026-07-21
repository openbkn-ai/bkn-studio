/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { http } from "@/framework/request/http";

vi.mock("@/framework/request/http", () => ({
  http: { get: vi.fn() },
}));

const mockGet = vi.mocked(http.get);

async function importFetchCurrentUser() {
  const module = await import("@/framework/auth/current-user");
  return module.fetchCurrentUser;
}

function meOk(data: Record<string, unknown>) {
  return Promise.resolve({ data } as never);
}

describe("fetchCurrentUser — 权限来源不可用时 fail-closed", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("/me/permissions 失败 → 权限为空,绝不沿用全量默认权限(#176)", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "u1", name: "Sec Builder", roles: ["security", "network_builder"] })
        : Promise.reject(new Error("500")),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.permissions).toEqual([]);
    expect(user.permissions).not.toContain("admin-audit:view");
    expect(user.permissions).not.toContain("admin-license:view");
    // 身份仍从 /me 拿到,不被权限失败牵连。
    expect(user.name).toBe("Sec Builder");
  });

  it("/me 失败但权限成功 → 保留权限,身份退空", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? Promise.reject(new Error("500"))
        : meOk({ is_admin: false, permissions: [] }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.name).toBeNull();
    expect(user.permissions).toEqual([]);
  });

  it("is_admin → 放行全部已注册权限", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "root" })
        : meOk({ is_admin: true, permissions: [] }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.permissions).toContain("admin-audit:view");
    expect(user.permissions).toContain("admin-license:view");
  });

  it("两个请求都失败 → 完全 fail-closed", async () => {
    mockGet.mockRejectedValue(new Error("network"));

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.permissions).toEqual([]);
    expect(user.name).toBeNull();
    expect(user.roles).toEqual([]);
  });
});
