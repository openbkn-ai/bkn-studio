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

  // Community builds keep the licence entry; real knowledge base routes stay extension-gated.
  it("knowledge base entry stays visible as a licence offer in community builds", () => {
    const kb =
      consoleNavigation
        .find((item) => item.key === "general-business-knowledge-network")
        ?.children?.filter((child) => child.key === "knowledge-base") ?? [];
    expect(kb).toHaveLength(1);

    expect(filterNavByCapability(kb, snapshot()).map((item) => item.key)).toEqual([
      "knowledge-base",
    ]);

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

  // The community route provides licence guidance even without an entitlement snapshot.
  it("knowledge base has a community fallback independently of extension installation", () => {
    const group = consoleNavigation.filter(
      (item) => item.key === "general-business-knowledge-network",
    );
    const childKeys = (items: typeof group) => (items[0]?.children ?? []).map((child) => child.key);

    expect(childKeys(filterNavByInstalledPages(group))).toContain("knowledge-base");
    expect(childKeys(filterNavByInstalledPages(group, () => true))).toContain("knowledge-base");
    // Unknown snapshots still expose the community licence route.
    expect(childKeys(filterNavByCapability(filterNavByInstalledPages(group), null))).toContain(
      "knowledge-base",
    );
  });
  // Workshop is a top-level entry whose pages are in the enterprise image.
  it("Workshop 入口:构建里没有扩展就隐藏,与授权快照无关", () => {
    const keys = (items: ConsoleNavItem[]) => items.map((item) => item.key);

    expect(keys(filterNavByInstalledPages(consoleNavigation))).not.toContain("workshop");
    expect(keys(filterNavByInstalledPages(consoleNavigation, () => true))).toContain("workshop");
    // Even a licence that grants Workshop does not bring the entry back into a build without it.
    const licensed = snapshot({
      capabilities: [CAPABILITIES.WORKSHOP],
      edition: "professional",
      extensions: [CAPABILITIES.WORKSHOP],
      licensed: true,
      state: "valid",
    });
    expect(
      keys(filterNavByCapability(filterNavByInstalledPages(consoleNavigation), licensed)),
    ).not.toContain("workshop");
    expect(
      keys(
        filterNavByCapability(
          filterNavByInstalledPages(consoleNavigation, () => true),
          licensed,
        ),
      ),
    ).toContain("workshop");
  });

  // Installed but not licensed: the entry stays and names the edition that unlocks it.
  it("Workshop 入口:装了没买 → 保留并标出专业版", () => {
    const workshop = consoleNavigation.filter((item) => item.key === "workshop");
    const result = filterNavByCapability(
      workshop,
      snapshot({ extensions: [CAPABILITIES.WORKSHOP], licensed: true, state: "valid" }),
    );

    expect(result.map((item) => item.key)).toEqual(["workshop"]);
    expect(result[0]?.locked).toBe(true);
    expect(result[0]?.lockedEdition).toBe("professional");
  });

  // Workshop answers to its own key, the one bkn-safe-ee checks, not the graph explorer's.
  it("Workshop 入口:按 workshop 能力判,不看图探索", () => {
    const workshop = consoleNavigation.filter((item) => item.key === "workshop");
    const installed = [CAPABILITIES.GRAPH_EXPLORER, CAPABILITIES.WORKSHOP];
    const view = (capabilities: string[]) =>
      filterNavByCapability(
        workshop,
        snapshot({ capabilities, extensions: installed, licensed: true, state: "valid" }),
      );

    expect(view([CAPABILITIES.GRAPH_EXPLORER])[0]?.locked).toBe(true);
    expect(view([CAPABILITIES.WORKSHOP])[0]?.locked).toBeUndefined();
  });
});
