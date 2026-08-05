/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { Edition } from "@/framework/entitlement/edition";

/**
 * 版本方案。数字取自 license-server `docs/design/license-service.md` §1.5 与
 * `architecture.md` §5,不是本页自造的:
 *
 * - 专业版 ¥49,800 / **项目** / 年。授权粒度是项目,一个项目一张 license——按席位
 *   报价会让客户按人头算账,和合同口径对不上
 * - 专业版默认 `max_users: 100`、`max_nodes: 5`;企业版 `-1`(不限)
 * - 行业版不单独出卡:有序档位下 `AtLeast(enterprise)` 对它恒真,合同**砍不掉**任何
 *   企业能力,只能加 `limits` 与行业专有能力。没有可列举的清单,列一张卡只能编
 */
export type SubscriptionPlan = {
  edition: Edition;
  /** 突出显示(设计稿里专业版那张)。 */
  featured?: boolean;
  /** 默认配额。`null` = 不限,`undefined` = 该档不设此项。 */
  limits?: { maxNodes: number | null; maxUsers: number | null };
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { edition: "community" },
  {
    edition: "professional",
    featured: true,
    limits: { maxNodes: 5, maxUsers: 100 },
  },
  { edition: "enterprise", limits: { maxNodes: null, maxUsers: null } },
];
