/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  capabilityState,
  isCapabilityAvailable,
  shouldOfferUpgrade,
} from "@/framework/entitlement/capability-state";
import type { Entitlement } from "@/framework/entitlement/types";

function snapshot(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    features: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

describe("capabilityState", () => {
  // 客户能处在的四种部署，以及每种下客户该做什么。这张表就是这个函数存在的理由。
  it.each([
    {
      name: "社区镜像：这段代码根本不在二进制里",
      snap: snapshot(),
      want: "not-installed" as const,
    },
    {
      name: "企业镜像无证：装了，没买",
      snap: snapshot({ extensions: ["rbac_basic", "perm_object_level"] }),
      want: "not-licensed" as const,
    },
    {
      name: "企业镜像专业证：买了这一个",
      snap: snapshot({
        capabilities: ["rbac_basic"],
        edition: "professional",
        extensions: ["rbac_basic", "perm_object_level"],
        licensed: true,
        state: "valid",
      }),
      want: "available" as const,
    },
    {
      name: "还没拿到快照",
      snap: null,
      want: "unknown" as const,
    },
  ])("$name", ({ snap, want }) => {
    expect(capabilityState("rbac_basic", snap)).toBe(want);
  });

  // 企业档买了，专业档能力当然也归它——档位是最低值，不是相等匹配。后端用
  // AtLeast 已经算好了，前端只要不自作聪明地再判一次 edition 就行。
  it("企业证下专业档能力照样在 capabilities 里", () => {
    const snap = snapshot({
      capabilities: ["rbac_basic", "perm_object_level"],
      edition: "enterprise",
      extensions: ["rbac_basic", "perm_object_level"],
      licensed: true,
      state: "valid",
    });
    expect(capabilityState("rbac_basic", snap)).toBe("available");
    expect(capabilityState("perm_object_level", snap)).toBe("available");
  });

  // 证书带着的 feature key 不构成任何授权。社区镜像配一张专业证是真实存在的部署
  // （分批升级时必然出现），那时 features 里有 rbac_basic 而镜像里没有那段代码。
  // 按 features 判就会显示一个点进去 404 的入口——这正是 ee-design.md §3.2 禁止
  // 读 features 的原因。
  it("features 里有但 extensions 里没有，仍然是没装", () => {
    const snap = snapshot({
      edition: "professional",
      features: ["rbac_basic", "source_sync"],
      licensed: true,
      state: "valid",
    });
    expect(capabilityState("rbac_basic", snap)).toBe("not-installed");
    expect(isCapabilityAvailable("rbac_basic", snap)).toBe(false);
  });
});

describe("isCapabilityAvailable", () => {
  // 拿不到快照时放行，等于把付费能力白送给任何能让这个请求失败的人。
  it("unknown 一律不可用，绝不 fail-open", () => {
    expect(isCapabilityAvailable("rbac_basic", null)).toBe(false);
  });

  it("装了没买也不可用", () => {
    expect(
      isCapabilityAvailable("rbac_basic", snapshot({ extensions: ["rbac_basic"] })),
    ).toBe(false);
  });
});

describe("shouldOfferUpgrade", () => {
  it("只有装了没买才出升级引导", () => {
    expect(
      shouldOfferUpgrade("rbac_basic", snapshot({ extensions: ["rbac_basic"] })),
    ).toBe(true);
  });

  // 买了证书也用不了，因为镜像里压根没这段代码——这种引导是在卖一个解决不了问题
  // 的东西。
  it("没装不出升级引导", () => {
    expect(shouldOfferUpgrade("rbac_basic", snapshot())).toBe(false);
  });

  // 社区部署首屏就会短暂处于 unknown。这时弹升级提示是对着不该被推销的人推销。
  it("未知不出升级引导", () => {
    expect(shouldOfferUpgrade("rbac_basic", null)).toBe(false);
  });
});
