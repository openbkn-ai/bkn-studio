/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FALLBACK_ENTITLEMENT } from "@/framework/entitlement/types";

const mockGet = vi.hoisted(() => vi.fn());

vi.mock("@/framework/request/http", () => ({
  http: { get: mockGet },
}));

async function importFetchEntitlement() {
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

  it("接口挂了退回社区版兜底,不抛给调用方", async () => {
    mockGet.mockRejectedValue(new Error("404"));

    await expect((await importFetchEntitlement())()).resolves.toEqual(
      FALLBACK_ENTITLEMENT,
    );
  });
});
