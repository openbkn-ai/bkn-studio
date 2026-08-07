/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { CAPABILITIES } from "@/framework/entitlement/capabilities";
import type { Edition } from "@/framework/entitlement/edition";

/**
 * 能力登记表在产品内的快照。
 *
 * 单一真源是 license-server 的 `capabilities` 表(`store/capabilities.go` 的 seed,
 * 设计见 license-server `docs/design/capability-registry.md` §9)。这里是它的镜像,
 * **产品自带、不在运行时去拉**——决策 7:客户常常完全离线,而离线激活流程正是为拉不到
 * license-server 的客户存在的,那些客户同样拉不到名字。
 *
 * 只收对客户在售的行。`planned`(sso / explorer / multi_tenant / version_mgmt /
 * offline_bundle / bigdata_connect,以及上游 e8fdf2f 退回 planned 的 audit /
 * ops_dashboard / branding——EE 侧从未实现)一条都不进。`impact_graph` 同样不进:
 * 登记表里是 active,但这一版产品里没有,列出来就是在卖交付不了的东西——登记表管的是
 * 「在售能力集」,产品页管的是「这一版真有什么」,两者不一致时以后者为准。
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
  /**
   * 哪个服务实现它(取自 `ee-features.md` 的能力总账)。
   *
   * 决定这一项能不能显示实况:`/api/safe/v1/capabilities` 的 `capabilities[]` /
   * `extensions[]` 只反映 **bkn-safe 自己进程**的装配表。ee-design.md §6 开篇写死了这条
   * ——「集群里完全可能 bkn-safe 已换企业镜像、某个业务服务还是社区镜像……**A 答不了 B**」,
   * 而每服务的形态自述(B)延后未做。
   *
   * 所以别的服务的能力在这个端点里永远缺席,把它渲染成「当前镜像不含」是错误结论:真相是
   * 这个端点答不了。
   */
  servedBy: "bkn-safe" | "other";
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
  { category: "dataConnect", key: "source_sync",
    servedBy: "other", minEdition: "professional" },
  { category: "permission", key: CAPABILITIES.RBAC_BASIC,
    servedBy: "bkn-safe", minEdition: "professional" },
  {
    category: "dataConnect",
    key: "connector_certified",
    servedBy: "other",
    minEdition: "professional",
    sinceVersion: "0.1.3",
  },
  {
    // 上游 e8fdf2f 把它降到社区档:技术 Trace 免费,对外能力对比里 CLI/SDK 的 trace
    // 查询本来就列在社区行。留在表里是为了让对比矩阵显示「三档都有」,不是付费项。
    category: "observability",
    key: "bkn_trace",
    servedBy: "other",
    minEdition: "community",
    sinceVersion: "0.1.3",
  },
  {
    category: "semantic",
    key: "semantic_task",
    servedBy: "other",
    minEdition: "professional",
    sinceVersion: "0.1.3",
  },
  { category: "permission", key: CAPABILITIES.PERM_OBJECT_LEVEL,
    servedBy: "bkn-safe", minEdition: "enterprise" },
  {
    category: "observability",
    key: CAPABILITIES.BUSINESS_PROVENANCE,
    servedBy: "other",
    minEdition: "enterprise",
    sinceVersion: "0.1.3",
  },
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

/**
 * 某个能力的最低档位,用于给锁定入口标徽标(「专业版」/「企业版」)。
 *
 * **只用于展示。** 能不能用由服务端算好的 `capabilities[]` 决定,前端不比档位
 * (ee-design.md §3.2)。这里回答的是另一个问题:客户要买哪一档才能解锁它。
 */
export function capabilityMinEdition(key: string): Edition | null {
  return CAPABILITY_CATALOG.find((entry) => entry.key === key)?.minEdition ?? null;
}
