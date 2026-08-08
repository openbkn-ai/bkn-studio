/**
 * Copyright (c) 2026 OpenBKN
 * SPDX-License-Identifier: LicenseRef-OpenBKN
 * Licensed under the OpenBKN License, a modified Apache 2.0 with Additional
 * Conditions. See LICENSE for the full text.
 */

import { capabilityState } from "@/framework/entitlement/capability-state";
import { atLeast, type Edition } from "@/framework/entitlement/edition";
import type { EntitlementView } from "@/framework/entitlement/types";

/**
 * 升级引导该说哪句话。
 *
 * 三种部署组合对应三种处置,弹窗说错等于把人指到错的地方:
 *
 * | 证书 | 镜像 | reason | 客户要做什么 |
 * |---|---|---|---|
 * | 档位不够 | 任意 | `buy` | 买/换证书 |
 * | 档位够 | 社区版 | `image` | 升级镜像(bkn-safe 的能力能确定判出) |
 * | 档位够 | 未知 | `image-likely` | 多半是别的服务的镜像还没升(判不了,给方向) |
 * | 档位够 | 企业版 | — | 能用,根本不会弹这个窗 |
 */
export type UpgradeReason = "buy" | "image" | "image-likely";

export function upgradeReason(
  capability: string,
  snapshot: EntitlementView | null,
  minEdition: Edition,
  servedByBknSafe: boolean,
): UpgradeReason {
  // 快照没到就按「还没买」说——不能凭空断言客户的证书已经够了。
  if (!snapshot || !atLeast(snapshot.edition, minEdition)) {
    return "buy";
  }

  // bkn-safe 自己的能力:extensions[] 是它这个进程的装配表,缺席即确定没装。
  if (servedByBknSafe) {
    return capabilityState(capability, snapshot) === "not-installed" ? "image" : "buy";
  }

  // 别的服务的能力从来不出现在这两个列表里,缺席说明不了任何事(ee-design.md §6
  // 「A 答不了 B」)。档位够却仍走到这里,最可能是那个服务的镜像没升——只能给方向。
  return "image-likely";
}

/**
 * 这项能力在当前部署上是不是**真的可用**。徽标与整页守卫据此放行。
 *
 * 判据按「能核实到什么程度」分两档:
 *
 * - **bkn-safe 自己实现的**:`capabilities[]` 就是它这个进程的实况,证够了还得在册才算数。
 * - **别的服务实现的**:它们从来不出现在这两个列表里,缺席说明不了任何事(ee-design.md
 *   §6「A 答不了 B」)。这时以证书为准——买了企业版证、也换了企业版包的客户,前端永远
 *   核实不了那个包,拿「核实不了」当「没装」就是把已付费能力锁死在门外。
 *
 * 少数几个「档位够但确实用不了」的位置有更强的信号(比如连接器有后端给的 `enabled`),
 * 由调用点自己判,不该让所有人陪着一起被拦。
 */
export function capabilitySatisfied(
  capability: string,
  snapshot: EntitlementView | null,
  minEdition: Edition,
  servedByBknSafe: boolean,
): boolean {
  if (!snapshot || !atLeast(snapshot.edition, minEdition)) {
    return false;
  }

  return servedByBknSafe ? capabilityState(capability, snapshot) === "available" : true;
}
