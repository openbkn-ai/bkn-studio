/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Edition } from "@/framework/entitlement/edition";

/**
 * 能力登记表在产品内的快照。
 *
 * 单一真源是 license-server 的 `capabilities` 表(`store/capabilities.go` 的 seed,
 * 设计见 license-server `docs/design/capability-registry.md` §9)。这里是它的镜像,
 * **产品自带、不在运行时去拉**——决策 7:客户常常完全离线,而离线激活流程正是为拉不到
 * license-server 的客户存在的,那些客户同样拉不到名字。
 *
 * 只收 `status = active` 的行。`planned`(sso / explorer / multi_tenant /
 * version_mgmt / offline_bundle / bigdata_connect / business_provenance)一条都不进:
 * 登记表里它们存在是为了让路线图落在表里而不是散文里,对客户不可见——写进版本对比页
 * 就是在卖还没有的东西。
 *
 * `key` 与 `minEdition` 在登记表里创建后不可改(改 key 会让存量证的那一项失去对应,
 * 改 minEdition 等于静默改动合同范围),所以这份快照对齐它们即可,名称与描述走 i18n。
 */
export type CapabilityCategory =
  | "dataConnect"
  | "observability"
  | "operations"
  | "permission"
  | "semantic";

export type CapabilityCatalogEntry = {
  category: CapabilityCategory;
  /** 登记表主键,同时是证书 `features[]` 里的拼写,也是后端装配表 `MarkAssembled` 的名字。 */
  key: string;
  minEdition: Edition;
  /** 首次可签发的产品版本。有值时列表里标「新增」。 */
  sinceVersion?: string;
};

/** 分组展示顺序。与登记表的 `sort_order` 同序:先专业档,后企业档。 */
export const CAPABILITY_CATEGORIES: CapabilityCategory[] = [
  "dataConnect",
  "permission",
  "semantic",
  "observability",
  "operations",
];

export const CAPABILITY_CATALOG: CapabilityCatalogEntry[] = [
  { category: "dataConnect", key: "source_sync", minEdition: "professional" },
  { category: "permission", key: "rbac_basic", minEdition: "professional" },
  {
    category: "semantic",
    key: "impact_graph",
    minEdition: "professional",
    sinceVersion: "0.1.2",
  },
  {
    category: "dataConnect",
    key: "connector_certified",
    minEdition: "professional",
    sinceVersion: "0.1.3",
  },
  {
    category: "observability",
    key: "bkn_trace",
    minEdition: "professional",
    sinceVersion: "0.1.3",
  },
  {
    category: "semantic",
    key: "semantic_task",
    minEdition: "professional",
    sinceVersion: "0.1.3",
  },
  { category: "permission", key: "perm_object_level", minEdition: "enterprise" },
  { category: "operations", key: "audit", minEdition: "enterprise" },
  { category: "operations", key: "ops_dashboard", minEdition: "enterprise" },
  { category: "operations", key: "branding", minEdition: "enterprise" },
];

/** 某一档**新增**的能力(不含从低档继承的)。用于版本卡片列出「这一档多了什么」。 */
export function capabilitiesIntroducedBy(edition: Edition): CapabilityCatalogEntry[] {
  return CAPABILITY_CATALOG.filter((entry) => entry.minEdition === edition);
}

export function capabilitiesByCategory(
  category: CapabilityCategory,
): CapabilityCatalogEntry[] {
  return CAPABILITY_CATALOG.filter((entry) => entry.category === category);
}
