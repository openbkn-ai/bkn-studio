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
    // Identity still comes from /me and is unaffected by the permission failure.
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
            // Actual super-admin response shape: compacted into one resource wildcard entry.
            permissions: [{ operations: ["*"], resource: { id: "*", type: "*" } }],
          }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.isAdmin).toBe(true);
    expect(user.isSuperAdmin).toBe(true);
    expect(user.permissions).toContain("admin-audit:view");
    expect(user.permissions).toContain("admin-license:view");
  });

  it("/me 失败但资源通配成功 → 仍识别为超级管理员", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? Promise.reject(new Error("500"))
        : meOk({
            is_admin: true,
            permissions: [{ operations: ["*"], resource: { id: "*", type: "*" } }],
          }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.roles).toEqual([]);
    expect(user.isSuperAdmin).toBe(true);
  });

  it("本地化超级管理员角色 → 识别为超级管理员", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "root", roles: ["超级管理员"] })
        : meOk({ is_admin: true, permissions: [] }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.isSuperAdmin).toBe(true);
  });

  // Backend CanAdmin checks safe_admin:console:manage, which all three administrator roles hold,
  // so is_admin is true for each. Granting every permission from it would disable point-level guards:
  // auditors would see grant/revoke buttons and only receive 403 after clicking them.
  it("is_admin=true 但无资源通配(三员角色) → 只给实际持有的点位", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "u-audit", roles: ["audit"] })
        : meOk({
            is_admin: true,
            // Actual audit-administrator response shape.
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
    expect(user.isSuperAdmin).toBe(false);
    expect(user.permissions).toContain("admin-audit:view");
    expect(user.permissions).toContain("admin-authz:view");
    expect(user.permissions).toContain("admin-role:view");
    // No authorization write permission should be present.
    expect(user.permissions).not.toContain("admin-authz:grant");
    expect(user.permissions).not.toContain("admin-authz:revoke");
    expect(user.permissions).not.toContain("admin-role:members");
    expect(user.permissions).not.toContain("admin-role:permissions");
    // is_admin must not implicitly grant write permissions in other modules either.
    expect(user.permissions).not.toContain("admin-user:create");
    expect(user.permissions).not.toContain("admin-license:manage");
    expect(user.permissions).not.toContain("execution-factory-lab:sandbox-runtime:view");
  });

  it("管理员持有大模型 display 授权 → 显示模型管理入口所需权限", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/safe/v1/me"
        ? meOk({ id: "u-model-admin", roles: ["admin"] })
        : meOk({
            is_admin: true,
            permissions: [
              { operations: ["view"], resource: { id: "*", type: "admin-user" } },
              { operations: ["display", "create", "modify", "execute"], resource: { id: "*", type: "large_model" } },
            ],
          }),
    );

    const fetchCurrentUser = await importFetchCurrentUser();
    const user = await fetchCurrentUser();

    expect(user.permissions).toContain("model-resources:model:view");
    expect(user.permissions).toContain("model-resources:large-model:view");
    expect(user.permissions).not.toContain("model-resources:small-model:view");
    expect(user.permissions).toContain("model-resources:model:create");
    expect(user.permissions).toContain("model-resources:model:edit");
    expect(user.permissions).not.toContain("execution-factory-lab:sandbox-runtime:view");
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
