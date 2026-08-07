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

/**
 * 某项配额的显示值:当前档位读证书里的真值,其余档位用产品自带的默认值。
 *
 * 三条约定,都来自 ee-design.md §3.0 / §3.5:
 *
 * - `-1` = 不限
 * - **缺失 ≠ 0**。证书约定「缺失 = 0(不允许)」,但那是**判定**语义;这里是展示,
 *   没写就退回默认值。把「这张证没写这项」显示成「一个都不给」方向正好反了,而
 *   §3.5 明确记着产品侧今天根本没有配额判定,显示成 0 只会凭空吓人
 * - 合同可以覆盖默认值(行业版尤其如此,§3.3 说定制只能落在 limits 上),所以当前
 *   档位必须以证书为准
 */
export function resolveQuota(
  fallback: number | null,
  licensed: number | undefined,
): number | null {
  const value = licensed ?? fallback;

  return value === -1 ? null : value;
}
