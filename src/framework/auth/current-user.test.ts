/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: mockGet },
}));

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

  it("资源通配(超级管理员) → 放行全部已注册权限", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "root" })
        : meOk({
            is_admin: true,
            // 超管的实际响应形态(实测 14.103.77.23):折叠成单行资源通配。
            permissions: [{ operations: ["*"], resource: { id: "*", type: "*" } }],
          }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.isAdmin).toBe(true);
    expect(user.permissions).toContain("admin-audit:view");
    expect(user.permissions).toContain("admin-license:view");
  });

  // 后端 CanAdmin 判的是 safe_admin:console:manage,三员角色都持有,所以 is_admin
  // 对三员一律为 true。若按它放行全部权限,按点位控制入口的门禁在三员身上就失效了
  // (审计员会看到授权/撤权按钮,点下去才被后端 403)。
  it("is_admin=true 但无资源通配(三员角色) → 只给实际持有的点位", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "u-audit", roles: ["audit"] })
        : meOk({
            is_admin: true,
            // 审计管理员的实际响应形态(实测 14.103.77.23)。
            permissions: [
              { operations: ["view"], resource: { id: "*", type: "admin-audit" } },
              { operations: ["view"], resource: { id: "*", type: "admin-user" } },
              { operations: ["view"], resource: { id: "*", type: "admin-dept" } },
              { operations: ["view"], resource: { id: "*", type: "admin-role" } },
              { operations: ["view"], resource: { id: "*", type: "admin-authz" } },
            ],
          }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.isAdmin).toBe(true);
    expect(user.permissions).toContain("admin-audit:view");
    expect(user.permissions).toContain("admin-authz:view");
    expect(user.permissions).toContain("admin-role:view");
    // 授权面的写点位一个都不该有。
    expect(user.permissions).not.toContain("admin-authz:grant");
    expect(user.permissions).not.toContain("admin-authz:revoke");
    expect(user.permissions).not.toContain("admin-role:members");
    expect(user.permissions).not.toContain("admin-role:permissions");
    // 其他模块的写权限同样不该被 is_admin 顺带放行。
    expect(user.permissions).not.toContain("admin-user:create");
    expect(user.permissions).not.toContain("admin-license:manage");
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
