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
    ).toEqual(["对象类行过滤", "对象类列过滤：隐藏、仅列名、脱敏", "行列权限变更审计"]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.perm_object_level.bullets),
    ).toEqual([
      "Row filtering on object types",
      "Column filtering: hide, names only, or mask",
      "Audit of row and column permission changes",
    ]);
  });
});

describe("subscription capability copy", () => {
  it("lists action modelling in the Professional capability copy", () => {
    expect(subscriptionZhCN.subscription.community.modelingTypes).toBe("对象与关系建模");
    expect(subscriptionEnUS.subscription.community.modelingTypes).toBe(
      "Object and relation modelling",
    );
    expect(subscriptionZhCN.subscription.capabilities.kn_action_modeling.name).toBe("行动建模");
    expect(subscriptionEnUS.subscription.capabilities.kn_action_modeling.name).toBe(
      "Action modelling",
    );
  });

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

  it("lists community sources and examples and describes Execution Factory as a paid capability", () => {
    const cardIds = COMMUNITY_CAPABILITIES.filter((entry) => entry.onCard).map((entry) => entry.id);
    expect(cardIds).toEqual(expect.arrayContaining(["commonSources", "oneClickExperience"]));
    expect(subscriptionZhCN.subscription.community.commonSources).toBe(
      "MySQL、PostgreSQL、MariaDB、OpenSearch",
    );
    expect(COMMUNITY_CAPABILITIES.map((entry) => entry.id)).not.toContain("executionFactory");
    expect(subscriptionZhCN.subscription.capabilities.execution_factory.name).toBe("执行工厂");
    expect(subscriptionEnUS.subscription.capabilities.execution_factory.name).toBe(
      "Execution Factory",
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

  it("lists Doris in Professional and SAP HANA in Enterprise without version labels", () => {
    expect(
      Object.values(subscriptionZhCN.subscription.capabilities.connector_certified.cardBullets),
    ).toEqual(["SQL Server", "Oracle", "Doris", "以 API 方式连接数据"]);
    expect(
      Object.values(subscriptionEnUS.subscription.capabilities.connector_certified.cardBullets),
    ).toEqual(["SQL Server", "Oracle", "Doris", "Data through APIs"]);
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
      expect(copy.description).toContain("Doris");
      expect(copy.description).not.toContain("0.2.0");
      expect(Object.values(copy.bullets).join(" ")).not.toContain("0.2.0");
    }
  });

  // 对象指标与项目管理都是专业档能力,社区版清单不该再提它们。
  it("keeps object metrics and project management off the Community list", () => {
    expect(subscriptionZhCN.subscription.community.modelingTypes).not.toContain("指标");
    expect(subscriptionEnUS.subscription.community.modelingTypes).not.toContain("metric");
    for (const text of Object.values(subscriptionZhCN.subscription.community)) {
      expect(text).not.toContain("项目");
    }
    expect(subscriptionZhCN.subscription.capabilities.bkn_project.name).toBe("项目管理");
  });

  // 2026-11-19 改名:专业档 perm_fine_grained 叫「对象授权」,企业档 perm_object_level 叫「行列级权限管控」。
  it("names Professional object authorization and Enterprise row- and column-level permission control", () => {
    expect(subscriptionZhCN.subscription.capabilities.perm_fine_grained.name).toBe("对象授权");
    expect(subscriptionZhCN.subscription.capabilities.perm_object_level.name).toBe(
      "行列级权限管控",
    );
    expect(subscriptionEnUS.subscription.capabilities.perm_fine_grained.name).toBe(
      "Object authorization",
    );
    expect(subscriptionEnUS.subscription.capabilities.perm_object_level.name).toBe(
      "Row- and column-level permission control",
    );
  });

  it("places drafts and running versions in the paid capability catalog", () => {
    expect(COMMUNITY_CAPABILITIES.some(({ id }) => id === "draftAndRunning")).toBe(false);
    expect(subscriptionZhCN.subscription.capabilities.kn_draft_versions.name).toBe(
      "知识网络草稿与运行版本",
    );
    expect(subscriptionEnUS.subscription.capabilities.kn_draft_versions.name).toBe(
      "Knowledge network drafts and running versions",
    );
    expect(Object.values(subscriptionZhCN.subscription.capabilities.version_mgmt.bullets)).toEqual([
      "多版本管理",
      "版本历史，按历史版本查询与执行",
      "版本比较与回退",
    ]);
    expect(Object.values(subscriptionEnUS.subscription.capabilities.version_mgmt.bullets)).toEqual([
      "Multiple versions",
      "Version history; query and run on a past version",
      "Version comparison and rollback",
    ]);
  });

  // 中文文案统一用全角标点;页头三句拼接时中文句号后不留空格。
  it("uses full-width punctuation in the Chinese copy", () => {
    const strings: string[] = [];
    const walk = (value: unknown) => {
      if (typeof value === "string") strings.push(value);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(subscriptionZhCN);
    for (const text of strings.filter((value) => /[\u4e00-\u9fff]/.test(value))) {
      expect(text).not.toMatch(/[\u4e00-\u9fff][,;:?()]|[,;:?()][\u4e00-\u9fff]/);
    }
    expect(subscriptionZhCN.subscription.current.edition).toBe("当前工作区运行在{{edition}}。");
  });

  // 应用工坊整体在企业档,方案推演、模型试算与执行行动仍写在它自己的卖点里,不另起一行。
  it("keeps scenarios, model trials and action execution in the Workshop copy", () => {
    expect(Object.values(subscriptionZhCN.subscription.capabilities.workshop.bullets)).toContain(
      "方案推演、模型试算与执行行动",
    );
    expect(subscriptionZhCN.subscription.capabilities).not.toHaveProperty("scenario");
    expect(subscriptionEnUS.subscription.capabilities).not.toHaveProperty("scenario");
  });
});
