/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { filterNavByEdition } from "@/app/shell/console-navigation";
import type { ConsoleNavItem } from "@/app/shell/navigation/types";
import type { Entitlement } from "@/framework/entitlement/types";

const communityBuild: Entitlement = {
  capabilities: [],
  edition: "community",
  extensions: [],
  features: [],
  licensed: false,
  limits: {},
  state: "unlicensed",
};

const eeBuild = (edition: Entitlement["edition"]): Entitlement => ({
  capabilities: [],
  edition,
  extensions: ["permobject"],
  features: [],
  licensed: true,
  limits: {},
  state: "valid",
});

const items: ConsoleNavItem[] = [
  { key: "home", labelKey: "home", path: "/home" },
  { key: "audit", labelKey: "audit", minEdition: "enterprise", path: "/audit" },
  { key: "roles", labelKey: "roles", minEdition: "professional", path: "/roles" },
];

describe("filterNavByEdition", () => {
  it("leaves ungated items alone", () => {
    expect(filterNavByEdition(items, eeBuild("enterprise")).map((i) => i.key)).toEqual([
      "home",
      "audit",
      "roles",
    ]);
  });

  // 社区镜像里付费实现物理不存在,升级要换镜像而不是换证——画个锁只是噪音。
  it("hides gated items on a community build", () => {
    expect(filterNavByEdition(items, communityBuild).map((i) => i.key)).toEqual(["home"]);
  });

  // 企业镜像 + 专业版证:审计还买不到,但换张证就能用,入口留着做升级引导。
  it("locks rather than hides on an ee build", () => {
    const result = filterNavByEdition(items, eeBuild("professional"));

    expect(result.map((i) => i.key)).toEqual(["home", "audit", "roles"]);
    expect(result.find((i) => i.key === "audit")?.locked).toBe(true);
    // 档位够的项原样返回,不多挂一个 locked:false——没必要为它换一次对象引用。
    expect(result.find((i) => i.key === "roles")?.locked).toBeFalsy();
  });

  it("drops a group whose children are all gated away", () => {
    const grouped: ConsoleNavItem[] = [
      {
        children: [
          { key: "audit", labelKey: "audit", minEdition: "enterprise", path: "/audit" },
        ],
        key: "system",
        labelKey: "system",
      },
    ];

    expect(filterNavByEdition(grouped, communityBuild)).toEqual([]);
    expect(filterNavByEdition(grouped, eeBuild("community"))).toHaveLength(1);
  });
});
