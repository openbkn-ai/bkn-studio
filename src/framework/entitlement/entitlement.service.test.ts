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
async function importFetchEntitlement(useMock: "false" | "true" = "false", mockEdition = "") {
  vi.stubEnv("VITE_USE_MOCK", useMock);
  vi.stubEnv("VITE_MOCK_EDITION", mockEdition);
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

    await (
      await importFetchEntitlement()
    )();

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

  it("mock 模式默认给出社区镜像快照,不发请求", async () => {
    const entitlement = await (await importFetchEntitlement("true"))();

    expect(mockGet).not.toHaveBeenCalled();
    expect(entitlement).toEqual({
      capabilities: [],
      edition: "community",
      extensions: [],
      features: [],
      licensed: false,
      limits: {},
      state: "fallback_community",
    });
  });

  it("mock 模式按 VITE_MOCK_EDITION 生成对应档位的快照", async () => {
    const professional = await (await importFetchEntitlement("true", "professional"))();
    expect(professional).toEqual({
      capabilities: ["rbac_basic", "perm_fine_grained", "graph_explorer"],
      edition: "professional",
      extensions: ["rbac_basic", "perm_fine_grained", "graph_explorer", "perm_object_level"],
      features: [
        "rbac_basic",
        "perm_fine_grained",
        "graph_explorer",
        "perm_object_level",
        "source_sync",
      ],
      licensed: true,
      limits: { max_users: 100 },
      state: "valid",
    });

    const enterprise = await (await importFetchEntitlement("true", "enterprise"))();
    expect(enterprise).toEqual({
      capabilities: ["rbac_basic", "perm_fine_grained", "graph_explorer", "perm_object_level"],
      edition: "enterprise",
      extensions: ["rbac_basic", "perm_fine_grained", "graph_explorer", "perm_object_level"],
      features: [
        "rbac_basic",
        "perm_fine_grained",
        "graph_explorer",
        "perm_object_level",
        "source_sync",
      ],
      licensed: true,
      limits: { max_users: 1000 },
      state: "valid",
    });

    const industry = await (await importFetchEntitlement("true", "industry"))();
    expect(industry).toEqual({
      capabilities: ["rbac_basic", "perm_fine_grained", "graph_explorer", "perm_object_level"],
      edition: "industry",
      extensions: ["rbac_basic", "perm_fine_grained", "graph_explorer", "perm_object_level"],
      features: [
        "rbac_basic",
        "perm_fine_grained",
        "graph_explorer",
        "perm_object_level",
        "source_sync",
      ],
      licensed: true,
      limits: { max_users: -1 },
      state: "valid",
    });

    const invalid = await (await importFetchEntitlement("true", "platinum"))();
    expect(invalid).toEqual({
      capabilities: [],
      edition: "community",
      extensions: [],
      features: [],
      licensed: false,
      limits: {},
      state: "fallback_community",
    });
  });
});
