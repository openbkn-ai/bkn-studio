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
};

export const COMMUNITY_CAPABILITIES: CommunityCapability[] = [
  { category: "modeling", id: "modelingSurfaces" },
  { category: "modeling", id: "modelingTypes" },
  { category: "modeling", id: "queryAndSearch" },
  { category: "dataConnect", id: "commonSources" },
  { category: "dataConnect", id: "indexing" },
  { category: "semantic", id: "mcpTooling" },
  { category: "semantic", id: "actionSandbox" },
  { category: "permission", id: "localAuth" },
  { category: "observability", id: "cliTrace" },
  { category: "operations", id: "selfHosted" },
];

export function communityCapabilitiesByCategory(
  category: CapabilityCategory,
): CommunityCapability[] {
  return COMMUNITY_CAPABILITIES.filter((entry) => entry.category === category);
}
