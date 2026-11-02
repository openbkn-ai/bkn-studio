/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import {
  consoleNavigation,
  filterNavByCapability,
  filterNavByInstalledPages,
} from "@/app/shell/console-navigation";
import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { EntitlementView } from "@/framework/entitlement/types";

const items: ConsoleNavItem[] = [
  { key: "users", labelKey: "users", path: "/system/users" },
  {
    capability: CAPABILITIES.PERM_OBJECT_LEVEL,
    key: "authorizations",
    labelKey: "authorizations",
    path: "/system/authorizations",
  },
];

function snapshot(overrides: Partial<EntitlementView> = {}): EntitlementView {
  return {
    capabilities: [],
    edition: "community",
    extensions: [],
    licensed: false,
    limits: {},
    state: "unlicensed",
    ...overrides,
  };
}

describe("filterNavByCapability", () => {
  it("能用的入口原样通过,不打 locked", () => {
    const result = filterNavByCapability(
      items,
      snapshot({
        capabilities: [CAPABILITIES.PERM_OBJECT_LEVEL],
        edition: "enterprise",
        extensions: [CAPABILITIES.PERM_OBJECT_LEVEL],
        licensed: true,
        state: "valid",
      }),
    );

    expect(result.map((i) => i.key)).toEqual(["users", "authorizations"]);
    expect(result[1]?.locked).toBeFalsy();
  });

  // 装了没买:换一张证就能用,入口留着并标出要哪一档——这是唯一该出商务信息的状态。
  it("装了没买 → 保留并标出解锁档位", () => {
    const result = filterNavByCapability(
      items,
      snapshot({
        edition: "professional",
        extensions: [CAPABILITIES.PERM_OBJECT_LEVEL],
        licensed: true,
        state: "valid",
      }),
    );

    expect(result.map((i) => i.key)).toEqual(["users", "authorizations"]);
    expect(result[1]?.locked).toBe(true);
    expect(result[1]?.lockedEdition).toBe("enterprise");
  });

  // 社区镜像:付费实现物理不在这个二进制里,画徽标等于指一条换证书走不通的路。
  it("没装 → 隐藏", () => {
    const result = filterNavByCapability(items, snapshot());

    expect(result.map((i) => i.key)).toEqual(["users"]);
  });

  /*
    快照缺席可能是端点不存在(旧版 bkn-safe、网关没放行),不是「没装」。按没装隐藏会让
    只升 studio 的存量部署整项丢入口,还查不出原因。原样放行,由页面上的 RequireCapability
    交代未知态;推销信息一律不给——可能对面就是社区部署。
  */
  it("快照未到 → 原样放行,且不标档位", () => {
    const result = filterNavByCapability(items, null);

    expect(result.map((i) => i.key)).toEqual(["users", "authorizations"]);
    expect(result[1]?.locked).toBeUndefined();
    expect(result[1]?.lockedEdition).toBeUndefined();
  });

  // 知识库页面只在企业版前端镜像里:社区镜像报不出能力,入口必须隐藏,不能指向一个不存在的路由。
  it("知识库入口:没装隐藏,装了且授权则显示", () => {
    const kb =
      consoleNavigation
        .find((item) => item.key === "general-business-knowledge-network")
        ?.children?.filter((child) => child.key === "knowledge-base") ?? [];
    expect(kb).toHaveLength(1);

    expect(filterNavByCapability(kb, snapshot())).toEqual([]);

    const available = filterNavByCapability(
      kb,
      snapshot({
        capabilities: [CAPABILITIES.KNOWLEDGE_BASE],
        edition: "professional",
        extensions: [CAPABILITIES.KNOWLEDGE_BASE],
        licensed: true,
        state: "valid",
      }),
    );
    expect(available.map((i) => i.key)).toEqual(["knowledge-base"]);
    expect(available[0]?.locked).toBeFalsy();
  });

  // 页面不在本仓的入口:社区构建在授权快照到位前(或取不到时)也不能露出一个 404 入口。
  it("知识库入口:构建里没有扩展就隐藏,与授权快照无关", () => {
    const group = consoleNavigation.filter(
      (item) => item.key === "general-business-knowledge-network",
    );
    const childKeys = (items: typeof group) => (items[0]?.children ?? []).map((child) => child.key);

    expect(childKeys(filterNavByInstalledPages(group))).not.toContain("knowledge-base");
    expect(childKeys(filterNavByInstalledPages(group, () => true))).toContain("knowledge-base");
    // Snapshot not loaded yet: capability filtering passes items through, so the build check is what hides it.
    expect(childKeys(filterNavByCapability(filterNavByInstalledPages(group), null))).not.toContain(
      "knowledge-base",
    );
  });
  // Workshop is a top-level entry whose pages are in the enterprise image.
  it("Workshop 入口:构建里没有扩展就隐藏,与授权快照无关", () => {
    const keys = (items: ConsoleNavItem[]) => items.map((item) => item.key);

    expect(keys(filterNavByInstalledPages(consoleNavigation))).not.toContain("workshop");
    expect(keys(filterNavByInstalledPages(consoleNavigation, () => true))).toContain("workshop");
    expect(
      keys(filterNavByCapability(filterNavByInstalledPages(consoleNavigation), null)),
    ).not.toContain("workshop");
  });
});
