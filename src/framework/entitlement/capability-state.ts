/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import type { CapabilityState, Entitlement } from "@/framework/entitlement/types";

/**
 * 判定一个能力在当前部署下的状态。纯函数,便于单测——门控判据不该只能通过渲染组件来验证。
 *
 * 两个列表交叉出三态,这是整套机制的地基:
 *
 *   在 capabilities                 → 能用
 *   在 extensions 不在 capabilities → 装了没买,可以卖
 *   两个都不在                       → 这个镜像没有它
 *
 * 后端特意分成两个列表就是为了让前端能做这个区分;只看 capabilities 会把「换镜像」和
 * 「买证书」两种处置混成一个「用不了」。
 */
export function capabilityState(
  capability: string,
  snapshot: Entitlement | null,
): CapabilityState {
  // null = 还没拿到快照(首屏加载中,或请求失败)。按不可用处理:显示一个点进去只会
  // 404 的入口,正是这个端点存在要防的事。但它与「已知不可用」必须分开——对着社区
  // 部署推销升级是更糟的错误。
  if (!snapshot) {
    return "unknown";
  }

  if (snapshot.capabilities.includes(capability)) {
    return "available";
  }

  return snapshot.extensions.includes(capability) ? "not-licensed" : "not-installed";
}

/** 能不能用。只有 available 算能用——unknown 一律按不能用,绝不 fail-open。 */
export function isCapabilityAvailable(
  capability: string,
  snapshot: Entitlement | null,
): boolean {
  return capabilityState(capability, snapshot) === "available";
}

/**
 * 该不该对这个能力出升级引导。
 *
 * 只有「装了没买」才是。没装(换镜像才能解决)出升级引导会让客户买了证书发现还是用不了;
 * unknown 出升级引导会对着社区部署推销。两种都是把商务信息放错地方。
 */
export function shouldOfferUpgrade(
  capability: string,
  snapshot: Entitlement | null,
): boolean {
  return capabilityState(capability, snapshot) === "not-licensed";
}
