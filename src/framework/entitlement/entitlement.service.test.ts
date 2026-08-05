/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: mockGet },
}));

// useMock 是模块加载时求值的常量,所以每个用例先 stub 再动态 import。
async function importFetchEntitlement(useMock: "false" | "true" = "false") {
  vi.stubEnv("VITE_USE_MOCK", useMock);
  vi.resetModules();
  const module = await import("@/framework/entitlement/entitlement.service");
  return module.fetchEntitlement;
}

function ok(data: Record<string, unknown>) {
  return Promise.resolve({ data } as never);
}

describe("fetchEntitlement", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("读的是 /safe/v1/capabilities,且不弹错误 toast", async () => {
    mockGet.mockReturnValue(ok({ edition: "enterprise", licensed: true }));

    await (await importFetchEntitlement())();

    expect(mockGet).toHaveBeenCalledWith("/safe/v1/capabilities", {
      skipErrorToast: true,
    });
  });

  it("原样带回档位、授权位与两份能力清单", async () => {
    mockGet.mockReturnValue(
      ok({
        capabilities: ["permobject"],
        edition: "enterprise",
        extensions: ["permobject", "audit"],
        features: ["audit"],
        licensed: true,
        limits: { max_users: -1 },
        state: "valid",
      }),
    );

    const entitlement = await (await importFetchEntitlement())();

    expect(entitlement).toEqual({
      capabilities: ["permobject"],
      edition: "enterprise",
      extensions: ["permobject", "audit"],
      features: ["audit"],
      licensed: true,
      limits: { max_users: -1 },
      state: "valid",
    });
  });

  // #638 之前的后端不吐 licensed。缺字段当无授权,而不是当有——少给,不错给。
  it("licensed 缺失或非布尔一律当 false", async () => {
    mockGet.mockReturnValue(ok({ edition: "enterprise", state: "valid" }));
    expect((await (await importFetchEntitlement())()).licensed).toBe(false);

    mockGet.mockReturnValue(ok({ edition: "enterprise", licensed: "yes" }));
    expect((await (await importFetchEntitlement())()).licensed).toBe(false);
  });

  // 后端可能先于前端加档位/状态取值,认不出来时按最低权限解释。
  it("认不出的档位与状态降到社区版 / unlicensed", async () => {
    mockGet.mockReturnValue(ok({ edition: "platinum", state: "renewing" }));

    const entitlement = await (await importFetchEntitlement())();

    expect(entitlement.edition).toBe("community");
    expect(entitlement.state).toBe("unlicensed");
  });

  /**
   * 失败必须抛,不能吞成社区版兜底:调用方(Provider)要把它落成 snapshot = null,
   * 也就是「未知」。吞成社区版会让企业客户的一次网络抖动被渲染成「你没买」,还配上
   * 一条升级引导。
   */
  it("接口挂了向上抛,由调用方落成未知", async () => {
    mockGet.mockRejectedValue(new Error("404"));

    await expect((await importFetchEntitlement())()).rejects.toThrow("404");
  });

  /**
   * ee-design.md §6.1 已写下 capabilities 的下一版形状(每项一个对象)。只认字符串会在
   * 后端换形状那天静默滤空——付费入口全消失且不报错。
   */
  it("capabilities 换成对象形状时照样取到 key", async () => {
    mockGet.mockReturnValue(
      ok({
        capabilities: [{ installed: true, key: "rbac_basic", licensed: true }],
        edition: "professional",
        extensions: [{ key: "rbac_basic" }, { key: "perm_object_level" }],
        licensed: true,
      }),
    );

    const entitlement = await (await importFetchEntitlement())();

    expect(entitlement.capabilities).toEqual(["rbac_basic"]);
    expect(entitlement.extensions).toEqual(["rbac_basic", "perm_object_level"]);
  });

  // mock 模式覆盖三态里的两态,本地开发才走得到升级引导那条路。
  it("mock 模式给出企业镜像 + 专业证,不发请求", async () => {
    const entitlement = await (await importFetchEntitlement("true"))();

    expect(mockGet).not.toHaveBeenCalled();
    expect(entitlement.capabilities).toEqual(["rbac_basic"]);
    expect(entitlement.extensions).toContain("perm_object_level");
  });
});
