/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CapabilityCategory } from "@/modules/subscription/capability-catalog";

/**
 * 社区版能力清单(展示用)。
 *
 * **刻意不进 `CAPABILITY_CATALOG`**:那份是 license-server 登记表的镜像,而登记表**不登记
 * 社区能力**——`ee-features.md` 写死了「Community 档不登记能力,社区证的 features 为空」,
 * 理由是将来若为门户展示而登记,会反过来改变存量社区证的内容。
 *
 * 所以这些条目没有 key、不参与任何门控、也不进「你的集群」那一列的实算:它们是产品自带的
 * 事实(这一版社区版就有这些),来源是对外版本说明里三档都打 ✓ 的那些行。
 *
 * 能力对比表少了它们会误导:整张表只剩付费项时,社区版那一列全是「—」,读起来像社区版
 * 什么都没有。
 */
export type CommunityCapability = {
  category: CapabilityCategory;
  /** i18n 后缀,文案在 `subscription.community.<id>`。 */
  id: string;
  /**
   * 是否上社区版卡片。卡片是选购视角,只放建模底座和权限基线——付费两档的卡片讲的
   * 正是权限模型怎么递进,社区卡不写清起点,后两张的「更细」就没有参照。完整清单在
   * 对比表里。
   */
  onCard?: boolean;
};

export const COMMUNITY_CAPABILITIES: CommunityCapability[] = [
  { category: "modeling", id: "modelingSurfaces", onCard: true },
  { category: "modeling", id: "modelingTypes", onCard: true },
  { category: "modeling", id: "queryAndSearch", onCard: true },
  { category: "dataConnect", id: "commonSources", onCard: true },
  { category: "dataConnect", id: "indexing" },
  { category: "semantic", id: "mcpTooling" },
  { category: "semantic", id: "actionSandbox" },
  // 权限基线,对应对外版本说明「权限能力矩阵」里三档都成立的那几行:内置角色 / 顶层资源
  // 整体授权 / 基础审计。矩阵社区列里的「只授顶层、固定权限包」是限制不是能力——这张表的
  // 社区行三档全勾,限制只能由付费行的「—」表达;把限制措辞写进来,会和紧挨着的「授权到
  // 子资源」并排自相矛盾。
  { category: "permission", id: "localAuth", onCard: true },
  { category: "permission", id: "topLevelGrants", onCard: true },
  { category: "permission", id: "basicAudit", onCard: true },
  { category: "observability", id: "cliTrace" },
  { category: "operations", id: "selfHosted" },
];

export function communityCapabilitiesByCategory(
  category: CapabilityCategory,
): CommunityCapability[] {
  return COMMUNITY_CAPABILITIES.filter((entry) => entry.category === category);
}
