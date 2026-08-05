/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { EntitlementStatus } from "@/framework/entitlement/entitlement-context";
import type { Entitlement } from "@/framework/entitlement/types";

/**
 * 单个能力在**这个集群**上的下场。两个列表交叉出三态,这是整页的地基:
 *
 * | 在哪 | 含义 | 客户要做什么 |
 * |---|---|---|
 * | `capabilities[]` | 能用 | — |
 * | 只在 `extensions[]` | 装了没买 | 换证书 |
 * | 两个都不在 | 没装 | 换镜像 |
 *
 * 后端刻意把「证里有什么」和「这个二进制装了什么」分成两个字段,就是为了让支持人员
 * 分得清「证不对」和「镜像不对」。合成一个列表会把这个区分丢掉。
 */
export type ClusterCapabilityStatus =
  | "available"
  | "not-installed"
  | "not-licensed"
  | "unknown";

export function clusterCapabilityStatus(
  key: string,
  entitlement: Entitlement,
  status: EntitlementStatus,
): ClusterCapabilityStatus {
  // 快照还没到:不可用与未知必须分开,否则会对着一个其实买了的客户显示「未安装」。
  if (status === "loading") {
    return "unknown";
  }

  if (entitlement.capabilities.includes(key)) {
    return "available";
  }

  return entitlement.extensions.includes(key) ? "not-licensed" : "not-installed";
}
