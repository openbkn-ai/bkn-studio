/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { describe, expect, it } from "vitest";

import { COMMUNITY_CAPABILITIES } from "../community-capabilities";

import { subscriptionEnUS } from "./en-US";
import { subscriptionZhCN } from "./zh-CN";

describe("subscription permission terminology", () => {
  it("describes row filtering and the supported column permission options", () => {
    expect(
      Object.values(subscriptionZhCN.subscription.capabilities.perm_object_level.bullets),
    ).toEqual([
      "对象类支持行过滤",
      "对象类支持列过滤（支持配置属性列不可见、仅属性名称、列掩码-内容脱敏）",
      "行列权限变更审计",
    ]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.perm_object_level.bullets),
    ).toEqual([
      "Object types support row filtering",
      "Object types support column filtering (hide property columns, show property names only, or use Column Masking to redact content)",
      "Audit of row and column permission changes",
    ]);
  });
});

describe("subscription capability copy", () => {
  it("describes semantic understanding for data resources", () => {
    expect(subscriptionZhCN.subscription.capabilities.semantic_task.name).toBe(
      "数据资源支持语义理解",
    );
    expect(subscriptionEnUS.subscription.capabilities.semantic_task.name).toBe(
      "Semantic understanding for data resources",
    );
  });

  it("shows derived and composite logical views on one line", () => {
    expect(subscriptionZhCN.subscription.capabilities.vega_logic_view.name).toBe(
      "逻辑视图：支持衍生视图和复合视图",
    );
    expect(subscriptionEnUS.subscription.capabilities.vega_logic_view.name).toBe(
      "Logical views: derived and composite views",
    );
  });

  it("shows common sources, Execution Factory and one-click examples on the Community card", () => {
    const cardIds = COMMUNITY_CAPABILITIES.filter((entry) => entry.onCard).map((entry) => entry.id);
    expect(cardIds).toEqual(
      expect.arrayContaining(["commonSources", "executionFactory", "oneClickExperience"]),
    );
    expect(subscriptionZhCN.subscription.community.commonSources).toBe(
      "MySQL、PostgreSQL、MariaDB、Opensearch 作为数据源接入",
    );
    expect(subscriptionZhCN.subscription.community.executionFactory).toBe(
      "执行工厂可接入 OpenAPI、MCP、 SKILL 与函数",
    );
    expect(subscriptionZhCN.subscription.community.oneClickExperience).toBe(
      "支持一键体验，动态加载官方样例",
    );
  });

  it("lists timeline and evidence chain without execution chain", () => {
    expect(
      Object.values(subscriptionZhCN.subscription.capabilities.business_provenance.bullets),
    ).toEqual(["时间链", "证据链"]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.business_provenance.bullets),
    ).toEqual(["Timeline", "Evidence chain"]);
  });

  it("lists Oracle in Professional and SAP HANA in Enterprise without version labels", () => {
    expect(
      Object.values(subscriptionZhCN.subscription.capabilities.connector_certified.cardBullets),
    ).toEqual(["SQL Server", "Oracle"]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.connector_certified.cardBullets),
    ).toEqual(["SQL Server", "Oracle"]);
    expect(subscriptionZhCN.subscription.capabilities.connector_certified.name).toBe(
      "高级数据连接",
    );
    expect(subscriptionZhCN.subscription.plans.enterprise.hanaConnector).toBe("SAP HANA");
    expect(subscriptionEnUS.subscription.capabilities.connector_certified.name).toBe(
      "Advanced data connectivity",
    );
    expect(subscriptionEnUS.subscription.plans.enterprise.hanaConnector).toBe("SAP HANA");
    for (const copy of [
      subscriptionZhCN.subscription.capabilities.connector_certified,
      subscriptionEnUS.subscription.capabilities.connector_certified,
    ]) {
      expect(copy.description).not.toContain("0.2.0");
      expect(Object.values(copy.bullets).join(" ")).not.toContain("0.2.0");
    }
  });
});
